# -*- coding: utf-8 -*-
# find_targets gegen die Grundmessung (punkt1_result.json) halten: schlaegt der Algorithmus Ziele
# vor, die vor der Invalidierung auch erreicht wurden?
#
# Aufgerufen wird der ECHTE deployte Algorithmus ueber den trading-monitor-MCP (HTTP), nicht eine
# Python-Nachbildung -- eine Nachbildung wuerde den Kandidaten-Pool (M5 live + HTF aus der DB,
# touched-Nachpruefung, Dedup) zwangslaeufig anders treffen als die Produktion.
#
# Basis JEDER Distanz ist die nahe OB-Kante (ob_bottom bei Short, ob_top bei Long) -- dieselbe
# Referenz, an der punkt1_result.json die Reichweite misst. Ein Kandidat gilt als erreicht, wenn
# reichweite >= distanz. Die Rangfolge bleibt wie geliefert (find_targets sortiert nach Distanz
# zum aktuellen Preis), nur die Distanz wird auf die OB-Kante umgerechnet.
#
# Ohne Argument wertet das Skript die abgelegte Rohdatei aus; mit "sammeln" holt es sie neu
# (ca. 7 Minuten, 255 sequentielle MCP-Aufrufe -- die cTrader-Verbindung haengt an einem einzigen
# OAuth-Token, parallel braeuchte das hier niemand). Dafuer muss TRADING_MONITOR_MCP_TOKEN gesetzt
# sein, und SETUPS/CANDLES muessen auf die gezogenen MCP-Ergebnisse zeigen (siehe README).
import json, sys, os, time, gzip, random, bisect, datetime, statistics, urllib.request
from drMerkmale import lade_setups

ROH = "find-targets-roh.jsonl.gz"
MCP_URL = "https://vkphwtqcvqrkphksproj.supabase.co/functions/v1/trading-monitor-mcp"
from drMerkmale import lade_kerzen, PIP, ARM, HORIZON
BERLIN = 2 * 3600  # CEST im gesamten Messzeitraum 15.07.-16.09.2026, wie filterAlterUndHandelszeit.py

ts = lambda s: int(datetime.datetime.fromisoformat(s).timestamp())
utc_dt = lambda sec: datetime.datetime.fromtimestamp(sec, datetime.timezone.utc)
med = lambda v: statistics.median(v) if v else float("nan")


def mcp(name, args, _id=[0]):
    _id[0] += 1
    body = json.dumps({"jsonrpc": "2.0", "id": _id[0], "method": "tools/call",
                       "params": {"name": name, "arguments": args}}).encode()
    req = urllib.request.Request(MCP_URL, data=body, headers={
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream",
        "Authorization": "Bearer " + os.environ["TRADING_MONITOR_MCP_TOKEN"]})
    with urllib.request.urlopen(req, timeout=180) as r:
        raw = r.read().decode()
    if raw.lstrip().startswith(("event:", "data:")):
        raw = "".join(l[5:].strip() for l in raw.splitlines() if l.startswith("data:"))
    msg = json.loads(raw)
    if "error" in msg:
        raise RuntimeError(msg["error"])
    return json.loads(msg["result"]["content"][0]["text"])


def drs_laden():
    """Je gemessener DR: Startzeitpunkt, nahe OB-Kante, Reichweite (normal + strikt), Risiko."""
    setups = {r["id"]: r for r in lade_setups()}
    cnd, times = lade_kerzen()
    out = []
    for x in json.load(open("punkt1_result.json")):
        r = setups[x["id"]]
        ref = r["ob_bottom"] if x["dir"] == "short" else r["ob_top"]
        start = ts(r["ob_start_time"]) + ARM
        # Zweite Reichweiten-Variante: die Kerze, die die Invalidierung trifft, zaehlt NICHT mehr
        # mit. Die Grundmessung nimmt ihren Docht noch auf, trade_setup_outcomes wertet denselben
        # Fall als Verlust -- die Gegenprobe zeigt, wie gross der Unterschied ueberhaupt ist.
        i, strikt = bisect.bisect_left(times, start), 0.0
        while i < len(cnd) and cnd[i]["time"] <= start + HORIZON:
            k = cnd[i]
            if (k["high"] >= r["fractal_price"]) if x["dir"] == "short" else (k["low"] <= r["fractal_price"]):
                break
            fav = (ref - k["low"]) if x["dir"] == "short" else (k["high"] - ref)
            strikt = max(strikt, fav / PIP)
            i += 1
        out.append(dict(x, start=start, ref=ref, reach_strikt=strikt,
                        stunde=utc_dt(ts(r["ob_start_time"]) + BERLIN).hour))
    out.sort(key=lambda d: d["start"])
    return out


