# -*- coding: utf-8 -*-
# SCHRITT 2, Filter 3+4 -- Inducement-Klasse (Sweep-Alter) und Handelszeit/Tageszeit.
# Alter, Klasse, Handelsstunde und Sweep-Herkunft kommen aus drMerkmale (dort auch die
# Begruendungen: ageTier-Klassen, Handelsfenster aus trading_schedules, CEST-Annahme).
import json, statistics
from drMerkmale import lade_setups, lade_bekannte_level, merkmale

res = json.load(open("punkt1_result.json"))
by_id = {r["id"]: r for r in lade_setups()}
known = lade_bekannte_level()

for x in res:
    m = merkmale(by_id[x["id"]], known)
    x.update(age_h=m["age_h"], klasse=m["klasse"], htf=m["htf_broad"],
             min_of_day=m["min_of_day"], stunde=m["stunde"], in_fenster=m["in_fenster"])


def show(g, name):
    if not g:
        print("  %-20s n=  0" % name); return
    v = sorted(x["reach"] for x in g)
    print("  %-20s n=%3d | Median %5.1f | p75 %5.1f | >=15P %3d | >=20P %3d | nie inval. %2d"
          % (name, len(g), statistics.median(v), v[3 * len(v) // 4],
             sum(1 for x in g if x["reach"] >= 15), sum(1 for x in g if x["reach"] >= 20),
             sum(1 for x in g if x["t_inval"] is None)))


print("FILTER 3 -- Inducement-Klasse (Sweep-Alter in Handelsstunden)")
for k in ("Major (>=120h)", "Medium (24-120h)", "Minor (<24h)"):
    show([x for x in res if x["klasse"] == k], k)
print()
print("  nur innerhalb der HTF-Gruppe (n=%d):" % sum(1 for x in res if x["htf"]))
for k in ("Major (>=120h)", "Medium (24-120h)", "Minor (<24h)"):
    show([x for x in res if x["htf"] and x["klasse"] == k], "  " + k)
print()
a = sorted(x["age_h"] for x in res)
print("  Sweep-Alter Verteilung: median %.1f h, p75 %.1f h, p90 %.1f h, max %.0f h"
      % (statistics.median(a), a[3 * len(a) // 4], a[9 * len(a) // 10], a[-1]))
print()

print("FILTER 4 -- Handelszeit (GBPUSD 08:00-18:00 Berlin, Mo-Fr)")
show([x for x in res if x["in_fenster"]], "im Fenster")
show([x for x in res if not x["in_fenster"]], "ausserhalb")
print()
print("  nach Stunde (Berlin), OB-Entstehung:")
for h in range(24):
    g = [x for x in res if x["stunde"] == h]
    if len(g) >= 5:
        v = sorted(x["reach"] for x in g)
        print("    %02d:00  n=%3d  Median %5.1f  >=20P %2d" % (h, len(g), statistics.median(v),
                                                               sum(1 for x in g if x["reach"] >= 20)))
print()
print("  MMM-Fenster 10:30-13:00 Berlin (laut trading_schedules-Notiz 'nur mit zusaetzlichen Bestaetigungen'):")
show([x for x in res if 630 <= x["min_of_day"] < 780], "in MMM")
show([x for x in res if x["in_fenster"] and not (630 <= x["min_of_day"] < 780)], "Fenster ohne MMM")
