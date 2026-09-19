# -*- coding: utf-8 -*-
# SCHRITT 2, Filter 1 -- HTF-Sweep, ehrliche Dreiteilung statt einer unvollstaendigen Zuordnung.
#
#   HTF sicher : in liquidity_levels gefunden (Tabelle fuehrt nur 1H/4H), ODER Abstand zum
#                Fraktal >5 Pips, ODER Vorlauf >45 Min -- die beiden letzten sind fuer ein
#                M5-LS per maxDistanceM5/lsMaxLeadSecM5 unmoeglich (_shared/tradeSetup.ts).
#   M5 sicher  : ls_pivot liegt NICHT auf einer vollen Stunde -- ein 1H-Pivot kann das nie.
#   unklar     : auf voller Stunde, aber keines der HTF-Merkmale. Enthaelt echte M5-Pivots
#                (rund jeder 12.) und die H1-Level, deren Zeile nicht mehr existiert.
import json, datetime, statistics

BASE = r"C:\Users\Philip\.claude\projects\c--Users-Philip-Documents-git-trading-monitor\25cfa4c0-a261-49e1-9482-af67f53adc09\tool-results"
rows = json.load(open(BASE + r"\mcp-trading-monitor-get_trade_setups-1789808350250.txt"))
levels = json.load(open(BASE + r"\mcp-trading-monitor-get_near_relevant_liquidity_levels-1789817921915.txt"))["levels"]
res = json.load(open("punkt1_result.json"))
ts = lambda s: int(datetime.datetime.fromisoformat(s).timestamp())
by_id = {r["id"]: r for r in rows}
known = {(round(l["price"], 5), l["pivotTime"]) for l in levels}

for x in res:
    r = by_id[x["id"]]
    dist = abs(r["ls_price"] - r["fractal_price"]) / 0.0001
    lead = (ts(r["fractal_pivot_time"]) - ts(r["ls_touched_time"])) / 60.0
    on_hour = ts(r["ls_pivot_time"]) % 3600 == 0
    in_tbl = (round(r["ls_price"], 5), ts(r["ls_pivot_time"])) in known
    if in_tbl or dist > 5.0 or lead > 45.0:
        x["cls"] = "HTF sicher"
    elif not on_hour:
        x["cls"] = "M5 sicher"
    else:
        x["cls"] = "unklar"


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
