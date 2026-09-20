# -*- coding: utf-8 -*-
# Saisonalitaet: laufen Dealing Ranges in manchen Monaten systematisch weiter als in anderen?
#
# Philips Frage (20.09.2026): "es koennte sein, dass es fuer forex auch ne Saisonalitaet gibt
# (z.B. Januar mau, worst case mehrere Monate mau)". Beantwortbar wurde das erst durch den
# Backfill -- vorher reichten die Daten nur ueber zwei Monate.
#
# Die entscheidende Trennung steht weiter unten: ein Monat kann weiter laufen, weil die SETUPS
# besser sind, oder schlicht weil der Markt mehr schwankt. Das zweite sieht man daran, dass das
# Risiko (nahe OB-Kante -> Extrem-Fraktal) mitwandert -- dann ist die Strecke in R flach, obwohl
# sie in Pips auseinanderlaeuft.
import json, statistics, random
from drMerkmale import lade_setups

med = lambda v: statistics.median(v) if v else float("nan")
res = json.load(open("punkt1_result.json"))
monate = sorted({x["day"][:7] for x in res})

print("JE MONAT (n=%d Dealing Ranges)" % len(res))
print("  Monat      n   Reichweite   Risiko   in R    >=15P   >=3R   nie inval.")
for m in monate:
    g = [x for x in res if x["day"][:7] == m]
    rr = [x["reach"] / x["risk"] for x in g if x["risk"] > 0]
    print("  %s %4d %10.1f %8.1f %6.2f %7.0f%% %6.0f%% %9.0f%%"
          % (m, len(g), med([x["reach"] for x in g]), med([x["risk"] for x in g]), med(rr),
             100.0 * sum(1 for x in g if x["reach"] >= 15) / len(g),
             100.0 * sum(1 for v in rr if v >= 3) / len(rr),
             100.0 * sum(1 for x in g if x["t_inval"] is None) / len(g)))

pips = [med([x["reach"] for x in res if x["day"][:7] == m]) for m in monate]
risk = [med([x["risk"] for x in res if x["day"][:7] == m]) for m in monate]
rs = [med([x["reach"] / x["risk"] for x in res if x["day"][:7] == m and x["risk"] > 0]) for m in monate]
print()
print("  Spannweite ueber die Monate:")
print("    Reichweite in Pips  %.1f bis %.1f   (Faktor %.1f)" % (min(pips), max(pips), max(pips) / min(pips)))
print("    Risiko in Pips      %.1f bis %.1f   (Faktor %.1f)" % (min(risk), max(risk), max(risk) / min(risk)))
print("    Reichweite in R     %.2f bis %.2f   (Faktor %.1f)" % (min(rs), max(rs), max(rs) / min(rs)))
print()
print("  Je staerker Risiko und Reichweite zusammen wandern, desto mehr ist der Monatsunterschied")
print("  blosse Volatilitaet und keine bessere Setup-Qualitaet.")

# Haelt der Monatsunterschied ueberhaupt, oder ist er bei rund 100 DRs je Monat Rauschen?
random.seed(7)
bester, schlechtester = monate[pips.index(max(pips))], monate[pips.index(min(pips))]
a = [x["reach"] for x in res if x["day"][:7] == bester]
b = [x["reach"] for x in res if x["day"][:7] == schlechtester]
diffs = sorted(med([random.choice(a) for _ in a]) - med([random.choice(b) for _ in b]) for _ in range(5000))
print()
print("  Bootstrap bester gegen schlechtesten Monat (%s %.1f gegen %s %.1f):" % (bester, max(pips), schlechtester, min(pips)))
print("    Differenz %.1f Pips, 95%%-Intervall [%.1f, %.1f], groesser in %.0f %% der Ziehungen"
      % (med(diffs), diffs[125], diffs[4874], 100.0 * sum(1 for d in diffs if d > 0) / len(diffs)))

# Dasselbe in R -- wenn das Intervall hier die Null enthaelt, ist der Monatseffekt reine Volatilitaet.
ra = [x["reach"] / x["risk"] for x in res if x["day"][:7] == bester and x["risk"] > 0]
rb = [x["reach"] / x["risk"] for x in res if x["day"][:7] == schlechtester and x["risk"] > 0]
diffs = sorted(med([random.choice(ra) for _ in ra]) - med([random.choice(rb) for _ in rb]) for _ in range(5000))
print("    dieselben zwei Monate in R: Differenz %.2f R, 95%%-Intervall [%.2f, %.2f], groesser in %.0f %%"
      % (med(diffs), diffs[125], diffs[4874], 100.0 * sum(1 for d in diffs if d > 0) / len(diffs)))

print()
print("WIE VIELE SETUPS JE MONAT (Handelstage schwanken, deshalb auch pro Tag)")
for m in monate:
    g = [x for x in res if x["day"][:7] == m]
    tage = len({x["day"] for x in g})
    print("  %s %4d Setups an %2d Tagen  = %.1f pro Tag" % (m, len(g), tage, len(g) / tage))
