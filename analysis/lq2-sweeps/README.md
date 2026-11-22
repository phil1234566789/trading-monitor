# LQ 2.0: Was macht einen guten Liquiditäts-Sweep aus?

> **Entscheidung (Philip, 22.11.2026): Variante B.** Ein LS ist stark, wenn der Impuls ≥ 0,85 H1-ATR ist, mindestens
> 1 Swing gebrochen wird und der LS ein LH nach LL ist (Long gespiegelt). Einen Asia-Ausschluss gibt es nicht.
> Gegen die Reaktion gemessen (H1/H2 2026): Lift 1,47/1,46, Recall 24/26 %. Die Regel behält 12–14 % der Sweeps ohne
> Reaktion. Alle 5 Mustertrade-Pins (623, 624, 625, 626, 629) bleiben drin. Die Schwelle 0,85 ist an Pin 626
> festgemacht. Umsetzung im Chart: Session liq-2-chart.

Stand 21.11.2026. Reine Analyse: kein Produktivcode, keine DB-Schreibzugriffe. Alle Zeiten Berlin.
Grundgesamtheit: alle gesweepten LQ-1.0-Level 2026 (M5, Fraktal P5, Spread Hour ignoriert) aus `fxcm_candles`,
05.01. bis 21.11.2026, GBPUSD, EURUSD und XAUUSD. Halbjahre: H1 = Jan–Jun, H2 = Jul–Nov (Berliner Monat).

Reproduktion (Rohdaten in `local-data/lq2-sweeps/`, nicht eingecheckt):
1. `node analysis/lq2-sweeps/sammle.mjs`: DB paginiert lesen, M5-Kerzen einmal je Instrument.
2. `node analysis/lq2-sweeps/elternTrend.mjs <INSTRUMENT> <DOB-Cache-Ordner>`: TS1.1-Kette (Wurzel und aktuelle Ebene),
   stündlich aus vorhandenen DOB-Kerzen-Caches. Keine DB, ca. 45 s je Instrument.
3. `node analysis/lq2-sweeps/reaktion.mjs` → `reaktion.json` (Hauptergebnis) und `node analysis/lq2-sweeps/auswerte.mjs`
   → `ergebnis.json` (Trade-Ebene und Positiv/Zufall). Die gemeinsame Merkmalsberechnung steht in `merkmale.mjs`.

## Kurzfassung

1. **Die Trade-Winrate taugt nicht als Zielgröße.** Über alle 5 LQ-Sweep-Läufe (4043 Trades mit M5-LS) trennt kein
   LS-Merkmal Gewinner von Verlierern in beiden Halbjahren. Entry, SL und DOB überdecken die Sweep-Qualität.
2. **Die Reaktion nach dem Sweep taugt.** Das sind 17.751 Sweeps mit Rückschluss. Mehrere Merkmale, die vor dem Sweep
   feststehen, sagen eine starke Reaktion in beiden Halbjahren und allen drei Instrumenten vorher: **Impuls in H1-ATR**
   (AUC 0,70/0,71), **Alter des LS** (0,63/0,66), **gebrochene Swings** (0,62/0,64) und **Sweep in NY statt Asia**.
3. **Philips Auswahl bestätigt die Zielgröße.** Von 11 Pins hat keiner „keine Reaktion“, bei den Journal-Gewinnern ist
   es 1 von 28. Im Durchschnitt aller Sweeps sind es 32 %.
4. **Was nicht trennt:** „LH nach LL“ (Lift 1,0), die Richtung der Elternebene (Wurzel und aktuelle Ebene, Lift 1,0),
   die M5/M15-OB-Kante (1,0) und der Abstand zum nächsten Kandidaten. Die heutige LQ-2.0-Regel ist nur schwach
   (Lift 1,3, behält 21 % der starken Reaktionen).

## Zielgröße „Reaktion“

- **Sweep-Zone:** 30 min ab dem ersten Touch. Ein Sweep läuft oft über mehrere Kerzen. Bei DR #145 berührt die
  11:40-Kerze den LS, schließt aber sofort zurück, und 11:45 sticht noch 3 Pips höher. Das Zonen-Extrem ist deshalb die
  Re-Sweep-Grenze.
- **Durchbruch:** kein M5-Schluss zurück hinter den LS innerhalb der Zone. Das ist kein Sweep und gehört nicht zur
  Grundgesamtheit (GBP 1605, EUR 1638, XAU 1500).
- **MFE:** ab dem Touch, vom LS weg, in H1-ATR zum Sweep-Zeitpunkt, bis zum Re-Sweep. **Stark:** MFE ≥ 1,5 ATR in 3 h.
  **Keine:** Re-Sweep, bevor 0,5 ATR erreicht sind. Dazwischen liegt „mittel“.

