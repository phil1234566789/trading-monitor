# -*- coding: utf-8 -*-
# SCHRITT 2, Filter 2 -- Gegenkraft als PAARVERGLEICH (Philips Definition, 19.09.2026):
# Eine Gegner-DR ist gefaehrlich, wenn sie sich VORHER gebildet hat und noch nicht fertig ist
# (weder Invalidierung noch Target erreicht). Da das sehr haeufig vorkommt, entscheidet die
# relative Staerke: "Wir traden nur, wenn die gegnerische Seite viel zu schwach ist" --
# guter LQ-Sweep gegen "Popel-M5-Sweep".
import json, datetime, bisect, statistics, collections

BASE = r"C:\Users\Philip\.claude\projects\c--Users-Philip-Documents-git-trading-monitor\25cfa4c0-a261-49e1-9482-af67f53adc09\tool-results"
rows = json.load(open(BASE + r"\mcp-trading-monitor-get_trade_setups-1789808350250.txt"))
levels = json.load(open(BASE + r"\mcp-trading-monitor-get_near_relevant_liquidity_levels-1789817921915.txt"))["levels"]
cnd = json.load(open(BASE + r"\mcp-trading-monitor-get_forex_candles_archive-1789814595814.txt"))
cnd.sort(key=lambda c: c["time"]); times = [c["time"] for c in cnd]
PIP = 0.0001; ARM = 600; HORIZON = 24 * 3600
ts = lambda s: int(datetime.datetime.fromisoformat(s).timestamp())
for r in rows:
    r["_B"] = (r["fractal_price"] == r["ls_price"] and r["fractal_pivot_time"] == r["ls_pivot_time"])
known = {(round(l["price"], 5), l["pivotTime"]) for l in levels}

groups = collections.defaultdict(list)
for r in rows:
    groups[(r["direction"], r["ob_start_time"], r["ob_top"], r["ob_bottom"])].append(r)


def walk(lead, d, ref, inval, start, tgt_pips):
    """-> (reach, t_inval_min|None, t_target_min|None)"""
    i = bisect.bisect_left(times, start)
    reach = 0.0; t_inv = t_tg = None
    tgt = ref - tgt_pips * PIP if d == "short" else ref + tgt_pips * PIP
    while i < len(cnd) and cnd[i]["time"] <= start + HORIZON:
        c = cnd[i]
        fav = (ref - c["low"]) if d == "short" else (c["high"] - ref)
        if fav / PIP > reach: reach = fav / PIP
        if t_tg is None and ((c["low"] <= tgt) if d == "short" else (c["high"] >= tgt)):
            t_tg = (c["time"] - start) / 60.0
        if (c["high"] >= inval) if d == "short" else (c["low"] <= inval):
            t_inv = (c["time"] - start) / 60.0
            break
        i += 1
    return reach, t_inv, t_tg


def build(tgt_pips):
    drs = []
    for key, g in groups.items():
        a = [r for r in g if not r["_B"]]
        if not a: continue
        lead = a[0]; d, obst, obtop, obbot = key
        start = ts(obst) + ARM
        if not (times[0] <= start <= times[-1] - 3600): continue
        ref = obbot if d == "short" else obtop
        inval = lead["fractal_price"]
        if (inval <= ref) if d == "short" else (inval >= ref): continue
        reach, t_inv, t_tg = walk(lead, d, ref, inval, start, tgt_pips)
        ends = [t for t in (t_inv, t_tg) if t is not None]
        fertig = start + (min(ends) * 60 if ends else HORIZON)
        dist = abs(lead["ls_price"] - lead["fractal_price"]) / PIP
        ldm = (ts(lead["fractal_pivot_time"]) - ts(lead["ls_touched_time"])) / 60.0
        strict = ((round(lead["ls_price"], 5), ts(lead["ls_pivot_time"])) in known) or dist > 5.0 or ldm > 45.0
        drs.append(dict(id=lead["id"], d=d, start=start, fertig=fertig, reach=reach,
                        t_inv=t_inv, strict=strict,
                        broad=strict or ts(lead["ls_pivot_time"]) % 3600 == 0))
    return drs


def analyse(drs, strength, tgt_pips):
    buckets = collections.defaultdict(list)
    for x in drs:
        opp = [o for o in drs if o["d"] != x["d"] and o["start"] < x["start"] and o["fertig"] > x["start"]]
        if not opp:
            k = "keine Gegen-DR"
        else:
            me = x[strength]
            strongest_opp = any(o[strength] for o in opp)
            if me and not strongest_opp: k = "ich HTF, Gegner M5"
            elif me and strongest_opp:   k = "beide HTF"
            elif not me and not strongest_opp: k = "beide M5"
            else: k = "ich M5, Gegner HTF"
        buckets[k].append(x)
    order = ["keine Gegen-DR", "ich HTF, Gegner M5", "beide HTF", "beide M5", "ich M5, Gegner HTF"]
    print("--- Staerke-Definition: %s | Target fuer 'fertig': %d Pips ---" % (strength, tgt_pips))
    for k in order:
        g = buckets.get(k, [])
        if not g:
            print("  %-20s n=  0" % k); continue
        v = sorted(x["reach"] for x in g)
        print("  %-20s n=%3d | Reichweite median %5.1f | >=15P %3d | >=20P %3d | nie inval. %2d"
              % (k, len(g), statistics.median(v),
                 sum(1 for x in g if x["reach"] >= 15), sum(1 for x in g if x["reach"] >= 20),
                 sum(1 for x in g if x["t_inv"] is None)))
    print()


for TGT in (20,):
    drs = build(TGT)
    print("DRs: %d   davon HTF strict %d / broad %d\n" % (
        len(drs), sum(1 for x in drs if x["strict"]), sum(1 for x in drs if x["broad"])))
    analyse(drs, "strict", TGT)
    analyse(drs, "broad", TGT)
for TGT in (15, 25):
    analyse(build(TGT), "broad", TGT)
