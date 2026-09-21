# -*- coding: utf-8 -*-
# SCHRITT 3 -- alles noch einmal, getrennt nach Trendlage.
#
# Die Grundmessung und die vier Filter kannten den 1H-Market-Structure-Trend gar nicht; ihre Zahlen
# sind Mittelwerte ueber eine Mischung aus Trade-Richtung-mit-dem-Trend und dagegen. Dieses Skript
# legt die Trendlage (aus trend-je-dr.json, siehe messeTrendJeDr.py) ueber jede der bisherigen
# Fragen -- inklusive der find_targets-Auswahlregeln.
#
# "Trend unklar" bleibt eine eigene Gruppe (siehe drMerkmale.trendlage), wird also weder
# weggeworfen noch einer der beiden Seiten zugeschlagen.
import bisect, json, random, statistics
from drMerkmale import lade_setups, lade_kerzen, lade_bekannte_level, lade_trend, merkmale, trendlage, dr_schluessel, ts, PIP, ARM
import filterGegenkraft as gk
import messeFindTargets as ft

LAGEN = ["mit dem Trend", "gegen den Trend", "Trend unklar"]
med = lambda v: statistics.median(v) if v else float("nan")

res = json.load(open("punkt1_result.json"))
by_id = {r["id"]: r for r in lade_setups()}
trend_map = lade_trend()
if not trend_map:
    raise SystemExit("trend-je-dr.json fehlt -- erst messeTrendJeDr.py laufen lassen.")

known = lade_bekannte_level()
for x in res:
    m = merkmale(by_id[x["id"]], known, trend_map)
    x.update(m)
    x["lage"] = trendlage(x["dir"], m["trend"])

fehlend = [x for x in res if x["trend"] is None]
print("TRENDLAGE JE DEALING RANGE  (1H-Market-Structure-Trend zum DR-Start)")
for lage in LAGEN:
    g = [x for x in res if x["lage"] == lage]
    print("  %-16s n=%3d" % (lage, len(g)))
if fehlend:
    print("  (ohne Trend-Antwort: %d)" % len(fehlend))
print()