def sammeln(drs):
    roh = {}
    if os.path.exists(ROH):
        roh = {json.loads(l)["id"]: json.loads(l)["res"] for l in gzip.open(ROH, "rt")}
    for n, d in enumerate(drs, 1):
        if d["id"] not in roh:
            roh[d["id"]] = mcp("find_targets", {"instrument": "GBPUSD", "direction": d["dir"],
                                                "replayUntilSec": d["start"]})
            time.sleep(0.2)
        if n % 25 == 0:
            print("%d/%d" % (n, len(drs)), flush=True)
    with gzip.open(ROH, "wt") as f:
        for i, res in roh.items():
            f.write(json.dumps({"id": i, "res": res}) + "\n")
    return roh


def roh_laden():
    """Die abgelegten find_targets-Antworten, id -> Antwort."""
    return {json.loads(l)["id"]: json.loads(l)["res"] for l in gzip.open(ROH, "rt")}


def kandidaten(d, res):
    """Die gelieferten Kandidaten auf die OB-Kante umgerechnet."""
    sign = -1 if d["dir"] == "short" else 1
    ks = []
    for art, feld, liste in (("LQ", "price", res["liquidityCandidates"]),
                             ("OB", "targetPrice", res["obCandidates"])):
        for rang, c in enumerate(liste, 1):
            dist = sign * (c[feld] - d["ref"]) / PIP
            ks.append(dict(art=art, rang=rang, tf=c["timeframe"], dist=dist, toofar=c["tooFar"],
                           rr=dist / d["risk"] if d["risk"] > 0 else float("nan"),
                           erreicht=d["reach"] >= dist, erreicht_strikt=d["reach_strikt"] >= dist))
    return ks


# --- Auswahlregeln ---------------------------------------------------------------------------
nahster = lambda ks: min(ks, key=lambda k: k["dist"]) if ks else None
erster_ab = lambda x: (lambda ks: next((k for k in sorted(ks, key=lambda k: k["dist"]) if k["dist"] >= x), None))
erster_rr = lambda x: (lambda ks: next((k for k in sorted(ks, key=lambda k: k["dist"]) if k["rr"] >= x), None))


def ergebnis(d, pick, strikt=False):
    """R-Ergebnis der IDEE: Treffer -> +RR (bei 10 gedeckelt), Invalidierung -> -1, sonst offen.

    Ein nicht erreichtes Ziel ist nur dann ein Verlust, wenn die DR binnen 24h auch wirklich
    invalidiert wurde -- sonst waere die Idee schlicht noch offen, nicht ausgestoppt."""
    k = pick([k for k in d["kand"] if k["dist"] > 0])
    if not k:
        return None, None
    if k["erreicht_strikt" if strikt else "erreicht"]:
        return min(k["rr"], 10), k
    return (-1.0, k) if d["t_inval"] is not None else (None, k)


def regel(name, pick, menge, strikt=False):
    paare = [(x, k) for x, k in (ergebnis(d, pick, strikt) for d in menge) if k]
    entsch = [(x, k) for x, k in paare if x is not None]
    if not entsch:
        return print("  %-34s --" % name)
    tr = [k for x, k in entsch if x > 0]
    print("  %-34s n=%3d | Treffer %3d  Verlust %3d  offen %2d | Quote %3.0f%% | Dist %5.1f  RR %4.2f | EV %+5.2f R"
          % (name, len(paare), len(tr), len(entsch) - len(tr), len(paare) - len(entsch),
             100.0 * len(tr) / len(entsch), med([k["dist"] for _, k in paare]),
             med([k["rr"] for _, k in paare]), sum(x for x, _ in entsch) / len(entsch)))


def ev(menge, pick):
    v = [x for x, k in (ergebnis(d, pick) for d in menge) if x is not None]
    return (sum(v) / len(v), len(v)) if v else (float("nan"), 0)


