# -*- coding: utf-8 -*-
# Taugt ein Trade-Setup mit groesserer FVG besser? Anlass: Philip, 23.09.2026, zu Setup #2936
# ("die FVG ist 0,5 Pip. viel zu schwach. koennten wir ueberlegen sowas rauszufiltern").
#
# Gemessen wird zuerst, gefiltert wird erst danach -- dieselbe Reihenfolge wie beim Gegenkraft-
# Filter. Geschnitten nach FESTEN Baendern (nicht Terzilen, siehe baenderTabellen.py), alle ueber
# Philips 50er-Schwelle.
#
# ZWEI ENTRY-MODELLE, und darauf kommt hier alles an:
#   Standard    -- Entry an der nahen OB-Kante, Pfad ab FVG-Bestaetigung. So rechnen alle anderen
#                  Tabellen. Der Preis steht zu diesem Zeitpunkt schon rund um die FVG-Groesse im
#                  Plus, denn die Luecke MISST genau diesen Abstand. Wer danach schneidet, misst
#                  den Vorsprung mit, nicht die Qualitaet.
#   Retest      -- Pfad zaehlt erst ab der Kerze, die die OB-Kante wieder beruehrt (lauf(retest=
#                  True)). Das ist der Entry, den Philip real nimmt, und es nimmt den Vorsprung
#                  heraus. DIESE Spalte entscheidet.
import json, random, statistics
from drMerkmale import (lade_setups, lade_kerzen, ts, PIP, DECKEL, lauf,
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
    # Die FVG selbst steht nicht im Dump (ob_gap gibt es erst seit 23.09.2026, der 2025/2026-Lauf
    # ist aelter) -- sie ist aber exakt rekonstruierbar: die FVG-anknuepfende OB-Kante ist c1, und
    # widenObForSweep erweitert immer nur die GEGENUEBERLIEGENDE. Also ob_bottom - high(cur) bei
    # Short, low(cur) - ob_top bei Long, mit cur = die Kerze nach der Impuls-Kerze. Gegenprobe: das
    # Minimum ueber alle 3282 Zeilen ist exakt 0,5000 Pip, die Schwelle der Erkennung.
    cur = kerze[ts(r["ob_start_time"]) + 300]
    x["fvg"] = r.get("ob_gap", (r["ob_bottom"] - cur["high"]) if r["direction"] == "short"
                     else (cur["low"] - r["ob_top"])) / PIP
    x["fvg_rel"] = 100.0 * x["fvg"] / x["risk"]
    # Wie weit der Pfad im Standardmodell schon im Plus startet.
    x["vorsprung"] = ((r["ob_bottom"] - cur["close"]) if r["direction"] == "short"
                      else (cur["close"] - r["ob_top"])) / PIP


def mess_retest(g, k):
    """-> (Quote unter den entschiedenen, Anteil ohne Retest). Entry erst beim Rueckkehr-Touch."""
    e = [lauf(x, k * min(x["risk"], DECKEL), min(x["risk"], DECKEL), retest=True) for x in g]
    w, l = e.count("win"), e.count("loss")
    return (100.0 * w / (w + l) if w + l else float("nan")), 100.0 * e.count("kein Retest") / len(g)


def schneide(baender, feld):
    return [(name, [x for x in res if lo <= x[feld] < hi]) for name, lo, hi in baender]


def tabellen(titel, baender, feld, einheit):
    gruppen = schneide(baender, feld)
    print("%s -- VERTEILUNG UND KONTEXT" % titel)
    print("  %-14s %5s %7s %10s %12s %14s" % ("", "n", "Anteil", "FVG-Median", "Risiko-Med", "Vorsprung-Med"))
    for name, g in gruppen:
        print("  %-14s %5d %6.1f%% %9.1f%s %10.1f P %12.1f P"
              % (name, len(g), 100.0 * len(g) / len(res), statistics.median([x[feld] for x in g]), einheit,
                 statistics.median([x["risk"] for x in g]), statistics.median([x["vorsprung"] for x in g])))
    print()

    print("  R-LEITER, STANDARD-ENTRY (Vorsprung steckt drin -- NICHT als Qualitaet lesen)")
    print("  %-14s %5s  " % ("", "n") + "".join("%7dR" % k for k in RS))
    for name, g in gruppen:
        print("  %-14s %5d  " % (name, len(g)) + "".join("%6.0f%% " % mess_gedeckelt(g, k)[0] for k in RS))
    print()

    print("  PIP-LEITER, STANDARD-ENTRY (nur Kontext, steigt mit der Volatilitaet)")
    print("  %-14s %5s  " % ("", "n") + "".join("%7dP" % X for X in PIPS))
    for name, g in gruppen:
        print("  %-14s %5d  " % (name, len(g)) + "".join("%6.0f%% " % mess_pips_gedeckelt(g, X)[0] for X in PIPS))
    print()

    print("  R-LEITER MIT RETEST-ENTRY -- DIE ENTSCHEIDENDE TABELLE")
    print("  %-14s %5s  " % ("", "n") + "".join("%7dR" % k for k in RS) + "   ohne Retest")
    for name, g in gruppen:
        print("  %-14s %5d  " % (name, len(g)) + "".join("%6.0f%% " % mess_retest(g, k)[0] for k in RS)
              + "   %9.0f%%" % mess_retest(g, 3)[1])
    print()
    return gruppen


def bootstrap(a, b, k, retest):
    """95%-Intervall fuer den Quotenunterschied a-b bei k R. Seed wie in saisonalitaet.py."""
    random.seed(7)
    treffer = lambda g: [e for e in (lauf(x, k * min(x["risk"], DECKEL), min(x["risk"], DECKEL), retest=retest)
                                     for x in g) if e in ("win", "loss")]
    ta, tb = treffer(a), treffer(b)
    if not ta or not tb:
        return float("nan"), float("nan")
    q = lambda t: 100.0 * sum(1 for _ in t if random.choice(t) == "win") / len(t)
    d = sorted(q(ta) - q(tb) for _ in range(2000))
    return d[int(0.025 * len(d))], d[int(0.975 * len(d))]


print("FVG-GROESSE JE DEALING RANGE -- %d GBPUSD-Setups, FXCM Bid, 2025 und 2026" % len(res))
print("Stopp durchgehend min(strukturelles Risiko, %d Pips), Fenster 24h.\n" % DECKEL)

abs_gruppen = tabellen("1) ABSOLUTE FVG", BAENDER, "fvg", " P")
tabellen("2) RELATIVE FVG (Luecke / OB-Hoehe)", REL_BAENDER, "fvg_rel", " %")

print("3) GEGENPROBE: groesstes gegen kleinstes Band, 3 R, 95%-Bootstrap-Intervall")
gross, klein = abs_gruppen[-1][1], abs_gruppen[0][1]
for modus, retest in (("Standard-Entry", False), ("Retest-Entry ", True)):
    lo, hi = bootstrap(gross, klein, 3, retest)
    print("  %s: ueber 8 Pips gegen unter 1 Pip = %+.0f bis %+.0f Punkte%s"
          % (modus, lo, hi, "   <- enthaelt die Null" if lo <= 0 <= hi else ""))