def basis(g, name, breit=False):
    if not g:
        return print("  %-18s n=  0" % name)
    v = sorted(x["reach"] for x in g)
    zeile = ("  %-18s n=%3d | Median %5.1f | p25 %5.1f  p75 %5.1f | nie inval. %3d"
             % (name, len(g), med(v), v[len(v) // 4], v[3 * len(v) // 4],
                sum(1 for x in g if x["t_inval"] is None)))
    if breit:
        zeile += " | " + "  ".join("%dP %3d" % (X, sum(1 for x in g if x["reach"] >= X))
                                   for X in (10, 15, 20, 25, 30))
    print(zeile)


print("BASIS JE TRENDLAGE (Reichweite ab naher OB-Kante, 24h-Fenster)")
for lage in LAGEN:
    basis([x for x in res if x["lage"] == lage], lage, breit=True)
basis(res, "ALLE", breit=True)
print()

print("Zeit bis Invalidierung (nur invalidierte DRs):")
for lage in LAGEN:
    t = sorted(x["t_inval"] for x in res if x["lage"] == lage and x["t_inval"] is not None)
    if t:
        print("  %-18s n=%3d | median %4.0f Min | p25 %4.0f  p75 %4.0f" % (lage, len(t), med(t), t[len(t) // 4], t[3 * len(t) // 4]))
print()

print("FILTER 1 x TRENDLAGE -- Sweep-Herkunft")
for h in ("HTF sicher", "unklar", "M5 sicher"):
    for lage in LAGEN[:2]:
        basis([x for x in res if x["herkunft"] == h and x["lage"] == lage], "%s / %s" % (h[:9], lage[:10]))
print()

print("FILTER 3 x TRENDLAGE -- Sweep-Alter")
for k in ("Major (>=120h)", "Medium (24-120h)", "Minor (<24h)"):
    for lage in LAGEN[:2]:
        basis([x for x in res if x["klasse"] == k and x["lage"] == lage], "%s / %s" % (k.split(" ")[0], lage[:10]))
print()

print("FILTER 4 x TRENDLAGE -- Handelsfenster 08:00-18:00 Berlin")
for f in (True, False):
    for lage in LAGEN[:2]:
        basis([x for x in res if x["in_fenster"] == f and x["lage"] == lage],
              "%s / %s" % ("im Fenster" if f else "ausserhalb", lage[:10]))
print()

print("FILTER 2 x TRENDLAGE -- lebende Gegen-DR (Paarvergleich wie filterGegenkraft.py, Target 20 Pips)")
gdrs = gk.build(20)
for x in gdrs:
    x["lage"] = trendlage(x["d"], trend_map.get(dr_schluessel(by_id[x["id"]]), {}).get("trend"))
for x in gdrs:
    x["konstellation"] = gk.konstellation(x, gdrs, "broad")
for k in gk.KONSTELLATIONEN:
    for lage in LAGEN[:2]:
        g = [x for x in gdrs if x["konstellation"] == k and x["lage"] == lage]
        if not g:
            print("  %-34s n=  0" % ("%s / %s" % (k, lage[:10])))
            continue
        v = sorted(x["reach"] for x in g)
        print("  %-34s n=%3d | Median %5.1f | >=20P %3d | nie inval. %2d"
              % ("%s / %s" % (k, lage[:10]), len(g), med(v),
                 sum(1 for x in g if x["reach"] >= 20), sum(1 for x in g if x["t_inv"] is None)))
print()

print("FIND_TARGETS x TRENDLAGE -- dieselben Auswahlregeln, je Trendlage")
print("EV in R der Idee, RR bei 10 gedeckelt, nur entschiedene DRs (Treffer oder Invalidierung)")
ftdrs = ft.drs_laden()
roh = ft.roh_laden()
lage_by_id = {x["id"]: x["lage"] for x in res}
for d in ftdrs:
    d["kand"] = ft.kandidaten(d, roh[d["key"]])  # key, nicht id: siehe drs_laden in messeFindTargets.py
    d["lage"] = lage_by_id[d["id"]]
REGELN = [("nahster", ft.nahster), (">=10 Pips", ft.erster_ab(10)),
          (">=15 Pips", ft.erster_ab(15)), (">=25 Pips", ft.erster_ab(25))]
for lage in LAGEN:
    menge = [d for d in ftdrs if d["lage"] == lage]
    if not menge:
        continue
    print("  %s (n=%d DRs)" % (lage, len(menge)))
    for rn, rp in REGELN:
        paare = [(x, k) for x, k in (ft.ergebnis(d, rp) for d in menge) if k]
        entsch = [x for x, _ in paare if x is not None]
        if not entsch:
            continue
        tr = [x for x in entsch if x > 0]
        print("     %-10s n=%3d  Quote %3.0f%%  Dist %5.1f  EV %+.2f R"
              % (rn, len(entsch), 100.0 * len(tr) / len(entsch),
                 med([k["dist"] for _, k in paare]), sum(entsch) / len(entsch)))
print()

print("Gegenprobe: dieselbe Trennung ueber den INNEREN Trend (nestedTrend), wo es einen gibt")
for lage in LAGEN[:2]:
    basis([x for x in res if x["nestedTrend"] and trendlage(x["dir"], x["nestedTrend"]) == lage],
          "innerer: " + lage[:10])
print("  (ohne inneren Trend: %d von %d)" % (sum(1 for x in res if not x["nestedTrend"]), len(res)))
print()

# Naheliegender Einwand gegen das Ergebnis: braucht ein Trade MIT dem Trend vielleicht einfach
# laenger als 24 Stunden? Wachsen koennen dabei nur die nie invalidierten DRs -- bei allen anderen
# beendet die Invalidierung die Messung ohnehin vorher.
print("GEGENPROBE LAENGERES FENSTER")
cnd, times = lade_kerzen()
setups_by_id = {r["id"]: r for r in lade_setups()}


def reichweite(x, horizont):
    r = setups_by_id[x["id"]]
    ref = r["ob_bottom"] if x["dir"] == "short" else r["ob_top"]
    inval, start = r["fractal_price"], ts(r["ob_start_time"]) + ARM
    i, best = bisect.bisect_left(times, start), 0.0
    while i < len(cnd) and cnd[i]["time"] <= start + horizont:
        c = cnd[i]
        best = max(best, ((ref - c["low"]) if x["dir"] == "short" else (c["high"] - ref)) / PIP)
        if (c["high"] >= inval) if x["dir"] == "short" else (c["low"] <= inval):
            break
        i += 1
    return best


for stunden, name in ((24, "24h (Grundmessung)"), (72, "72h"), (168, "7 Tage")):
    werte = {lage: [reichweite(x, stunden * 3600) for x in res if x["lage"] == lage] for lage in LAGEN[:2]}
    print("  %-20s " % name + "   ".join("%s %5.1f (n=%3d)" % (lage[:5], med(v), len(v)) for lage, v in werte.items()))
print()

print("STABILITAET des Trend-Effekts")
res.sort(key=lambda x: x["day"])
h = len(res) // 2
for label, menge in (("gesamt", res), ("1. Haelfte bis " + res[h - 1]["day"], res[:h]),
                     ("2. Haelfte ab " + res[h]["day"], res[h:])):
    teil = {lage: [x["reach"] for x in menge if x["lage"] == lage] for lage in LAGEN[:2]}
    print("  %-24s " % label + "  ".join("%s %5.1f (n=%3d)" % (lage[:5], med(v), len(v)) for lage, v in teil.items()))
random.seed(7)
mit = [x["reach"] for x in res if x["lage"] == "mit dem Trend"]
geg = [x["reach"] for x in res if x["lage"] == "gegen den Trend"]
if mit and geg:
    diffs = sorted(med([random.choice(mit) for _ in mit]) - med([random.choice(geg) for _ in geg])
                   for _ in range(5000))
    print("  Bootstrap Reichweiten-Median (mit minus gegen): %+.1f Pips, 95%%-Intervall [%+.1f, %+.1f],"
          % (med(diffs), diffs[125], diffs[4874]))
    print("  mit dem Trend groesser in %.0f%% der Ziehungen" % (100.0 * sum(1 for d in diffs if d > 0) / len(diffs)))

# Auch die auffaelligste Zahl der find_targets-Tabelle gegenpruefen, bevor sie jemand als Befund
# liest: das ambitionierte Ziel sieht gegen den Trend deutlich besser aus als mit ihm.
mit_ft = [d for d in ftdrs if d["lage"] == "mit dem Trend"]
geg_ft = [d for d in ftdrs if d["lage"] == "gegen den Trend"]
for rn, rp in ((">=25 Pips", ft.erster_ab(25)), (">=15 Pips", ft.erster_ab(15)), ("nahster", ft.nahster)):
    diffs = []
    for _ in range(5000):
        a = ft.ev([random.choice(geg_ft) for _ in geg_ft], rp)[0]
        b = ft.ev([random.choice(mit_ft) for _ in mit_ft], rp)[0]
        diffs.append(a - b)
    diffs.sort()
    print("  EV %-10s gegen minus mit: %+.2f R, 95%%-Intervall [%+.2f, %+.2f], gegen besser in %.0f%%"
          % (rn, med(diffs), diffs[125], diffs[4874], 100.0 * sum(1 for d in diffs if d > 0) / len(diffs)))