def main():
    drs = drs_laden()
    roh = sammeln(drs) if "sammeln" in sys.argv else roh_laden()
    for d in drs:
        d["kand"] = kandidaten(d, roh[d["id"]])
    alle = [k for d in drs for k in d["kand"]]
    print("Dealing Ranges: %d   Kandidaten insgesamt: %d   Reichweite-Median %.1f Pips\n"
          % (len(drs), len(alle), med([d["reach"] for d in drs])))

    print("ANGEBOT")
    print("  ohne LQ-Kandidat: %d   ohne OB-Kandidat: %d   voellig leer: %d"
          % (sum(1 for d in drs if not [k for k in d["kand"] if k["art"] == "LQ"]),
             sum(1 for d in drs if not [k for k in d["kand"] if k["art"] == "OB"]),
             sum(1 for d in drs if not d["kand"])))
    print("  Kandidaten hinter der nahen OB-Kante (als Ziel wertlos): %d von %d"
          % (sum(1 for k in alle if k["dist"] <= 0), len(alle)))
    print()

    print("TREFFERQUOTE JE RANG (erreicht = Reichweite >= Distanz ab naher OB-Kante)")
    print("  %-8s %4s %6s %7s %9s %8s" % ("", "n", "Treff", "Quote", "Dist-Med", "RR-Med"))
    for art in ("LQ", "OB"):
        for rang in range(1, 6):
            g = [k for k in alle if k["art"] == art and k["rang"] == rang]
            if g:
                t = [k for k in g if k["erreicht"]]
                print("  %-8s %4d %6d %6.0f%% %9.1f %8.2f" % ("%s #%d" % (art, rang), len(g), len(t),
                      100.0 * len(t) / len(g), med([k["dist"] for k in g]), med([k["rr"] for k in g])))
    print()

    print("tooFar-FLAG (>50 Pips zum aktuellen Preis)")
    for flag in (False, True):
        g = [k for k in alle if k["toofar"] == flag]
        t = [k for k in g if k["erreicht"]]
        print("  tooFar=%-5s n=%4d  erreicht %3d (%2.0f%%)  Dist-Median %.1f"
              % (flag, len(g), len(t), 100.0 * len(t) / len(g), med([k["dist"] for k in g])))
    print()

    print("KANDIDATEN-TIMEFRAME")
    for art in ("LQ", "OB"):
        for tf in ("5M", "1H", "4H"):
            g = [k for k in alle if k["art"] == art and k["tf"] == tf]
            if g:
                t = [k for k in g if k["erreicht"]]
                print("  %-3s %-3s n=%4d  erreicht %3d (%2.0f%%)  Dist-Median %5.1f  RR-Median %.2f"
                      % (art, tf, len(g), len(t), 100.0 * len(t) / len(g),
                         med([k["dist"] for k in g]), med([k["rr"] for k in g])))
    print()

    print("AUSWAHLREGELN -- Quote und EV nur ueber ENTSCHIEDENE DRs (Treffer oder Invalidierung),")
    print("RR bei 10 gedeckelt, damit kein einzelner Ausreisser die Zahl traegt")
    for name, pick in (("nahster Kandidat (Status quo)", nahster),
                       ("nahster LQ-Kandidat", lambda ks: nahster([k for k in ks if k["art"] == "LQ"])),
                       ("nahster OB-Kandidat", lambda ks: nahster([k for k in ks if k["art"] == "OB"])),
                       ("nahster mit Distanz >= 10 Pips", erster_ab(10)),
                       ("nahster mit Distanz >= 15 Pips", erster_ab(15)),
                       ("nahster mit Distanz >= 20 Pips", erster_ab(20)),
                       ("nahster mit RR >= 2", erster_rr(2)),
                       ("nahster mit RR >= 3", erster_rr(3)),
                       ("weitester ohne tooFar", lambda ks: max([k for k in ks if not k["toofar"]] or [],
                                                                key=lambda k: k["dist"], default=None))):
        regel(name, pick, drs)
    print()
    print("Gegenprobe mit strikter Reichweite (Invalidierungs-Kerze zaehlt nicht mit, betrifft %d von %d DRs):"
          % (sum(1 for d in drs if d["reach"] - d["reach_strikt"] > 0.1), len(drs)))
    regel("nahster Kandidat", nahster, drs, strikt=True)
    regel("nahster mit Distanz >= 15 Pips", erster_ab(15), drs, strikt=True)
    print()

    print("STABILITAET")
    h = len(drs) // 2
    REGELN = [("nahster", nahster), (">=10P", erster_ab(10)), (">=15P", erster_ab(15)), (">=20P", erster_ab(20))]
    for label, menge in (("gesamt", drs),
                         ("1. Haelfte bis %s" % drs[h - 1]["day"], drs[:h]),
                         ("2. Haelfte ab %s" % drs[h]["day"], drs[h:])):
        print("  %-22s " % label + "  ".join("%s %+.2f (n=%d)" % (rn, *ev(menge, rp)) for rn, rp in REGELN))
    random.seed(7)
    print("  Gepaarter Bootstrap, 5000 Ziehungen, EV-Differenz zu 'nahster':")
    for rn, rp in REGELN[1:]:
        diffs = []
        for _ in range(5000):
            stich = [random.choice(drs) for _ in drs]
            diffs.append(ev(stich, rp)[0] - ev(stich, nahster)[0])
        diffs.sort()
        print("    %-6s median %+.2f R  95%%-Intervall [%+.2f, %+.2f]  besser in %.0f%% der Ziehungen"
              % (rn, med(diffs), diffs[125], diffs[4874], 100.0 * sum(1 for x in diffs if x > 0) / len(diffs)))
    print()

    print("HANDELSFENSTER x ZIEL-DISTANZ (Handelsfenster GBPUSD 08:00-18:00 Berlin)")
    for label, menge in (("im Fenster", [d for d in drs if 8 <= d["stunde"] < 18]),
                         ("ausserhalb", [d for d in drs if not (8 <= d["stunde"] < 18)])):
        print("  %s (n=%d, Reichweite-Median %.1f Pips)" % (label, len(menge), med([d["reach"] for d in menge])))
        for rn, rp in (("nahster", nahster), (">=15 Pips", erster_ab(15)), (">=25 Pips", erster_ab(25))):
            e, n = ev(menge, rp)
            print("     %-10s n=%3d  EV %+.2f R" % (rn, n, e))


# Guard, damit filterTrend.py/winrate.py die Bausteine importieren koennen, ohne den ganzen
# Bericht auszuloesen.
if __name__ == "__main__":
    main()
