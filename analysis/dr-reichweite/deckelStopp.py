# -*- coding: utf-8 -*-
# Wie weit ist es von der nahen OB-Kante bis zum Extrem-Fraktal -- und was kostet ein Deckel?
#
# Philips Idee (19.09.2026): "wenn das Risiko ueber 10 Pips gross ist, machts auch keinen Sinn ...
# ich denke man koennte auf maximal 6-7 pips eingrenzen, falls diese Distanzstrecke drueber ist."
#
# Gerechnet wird das als reine PFAD-Frage, ohne Entry-Modell: laeuft der Preis mehr als C Pips
# ueber die nahe OB-Kante hinaus (gegen die Trade-Richtung), bevor das Ziel kommt? Wenn ja, haette
# ein Stopp bei C den Trade gekillt, den die Invalidierung noch am Leben gelassen haette. Der
# Entry bleibt dabei fix an der OB-Kante -- nur so sind zwei Stopp-Platzierungen vergleichbar.
#
# Ziel und Stopp in derselben M5-Kerze zaehlen als Verlust, wie in _shared/tradeSetupOutcome.ts.
import json, bisect, statistics
from drMerkmale import lade_setups, lade_kerzen, ts, PIP, ARM, HORIZON

med = lambda v: statistics.median(v) if v else float("nan")
setups = {r["id"]: r for r in lade_setups()}
cnd, times = lade_kerzen()
res = json.load(open("punkt1_result.json"))
n = len(res)


def lauf(x, ziel_pips, stop_pips):
    """-> 'win' | 'loss' | 'offen', beides gemessen ab der nahen OB-Kante."""
    r = setups[x["id"]]
    d = x["dir"]
    ref = r["ob_bottom"] if d == "short" else r["ob_top"]
    start = ts(r["ob_start_time"]) + ARM
    ziel = ref - ziel_pips * PIP if d == "short" else ref + ziel_pips * PIP
    stop = ref + stop_pips * PIP if d == "short" else ref - stop_pips * PIP
    i = bisect.bisect_left(times, start)
    while i < len(cnd) and cnd[i]["time"] <= start + HORIZON:
        c = cnd[i]
        traf_ziel = (c["low"] <= ziel) if d == "short" else (c["high"] >= ziel)
        traf_stop = (c["high"] >= stop) if d == "short" else (c["low"] <= stop)
        if traf_ziel and traf_stop:
            return "loss"
        if traf_ziel:
            return "win"
        if traf_stop:
            return "loss"
        i += 1
    return "offen"


print("VERTEILUNG des Risikos (nahe OB-Kante -> Extrem-Fraktal), alle %d DRs" % n)
kum = 0
for a, b in [(0, 2), (2, 3), (3, 4), (4, 5), (5, 6), (6, 7), (7, 8), (8, 10), (10, 15), (15, 99)]:
    g = [x for x in res if a <= x["risk"] < b]
    kum += len(g)
    print("  %2.0f-%-2.0f Pips : %3d  (%4.1f %%)   kumuliert %3d (%5.1f %%)"
          % (a, b, len(g), 100.0 * len(g) / n, kum, 100.0 * kum / n))
r = sorted(x["risk"] for x in res)
print("  min %.1f | p25 %.1f | median %.1f | p75 %.1f | p90 %.1f | max %.1f"
      % (r[0], r[len(r) // 4], med(r), r[3 * len(r) // 4], r[int(0.9 * len(r))], r[-1]))
print()
for C in (5, 6, 7, 8, 10):
    ueber = [x for x in res if x["risk"] > C]
    print("  ueber %2d Pips: %3d von %d (%4.1f %%), deren Median %.1f P" % (C, len(ueber), n, 100.0 * len(ueber) / n, med([x["risk"] for x in ueber])))
print()

print("WAS KOSTET DER DECKEL -- nur die betroffene Gruppe (Risiko > Deckel),")
print("bei allen anderen aendert er per Definition nichts.")
for C in (8, 7, 6, 5):
    betroffen = [x for x in res if x["risk"] > C]
    print("\n  Deckel %d Pips -- betroffen: %d von %d DRs (Risiko-Median dort %.1f P, max %.1f)"
          % (C, len(betroffen), n, med([x["risk"] for x in betroffen]), max(x["risk"] for x in betroffen)))
    for ziel in (10, 15, 20):
        voll = [lauf(x, ziel, x["risk"]) for x in betroffen]
        deck = [lauf(x, ziel, C) for x in betroffen]
        gekostet = sum(1 for a, b in zip(voll, deck) if a == "win" and b != "win")
        ev_voll = sum((ziel / x["risk"] if e == "win" else -1) for x, e in zip(betroffen, voll) if e != "offen") \
            / max(1, sum(1 for e in voll if e != "offen"))
        ev_deck = sum((ziel / C if e == "win" else -1) for e in deck if e != "offen") \
            / max(1, sum(1 for e in deck if e != "offen"))
        print("     Ziel %2dP | Wins %3d -> %3d (%d gekostet) | RR %.2f -> %.2f | EV %+.2f -> %+.2f R"
              % (ziel, voll.count("win"), deck.count("win"), gekostet,
                 ziel / med([x["risk"] for x in betroffen]), ziel / C, ev_voll, ev_deck))

print("\n\nGESAMTBILD ueber alle %d DRs (Deckel greift nur, wo das Risiko groesser ist)" % n)
print("  %-24s %5s %5s %5s %7s %8s" % ("Stopp", "win", "loss", "offen", "Quote", "EV"))
for ziel in (10, 15, 20):
    print("  Ziel %d Pips:" % ziel)
    for name, cap in (("Invalidierung (heute)", None), ("gedeckelt auf 8 P", 8),
                      ("gedeckelt auf 7 P", 7), ("gedeckelt auf 6 P", 6), ("gedeckelt auf 5 P", 5)):
        w = l = o = 0
        ev = 0.0
        for x in res:
            s = x["risk"] if cap is None else min(x["risk"], cap)
            erg = lauf(x, ziel, s)
            if erg == "win":
                w += 1
                ev += ziel / s
            elif erg == "loss":
                l += 1
                ev -= 1
            else:
                o += 1
        print("    %-24s %5d %5d %5d %6.0f%% %+8.2f R" % (name, w, l, o, 100.0 * w / (w + l), ev / (w + l)))
