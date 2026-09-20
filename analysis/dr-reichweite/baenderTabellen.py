# -*- coding: utf-8 -*-
# Die vier Tabellen, die PLAN-dr-statistik-ui.md fuer die Chart-Anzeige braucht. Sie entstanden am
# 20.09.2026 als Handarbeit im Chat und waren damit nicht wiederholbar -- nach der Umstellung der
# Invalidierung auf die ferne OB-Kante (915 statt 855 DRs) musste jede Zahl einzeln nachgezogen
# werden. Deshalb hier als Skript.
#
# Geschnitten wird nach FESTEN Risiko-Baendern, nicht nach Terzilen: Terzile sind immer gleich
# besetzt, verschieben aber ihre Grenzen, sobald die Stichprobe waechst -- dieselbe DR zeigte nach
# dem naechsten Backfill andere Zahlen. Die Baender sind stabil und alle ueber Philips Schwelle
# ("glaub 50 reichen mir fuer ne Prozentanzahl").
import json, statistics
from drMerkmale import lade_setups, lade_bekannte_level, merkmale, lauf
import filterGegenkraft as gk

PIPS = (10, 15, 20, 25, 30, 35, 40)
RS = (2, 3, 4, 5, 6)
BAENDER = (("unter 3 Pips", 0, 3), ("3-5 Pips", 3, 5), ("5-7 Pips", 5, 7),
           ("7-10 Pips", 7, 10), ("ueber 10 Pips", 10, 1e9))
DECKEL = 6
med = lambda v: statistics.median(v) if v else float("nan")

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
baender = [(name, [x for x in res if lo < x["risk"] <= hi]) for name, lo, hi in BAENDER]


def zeile(name, g, f_pips, f_r, fmt):
    print(("  %-42s %4d  " % (name, len(g))) + "".join(fmt % f_pips(g, X) for X in PIPS)
          + " |" + "".join(fmt % f_r(g, k) for k in RS))


def kopf(titel):
    print(titel)
    print("  %-42s %4s  " % ("", "n") + "".join("%7dP" % X for X in PIPS)
          + " |" + "".join("%7dR" % k for k in RS))


def ev(g, ziel_pips, rr):
    """Erwartungswert in R ueber die ENTSCHIEDENEN DRs (Treffer oder Stopp, nicht 'offen').
    Treffer zaehlt +RR, Stopp -1. RR bei 10 gedeckelt, damit kein Ausreisser die Zahl traegt."""
    summe = anzahl = 0
    for x in g:
        z = ziel_pips(x)
        erg = lauf(x, z, x["risk"])
        if erg == "offen":
            continue
        summe += min(rr(x, z), 10) if erg == "win" else -1
        anzahl += 1
    return summe / anzahl if anzahl else float("nan")


kopf("1) TREFFERQUOTE JE RISIKO-BAND")
for name, g in baender:
    zeile(name, g, quote, quote_r, "%6.0f%% ")
zeile("alle", res, quote, quote_r, "%6.0f%% ")
print()

# Der informativste verfuegbare Schnitt: Sweep-ALTER (Philips Kriterium, 20.09.2026: "ob ein
# Liquidity Sweep von M5 oder einem Higher Timeframe kommt, ist mir eigentlich egal, es spielt das
# Alter eine Rolle") kombiniert mit der lebenden Gegen-DR.
#
# Die frueher hier stehende Sweep-HERKUNFT ist damit raus -- sie war ohnehin fast dasselbe Merkmal,
# und zwar strukturell: poi-watcher laedt 300 M5-Kerzen (~25h), ein M5-Level kann also nie aelter
# als ~25h werden. Gemessen: von 815 M5-Sweeps sind 0 reif, von 100 1H-Sweeps sind 75 % reif.
#
# Medium und Major sind EIN Topf. Der Unterschied zwischen ihnen ist auf dieser Stichprobe nicht
# belegbar (15 Pips: 9 Punkte, 95 %-Intervall [-9, +26] bei n=30 gegen n=45). Die belastbare Linie
# liegt bei 24 Handelsstunden: reif gegen Minor sind +25 Punkte, Intervall [14, 34].
kopf("2) ZWEITER SCHNITT: SWEEP-ALTER x GEGENKRAFT")
schnitte = [
    ("reifer Sweep (>= 24h)", [x for x in res if x["age_h"] >= 24]),
    ("Minor, kein lebender Gegner",
     [x for x in res if x["age_h"] < 24 and x["konstellation"] == "keine Gegen-DR"]),
    ("Minor gegen lebende M5-Gegen-DR",
     [x for x in res if x["age_h"] < 24 and x["konstellation"] == "beide M5"]),
]
for name, g in schnitte:
    zeile(name, g, quote, quote_r, "%6.0f%% ")
zeile("alle", res, quote, quote_r, "%6.0f%% ")
print()

kopf("3) ERWARTUNGSWERT IN R JE RISIKO-BAND")
for name, g in baender:
    zeile(name, g,
          lambda gg, X: ev(gg, lambda x: X, lambda x, z: z / x["risk"]),
          lambda gg, k: ev(gg, lambda x: k * x["risk"], lambda x, z: k),
          "%7.2f ")
zeile("alle", res,
      lambda gg, X: ev(gg, lambda x: X, lambda x, z: z / x["risk"]),
      lambda gg, k: ev(gg, lambda x: k * x["risk"], lambda x, z: k),
      "%7.2f ")
print()
print("  Flach innerhalb einer Zeile = das Ziel zu optimieren bringt fast nichts.")
print("  Gefaelle zwischen den Zeilen = das RR kommt aus der Auswahl der DR.")
print()

print("4) GEDECKELTER STOPP (%d Pips), Ziel 20 Pips" % DECKEL)
print("  %-42s %4s   %-24s %s" % ("", "n", "Stopp = Invalidierung", "mit Deckel"))
for name, g in baender:
    voll = [lauf(x, 20, x["risk"]) for x in g]
    deck = [lauf(x, 20, min(x["risk"], DECKEL)) for x in g]
    ev_voll = ev(g, lambda x: 20, lambda x, z: z / x["risk"])
    ev_deck = sum((20 / min(x["risk"], DECKEL) if e == "win" else -1)
                  for x, e in zip(g, deck) if e != "offen") / max(1, sum(1 for e in deck if e != "offen"))
    unberuehrt = all(x["risk"] <= DECKEL for x in g)
    rechts = "unberuehrt" if unberuehrt else ("%3.0f %% * %+.2f R" % (
        100.0 * deck.count("win") / max(1, sum(1 for e in deck if e != "offen")), ev_deck))
    print("  %-42s %4d   %3.0f %% * %+.2f R          %s"
          % (name, len(g), 100.0 * voll.count("win") / max(1, sum(1 for e in voll if e != "offen")),
             ev_voll, rechts))
