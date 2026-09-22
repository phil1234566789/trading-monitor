# -*- coding: utf-8 -*-
# Saisonalitaet: liefert die Strategie in manchen Monaten systematisch schlechter?
#
# Philips Frage (20.09.2026): "es koennte sein, dass es fuer forex auch ne Saisonalitaet gibt
# (z.B. Januar mau, worst case mehrere Monate mau)". Beantwortbar wurde das erst durch den
# Backfill -- vorher reichten die Daten nur ueber zwei Monate.
#
# Leitkennzahl ist die TREFFERQUOTE, nicht der Reichweiten-Median. Philip: "mir ist doch egal wie
# weit die Pipstrecken gehen, ich will am ende 10-20 pips traden und den Gewinn mitnehmen. Ich
# will ne gute Winrate von Dealing Ranges. Ob sie 20 oder 40 pips gehen ist mir doch egal."
# Ein Median laesst sich von den wenigen sehr weiten Laeufen hochziehen und beschreibt damit
# etwas, das fuer die Entscheidung "traden oder nicht" keine Rolle spielt.
#
# Der Reichweiten-Median steht trotzdem in der zweiten Tabelle -- zusammen mit dem Risiko-Median
# beantwortet er die Anschlussfrage, ob ein schwacher Monat schlechtere Setups hat oder nur
# weniger Volatilitaet (dann wandern beide zusammen und die Quote in R bleibt stabiler).
import json, statistics, random

med = lambda v: statistics.median(v) if v else float("nan")
res = json.load(open("punkt1_result.json"))
monate = sorted({x["day"][:7] for x in res})
PIPS = (10, 15, 20, 25, 30, 35, 40)
RS = (2, 3, 4, 5, 6)

quote = lambda g, X: 100.0 * sum(1 for x in g if x["reach"] >= X) / len(g)
quote_r = lambda g, k: 100.0 * sum(1 for x in g if x["reach"] >= k * x["risk"]) / len(g)

print("TREFFERQUOTE JE MONAT — Ziel erreicht, bevor die DR invalidierte")
print("  Monat      n  " + "".join("%7dP" % X for X in PIPS))
for m in monate:
    g = [x for x in res if x["day"][:7] == m]
    print("  %s %4d  " % (m, len(g)) + "".join("%7.0f%%" % quote(g, X) for X in PIPS))
print("  %-8s %4d  " % ("ALLE", len(res)) + "".join("%7.0f%%" % quote(res, X) for X in PIPS))
print()

print("DIESELBEN MONATE IN R (Vielfaches des eigenen Risikos)")
print("  Monat      n  " + "".join("%8dR" % k for k in RS))
for m in monate:
    g = [x for x in res if x["day"][:7] == m]
    print("  %s %4d  " % (m, len(g)) + "".join("%8.0f%%" % quote_r(g, k) for k in RS))
print("  %-8s %4d  " % ("ALLE", len(res)) + "".join("%8.0f%%" % quote_r(res, k) for k in RS))
print()

print("VOLATILITAET ODER SETUP-QUALITAET? Reichweite und Risiko je Monat")
print("  Monat      n   Reichweite   Risiko   Reichweite in R   nie invalidiert")
for m in monate:
    g = [x for x in res if x["day"][:7] == m]
    rr = [x["reach"] / x["risk"] for x in g if x["risk"] > 0]
    print("  %s %4d %10.1f %8.1f %15.2f %15.0f%%"
          % (m, len(g), med([x["reach"] for x in g]), med([x["risk"] for x in g]), med(rr),
             100.0 * sum(1 for x in g if x["t_inval"] is None) / len(g)))
pips = [med([x["reach"] for x in res if x["day"][:7] == m]) for m in monate]
risk = [med([x["risk"] for x in res if x["day"][:7] == m]) for m in monate]
rs = [med([x["reach"] / x["risk"] for x in res if x["day"][:7] == m and x["risk"] > 0]) for m in monate]
print("  Spannweite: Reichweite Faktor %.1f | Risiko Faktor %.1f | in R Faktor %.1f"
      % (max(pips) / min(pips), max(risk) / min(risk), max(rs) / min(rs)))
print("  Wandern Reichweite und Risiko zusammen, ist der Monatsunterschied groesstenteils")
print("  Volatilitaet. Bleibt auch die R-Spalte auseinander, sind es wirklich die Setups.")
print()

print("HAELT DER UNTERSCHIED? Bootstrap bester gegen schlechtesten Monat, 5000 Ziehungen")
random.seed(7)
for X in PIPS:
    quoten = [(m, quote([x for x in res if x["day"][:7] == m], X)) for m in monate]
    best, schl = max(quoten, key=lambda t: t[1]), min(quoten, key=lambda t: t[1])
    a = [1 if x["reach"] >= X else 0 for x in res if x["day"][:7] == best[0]]
    b = [1 if x["reach"] >= X else 0 for x in res if x["day"][:7] == schl[0]]
    d = sorted(100.0 * sum(random.choice(a) for _ in a) / len(a) - 100.0 * sum(random.choice(b) for _ in b) / len(b)
               for _ in range(5000))
    print("  %2d Pips: %s %2.0f%% gegen %s %2.0f%% | Differenz %2.0f Punkte, 95%%-Intervall [%2.0f, %2.0f]"
          % (X, best[0], best[1], schl[0], schl[1], med(d), d[125], d[4874]))
print()

print("HALBJAHRE DIREKT GEGENEINANDER")
# Mehrere Jahre: ein Datum vor Juli 2026 ist nicht automatisch ein erstes Halbjahr.
h1 = [x for x in res if int(x["day"][5:7]) <= 6]
h2 = [x for x in res if int(x["day"][5:7]) >= 7]
print("  %-22s n  " % "" + "".join("%7dP" % X for X in PIPS))
for name, g in (("Januar-Juni", h1), ("Juli-Dezember", h2)):
    print("  %-20s %4d  " % (name, len(g)) + "".join("%7.0f%%" % quote(g, X) for X in PIPS))
for X in (10, 15, 20):
    a = [1 if x["reach"] >= X else 0 for x in h1]
    b = [1 if x["reach"] >= X else 0 for x in h2]
    d = sorted(100.0 * sum(random.choice(a) for _ in a) / len(a) - 100.0 * sum(random.choice(b) for _ in b) / len(b)
               for _ in range(5000))
    print("  %2d Pips: erstes Halbjahr liegt %2.0f Punkte vorn, 95%%-Intervall [%2.0f, %2.0f]"
          % (X, med(d), d[125], d[4874]))
print()

print("SETUPS JE MONAT (Handelstage schwanken, deshalb auch pro Tag)")
for m in monate:
    g = [x for x in res if x["day"][:7] == m]
    tage = len({x["day"] for x in g})
    print("  %s %4d Setups an %2d Tagen = %.1f pro Tag" % (m, len(g), tage, len(g) / tage))
