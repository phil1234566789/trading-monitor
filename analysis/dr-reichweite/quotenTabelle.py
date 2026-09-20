# -*- coding: utf-8 -*-
# Eine Tabelle je Merkmal, durchgehend in Philips Leitkennzahl: TREFFERQUOTE bei 10 bis 40 Pips
# und bei 1 bis 5 R. Loest die Median-Tabellen als Hauptdarstellung ab.
#
# Philip 20.09.2026: "mir ist doch egal wie weit die Pipstrecken gehen, ich will am ende 10-20
# pips traden und den Gewinn mitnehmen. Ich will ne gute Winrate von Dealing Ranges." Bei ca. 15
# Pips nimmt er TP1, danach laeuft der Rest -- deshalb die Reihe bis 40.
import json, statistics
from drMerkmale import lade_setups, lade_bekannte_level, merkmale
import filterGegenkraft as gk

med = lambda v: statistics.median(v) if v else float("nan")
PIPS = (10, 15, 20, 25, 30, 35, 40)
RS = (1, 2, 3, 4, 5)

res = json.load(open("punkt1_result.json"))
known = lade_bekannte_level()
by_id = {r["id"]: r for r in lade_setups()}
for x in res:
    x.update(merkmale(by_id[x["id"]], known))
gliste = gk.build(20)
gdrs = {x["id"]: x for x in gliste}
for x in res:
    g = gdrs.get(x["id"])
    x["konstellation"] = gk.konstellation(g, gliste, "broad") if g else None

quote = lambda g, X: 100.0 * sum(1 for x in g if x["reach"] >= X) / len(g)
quote_r = lambda g, k: 100.0 * sum(1 for x in g if x["reach"] >= k * x["risk"]) / len(g)


def block(titel, gruppen):
    print(titel)
    print("  %-26s %4s  " % ("", "n") + "".join("%6dP" % X for X in PIPS) + "  |" + "".join("%6dR" % k for k in RS))
    for name, g in gruppen:
        if not g:
            print("  %-26s %4d" % (name, 0))
            continue
        print("  %-26s %4d  " % (name, len(g)) + "".join("%6.0f%%" % quote(g, X) for X in PIPS)
              + "  |" + "".join("%6.0f%%" % quote_r(g, k) for k in RS))
    print()


block("ALLE DEALING RANGES", [("gesamt", res)])

block("SWEEP-HERKUNFT", [(h, [x for x in res if x["herkunft"] == h]) for h in ("HTF sicher", "unklar", "M5 sicher")])

block("SWEEP-ALTER (Inducement-Klasse)",
      [(k, [x for x in res if x["klasse"] == k]) for k in ("Major (>=120h)", "Medium (24-120h)", "Minor (<24h)")])

block("HANDELSFENSTER 08:00-18:00 BERLIN",
      [("im Fenster", [x for x in res if x["in_fenster"]]), ("ausserhalb", [x for x in res if not x["in_fenster"]])])

block("GEGENKRAFT", [(k, [x for x in res if x["konstellation"] == k]) for k in gk.KONSTELLATIONEN])

res_sortiert = sorted(res, key=lambda x: x["risk"])
d = len(res_sortiert) // 3
block("ENGE DER DR (Risiko-Terzile)",
      [("eng (bis %.1f P)" % res_sortiert[d - 1]["risk"], res_sortiert[:d]),
       ("mittel (bis %.1f P)" % res_sortiert[2 * d - 1]["risk"], res_sortiert[d:2 * d]),
       ("weit (ab %.1f P)" % res_sortiert[2 * d]["risk"], res_sortiert[2 * d:])])

block("RICHTUNG", [(r, [x for x in res if x["dir"] == r]) for r in ("short", "long")])

print("LESEHILFE")
print("  Links die Trefferquote bei einem Ziel in PIPS, rechts dieselbe Frage in R (Vielfaches des")
print("  eigenen Risikos). Laufen die beiden Seiten einer Zeile auseinander, liegt es an der Enge")
print("  der DR: eine enge Range erreicht wenige Pips, aber viele R.")
