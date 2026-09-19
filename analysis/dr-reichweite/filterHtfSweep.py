# -*- coding: utf-8 -*-
# SCHRITT 2, Filter 1 -- HTF-Sweep, ehrliche Dreiteilung statt einer unvollstaendigen Zuordnung.
# Die Klassifikation selbst steht in drMerkmale.sweep_herkunft (dort auch die Begruendung der
# drei Klassen), damit sie nicht in jedem Filter-Skript erneut dasteht.
import json, statistics
from drMerkmale import lade_setups, lade_bekannte_level, sweep_herkunft

res = json.load(open("punkt1_result.json"))
by_id = {r["id"]: r for r in lade_setups()}
known = lade_bekannte_level()

for x in res:
    x["cls"] = sweep_herkunft(by_id[x["id"]], known)


def stats(g, name):
    if not g:
        return
    v = sorted(x["reach"] for x in g)
    nie = sum(1 for x in g if x["t_inval"] is None)
    print("%-12s n=%3d | Reichweite median %5.1f  p25 %5.1f  p75 %5.1f | nie inval. %3d"
          % (name, len(g), statistics.median(v), v[len(v) // 4], v[3 * len(v) // 4], nie))
    cells = ["%2dP %3d" % (X, sum(1 for x in g if x["reach"] >= X)) for X in (10, 15, 20, 25, 30)]
    print("%-12s   Ziel erreicht (von %d):  %s" % ("", len(g), "   ".join(cells)))


for name in ("HTF sicher", "unklar", "M5 sicher"):
    stats([x for x in res if x["cls"] == name], name)
    print()
stats(res, "ALLE")
