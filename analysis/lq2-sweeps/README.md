# LQ 2.0: Was macht einen guten Liquiditäts-Sweep aus?

Stand 21.11.2026, git siehe `ergebnis.json`. Reine Analyse: kein Produktivcode, keine DB-Schreibzugriffe.
Grundgesamtheit sind alle gesweepten LQ-1.0-Level (M5, Fraktal P5, Spread Hour ignoriert) aus `fxcm_candles`
vom 05.01. bis 21.11.2026. Alle Zeiten Berlin.

Reproduktion: `node analysis/lq2-sweeps/sammle.mjs` (liest DB paginiert und Kerzen einmal je Instrument in
`local-data/lq2-sweeps/`), danach `node analysis/lq2-sweeps/auswerte.mjs` (offline, ~20 s, Seed 20261121).

## Kurzfassung

1. **Kein LS-Merkmal verbessert die Winrate der DOB-LQ-Sweep-Läufe belastbar.** Gewinner- und Verlierer-LS
   sehen gleich aus: Alter, Impuls, Swings, BOS, Sweep-Tiefe, Session und OB-Kante liegen bei AUC 0,43–0,55.
   Hinweise gibt es nur bei GBP („LH nach LL“, „Wechselpivot überhaupt“), und EUR und XAU bestätigen sie nicht (unten). Die heutige LQ-2.0-Regel (LH nach LL + BOS ≤ 2 h) ändert die
   Winrate in keinem Instrument.
2. **Die heutige LQ-2.0-Regel ist zu streng für Philips Pins.** Sie behält nur 5 der 11 Pins, wirft aber 83 % der
   Zufalls-Sweeps raus. Das passt zu „noch kein Erfolg“.
3. **Was Pins von Zufall trennt** (n = 11, also nur Hinweise): größerer Impuls in H1-ATR, älterer LS, mehr Abstand
   zum nächsten Kandidaten, Sweep häufiger in London.
4. Was „Positiv gegen Zufall“ in den Läufen trennt (LH nach LL, Rückschluss, Abstand zum nächsten Kandidaten), steckt
   genauso in den Verlierern. Das ist die TS1.1-Vorauswahl des LS, keine Sweep-Qualität.

## Mengen

