# -*- coding: utf-8 -*-
# Taugt eine Dealing Range mit groesserer FVG besser? Anlass: Philip, 23.09.2026, zu Setup #2936
# ("die FVG ist 0,5 Pip. viel zu schwach. koennten wir ueberlegen sowas rauszufiltern").
#
# Gemessen wird zuerst, gefiltert wird erst danach -- dieselbe Reihenfolge wie beim Gegenkraft-
# Filter. Geschnitten nach FESTEN Baendern (nicht Terzilen, siehe baenderTabellen.py), alle ueber
# Philips 50er-Schwelle.
#
# Gemessen wird die STRECKE AB DER NAHEN OB-KANTE, wie in jeder anderen Tabelle hier -- ob der
# Preis die Kante nochmal beruehrt, ist keine Bedingung (Philip 23.09.2026: "entries suche ich
# anders ... ansonsten kann ich auch im M1 einen entry finden ohne OB Retest"). Der Retest laeuft
# nur als Protokollspalte mit.
import json, random, statistics
from drMerkmale import (lade_setups, lade_kerzen, ts, PIP, DECKEL, lauf, kam_retest,
                        mess_gedeckelt, mess_pips_gedeckelt, PIPS_REIHE as PIPS)

RS = (2, 3, 4, 5, 6)
# Absolute Luecke in Pips. Untergrenze ist 0,5 (das M5-Minimum in orderBlockDetection.js), oben
# offen. Besetzung: 972 / 963 / 539 / 493 / 217 / 98.
BAENDER = (("unter 1 Pip", 0, 1), ("1-2 Pips", 1, 2), ("2-3 Pips", 2, 3),
           ("3-5 Pips", 3, 5), ("5-8 Pips", 5, 8), ("ueber 8 Pips", 8, 1e9))
# Relative Luecke = FVG / OB-Hoehe. Philips Einwand war ein Missverhaeltnis (0,5 Pip in einem
# 15,8-Pip-OB), nicht die absolute Zahl -- moeglich, dass das besser trennt. Grenzen an den
# Dezilen der Verteilung.
REL_BAENDER = (("unter 15 %", 0, 15), ("15-25 %", 15, 25), ("25-40 %", 25, 40),
               ("40-65 %", 40, 65), ("ueber 65 %", 65, 1e9))

res = json.load(open("punkt1_result.json"))
by_id = {r["id"]: r for r in lade_setups()}
cnd, _ = lade_kerzen()
kerze = {c["time"]: c for c in cnd}

for x in res:
    r = by_id[x["id"]]
    # Die FVG steht nicht im Dump (ob_gap gibt es erst seit 23.09.2026, der 2025/2026-Lauf ist
    # aelter) -- sie ist aber exakt rekonstruierbar: die FVG-anknuepfende OB-Kante ist c1, und
    # widenObForSweep erweitert immer nur die GEGENUEBERLIEGENDE. Also ob_bottom - high(cur) bei
    # Short, low(cur) - ob_top bei Long, mit cur = die Kerze nach der Impuls-Kerze. Gegenprobe: das
    # Minimum ueber alle 3282 Zeilen ist exakt 0,5000 Pip, die Schwelle der Erkennung.
    cur = kerze[ts(r["ob_start_time"]) + 300]
    x["fvg"] = r.get("ob_gap", (r["ob_bottom"] - cur["high"]) if r["direction"] == "short"
                     else (cur["low"] - r["ob_top"])) / PIP
    x["fvg_rel"] = 100.0 * x["fvg"] / x["risk"]
    x["retest"] = kam_retest(x)


def schneide(baender, feld):
    return [(name, [x for x in res if lo <= x[feld] < hi]) for name, lo, hi in baender]


