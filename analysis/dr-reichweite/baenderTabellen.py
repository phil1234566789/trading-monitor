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
DECKEL = 6          # Philips Stopp-Deckel, seit 20.09.2026 die Konvention (siehe PLAN)
R_GEDECKELT = tuple(range(2, 11))
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
# als ~25h werden. Gemessen ueber 3282 DRs: von 3050 M5-Sweeps ist genau einer reif.
#
# ACHTUNG, der Alters-Effekt ist nach dem 2025-Backfill deutlich kleiner (22.09.2026): "reif gegen
# Minor" faellt bei 15 Pips von +25 Punkten [14, 34] auf +10 [3, 17], obwohl die reife Gruppe von
# n=70 auf n=188 gewachsen ist. Medium ist von Minor nicht mehr zu trennen (Median 17,6 gegen 17,6),
# nur Major >=120h steht heraus (29,4, n=72). Die Gegenkraft ist inzwischen das staerkere Merkmal:
# +15 Punkte [11, 19]. Wer hier eine Alters-Zeile baut, darf sie nicht als den grossen Hebel
# verkaufen -- Begruendung und Zahlen in PLAN-dr-statistik-ui.md.
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


# --- Die Leiter, die der Chart tatsaechlich zeichnet -------------------------------------------
# Seit 20.09.2026 rechnet die R-Skala gegen den GEDECKELTEN Stopp min(Risiko, 6 Pips), nicht gegen
# das strukturelle Risiko der Range -- "3 R" soll dasselbe heissen wie in Philips Trade. Oberhalb
# des Deckels liegen die Marken damit fuer jede DR bei denselben Pip-Abstaenden (12/18/24/...).
#
# Das ist eine ANDERE Messung als Tabelle 1 oben, nicht nur eine Umrechnung: dort zaehlt die reine
# Reichweite bis zur fernen OB-Kante, hier laeuft der Pfad gegen den engeren Stopp, der fallen
# kann, waehrend die Range strukturell noch lebt. Deshalb aendern sich auch die Baender unter
# 6 Pips leicht, obwohl der Deckel dort gar nicht greift.
#
# Befund zum Mitnehmen: der Deckel FLACHT die Bandunterschiede ab. Bei 3 R spannen die Baender
# ohne Deckel 32 Punkte auf (72 bis 40), mit Deckel nur noch 20 (72 bis 52), und die oberen drei
# werden praktisch ununterscheidbar (59/52/53 -- das letzte Paar dreht die Reihenfolge sogar um,
# bei n=182 gegen n=134 reines Rauschen). Aus 52 gegen 53 also KEINE Aussage bauen.
def mess_gedeckelt(g, k):
    """-> (Quote, Treffer, unentschieden). Unentschieden = weder Ziel noch Stopp binnen 24h."""
    w = l = o = 0
    for x in g:
        stop = min(x["risk"], DECKEL)
        erg = lauf(x, k * stop, stop)
        if erg == "offen":
            o += 1
        elif erg == "win":
            w += 1
        else:
            l += 1
    return (100.0 * w / (w + l) if w + l else float("nan")), w, o


# Die Pip-Leiter gehoert neben die R-Leiter ins TSC und muss deshalb GEGEN DENSELBEN STOPP messen:
# min(strukturelles Risiko, Deckel) -- nicht pauschal 6 Pips, bei einer engen DR ist der Stopp
# enger. Tabelle 1 oben misst die Pip-Ziele noch gegen die Invalidierung; beide Leitern
# nebeneinander duerfen aber nicht zwei verschiedene Fragen beantworten ("bevor mein Stopp fiel"
# gegen "bevor die Range strukturell starb"). Nenner wie in Tabelle 5 die ENTSCHIEDENEN Faelle.
def mess_pips_gedeckelt(g, X):
    """-> (Quote, Treffer, unentschieden) fuer ein festes Pip-Ziel gegen den gedeckelten Stopp."""
    w = l = o = 0
    for x in g:
        erg = lauf(x, X, min(x["risk"], DECKEL))
        if erg == "offen":
            o += 1
        elif erg == "win":
            w += 1
        else:
            l += 1
    return (100.0 * w / (w + l) if w + l else float("nan")), w, o


print("6) PIP-LEITER MIT GEDECKELTEM STOPP (%d Pips) -- Gegenstueck zu Tabelle 5 fuers TSC" % DECKEL)
print("  %-42s %4s  " % ("", "n") + "".join("%7dP" % X for X in PIPS))
for name, g in baender:
    print("  %-42s %4d  " % (name, len(g)) + "".join("%6.0f%% " % mess_pips_gedeckelt(g, X)[0] for X in PIPS))
print("  %-42s %4d  " % ("alle", len(res)) + "".join("%6.0f%% " % mess_pips_gedeckelt(res, X)[0] for X in PIPS))
print("  Unentschieden ueber alle DRs (weder Ziel noch gedeckelter Stopp binnen 24h):")
print("    " + "  ".join("%dP:%d" % (X, mess_pips_gedeckelt(res, X)[2]) for X in PIPS))
print()

print("5) R-LEITER MIT GEDECKELTEM STOPP (%d Pips) -- das ist die Tabelle fuer die Chart-Skala" % DECKEL)
print("  %-42s %4s  " % ("", "n") + "".join("%7dR" % k for k in R_GEDECKELT))
for name, g in baender:
    print("  %-42s %4d  " % (name, len(g)) + "".join("%6.0f%% " % mess_gedeckelt(g, k)[0] for k in R_GEDECKELT))
print("  %-42s %4d  " % ("alle", len(res)) + "".join("%6.0f%% " % mess_gedeckelt(res, k)[0] for k in R_GEDECKELT))
print()
print("  Marke in Pips, sobald das Risiko ueber dem Deckel liegt:")
print("    " + "  ".join("%dR=%dP" % (k, k * DECKEL) for k in R_GEDECKELT))
print("  Unentschieden ueber alle DRs (weder Ziel noch Stopp binnen 24h):")
print("    " + "  ".join("%dR:%d" % (k, mess_gedeckelt(res, k)[2]) for k in R_GEDECKELT))
print()
print("  Erwartungswert -- RR ist bei gedeckeltem Stopp exakt k, also EV = q*k - (1-q):")
print("  %-42s  " % "" + "".join("%7dR" % k for k in R_GEDECKELT))
for name, g in baender:
    print("  %-42s  " % name
          + "".join("%+7.2f " % (mess_gedeckelt(g, k)[0] / 100 * k - (1 - mess_gedeckelt(g, k)[0] / 100)) for k in R_GEDECKELT))
ev_alle = [mess_gedeckelt(res, k)[0] / 100 * k - (1 - mess_gedeckelt(res, k)[0] / 100) for k in R_GEDECKELT]
print("  %-42s  " % "alle" + "".join("%+7.2f " % e for e in ev_alle))
# Spannweite gerechnet statt hingeschrieben -- als fester Text stand hier nach dem naechsten
# Datenstand (21.09.2026) eine Zahl, die es nicht mehr gab.
print("  Flach ueber die ganze Leiter (%.2f bis %.2f) -- die Anzeige soll informieren, nicht empfehlen."
      % (min(ev_alle), max(ev_alle)))
