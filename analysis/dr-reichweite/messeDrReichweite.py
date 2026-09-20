# -*- coding: utf-8 -*-
# PUNKT 1 -- Grundmessung je Dealing Range.
#
# Eine DR = ein M5-OB. Zeilen desselben OB werden zusammengefasst -- dieselbe Gruppierung, die
# seit dem 20.09.2026 auch die Tabelle selbst hat (Migration 20260920140000).
#
# Invalidierung = FERNE OB-Kante, seit dem 20.09.2026 auch im Produktivcode die einzige Quelle
# (siehe deriveSetupEntryInvalidation). Vorher stand hier das bestaetigte Extrem-Fraktal aus der
# Path-A-Zeile. Nachgemessen: ueber die 855 DRs, die BEIDE Fassungen kennen, aendert der Wechsel
# die Trefferquoten um 0,0 bis 0,1 Punkte -- die beiden Preise sind in 97 % der Faelle identisch.
# Der eigentliche Gewinn ist die Stichprobe: die alte Fassung musste 60 DRs ohne Path-A-Zeile
# komplett verwerfen, weil ohne bestaetigtes Fraktal keine Invalidierung bestimmbar war. Die ferne
# OB-Kante steht dagegen bei JEDER DR fest, also sind es jetzt 915 statt 855. Die 60 Nachzuegler
# sind unterdurchschnittlich, deshalb sinken die Quoten um 1 bis 3 Punkte.
#
# Gemessen ab FVG-Bestaetigung (ob_start + 2 M5-Kerzen), danach:
#   invalidiert_nach : Minuten bis eine Kerze die ferne OB-Kante BERUEHRT (Philips "trifft")
#   reichweite       : groesste Bewegung in Trade-Richtung VOR der Invalidierung,
#                      gemessen ab der NAHEN OB-Kante (ob_bottom bei Short, ob_top bei Long)
import json, bisect, statistics, collections
from drMerkmale import lade_setups, lade_kerzen, ts, PIP, ARM, HORIZON

rows = lade_setups()
cnd, times = lade_kerzen()

for r in rows:
    r["_B"] = (r["fractal_price"] == r["ls_price"] and r["fractal_pivot_time"] == r["ls_pivot_time"])

groups = collections.defaultdict(list)
for r in rows:
    groups[(r["direction"], r["ob_start_time"], r["ob_top"], r["ob_bottom"])].append(r)

# Merkmalstraeger der Gruppe ist die Zeile mit einem EIGENEN bestaetigten Fraktal -- dieselbe Wahl
# wie setup_quelle in der Migration, damit Auswertung und Tabelle dieselbe Zeile meinen.
drs = []
for key, g in groups.items():
    a = [r for r in g if not r["_B"]]
    drs.append((key, a[0] if a else g[0], g))
ohne_fraktal = sum(1 for _, lead, _ in drs if lead["_B"])

print("Setup-Zeilen gesamt      : %d" % len(rows))
print("Dealing Ranges (je M5-OB): %d   -> %d Zeilen waren Duplikate"
      % (len(groups), len(rows) - len(groups)))
print("   davon ohne bestaetigtes Fraktal: %d  (frueher ausgeschlossen, jetzt ueber die OB-Kante messbar)"
      % ohne_fraktal)
print()

res, skipped_sanity = [], 0
for key, lead, g in drs:
    d, obst, obtop, obbot = key
    start = ts(obst) + ARM
    if not (times[0] <= start <= times[-1] - 3600):
        continue
    inval = obtop if d == "short" else obbot
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
print("Risiko (nahe -> ferne OB-Kante): median %.1f Pips, p25 %.1f, p75 %.1f"
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