def tabellen(titel, baender, feld, einheit):
    gruppen = schneide(baender, feld)
    print("%s -- VERTEILUNG UND KONTEXT" % titel)
    print("  %-14s %5s %7s %11s %11s %11s %10s"
          % ("", "n", "Anteil", "FVG-Median", "Risiko-Med", "Reichw-Med", "OB-Retest"))
    for name, g in gruppen:
        print("  %-14s %5d %6.1f%% %10.1f%s %9.1f P %9.1f P %9.0f%%"
              % (name, len(g), 100.0 * len(g) / len(res),
                 statistics.median([x[feld] for x in g]), einheit,
                 statistics.median([x["risk"] for x in g]),
                 statistics.median([x["reach"] for x in g]),
                 100.0 * sum(1 for x in g if x["retest"]) / len(g)))
    print("  OB-Retest = Anteil, bei dem der Preis die nahe Kante binnen 24h nochmal beruehrt hat.")
    print("  Geht in keine Quote ein, steht nur fuers Protokoll.")
    print()

    print("  R-LEITER MIT GEDECKELTEM STOPP (%d Pips) -- am eigenen Risiko normiert" % DECKEL)
    print("  %-14s %5s  " % ("", "n") + "".join("%7dR" % k for k in RS))
    for name, g in gruppen:
        print("  %-14s %5d  " % (name, len(g)) + "".join("%6.0f%% " % mess_gedeckelt(g, k)[0] for k in RS))
    print("  %-14s %5d  " % ("alle", len(res)) + "".join("%6.0f%% " % mess_gedeckelt(res, k)[0] for k in RS))
    print()

    print("  PIP-LEITER MIT DEMSELBEN STOPP -- Kontext, steigt mit der Volatilitaet")
    print("  %-14s %5s  " % ("", "n") + "".join("%7dP" % X for X in PIPS))
    for name, g in gruppen:
        print("  %-14s %5d  " % (name, len(g)) + "".join("%6.0f%% " % mess_pips_gedeckelt(g, X)[0] for X in PIPS))
    print("  %-14s %5d  " % ("alle", len(res)) + "".join("%6.0f%% " % mess_pips_gedeckelt(res, X)[0] for X in PIPS))
    print()
    return gruppen


def bootstrap(a, b, k):
    """95%-Intervall fuer den Quotenunterschied a-b bei k R. Seed wie in saisonalitaet.py."""
    random.seed(7)
    treffer = lambda g: [e for e in (lauf(x, k * min(x["risk"], DECKEL), min(x["risk"], DECKEL))
                                     for x in g) if e in ("win", "loss")]
    ta, tb = treffer(a), treffer(b)
    if not ta or not tb:
        return float("nan"), float("nan")
    q = lambda t: 100.0 * sum(1 for _ in t if random.choice(t) == "win") / len(t)
    d = sorted(q(ta) - q(tb) for _ in range(2000))
    return d[int(0.025 * len(d))], d[int(0.975 * len(d))]


print("FVG-GROESSE JE DEALING RANGE -- %d GBPUSD-Setups, FXCM Bid, 2025 und 2026" % len(res))
print("Strecke ab der nahen OB-Kante, Stopp min(strukturelles Risiko, %d Pips), Fenster 24h.\n" % DECKEL)

abs_gruppen = tabellen("1) ABSOLUTE FVG", BAENDER, "fvg", " P")
rel_gruppen = tabellen("2) RELATIVE FVG (Luecke / OB-Hoehe)", REL_BAENDER, "fvg_rel", " %")

print("3) GROESSTES GEGEN KLEINSTES BAND, 95%-Bootstrap-Intervall")
for titel, gruppen in (("absolut ", abs_gruppen), ("relativ ", rel_gruppen)):
    gross, klein = gruppen[-1][1], gruppen[0][1]
    for k in (2, 3, 4):
        lo, hi = bootstrap(gross, klein, k)
        print("  %s %-12s gegen %-12s bei %dR: %+5.0f bis %+5.0f Punkte%s"
              % (titel, gruppen[-1][0], gruppen[0][0], k, lo, hi,
                 "   <- enthaelt die Null" if lo <= 0 <= hi else ""))
print()
print("  LESEHINWEIS: eine FVG von X Pip ist per Konstruktion bereits Teil der Strecke -- der Preis")
print("  steht zum Messstart schon so weit von der Kante weg. Bei den kleinen Baendern (Median 0,7")
print("  bis 2,5 Pip) faellt das gegen ein 10-Pip-Ziel nicht ins Gewicht, im obersten Band (Median")
print("  10,1 Pip) schon.")