| | n | stark H1 / H2 | keine H1 / H2 |
|---|---|---|---|
| GBPUSD | 5985 | 14,1 / 16,6 % | 34,5 / 31,6 % |
| EURUSD | 5890 | 14,1 / 14,7 % | 32,3 / 32,3 % |
| XAUUSD | 5876 | 14,7 / 16,5 % | 30,8 / 32,9 % |

MFE-Verteilung (alle, H1-ATR): 1 h Median 0,55 (Q75 0,91, Q90 1,39) · 3 h 0,62 (1,11 / 1,85) · bis Sessionende 0,62
(1,14 / 1,98). Ein Re-Sweep kommt bei 40 % innerhalb 1 h und bei 56 % innerhalb 3 h. Bei 1,5 ATR in 3 h sind 15 % stark.

## Merkmale: stark gegen keine (alle Instrumente, AUC bzw. Lift H1 / H2)

„Trennt“ heißt |AUC − 0,5| ≥ 0,05 und p < 0,01 in beiden Halbjahren, mit gleicher Richtung.

| Merkmal (vor dem Sweep bekannt) | H1 | H2 | trennt | auch je Instrument |
|---|---|---|---|---|
| Impuls vom LS in H1-ATR | AUC 0,70 | 0,71 | ja | GBP, EUR, XAU |
| Alter des LS | 0,63 | 0,66 | ja | GBP, EUR, XAU |
| gebrochene Swings im Impuls | 0,62 | 0,64 | ja | GBP, EUR, XAU |
| Impulsdauer | 0,61 | 0,63 | ja | GBP, EUR, XAU |
| Rang unter aktiven Kandidaten | 0,60 | 0,61 | ja | GBP, EUR, XAU |
| BOS vor dem Sweep | Lift 1,31 | 1,34 | ja | GBP, EUR, XAU |
| Sweep in NY | Lift 1,45 | 1,62 | ja | GBP, EUR, XAU |
| Sweep in Asia | Lift 0,67 | 0,63 | ja (negativ) | GBP, EUR |
| LQ 2.0 heute (LH nach LL + BOS ≤ 2 h) | Lift 1,33 | 1,30 | schwach (AUC 0,53) | – |
| LH nach LL | 1,01 | 1,04 | nein | – |
| mit der Wurzel (TS1.1) | 1,00 | 0,98 | nein | – |
| mit der aktuellen Ebene (TS1.1) | 0,97 | 0,96 | nein | – |
| M5- bzw. M15-OB-Kante (Pip) | 1,00 / 0,92 | 0,99 / 1,03 | nein | – |
| Abstand zum nächsten Kandidaten | AUC 0,51 | 0,50 | nein | – |

Nachlaufend, darum nicht in der LS-Regel:
- Spanne der Sweep-Kerze: AUC 0,79/0,82. Sie steckt zum Teil selbst in der MFE und taugt als Entry-Auslöser.
- Gegen-FVG direkt nach dem Sweep: Lift 1,68/1,95.
- Session-High/-Low: Lift 1,54/1,56. Der Wert kennt das Session-Ende.

## Regeln (nur Merkmale vor dem Sweep)

P = Precision (Anteil stark), R = Recall (Anteil der starken behalten), keine = Anteil der „keine“-Sweeps, die die Regel
behält. Basis stark: 14,3 / 15,9 %. Werte für alle drei Instrumente; je Instrument steht es in `reaktion.json`.

| Regel | P H1 / H2 | R H1 / H2 | Lift | keine behalten |
|---|---|---|---|---|
| LQ 2.0 heute | 19,0 / 20,8 | 20,8 / 21,5 | 1,33 / 1,30 | 14 / 15 % |
| Impuls ≥ 1 ATR | 19,9 / 22,6 | 62,8 / 65,6 | 1,39 / 1,42 | 34 % |
| Impuls ≥ 1,5 ATR | 22,1 / 24,1 | 38,8 / 40,0 | 1,55 / 1,51 | 16 / 17 % |
| Alter ≥ 10 h | 23,0 / 26,3 | 32,4 / 36,8 | 1,61 / 1,65 | 13 % |
| **Impuls ≥ 1 ATR & ≥ 1 Swing & Sweep nicht Asia** | **21,4 / 26,0** | **42,4 / 47,8** | **1,50 / 1,63** | **19 %** |
| LH nach LL & Impuls ≥ 1 ATR & Sweep nicht Asia | 20,2 / 24,5 | 22,8 / 26,4 | 1,41 / 1,54 | 11 / 13 % |

