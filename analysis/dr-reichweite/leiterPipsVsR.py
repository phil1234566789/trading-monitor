# -*- coding: utf-8 -*-
# Fuer eine Anzeige in der UI: "wie wahrscheinlich ist Strecke X?" -- in welcher Einheit?
#
# Philips Idee (19.09.2026): die Statistik der Pip-Strecke zu einer laufenden Dealing Range
# anzeigen, z.B. vom Invalidierungslevel aus in den Chart gezeichnet. Bevor eine solche Leiter
# gebaut wird, muss klar sein, ob EINE Leiter fuer alle DRs ueberhaupt taugt: wenn dieselbe
# Pip-Strecke je nach Risiko der DR voellig andere Quoten hat, waere eine Pip-Leiter irrefuehrend.
#
# Gegenprobe deshalb ueber Risiko-Terzile (Risiko = nahe OB-Kante -> Extrem-Fraktal).
import json, statistics

res = json.load(open("punkt1_result.json"))
n = len(res)
PIPS = (5, 10, 15, 20, 25, 30, 40)
RS = (2, 3, 4, 5, 6)

quote_pips = lambda g, X: 100.0 * sum(1 for x in g if x["reach"] >= X) / len(g)
quote_r = lambda g, k: 100.0 * sum(1 for x in g if x["reach"] >= k * x["risk"]) / len(g)

print("UNBEDINGTE LEITER ueber alle %d DRs" % n)
print("  Pips  " + "  ".join("%dP %3.0f%%" % (X, quote_pips(res, X)) for X in PIPS))
print("  in R  " + "  ".join("%.0fR %3.0f%%" % (k, quote_r(res, k)) for k in RS))
print()

res.sort(key=lambda x: x["risk"])
d = n // 3
terzile = [("kleines Risiko", res[:d]), ("mittleres Risiko", res[d:2 * d]), ("grosses Risiko", res[2 * d:])]
for name, g in terzile:
    print("%-17s n=%3d  Risiko-Median %4.1f Pips" % (name, len(g), statistics.median([x["risk"] for x in g])))
    print("   Pips  " + "  ".join("%dP %3.0f%%" % (X, quote_pips(g, X)) for X in (10, 15, 20, 30)))
    print("   in R  " + "  ".join("%.0fR %3.0f%%" % (k, quote_r(g, k)) for k in (1, 2, 3, 5)))
print()

# Entscheidungskriterium: wie weit laeuft die Quote zwischen den Terzilen auseinander? Je kleiner
# die Spannweite, desto eher taugt EINE Leiter fuer alle DRs.
for einheit, stufen, f in (("Pips", (10, 15, 20, 30), quote_pips), ("R", (1, 2, 3, 5), quote_r)):
    spann = [max(f(g, X) for _, g in terzile) - min(f(g, X) for _, g in terzile) for X in stufen]
    print("Spannweite ueber die Risiko-Terzile, Einheit %-4s: %s Punkte  (Mittel %.0f)"
          % (einheit, " ".join("%2.0f" % s for s in spann), sum(spann) / len(spann)))
