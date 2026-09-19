# -*- coding: utf-8 -*-
# SCHRITT 2, Filter 3+4 -- Inducement-Klasse (Sweep-Alter) und Handelszeit/Tageszeit.
#
# Sweep-Alter = ls_pivot_time -> ls_touched_time in HANDELSSTUNDEN (Wochenende raus), wie
# _shared/ageTier.ts. Klassen laut liquidität.md: Minor <24h, Medium 24-120h, Major >=120h.
# Handelsfenster GBPUSD aus trading_schedules: weekday 480-1080 Min = 08:00-18:00 Berlin.
# Der ganze Messzeitraum (15.07.-16.09.2026) liegt in CEST, also UTC+2.
import json, datetime, statistics, collections

BASE = r"C:\Users\Philip\.claude\projects\c--Users-Philip-Documents-git-trading-monitor\25cfa4c0-a261-49e1-9482-af67f53adc09\tool-results"
rows = json.load(open(BASE + r"\mcp-trading-monitor-get_trade_setups-1789808350250.txt"))
levels = json.load(open(BASE + r"\mcp-trading-monitor-get_near_relevant_liquidity_levels-1789817921915.txt"))["levels"]
res = json.load(open("punkt1_result.json"))
ts = lambda s: int(datetime.datetime.fromisoformat(s).timestamp())
by_id = {r["id"]: r for r in rows}
known = {(round(l["price"], 5), l["pivotTime"]) for l in levels}
BERLIN = 2 * 3600            # CEST im gesamten Messzeitraum
WIN_FROM, WIN_TO = 480, 1080  # Minuten ab Mitternacht Berlin


def business_hours(a, b):
    """Stunden zwischen a und b, Samstag/Sonntag herausgerechnet."""
    if b <= a:
        return 0.0
    sec = 0
    cur = a
    while cur < b:
        nxt = min(b, cur + 3600)
        if datetime.datetime.utcfromtimestamp(cur).weekday() < 5:
            sec += nxt - cur
        cur = nxt
    return sec / 3600.0


for x in res:
    r = by_id[x["id"]]
    age = business_hours(ts(r["ls_pivot_time"]), ts(r["ls_touched_time"]))
    x["age_h"] = age
    x["klasse"] = "Major (>=120h)" if age >= 120 else ("Medium (24-120h)" if age >= 24 else "Minor (<24h)")
    dist = abs(r["ls_price"] - r["fractal_price"]) / 0.0001
    ldm = (ts(r["fractal_pivot_time"]) - ts(r["ls_touched_time"])) / 60.0
    x["htf"] = (((round(r["ls_price"], 5), ts(r["ls_pivot_time"])) in known)
                or dist > 5.0 or ldm > 45.0 or ts(r["ls_pivot_time"]) % 3600 == 0)
    bt = datetime.datetime.utcfromtimestamp(ts(r["ob_start_time"]) + BERLIN)
    x["min_of_day"] = bt.hour * 60 + bt.minute
    x["stunde"] = bt.hour
    x["in_fenster"] = bt.weekday() < 5 and WIN_FROM <= x["min_of_day"] < WIN_TO


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