Die gierige Suche auf H1 (geprüft auf H2) findet mit Merkmalen vor dem Sweep keine bessere Kombination als Impuls oder
Alter allein (Lift 1,6–1,7). Darf sie die Sweep-Kerze nutzen, kommt „Spanne ≥ 0,64 ATR & Impuls ≥ 1,1 ATR & Sweep nicht
13–14/22–23 Uhr“ heraus (Lift 2,4 / 2,5). Das ist aber ein Entry-Auslöser, keine LS-Bewertung.

## Gegenprobe

| Regel | Pins | Journal + | Journal − | DR #145 15:45, P557 07:45 | 19:40 raus? |
|---|---|---|---|---|---|
| LQ 2.0 heute | 5/11 | 12/28 | 1/5 | 2/2 | ja |
| Impuls ≥ 1 ATR | 8/11 | 12/28 | 2/5 | 2/2 | nein |
| Impuls ≥ 1 ATR & ≥ 1 Swing & Sweep nicht Asia | 5/11 | 9/28 | 2/5 | 2/2 | **nein** (1,5 ATR, 1 Swing, Sweep London) |
| LH nach LL & Impuls ≥ 1 ATR & Sweep nicht Asia | 4/11 | 9/28 | 1/5 | 2/2 | ja |

Reaktionsklasse der Prüffälle:
- Pins: 5/11 stark, 0/11 keine.
- Journal-Gewinner: 7/28 stark, 1/28 keine.
- DR #145 15:45: „mittel“ (1,28 ATR in 3 h; der große Abgang kam erst nach 15:45).
- P557: stark (1,51).
- 19:40: „mittel“ (0,91).

## Vorschlag

- **LQ-2.0-Kern aus den Daten:** Impuls ≥ 1 H1-ATR, mindestens 1 gebrochener Swing, Sweep nicht in Asia. Die Regel
  ist in beiden Halbjahren und allen Instrumenten stabil (Lift 1,45–1,77). Sie behält knapp die Hälfte der starken
  Reaktionen und wirft vier Fünftel der „keine“-Sweeps raus.
- **Strukturfrage für Philip:** Mit „LH nach LL“ fällt 19:40 raus, und DR #145 und P557 bleiben drin. Die Daten zeigen
  dafür aber keinen Mehrwert: Der Recall halbiert sich, die Precision steigt nicht. Ob die Struktur Pflicht wird, ist
  eine fachliche Entscheidung.
- **Streichen als LS-Kriterium:** BOS ≤ 2 h (zu streng, schwach), OB-Kante, Elterntrend.
- **Grenzen:** Die Regel behält nur 5 von 11 Pins und 9 von 28 Journal-Gewinnern, obwohl diese fast nie scheitern.
  Philips Auge sieht also mehr als diese Merkmale. Die Gold-Journal-Gewinner haben oft nur 0,6–0,9 ATR Impuls.

## Zweite Quelle: M5-OB-Kanten (`obQuelle` in `reaktion.json`)

Die OB-Kanten stammen aus `setup1ObLiquidityLevels` (`detectOrderBlockLiquidityLevels`, dieselben OBs wie der Chart-Toggle
„OB Sweeps“). Zeitraum, Zone und Klassen sind dieselben wie bei den Pivots. Rang und Abstand zum nächsten Kandidaten
entfallen hier, weil die Quelle nur berührte Kanten kennt. Eine OB-Kante, die auf demselben Preis (±1 Tick) zur selben
Zeit gesweept wird wie ein Pivot, zählt als „Pivot“.

| alle Instrumente | n H1 / H2 | stark H1 / H2 | keine H1 / H2 | MFE-Median 3 h |
|---|---|---|---|---|
| Pivot (alle) | 9715 / 8036 | 14,3 / 15,9 % | 32,5 / 32,3 % | 0,61 / 0,62 |
| Pivot ohne OB-Kante | 5387 / 4227 | 13,9 / 15,7 % | 32,8 / 33,5 % | 0,61 / 0,61 |
| Pivot auf OB-Kante | 4328 / 3809 | 14,8 / 16,2 % | 32,2 / 30,8 % | 0,62 / 0,64 |
| OB-Kante, kein Pivot | 10593 / 8383 | 15,1 / 16,2 % | 31,7 / 32,4 % | 0,63 / 0,62 |

- **OB-Kanten reagieren nicht besser als Pivots.** Der Unterschied liegt bei höchstens einem Prozentpunkt und ist nicht
  in beiden Halbjahren signifikant. Das gilt auch je Instrument (GBP, EUR, XAU): Abstand ≤ 1,5 Prozentpunkte, in
  wechselnder Richtung. Auch der Durchbruch-Anteil ist gleich, rund 21 % bei beiden Quellen.