| Herkunft | GBPUSD | EURUSD | XAUUSD |
|---|---|---|---|
| Pins 610–620 („taugt als LQ-Sweep Kraft“) | 11 | – | – |
| Journal, DR gewonnen (Setup-LS oder 5M-Pivot-Evidence) | 8 | 2 | 18 |
| Journal, DR verloren | 4 | 0 | 1 |
| Lauf-LS, erster Trade gewonnen (v0 ∪ v1, eindeutig) | 190 | 156 | 168 |
| Lauf-LS, erster Trade verloren | 332 | 290 | 279 |
| Muster (DR #145 LS 15:45 +, LS 19:40 −; P557 LS 07:45 +) | 1 + / 1 − | – | 1 + |
| **Positiv gesamt / Negativ gesamt** (eindeutig, Konflikte raus) | **192 / 327** | **157 / 289** | **167 / 267** |
| Zufall (aus allen gesweepten LQ-1.0-Leveln) | 3000 | 3000 | 3000 |

- Lauf-LS je Lauf (5M, erster Trade je TS1.1-POI): GBP v0 462, GBP v1 321, EUR v0 447, XAU v0 398, XAU v1 268.
  Pro Lauf 14–26 LS mit H1-Zeitrahmen ausgelassen. v0 und v1 teilen viele LS, sind also nicht unabhängig.
- Konflikte (dieselbe LS einmal gewonnen, einmal verloren, z. B. v0 gegen v1): GBP 10, EUR 1, XAU 13. Sie fallen aus
  Positiv und Negativ raus.
- Ohne LQ-1.0-Gegenstück: EUR DR #94 (Evidence 22.09. 13:30), XAU TS 50160 / DR #140 (22.10. 02:30). DR #112, #134,
  #136 haben weder Setup noch 5M-Pivot-Evidence.
- Journal-DR mit gemischten Positionen zählt als gewonnen, sobald eine Position gewann.

## Merkmale (für alle Gruppen gleich berechnet)

`ageHours` LS bis Sweep · `lhAfterLL` LS ist Wechselpivot direkt nach LL (Short; Long gespiegelt) · `isLH` LS unter
vorigem Hoch · `bos2h` = LQ-2.0-Regel aus `src/liquidity2.js` · `bosBeforeSweep`/`bosMinutes` Schluss unter dem LL
vor dem Sweep · Impuls bis zum ersten Gegen-Pivot ab BOS (`impulsePips`, `impulseAtr` in H1-ATR(14), `impulseMinutes`),
`brokenSwings` per Schluss gebrochene Swing-Tiefs (5 Tage zurück) · `sweepDepth*`, `closedBack` · `lsSession`/
`sweepSession` (Asia/MMM/NY aus `sessions`, London = 07:00–10:30, „Sonstige“ = 13–14 Uhr und 22–23 Uhr) ·
`sessionExtreme` (`contextForPivot`) · `m5Ob*`/`m15Ob*` LS auf OB-Kante (1 Tick bzw. 1 Pip, Gold 1/3 USD) ·
`rankRecency` Rang unter den aktiven Kandidaten · `gapNextAtr` Abstand zum nächsten aktiven Kandidaten dahinter.

## Pins gegen Zufall (GBPUSD, 11 gegen 3000)

| Merkmal | Pins: Median (Q25–Q75) | Zufall: Median (Q25–Q75) | Trennung | p |
|---|---|---|---|---|
| Impuls in H1-ATR | 1,22 (0,98–2,57) | 0,94 (0,59–1,58) | AUC 0,69 | 0,03 |
| Abstand zum nächsten Kandidaten (ATR) | 0,83 (0,47–1,13) | 0,38 (0,15–0,83) | AUC 0,71 | 0,02 |
| LQ-2.0-Regel erfüllt | 45 % | 17 % | | 0,01 |
| Alter (h) | 4,0 (2,1–9,5) | 1,9 (0,8–7,6) | AUC 0,63 | 0,14 |
| Impuls in Pips | 15,8 (12,9–29,6) | 13,9 (8,6–23,5) | AUC 0,62 | 0,18 |
| LH nach LL | 64 % | 40 % | | 0,11 |
| Sweep in London | 45 % | 18 % | | Hinweis |
| gebrochene Swings, Sweep-Tiefe, OB-Kante, Session-High/-Low | gleich | | | > 0,3 |

Bei 21 getesteten Merkmalen hält davon keines eine Bonferroni-Korrektur aus (Schwelle ≈ 0,002). 3 der 11 Pins
(611, 617, 620) sind keine Wechselpivots: Zwischen zwei Hochs liegt kein P5-Tief. Eine Strukturregel auf
den heutigen alternierenden P5-Pivots kann diese Pins nie behalten.

## Lauf-Gewinner gegen Lauf-Verlierer (erster Trade je LS)

| | GBP 190/332 | EUR 156/290 | XAU 168/279 |
|---|---|---|---|
| Stärkstes Zahlenmerkmal (AUC) | `bosMinutes` 0,43 (p 0,08) | `rankRecency` 0,54 (p 0,16) | alle 0,49–0,51 |
| LH nach LL (Anteil Gewinner/Verlierer) | 60 % / 50 % (p 0,02) | 43 % / 45 % | 52 % / 51 % |
| Wechselpivot überhaupt | 87 % / 76 % (p 0,001) | 75 % / 78 % | 77 % / 83 % |
| LQ-2.0-Regel | 26 % / 24 % | 19 % / 23 % | 26 % / 25 % |

„LH nach LL“ je Lauf (Winrate behalten / verworfen): GBP v0 40,7 / 30,1 % (p 0,02), GBP v1 39,2 / 32,7 % (p 0,23),
XAU v1 39,9 / 32,6 % (p 0,22), XAU v0 37,1 / 38,0 %, EUR v0 34,0 / 35,6 %. Die Richtung stimmt in 3 von 5 Läufen,
die Läufe überlappen aber. Das ist ein Hinweis, kein Befund. „Wechselpivot überhaupt“ ist bei GBP das schärfste
Lauf-Merkmal (p 0,001), dreht bei EUR und XAU aber die Richtung.

## Kandidaten-Regeln

Positiv/Pins/Journal = Anteil behalten · Zufall raus = Anteil verworfen · WR = Winrate erster Lauf-Trade je LS,
behalten gegen verworfen. Break-even bei 3R ≈ 25 %.

| Regel | GBP Pins | GBP Journal + | Zufall raus (GBP/EUR/XAU) | WR GBP | WR EUR | WR XAU |
|---|---|---|---|---|---|---|
| LQ 2.0 heute (LH nach LL + BOS ≤ 2 h) | 5/11 | 38 % | 83 / 84 / 83 % | 38 / 36 | 30 / 36 | 38 / 38 |
| LH nach LL | 7/11 | 63 % | 60 / 61 / 59 % | **41 / 31** (p 0,02) | 34 / 36 | 38 / 37 |
| Impuls ≥ 0,5 H1-ATR | 11/11 | 100 % | 18 / 18 / 17 % | 37 / 32 | 37 / 26 (p 0,08) | 37 / 42 |
| Impuls ≥ 1 H1-ATR | 8/11 | 63 % | 54 / 54 / 56 % | 37 / 36 | 38 / 32 | 38 / 37 |
| Alter ≥ 2 h | 8/11 | 75 % | 50 / 51 / 51 % | 37 / 36 | 36 / 34 | 36 / 39 |
| Impuls ≥ 1 ATR + Alter ≥ 2 h | 7/11 | 50 % | 64 / 64 / 64 % | 38 / 35 | 38 / 33 | 37 / 38 |
| ≥ 1 gebrochener Swing | 7/11 | 63 % | 51 / 52 / 52 % | 36 / 37 | 35 / 35 | 36 / 40 |
| M5/M15-OB-Kante (Pip) | 8/11 | 63 % | 18 / 14 / 41 % | 37 / 34 | 36 / 31 | 39 / 35 |

Mustertrades: DR #145 LS 15:45 erfüllt alles (LH nach LL, BOS nach 50 min, 2,5 ATR, 3 Swings, 20 h alt). Der
popelige LS 19:40 fällt nur an der Struktur durch (kein LH, kein LH nach LL), Impuls 1,5 ATR und 1 Swing hätte er.
P557 LS 07:45 erfüllt LQ 2.0 (BOS nach 15 min, 1,1 ATR, 1 Swing, 2,8 h).

## Vorschlag

- **Impuls ≥ 0,5 H1-ATR als Untergrenze.** Sie behält alle Pins und alle gewonnenen Journal-DRs und wirft knapp
  ein Fünftel der Zufalls-Sweeps raus. Die Lauf-Winrate ändert sie nicht belastbar (bei XAU sind die verworfenen
  sogar etwas besser, 42 gegen 37 %, p 0,43). Ein sicherer, aber schwacher Filter.
- **Struktur bleibt Kern, BOS ≤ 2 h wird gelockert.** „LH nach LL“ ist der einzige Lauf-Hinweis und trennt 15:45
  von 19:40. Die 2-h-BOS-Pflicht kostet dagegen Pins ohne Winrate-Gewinn. Variante zum Ansehen am Chart:
  LH nach LL **und** (Impuls ≥ 1 ATR **oder** Alter ≥ 2 h).
- **Strukturbasis prüfen:** 3 von 11 Pins sind auf den alternierenden P5-Pivots gar keine Wechselpivots. Bevor eine
  Strukturregel scharf geschaltet wird, sollte Philip entscheiden, ob innere Pivots (kleinere Periode oder M1)
  zählen.
- **Für eine belastbare Regel fehlen Daten, nicht Merkmale.** Die Lauf-Winrate ist als Zielgröße für die LS-Qualität
  zu verrauscht (Entry, SL und DOB entscheiden mehr). Nötig wären etwa 30 bis 50 weitere Pins, systematisch
  gesetzt: gute **und** popelige LS, auch für EUR und XAU. Dann ist der Vergleich Pins gegen Pins möglich statt
  Pins gegen Zufall.
