# -*- coding: utf-8 -*-
# SCHRITT 2, Filter 2 -- Gegenkraft als PAARVERGLEICH (Philips Definition, 19.09.2026):
# Eine Gegner-DR ist gefaehrlich, wenn sie sich VORHER gebildet hat und noch nicht fertig ist
# (weder Invalidierung noch Target erreicht). Da das sehr haeufig vorkommt, entscheidet die
# relative Staerke: "Wir traden nur, wenn die gegnerische Seite viel zu schwach ist" --
# guter LQ-Sweep gegen "Popel-M5-Sweep".
import bisect, statistics, collections
from drMerkmale import lade_setups, lade_kerzen, lade_bekannte_level, sweep_herkunft, ts, PIP, ARM, HORIZON

rows = lade_setups()
cnd, times = lade_kerzen()
for r in rows:
    r["_B"] = (r["fractal_price"] == r["ls_price"] and r["fractal_pivot_time"] == r["ls_pivot_time"])
known = lade_bekannte_level()

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
        herkunft = sweep_herkunft(lead, known)
        drs.append(dict(id=lead["id"], d=d, start=start, fertig=fertig, reach=reach,
                        t_inv=t_inv, strict=herkunft == "HTF sicher",
                        broad=herkunft != "M5 sicher"))
    return drs


KONSTELLATIONEN = ["keine Gegen-DR", "ich HTF, Gegner M5", "beide HTF", "beide M5", "ich M5, Gegner HTF"]


def konstellation(x, drs, strength):
    """Welche Gegenkraft-Lage liegt zum Start dieser DR vor? Gefaehrlich ist eine Gegner-DR, die
    sich VORHER gebildet hat und noch nicht fertig ist -- danach entscheidet die relative Staerke."""
    opp = [o for o in drs if o["d"] != x["d"] and o["start"] < x["start"] and o["fertig"] > x["start"]]
    if not opp:
        return "keine Gegen-DR"
    me = x[strength]
    strongest_opp = any(o[strength] for o in opp)
    if me and not strongest_opp: return "ich HTF, Gegner M5"
    if me and strongest_opp:     return "beide HTF"
    if not strongest_opp:        return "beide M5"
    return "ich M5, Gegner HTF"


def analyse(drs, strength, tgt_pips):
    buckets = collections.defaultdict(list)
    for x in drs:
        buckets[konstellation(x, drs, strength)].append(x)
    order = KONSTELLATIONEN
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


# Guard, damit filterTrend.py build() importieren kann, ohne diese Ausgabe auszuloesen.
if __name__ == "__main__":
    for TGT in (20,):
        drs = build(TGT)
        print("DRs: %d   davon HTF strict %d / broad %d\n" % (
            len(drs), sum(1 for x in drs if x["strict"]), sum(1 for x in drs if x["broad"])))
        analyse(drs, "strict", TGT)
        analyse(drs, "broad", TGT)
    for TGT in (15, 25):
        analyse(build(TGT), "broad", TGT)