- Innerhalb der reinen OB-Sweeps trennen dieselben Merkmale in beiden Halbjahren: Impuls (AUC 0,70/0,68), Alter
  (0,62/0,62), Swings (0,60/0,61) und Sweep in NY (Lift 1,43/1,57), Asia gegenläufig. Die Elternebene trennt
  wieder nicht.
- Dieselbe Regel (Impuls ≥ 1 ATR & ≥ 1 Swing & Sweep nicht Asia) bringt bei OB-Kanten Lift 1,41/1,46 bei Recall
  45/50 %. Sie lässt sich also für beide Quellen gleich verwenden.
- Bei den Pins liegt der LS seltener auf einer M5-OB-Kante (4/11) als im Zufall (47 %). Die Vermutung „gute Sweeps sind
  eher OB-Kanten“ bestätigen die Daten damit nicht.

## Frühere Auswertung (Positiv/Zufall, `ergebnis.json`)

- Pins gegen Zufall zeigten dieselbe Richtung: größerer Impuls (1,22 gegen 0,94 ATR) und älterer LS (4 gegen 1,9 h).
- Was in den Läufen „Positiv gegen Zufall“ trennte (LH nach LL, Rückschluss), steckte genauso in den Verlierern. Das
  ist die TS1.1-Vorauswahl.
- Lauf-LS (erster Trade je LS): GBP v0 462, v1 321, EUR v0 447, XAU v0 398, v1 268.
- Journal-DR ohne LS: #112, #134, #136.
- Ohne LQ-1.0-Gegenstück: EUR DR #94, XAU TS 50160/DR #140.
- Die HTF-OB-Läufe (`dob-setup-*`) haben keinen TS1.1-Link und damit keinen LS.

## Einzelfall DR #148 (Position 177): FVG-Anti-Confluence R1–R6

GBPUSD Short, 01.10.2026, Zeiten Berlin (CEST). Entry 15:14 bei 1,32230 am bärischen M5-OB 15:00 (1,32274–1,32320).
Laut Journal: SL 1,32292, Exit 17:34 bei 1,31923 als Win, Invalidierung 1,3266. H1-ATR beim Entry 18,7 Pips.
Gerechnet mit `fallDr148.mjs` → `fall-dr148.json`, das Diagramm mit `svgDr148.mjs`. Nur lokale Kerzen.

