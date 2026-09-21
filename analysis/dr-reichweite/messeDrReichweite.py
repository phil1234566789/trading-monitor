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
import json, statistics
from drMerkmale import lade_setups, lade_kerzen, messe_drs

rows = lade_setups()
cnd, times = lade_kerzen()
res, info = messe_drs(rows, cnd, times)

print("Setup-Zeilen gesamt      : %d" % info["zeilen"])
print("Dealing Ranges (je M5-OB): %d   -> %d Zeilen waren Duplikate"
      % (info["drs"], info["zeilen"] - info["drs"]))
print("   davon ohne bestaetigtes Fraktal: %d  (frueher ausgeschlossen, jetzt ueber die OB-Kante messbar)"
      % info["ohne_fraktal"])
print()
print("ausgewertet: %d   (Sanity-Ausschluss, Invalidierung auf falscher Seite: %d)"
      % (len(res), info["sanity"]))
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
