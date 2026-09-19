# -*- coding: utf-8 -*-
# PUNKT 1 -- Grundmessung je Dealing Range.
#
# Eine DR = ein M5-OB. Path-A- und Path-B-Zeile desselben OB werden zusammengefasst;
# die Invalidierung kommt aus der Path-A-Zeile (dort steht das Extrem-Fraktal, nicht
# das gesweepte Level).
#
# Gemessen ab FVG-Bestaetigung (ob_start + 2 M5-Kerzen), danach:
#   invalidiert_nach : Minuten bis eine Kerze das Extrem-Fraktal BERUEHRT (Philips "trifft")
#   reichweite       : groesste Bewegung in Trade-Richtung VOR der Invalidierung,
#                      gemessen ab der NAHEN OB-Kante (ob_bottom bei Short, ob_top bei Long)
import json, datetime, bisect, statistics, collections

SETUPS = r"C:\Users\Philip\.claude\projects\c--Users-Philip-Documents-git-trading-monitor\25cfa4c0-a261-49e1-9482-af67f53adc09\tool-results\mcp-trading-monitor-get_trade_setups-1789808350250.txt"
CANDLES = r"C:\Users\Philip\.claude\projects\c--Users-Philip-Documents-git-trading-monitor\25cfa4c0-a261-49e1-9482-af67f53adc09\tool-results\mcp-trading-monitor-get_forex_candles_archive-1789814595814.txt"
PIP = 0.0001
ARM = 600
HORIZON = 24 * 3600

rows = json.load(open(SETUPS))
cnd = json.load(open(CANDLES)); cnd.sort(key=lambda c: c["time"])
times = [c["time"] for c in cnd]
ts = lambda s: int(datetime.datetime.fromisoformat(s).timestamp())

for r in rows:
    r["_B"] = (r["fractal_price"] == r["ls_price"] and r["fractal_pivot_time"] == r["ls_pivot_time"])

groups = collections.defaultdict(list)
for r in rows:
    groups[(r["direction"], r["ob_start_time"], r["ob_top"], r["ob_bottom"])].append(r)

drs, nur_b = [], []
for key, g in groups.items():
    a = [r for r in g if not r["_B"]]
    (drs if a else nur_b).append((key, a[0] if a else g[0], g))

print("Setup-Zeilen gesamt      : %d" % len(rows))
print("Dealing Ranges (je M5-OB): %d   -> %d Zeilen waren Duplikate"
      % (len(groups), len(rows) - len(groups)))
print("   davon mit Path-A-Zeile (Extrem-Fraktal bekannt): %d" % len(drs))
print("   nur Path B (Invalidierung NICHT bestimmbar)    : %d  -> ausgeschlossen" % len(nur_b))
print()

res, skipped_sanity = [], 0
for key, lead, g in drs:
    d, obst, obtop, obbot = key
    start = ts(obst) + ARM
    if not (times[0] <= start <= times[-1] - 3600):
        continue
    inval = lead["fractal_price"]
    ref = obbot if d == "short" else obtop
    # Sanity: Invalidierung muss auf der richtigen Seite der Referenz liegen
    if (inval <= ref) if d == "short" else (inval >= ref):
        skipped_sanity += 1
        continue
    i = bisect.bisect_left(times, start)
    reach = 0.0
    t_inval = None
    while i < len(cnd) and cnd[i]["time"] <= start + HORIZON:
        c = cnd[i]
        fav = (ref - c["low"]) if d == "short" else (c["high"] - ref)
        reach = max(reach, fav / PIP)
        hit = (c["high"] >= inval) if d == "short" else (c["low"] <= inval)
        if hit:
            t_inval = (c["time"] - start) / 60.0
            break
        i += 1
    res.append(dict(id=lead["id"], dir=d, reach=reach, t_inval=t_inval,
                    risk=abs(inval - ref) / PIP, day=obst[:10]))

print("ausgewertet: %d   (Sanity-Ausschluss, Invalidierung auf falscher Seite: %d)"
      % (len(res), skipped_sanity))
print()

nie = [x for x in res if x["t_inval"] is None]
inv = [x for x in res if x["t_inval"] is not None]
print("Invalidierung binnen 24h getroffen : %d" % len(inv))
print("nie invalidiert (24h-Fenster)      : %d" % len(nie))
if inv:
    t = sorted(x["t_inval"] for x in inv)
    print("   Zeit bis Invalidierung: median %.0f Min, p25 %.0f, p75 %.0f, max %.0f"
          % (statistics.median(t), t[len(t)//4], t[3*len(t)//4], t[-1]))
print()

rr = sorted(x["reach"] for x in res)
print("REICHWEITE ab naher OB-Kante, vor der Invalidierung (alle %d):" % len(res))
print("   median %.1f Pips   p25 %.1f   p75 %.1f   max %.1f"
      % (statistics.median(rr), rr[len(rr)//4], rr[3*len(rr)//4], rr[-1]))
print()
print("   Ziel erreichbar gewesen (Reichweite >= X), bevor die DR invalidierte:")
for X in (5, 10, 15, 20, 25, 30, 40):
    n = sum(1 for x in res if x["reach"] >= X)
    print("      >= %2d Pips : %3d von %3d" % (X, n, len(res)))
print()
rsk = sorted(x["risk"] for x in res)
print("Risiko (nahe OB-Kante -> Extrem-Fraktal): median %.1f Pips, p25 %.1f, p75 %.1f"
      % (statistics.median(rsk), rsk[len(rsk)//4], rsk[3*len(rsk)//4]))
print()
for d in ("short", "long"):
    s = [x for x in res if x["dir"] == d]
    if s:
        v = sorted(x["reach"] for x in s)
        print("   %-5s n=%3d  Reichweite median %.1f Pips   nie invalidiert: %d"
              % (d, len(s), statistics.median(v), sum(1 for x in s if x["t_inval"] is None)))

json.dump(res, open("punkt1_result.json", "w"))
print("\n-> punkt1_result.json geschrieben (%d Zeilen)" % len(res))