![DR #148](fall-dr148.svg)

**Bullische Kräfte beim Entry** (Stand 15:10, nur geschlossene Kerzen; Abstand vom Entry nach unten):

| Art | Zeit | Zone/Preis | Abstand | Zustand |
|---|---|---|---|---|
| 1H-OB (Journal-Anti-Confluence, `ob_zones` 4863827) | 13:00 | 1,31923–1,32261 | Entry liegt darin | ungetestet |
| 15M-FVG (A) | 13:30 | 1,32186–1,32310 | Entry liegt darin, direkt unter dem Entry-OB | angelaufen, nicht durchlaufen |
| 5M-FVG (A) | 13:35 | 1,32193–1,32231 | 0 Pips | angelaufen, nicht durchlaufen |
| 15M-OB (B) | 13:30 | 1,32138–1,32186 | 4,4 Pips / 0,23 ATR | ungetestet |
| 5M-OB (B) | 13:35 | 1,32111–1,32193 | 3,7 Pips / 0,20 ATR | ungetestet |
| 15M-FVG (A) / 15M-OB (B) | 12:15 | 1,32078–1,32180 / 1,32034–1,32078 | 5,0 / 15,2 Pips | angelaufen / ungetestet |
| 5M-FVG (A) / 5M-OB (B) | 12:10 | 1,32023–1,32034 / 1,31923–1,32023 | 19,6 / 20,7 Pips | offen / ungetestet |
| protected-low der inneren Aufwärts-Ebene | 13:25 | 1,32111 | 11,9 Pips / 0,63 ATR | nicht gebrochen |
| bullischer LQ-Sweep (Tief 12:00) | 11:55 | holt die Tiefs 29.09. 17:25–19:55 und 01.10. 11:00 (1,32017–1,32084), Tief 1,31923 | 14,6–21,3 Pips / 0,8–1,1 ATR | nicht sauber gebrochen |

**R1–R6:**
- **R1 greift:** Eine offene Gegen-FVG (15M 13:30) liegt direkt unter bzw. im Entry-OB. In Variante B gilt dasselbe für
  den ungetesteten 1H-OB 13:00, in dem der Entry selbst liegt. Beide Varianten würden den Trade sperren.
- **R2 hängt an „direkt vor dem Kurs“:** Der bullische LQ-Sweep 11:55 ist nicht sauber gebrochen, liegt aber 0,8–1,1 ATR
  unter dem Entry und ist zugleich das Ziel. Bei einer Grenze von ≤ 0,5 ATR greift R2 nicht.
- **R3 hebt nichts auf:** Bis zum Entry gibt es keinen Schluss unter das protected-low 13:25 und keinen unter das Sweep-Tief.
- **R4 ist erfüllt:** Nach der aktivierten bullischen Kraft (Sweep 11:55, Anstieg bis 13:55) gibt es mit dem M5-OB 15:00
  einen neuen eigenen bärischen OB.
- **R5 passt:** Die offenen FVGs um den Entry werden nach dem Entry angelaufen, mit einem Rücklauf bis 1,32356 (15:55).
  Die tieferen bei 12:10/12:15 holt der Kurs um 16:55–17:05 (Tief 1,31976 um 17:05) und prallt bis 1,32154 (17:20) ab.
- **R6 rettet den Trade:** Der bärische P2-LH ist das Hoch 14:30 bei 1,32372 (Fraktal P2, LH unter dem Hoch 13:55 bei
  1,32490). Der Struktur-Algo führt ihn nur als „high“, nicht als protected-high. Zum Entry sieht er eine Abwärts-Wurzel
  und darin eine innere Aufwärts-Ebene mit protected-low 1,32111.

**SL-Simulation ab der Entry-Kerze** (gleiche Kerze für SL und Ziel zählt konservativ als SL):

| SL | Risiko | Ziel Journal 1,31923 | Ziel DOB 1,32106 |
|---|---|---|---|
| 1,32292 (Journal und DOB) | 6,2 Pips | SL 15:45 | SL 15:45 (DOB-Lauf: 15:48) |
| **1,32377 (0,5 Pip über P2-LH 14:30)** | **14,7 Pips** | **TP 17:30, +2,09 R** | TP 16:55, +0,84 R |
| 1,32495 (über dem Hoch 13:55) | 26,5 Pips | TP 17:30, +1,16 R | TP 16:55, +0,47 R |
| 1,3266 (Invalidierung) | 43 Pips | TP 17:30, +0,71 R | TP 16:55, +0,29 R |

Das höchste Hoch zwischen Entry und Ziel liegt bei 1,32356 (15:55), 1,6 Pips unter dem P2-LH. Damit hält der SL.

**DOB-Läufe:** Den Trade gibt es identisch in `dob-lq-sweep-gbpusd-v0`, `-v1` (POI TS 10056) und `dob-setup-gbpusd-v0`:
Entry a 15:14 bei 1,32230, SL 1,32292, Ziel 1,32106 (2R). Ergebnis **Loss** um 15:48, max_r 1.
Ein zweiter Entry 17:32 bei 1,31999 ist dort `unknown`.

**Widerspruch im Journal:** Position 177 hat SL 1,32292 und Outcome „win“. Mit diesem SL wäre sie um 15:45 ausgestoppt
worden. Der eingetragene SL ist offenbar der DOB-SL. Philips realer SL lag nach seiner Aussage auf dem P2-LH; dann
stimmt das Win mit 2,09 R.

## SL statt Sperre: FVG-Anti-Confluence auf den DOB-Läufen 2026

Frage (Philip, 22.11.): Gewinnt man mehr, wenn die Anti-Confluence den Trade nicht sperrt, sondern den SL hinter den nächsten
Strukturpunkt legt (Vorbild DR #148)? Skripte `sammleDob.mjs` (Trades und News lesen) und `slStattSperre.mjs` →
`sl-statt-sperre.json`. Ausgewertet sind die jüngsten Läufe je Asset: LQ-Sweep GBP v1, EUR v0, XAU v1 und HTF-OB v3. Nur
abgeschlossene Trades bis 20.11.

> **Korrigiert am 23.11.:** Die erste Fassung zählte „getestet“ bzw. „durchlaufen“ ab der Startzeit der berührenden Kerze.
> Eine M15/H1-Zone galt dadurch beim Entry schon als erledigt, obwohl die Kerze noch lief (DR #148: der 1H-OB 13:00 fehlte).
> Jetzt zählt der Schluss der berührenden Kerze. Damit kippt das Fazit: Die Sperre ist nicht mehr die einzige stabile
> Variante, und (c) M15 liegt in der Winrate in jedem Halbjahr vorn.

**Treffer (R1, Varianten A/B):**
- Eine bullische (Short) bzw. bärische (Long) Zone auf M5/M15/H1 aus den letzten 2 Tagen. Sie ist beim Entry offen (FVG nicht
  vollständig durchlaufen = A) bzw. ungetestet (OB = B), liegt zwischen Ziel und Entry, und ihre Kante liegt höchstens
  0,5 H1-ATR hinter dem Entry.
- **Streng:** Der Entry liegt in der Zone selbst.
- Die breite Definition trifft 66–76 % aller Trades, die strenge 25–26 %.

**Varianten:**
- (a) wie gelaufen: DOB-Ergebnis, Ziel-R oder −1.
- (b) gesperrt: 0 R.
- (c) SL 5 Ticks hinter den letzten bestätigten, bis zum Entry unberührten P2-Swing (M5 oder M15) der letzten 2 Tage, jenseits
  des DOB-SL. Das Ziel bleibt, R wird neu berechnet.
- **Proxy-Hinweis:** Der Struktur-Algo markiert solche LH nicht als protected (DR #148: 14:30 nur „high“), deshalb P2-Fraktale.
- Bei jedem Treffer gab es einen solchen Swing. Der SL wird dadurch im Median 1,5-mal so groß.
- Die eigene M5-Simulation stimmt bei 97 % der Trades mit dem DOB-Ergebnis überein.

Werte als ΣR · WR · Max-DD (R):

| Gruppe | Treffer | (a) wie gelaufen | (b) gesperrt | (c) M5-Swing | (c) M15-Swing |
|---|---|---|---|---|---|
| LQ-Sweep GBP v1 | 588/868 | −16 · 32,7 % · 80 | −19 · 31,1 % · 40 | −36 · 40,7 % · 77 | −22 · 45,9 % · 66 |
| LQ-Sweep EUR v0 | 724/1089 | −6 · 33,1 % · 58 | +19 · 35,1 % · 19 | +18 · 43,0 % · 41 | +6 · 47,8 % · 42 |
| LQ-Sweep XAU v1 | 405/534 | +45 · 36,1 % · 26 | +12 · 36,4 % · 24 | +30 · 43,1 % · 25 | +39 · 49,1 % · 26 |
| HTF-OB GBP v3 | 268/363 | −18 · 31,7 % · 47 | −11 · 29,5 % · 17 | +4 · 43,5 % · 15 | +19 · 50,1 % · 14 |
| HTF-OB EUR v3 | 206/296 | +4 · 33,8 % · 32 | +12 · 37,8 % · 9 | +7 · 43,2 % · 22 | −2 · 46,6 % · 26 |
| HTF-OB XAU v3 | 387/521 | +40 · 35,9 % · 31 | +37 · 42,5 % · 13 | +48 · 44,0 % · 28 | +59 · 50,1 % · 20 |
| **alle LQ-Sweep** | 1717/2491 | +23 · 33,6 % · 63 | +12 · 33,9 % · 40 | +12 · 42,2 % · 76 | +22 · 47,4 % · 70 |
| **alle HTF-OB v3** | 861/1180 | +26 · 34,1 % · 62 | +38 · 37,3 % · 17 | +59 · 43,6 % · 45 | +75 · 49,2 % · 36 |

Nach Halbjahr H1 / H2, als WR und ΣR:

| Gruppe | (a) | (b) | (c) M15 |
|---|---|---|---|
| alle LQ-Sweep | 33,9 / 33,3 % · +24 / −1 | 35,0 / 32,5 % · +21 / −9 | **47,9 / 46,7 %** · +40 / −18 |
| alle HTF-OB v3 | 32,1 / 37,2 % · −27 / +53 | 37,9 / 36,5 % · +25 / +13 | **47,9 / 51,4 %** · +18 / +57 |

**Ergebnis:**
- **(c) M15 hebt die Winrate stabil auf 46–53 %**, in jedem Lauf und jedem Halbjahr. Bei den getroffenen Trades steigt sie von
  33 auf 53–54 %.
- **HTF-OB:** (c) M15 ist in ΣR in beiden Halbjahren besser als (a). Gegenüber der Sperre liegt es nur insgesamt (+75 gegen
  +38 R) und in H2 vorn, in H1 nicht (+18 gegen +25 R). Der Max-DD (36 R) ist doppelt so groß wie bei der Sperre (17 R).
- **LQ-Sweep:** Keine Variante ist in beiden Halbjahren positiv. (c) M15 verliert in H2 18 R, vor allem GBP und EUR.
- **Gegenprobe DR #148:** Der Trade ist ein Treffer (A, B und streng). (c) M5 macht ihn zum Win: SL 1,32377 hinter P2 14:30,
  Ziel um 16:55, +0,84 R mit dem DOB-Ziel 2R (+2,09 R mit Philips Ziel). (c) M15 macht ihn ebenfalls zum Win: SL 1,32495
  hinter dem Swing 13:45, +0,47 R.

## c-losses: Wo verliert (c) M15?

Skript `cLosses.mjs` → `c-losses.json`, nur lokale Daten. Zielmaß ist die Winrate (Philip: TPs per Hand). Der H1-Trend kommt
aus `dobOuterTrend` (H1, 10 Tage). Die LS-Güte nach LQ 2.1 gibt es nur bei LQ-Sweep-Trades mit M5-LS. News-Nähe heißt ein
GBP/EUR/USD-Termin von 1 h vor bis 2 h nach dem Entry; `news_events` hat für 2026 nur 84 Einträge.

**Max-DD von (c) M15:**

| Familie | Max-DD | Zeitraum (Berlin) | Trades | WR darin | Anteil je Asset |
|---|---|---|---|---|---|
| LQ-Sweep | 69,5 R | 10.07. 20:19 → 22.09. 10:56 | 518 | 41,1 % | EUR −32 R (201 T, 40,8 %) · GBP −28 R (193 T, 39,4 %) · XAU −9 R (124 T, 44,4 %) |
| HTF-OB v3 | 35,9 R | 15.01. 20:11 → 06.03. 19:33 | 210 | 39,0 % | XAU −15 R (84 T, 34,5 %) · EUR −15 R (45 T, 31,1 %) · GBP −6 R (81 T, 48,1 %) |

- **LQ-Sweep:** Der DD ist eine Sommerphase (Juli bis September, Schwerpunkt August mit 221 Trades). Je Asset: GBP läuft von
  27.02. bis 08.09. 66 R ins Minus (WR 42 %), mit dem schlechtesten Monat August (35 %, −29 R). EUR 13.07. → 17.11. 42 R,
  XAU 29.06. → 21.10. 26 R.
- **HTF-OB:** Der DD liegt im Januar und Februar (Februar 141 Trades). XAU Januar 28 % WR, EUR Februar und März 43–48 %.

Monatliche WR von (c) M15 (alle Trades, ΣR in Klammern):

| Asset · Familie | Jan | Feb | Mär | Apr | Mai | Jun | Jul | Aug | Sep | Okt | Nov |
|---|---|---|---|---|---|---|---|---|---|---|---|
| GBP LQ | 54 % (+15) | 48 % (0) | 46 % (−10) | 43 % (−10) | 42 % (−9) | 43 % (−7) | 51 % (+9) | **35 % (−29)** | 51 % (+11) | 56 % (+21) | 33 % (−14) |
| EUR LQ | 50 % (+12) | 40 % (−16) | 49 % (−2) | 53 % (+23) | 55 % (+15) | 44 % (−10) | 54 % (+7) | 43 % (−4) | 41 % (−11) | 47 % (0) | 44 % (−7) |
| XAU LQ | – | 46 % (+5) | 55 % (+5) | 48 % (+6) | 52 % (+14) | 48 % (+11) | 46 % (−5) | 39 % (−10) | 59 % (+7) | 44 % (−10) | 57 % (+17) |
| GBP HTF | 65 % (+9) | 49 % (−2) | 43 % (−6) | 56 % (+11) | 45 % (0) | 17 % (−13) | 54 % (+11) | 62 % (+7) | 46 % (+1) | (1 T) | 50 % (0) |
| EUR HTF | 50 % (+2) | 48 % (+2) | 43 % (−7) | 47 % (0) | 46 % (0) | 46 % (−3) | 42 % (−3) | 42 % (−2) | 61 % (+7) | 42 % (−3) | 56 % (+5) |
| XAU HTF | 28 % (−7) | 39 % (0) | 44 % (−5) | 59 % (+9) | 47 % (+2) | 64 % (+25) | 47 % (+2) | 46 % (+3) | 54 % (+3) | 53 % (+7) | 68 % (+19) |

**Losses gegen Wins:** Grundlage sind die 2.578 Treffer, bei denen (c) gilt. WR gesamt 53,5 % (H1 52,6 %, H2 54,8 %).
„Auffällig“ heißt: in beiden Halbjahren mindestens 30 Treffer und mindestens 5 Punkte Abweichung in dieselbe Richtung.

| Merkmal | Ausprägung · WR gesamt (H1 / H2) · n | Urteil |
|---|---|---|
| **SL-Faktor** (neu/alt) | < 1,5×: **41,6 %** (42,0 / 40,8) · 693 · 1,5–2,5×: 48,1 % · 910 · 2,5–4×: 61,2 % · 564 · ≥ 4×: **75,2 %** (77,6 / 72,6) · 411 | auffällig, aber Mechanik |
| Session | London 49,7 % (47,5 / 52,9) · 515 · MMM 56,4 % · NY 54,3 % · Asia 54,3 % | London schwächer, nur in H1 deutlich |
| H1-Trend | gegen 55,4 % (54,7 / 56,3) · 1137 · mit 51,1 % (51,5 / 50,6) · 959 | Hinweis, unter 5 Punkten |
| LS gebrochene Swings | ≥ 2: 49,5 % (50,7 / 48,0) · 654 · 0: 57,3 % · 494 | Hinweis |
| LS-Alter | < 2 h: 58,2 % (56,8 / 59,9) · 641 · 2–10 h: 50,1 % | knapp unter der Schwelle |
| LQ 2.1 erfüllt | 54,7 % (57,4 / 51,6) · 495 gegen 53,0 % · 1109 | kein Unterschied |
| Hindernis-Typ / höchster TF / Abstand | A+B 53,6 %, nur A 52,1 % · 1H 53,9 %, 15M 54,8 %, 5m 52,6 % · in Zone 54,5 %, 0,25–0,5 ATR 50,0 % | kein Unterschied |
| Asset, Familie, Wochentag | jeweils 52–56 %, Halbjahre wechselnd | kein Unterschied |
| News-Nähe | 45,9 % (52,1 / 34,6) · nur 74 Trades | zu wenig n |

- **Die Losses häufen sich nicht verdächtig.** Das einzige stabile Merkmal ist der SL-Faktor, und das ist Mechanik: Je weiter
  der neue SL bei gleichem Ziel liegt, desto öfter wird das Ziel zuerst erreicht. Liegt der M15-Swing nur knapp hinter dem
  DOB-SL (< 1,5×), wirkt (c) kaum, und die WR bleibt bei 42 %.
- **Zeitliche Cluster gibt es:** LQ-Sweep im Sommer (August), HTF-OB im Januar und Februar. Sie folgen keinem der Merkmale.

**Typische Losses von (c) M15** (alle mit kleinem SL-Faktor):

| Entry (Berlin) | Asset · Richtung · Lauf | Entry / DOB-SL / SL (c) | SL-Treffer | Hindernis |
|---|---|---|---|---|
| 19.11. 14:37 | GBPUSD Long · LQ v1 | 1,31518 / 1,31443 / 1,31428 (×1,20, Swing 10:30) | 15:45 | 5m-OB 0,38 ATR, 5m-FVG 0,14 ATR |
| 17.11. 15:39 | EURUSD Short · LQ v0 | 1,09880 / 1,09944 / 1,09959 (×1,23, Swing 14:00) | 16:25 | 5m- und 15M-FVG 0,24 ATR |
| 10.11. 08:38 | XAUUSD Long · LQ v1 | 4.115,63 / 4.110,82 / 4.110,05 (×1,16, Swing 05:45) | 10:00 | 5m-OB 0,36, 5m-FVG 0,32 ATR |
| 30.10. 07:15 | GBPUSD Short · LQ v1 | 1,33920 / 1,34009 / 1,34042 (×1,37, Swing 04:00) | 08:20 | 5m-FVG 0,43, 5m-OB 0,33 ATR |
| 30.10. 05:16 | EURUSD Short · HTF v3 | 1,11913 / 1,12004 / 1,12029 (×1,27, Swing 04:00) | 11:05 | 5m-FVG 0,07 und 0,18 ATR |

**Engine (nur gelesen):**
- (c) ist **keine reine Konfiguration**. `src/tradeSetupSimulation.js` ist der TS2-Simulator und betrifft den DOB-Lauf nicht.
- Der DOB-Lauf entsteht in `scripts/dobTradeSetupsFill.mjs`. Dort werden `max_r`, `sl_hit` und `ambiguous_r` je Trade mit
  `dobMaxR` (`src/dobMaxR.js`) für den Indikator-SL berechnet. Die Konfig (`src/dobTradeStatistics.js`, `dobTotalStats`) wählt
  daraus nur Ziel-R und Filter.
- **Vorbild:** Die weite SL-Variante `dobWideVariant` (`src/dobMaxR.js:30`) wird beim Füllen mitgerechnet und in eigenen
  Spalten gespeichert (`wide_max_r`, `wide_sl_hit`, `wide_ambiguous_r`, `wide_risk_usd`). `dobAsWide`
  (`src/dobTradeStatistics.js:148`) tauscht sie für die Auswertung ein. (c) bräuchte dasselbe Muster:
  1. ein Anti-Confluence-Merkmal beim Entry (Zonen M5/M15/H1, offen bzw. ungetestet);
  2. den letzten unberührten M15-P2 als SL;
  3. `dobMaxR` mit diesem SL;
  4. neue Spalten in `dob_trade_setups` (Migration) und einen Konfig-Schalter;
  5. für den Live-Betrieb dasselbe in `supabase/functions/dob-watcher`.
- **Fachentscheidung nötig:** Die weite Variante rechnet die Ziele aus dem neuen Risiko (k·R). Diese Messung hält dagegen den
  Zielpreis fest. Welche Semantik soll (c) haben?
