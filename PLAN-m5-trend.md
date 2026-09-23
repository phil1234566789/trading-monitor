# PLAN: M5-Trend algorithmisieren

Ziel: ein eigener M5-Struktur-Trend, analog zum bestehenden 1h-Struktur-Trend
(`src/marketStructureAnalysis.ts`). Vorstufe für die geplanten M1-Funktionalitäten und
Voraussetzung für milk-city `10-10-nur-im-m5-trend` ("nur im M5 Trend": Setups filtern,
Handbuch-Regeln, Anti-Confluence).

Stand: 23.09.2026 — Befundaufnahme abgeschlossen, noch keine Implementierung.

## Ziel-Output (Philip, 23.09.2026)

Bewusst klein gehalten. Am Ende sollen genau diese Angaben herauskommen:

1. **M5 Trend** — up oder down
2. **M5 Trend Reaktion** — Change of Character (CHoCH) oder Break of Structure (BOS)
3. **M5 LQ-Levels** — existiert heute schon (`m5LiquidityLevels` in `get_data_export`)

Dieselben Angaben stehen im TSC. Fuer den Chart braucht es zusaetzlich eine "bessere"
Visualisierung — noch nicht spezifiziert, eigener Task.

**Damit ist der volle `structurePivots`-Export fuer M5 NICHT noetig** und die Pivot-Kappung
(Punkt 4) ist entschaerft — Philip ausdruecklich: "das mit der Kappung ist nicht schlimm".

### Beides existiert im Algo bereits

- **BOS**: eigener Pivot-Typ `"break-of-structure"` (`src/range.type.ts:48`) — ein
  `protected-low`, unter dessen Kerze tatsaechlich eine Kerze geschlossen hat. Im Kommentar
  dort schon als "Break of Structure" benannt. Liegt in `structurePivots`.
- **CHoCH**: der `nestedTrend`-Gegentrend-Tracker (`advanceNestedTrend`,
  `src/marketStructureAnalysis.ts:980`). Ein bestaetigter nestedTrend IST ein CHoCH; das
  Rendering zeichnet dafuer heute schon ein CHoCH-Label.

Was fehlt, ist nur eine kleine **Ableitungsfunktion** "State -> {trend, reaktion}". Die gehoert
nach `marketStructureAnalysis.ts` (beide Kopien), nicht doppelt in TSC und MCP-Export —
CLAUDE.md-Regel "DRY within a single runtime".

### Prototyp-Ergebnis fuer den Referenzfall

Mit Anker 27.07. 04:00, Ableitung "juengstes Ereignis aus CHoCH/BOS ueber alle Ebenen":

| Perioden | M5-Trend | Reaktion | Verschachtelung |
|---|---|---|---|
| P5/P2 | **DOWNTREND** | BOS @ 27.07. 06:15 / 1.33544 | 0 |
| P10/P5 | **DOWNTREND** | keine | 0 |
| P20/P10 | **DOWNTREND** | keine | 0 |

Alle drei liefern den erwarteten Downtrend. **Offen:** "Reaktion" ist haeufig `null` — ein
sauber durchlaufender Trend hat weder CHoCH noch BOS. Der Output braucht also einen dritten
Zustand ("keine Reaktion"), oder "Reaktion" ist anders gemeint als in diesem Entwurf. Die
Ableitungsfunktion oben ist ein **Entwurf, kein verifizierter Algorithmus**.

## Referenzfall: GBPUSD, Mo 27.07.2026 20:15 (Berlin)

Philips Beispiel, verifiziert über `get_data_export` (replayUntilSec=1785176100):

| Ebene | Trend | Range |
|---|---|---|
| 1h Haupttrend | downtrend (8 Tage) | H 1.35575 (15.07. 20:00) / L 1.32984 (23.07. 17:00) |
| 1h Nested | **uptrend** (2 Tage) | H 1.33631 (27.07. 04:00) / L 1.32984 (23.07. 17:00) |

Der M5-Verlauf des Tages ist ein Lehrbuch-Downtrend: Tages-High 1.33604 um 08:40,
Tages-Low 1.32839 um 19:30, 76 Pips, jede Stunde tieferes High **und** tieferes Low.
Close 20:15 = 1.32898.

### Warum der 1h-Nested noch bullisch ist

Nicht weil die Struktur noch hält — sie ist längst durch. Alle Pullback-Levels des
Nested-Uptrends waren um 20:15 bereits getoucht:

| Level | Typ | entstanden | getoucht |
|---|---|---|---|
| 1.33152 | break-of-structure | 24.07. 22:00 | 27.07. 13:00 |
| 1.33052 | low | 24.07. 14:00 | 27.07. 14:00 |
| 1.32984 | Range-Low/Ursprung | 23.07. 17:00 | 27.07. 19:00 |

Der Grund ist die **Bestätigungsverzögerung**: ein H1-Periode-5-Pivot wird erst 5 Kerzen
= 5 Stunden nach seiner Entstehung verarbeitet (`buildMarketStructureState`:
`pivotTime + period * 3600`). Das Tages-Low um 19:30 kann als P5-Pivot frühestens
nach Mitternacht bestätigt werden. Der 1h-Algo läuft hier also strukturell ~5-6h nach —
genau die Lücke, die ein M5-Trend schließen soll (auf M5: 5 Kerzen = 25 Minuten).

## Befund: der bestehende Algo läuft auf M5-Kerzen bereits

Trockenlauf mit echten M5-Kerzen (22.-27.07., 1112 Kerzen), `computeRangesPivots` +
`buildMarketStructureState` unverändert, Zeitachse testweise /12 gestaucht, um die
Bestätigungsverzögerung auf M5 zu simulieren:

| Lookback | Perioden | Ergebnis | structurePivots |
|---|---|---|---|
| 1d | P5/P2 | downtrend | 22 |
| 2d | P5/P2 | downtrend | 22 |
| 5d | P5/P2 | downtrend | 98 |
| 5d | P10/P5 | downtrend | 45 |
| 5d | P20/P10 | downtrend, 4-fach verschachtelt | 24 |

**Alle 8 getesteten Konfigurationen liefern `downtrend`.** Der Kern-Algorithmus
(`applyMarketStructurePivot`/`applyInnerMarketStructurePivot`/`advanceNestedTrend`)
ist timeframe-agnostisch — er arbeitet nur auf Pivot-Preisen, Pivot-Zeiten und
`candles`. Es braucht also keinen zweiten Algorithmus, nur eine Parametrisierung.

## Offene Punkte

### 1. `period * 3600` ist die einzige harte H1-Annahme
`src/marketStructureAnalysis.ts:1070` und `:1073` in `buildMarketStructureState`.
Muss `period * barSeconds` werden; `barSecondsFor()` existiert schon in
`src/timeframes.js`. Betrifft beide Runtimes (Frontend + `trading-monitor-mcp/`).

### 2. Perioden-Wahl — die eigentliche Designfrage
Philips Notiz im Task: *"einen M5 struktur algo ist schwieriger als im 1h, weil wir
dort p2 und p5 pivots haben"*. Der Trockenlauf bestätigt das quantitativ: P5/P2 auf M5
erzeugt über 5 Tage 107 bzw. 227 Roh-Pivots (1h: ~8 structurePivots). P20/P10 dämpft
das Rauschen, produziert dafür eine 4-stufig verschachtelte Trendkette — unbrauchbar tief.
Noch nicht entschieden.

### 3. Fenster-Anker — geklaert, Analogie traegt

Der 1h-Trend ankert am letzten 1D-Periode-4-Pivot, aber **nicht direkt**: der Cron
`daily-structure-pivots` erkennt den 1D-P4-Fraktal und loest ihn per
`_shared/resolveStructureStartTime.ts` auf die **1H-Kerze innerhalb dieses Tages** herunter,
die den Pivot-Preis tatsaechlich gebildet hat. Erst diese Stunde ist der Cutoff.
Im Beispiel: 1D-P4-Pivot vom 15.07., aufgeloest auf die 1H-Kerze **15.07. 20:00** — genau der
`cutoffOuterAt`, den `get_data_export` ausweist.

Die Analogie eine Stufe tiefer ist also: **H1-Fraktal-Pivot, aufgeloest auf die M5-Kerze
innerhalb dieser Stunde.**

Nachgerechnet fuer den Referenzfall (H1 aus den M5-Kerzen aggregiert, `detectLiquidityLevels`,
angebrochene Stunde verworfen):

| Anker-Periode | letzter bestaetigter H1-Pivot | M5-Aufloesung | bestaetigt ab |
|---|---|---|---|
| P4 | High **1.33631**, 27.07. 04:00 | 27.07. **04:00** | 27.07. 08:00 |
| P5 | High **1.33631**, 27.07. 04:00 | 27.07. **04:00** | 27.07. 09:00 |

**P4 und P5 liefern denselben Anker** — die Periodenwahl ist hier unkritisch. Und der Anker ist
exakt das Asia-High, das Philip als Start des M5-Downtrends benannt hat, und zugleich der
`currRange.high` des 1h-Nested-Uptrends. Der M5-Algo wuerde ab 27.07. 04:00 rechnen.

**Philips Entscheidung (23.09.2026): den Anker am 1h-Structure festmachen, nicht an einem
separaten Fraktal-Lauf.** Das faellt mit dem Messergebnis oben zusammen, und zwar systematisch:
der 1h-Algo speist sich genau aus diesen H1-Pivots, also IST `currRange.high/low` ein solcher
Pivot. Im Referenzfall ist der 1h-Nested-`currRange.high` = 1.33631 @ 27.07. 04:00 — identisch
mit dem oben per Fraktal-Lauf ermittelten Anker.

**Konkreter Vorschlag:** der **juengere der beiden `currRange`-Grenzen (high/low) der innersten
bestaetigten 1h-Ebene**. Im Referenzfall: Nested-Uptrend mit high 27.07. 04:00 vs. low 23.07.
17:00 -> das High, 27.07. 04:00. Fenster = 16,25h -> 22 Pivots bei P5/P2, gut handhabbar.

Vorteile gegenueber dem Fraktal-Weg: kein zweiter Fraktal-Lauf, keine weitere Periode zu tunen,
keine Tabelle, kein Cron. Der 1h-State wird ohnehin berechnet — `compute1hStructureState` ist
seit `run_bias_check` bereits exportiert und wiederverwendbar.

**Und der `resolveStructureStartTime`-Port entfaellt vermutlich:** die 1D-Variante brauchte ihn,
weil eine 1D-Kerze keinen Intraday-Zeitpunkt hat. Eine H1-Kerze hat einen exakten Zeitstempel;
die Stunde selbst genuegt als M5-Cutoff. Eine Verfeinerung auf die exakte M5-Kerze innerhalb der
Stunde verschiebt das Fenster um maximal 55 Minuten — bei 16h Fenster irrelevant. Erst bauen,
wenn es sich als noetig zeigt.

Historisch, falls der Fraktal-Weg doch gebraucht wird: der 1D-Weg braucht Tabelle + Cron
(`daily_structure_pivots`), weil 1D-Historie weit zurueckreicht. H1-Pivots der letzten Tage
sind dagegen aus den ohnehin geladenen H1-Kerzen in Millisekunden berechnet — eine zweite
Tabelle waere vermutlich unnoetig. Noch nicht entschieden.

### 4. Pivot-Kappung — kein Volumen-, sondern ein Nachvollziehbarkeitsproblem

Gemessen 23.09.2026. `dataExport.ts` kappt structurePivots **je Ebene** auf die letzten
`STRUCTURE_PIVOTS_MAX_EXPOSED = 8` (`capStructurePivots`, rekursiv ueber die
nestedTrend-Kette).

**Das Datenvolumen ist damit bereits geloest** — die Kappung deckelt zuverlaessig:

| M5-Konfiguration | Ebenen | Pivots gesamt -> gekappt | JSON gesamt -> gekappt |
|---|---|---|---|
| 1d, P5/P2 | 1 | 22 -> 8 | 2.511 -> **1.088** Z |
| 5d, P5/P2 | 2 | 124 -> 16 | 13.641 -> **2.140** Z |
| 5d, P20/P10 | 4 | 42 -> 18 | 5.734 -> **3.023** Z |

Zum Vergleich: der heutige `structure1h`-Block im Export ist 2.663 Zeichen (bei 48.825 Zeichen
Gesamt-Export; die dicken Brocken sind `obZones1h` mit 16.455 und `candles` mit 16.630).
Alle gekappten M5-Varianten liegen also im selben Rahmen wie heute schon.

**Das Problem ist der Informationsverlust.** Wie viel Trendhistorie die aeussere Ebene nach der
Kappung noch abdeckt:

| M5-Konfiguration | real abgedeckt | nach Kappung auf 8 |
|---|---|---|
| 1d, P5/P2 | 18,4h (22 Pivots) | **6,4h** |
| 5d, P5/P2 | 117,8h (98 Pivots) | **4,8h** |
| 5d, P20/P10 | 103,8h (24 Pivots) | 67,5h |

Bei 1h ist die Kappung praktisch nie bindend — dort liegen ueber ALLE Ebenen zusammen 13
structurePivots vor, die den kompletten 8-Tage-Trend abdecken. Bei M5/P5/P2 schneidet dieselbe
Konstante ~96% der Trendherleitung weg: Lana saehe einen willkuerlichen 5-Stunden-Ausschnitt und
koennte nicht mehr nachvollziehen, worauf der Trend beruht.

**Das haengt direkt an der Perioden-Wahl (Punkt 2):** groebere Perioden erzeugen weniger Pivots und
entschaerfen die Kappung nebenbei (P20/P10 behaelt 67,5h). Die beiden Punkte sind nicht unabhaengig
voneinander zu entscheiden. Ein blosses Hochsetzen der Konstante fuer M5 waere die naive Loesung —
dann waechst aber die Ebenen-Anzahl mit (P20/P10 erzeugt 4 verschachtelte Ebenen, die Kappung
wirkt je Ebene), und die fachliche Frage "was heisst Nested im Nested im Nested?" bleibt offen.

### 5. Wo der M5-Trend hin wirkt
Aus dem milk-city-Task, noch nicht ausgearbeitet: Trade-Setup-Filter, Handbuch-Regeln,
Anti-Confluence im TSC.

## Duplikation: 7 Voll-Kopien zwischen src/ und supabase/functions/

Erhoben 23.09.2026. `marketStructureAnalysis.ts` existiert zweimal, und ist nicht der
einzige Fall. Code-Diff ohne Kommentare und Import-Pfade:

| Datei | Frontend | Backend | Code-Diff |
|---|---|---|---|
| marketStructureAnalysis.ts | 1136 Z | trading-monitor-mcp/ | **0** |
| rsi.js | 334 Z | trading-monitor-mcp/ | **0** |
| sessionOccurrences.js | 231 Z | _shared/ | **0** |
| orderBlockDetection.js | 174 Z | trading-monitor-mcp/ | **0** |
| rsiDivergenceOutcome.js | 79 Z | trading-monitor-mcp/ | **0** |
| ema.js | 19 Z | trading-monitor-mcp/ | **0** |
| pipConfig.js | 14 Z | _shared/ | **0** |
| liquidityDetection | 193 Z | _shared/ (149 Z) | **61** |

Rund 1990 Zeilen echte Doppelung (`0` Code-Diffzeilen = identisch nach Entfernen von
Kommentarzeilen und Normalisierung der `from "..."`-Pfade; Kommentare unterscheiden sich teils
bewusst). Technisch erzwungen dadurch, dass es keine `deno.json`/`import_map.json` gibt und
`npx supabase functions deploy` nur den `supabase/functions/`-Baum bundelt. Die Kopie kam mit Commit `c0fb43b` ("trading-monitor MCP als
Supabase Edge Function"), nachdem `5434a0b` die Datei bewusst von Browser-Code entkoppelt hatte
(deshalb der dependency-freie Kopf von `marketStructureAnalysis.ts`).

**Warum, laut Doku (`docs/mcp-server.md`):** nicht primaer die Deploy-Grenze, sondern
Browser-Kopplung. `buildDataExport` und transitiv `liquidity.js`/`chartColors.js`/
`sessions.js` fassen `localStorage` und `import.meta.env` **zur Modul-Ladezeit** an und
crashen sofort ausserhalb des Browsers. Deshalb liegen "kleine, stabile, dependency-freie Stuecke
in Deno-sicherer Form dupliziert" — mit der ausdruecklichen Regel: *"Wird eines der Originale
geaendert, pruefen ob der Port hier denselben Fix braucht."* `_shared/` ist dabei "die einzige
Cross-Function-Grenze im Repo (eine dritte Kopie waere die Alternative gewesen)".

**Die Doku ist vollstaendig — der Fachdoku-Router routet korrekt.** Trigger "Arbeit an
`src/marketStructureAnalysis.ts`" -> `src/marketStructureAnalysis.notes.md`, und dort steht
woertlich "dort jetzt die alleinige Deno-Kopie in `supabase/functions/trading-monitor-mcp/`".
Die CLAUDE.md-Tabelle listet die Kopie bewusst nicht: nach der globalen Regel "Ladekosten passend
zur Abruf-Haeufigkeit" gehoert sie in die bei Bedarf geladene Datei, nicht in die immer geladene.
**Eine frueher hier notierte "CLAUDE.md-Luecke" war ein Fehlurteil** — entstanden, weil der
fachdoku-router-Skill nicht aufgerufen wurde, obwohl seine Beschreibung genau das verlangt.

**`liquidityDetection` ist mit 61 Code-Diffzeilen als einziges Paar auseinandergelaufen.**
Ob das legitime Unterschiede sind (TS-Typen) oder echte Drift, ist NICHT geprueft — vor dem
M5-Umbau anschauen, weil `computeRangesPivots` direkt darauf aufsetzt.

**Vorschlag (noch nicht entschieden):** ein Sync-Guard-Test nach dem Muster von
`test/supabaseRowCapGuard.test.js` (scannt schon heute Sources und schlaegt bei Verstoessen fehl) —
vergleicht die Kopien-Paare kommentar- und importpfad-normalisiert und schlaegt bei Divergenz fehl.
Billiger als ein Build-Step und verhindert genau das, was bei `liquidityDetection` passiert sein
koennte. Kein Symlink (Windows) und kein Bundler.

## Nebenbefund

`src/components/PriceChart.vue:227` behauptet, die Periode-2-Pivots flössen "aktuell NICHT
in marketStructureAnalysis.ts/applyMarketStructurePivot ein (nur Rohdaten zum
Beobachten/TDD)". Das ist seit `applyInnerMarketStructurePivot` überholt — `innerRest`
ist in `buildMarketStructureState` voll im Merge. Kommentar korrigieren.

## Kostenschaetzung

Erhoben am 23.09.2026.

**Guenstig — der Algo selbst:**
- `period * 3600` -> `period * barSeconds`: je 2 Zeilen in beiden Kopien, plus ein
  Parameter an `buildMarketStructureState`. Nur **zwei** Produktiv-Aufrufer:
  `src/composables/usePriceChartMarketStructure.js:130` und
  `supabase/functions/trading-monitor-mcp/tools/dataExport.ts:239`. Dazu ein Test
  (`test/marketStructureAnalysisRealPipeline.test.js:34`).
- Die beiden Kopien von `marketStructureAnalysis.ts` (src/ und trading-monitor-mcp/) sind
  **funktional identisch** — Unterschiede nur in drei Kommentarzeilen und einem Import-Pfad.
  Eine Aenderung laesst sich 1:1 spiegeln.
- M5-Kerzen sind in **beiden** Runtimes bereits geladen: Frontend
  `TRADE_SETUP_M5_CANDLE_COUNT = 2500` (~8,7 Tage),
  Backend `M5_DETECTION_LOOKBACK_HOURS = 21 * 24`. Kein zusaetzlicher cTrader-Fetch.
  `M5_BAR_SECONDS = 300` existiert schon in dataExport.ts.
- Der Kern (`applyMarketStructurePivot`/`applyInnerMarketStructurePivot`/
  `advanceNestedTrend`) bleibt unveraendert — im Trockenlauf bewiesen.

**Mittel:**
- `resolveStructureStartTime.ts` ist auf 1D hardcodiert (`DAY_SECONDS`,
  `pivotTime + 86400`). Generalisieren auf einen Parent-Bar-Parameter.
- Anker-Bezug fuer M5 (on-the-fly vs. Tabelle, siehe oben).

**Der eigentliche Aufwand liegt im Drumherum, nicht im Algorithmus:**
- structurePivots-Verdichtung (22-98 statt ~8), `STRUCTURE_PIVOTS_MAX_EXPOSED`.
- Perioden-Wahl auf M5 — noch offen.
- Chart-Rendering (`marketStructureRendering.ts`) — noch nicht entschieden, ob gewuenscht.
- MCP-Export-Feld + TSC-/Setup-Filter-Anbindung (der eigentliche milk-city-Task).

## Variante "volle Outer-Range" (Philip, 23.09.2026)

Philip moechte den M5-Anker nicht an der innersten 1h-Ebene festmachen, sondern am **Startpunkt
des Outer-Trends** — im Referenzfall das High 1.35575 des 1h-Downtrends.

### Anker-Korrektur

Philip nannte 13.07. 23:00. Nachgerechnet stimmt das nicht:

| | Zeitpunkt |
|---|---|
| 1D-Kerze, die das High 1.35575 enthaelt | startet Di **14.07. 23:00**, endet Mi 15.07. 23:00 |
| H1-Kerze, die das High 1.35575 bildet | Mi **15.07. 20:00** |
| 13.07. 23:00 | die 1D-Kerze *davor* (High 1.34428) |

**Und der Clou: 15.07. 20:00 IST bereits der heutige Anker.** `get_data_export` weist
`structureWindow.cutoffOuterAt = "2026-07-15 20:00"` aus. Der Outer-Trend-Start ist per
Konstruktion der bestehende `cutoffOuter` — dieser Anker kostet **nichts**, das Feld liegt vor.

### Kosten des 12-Tage-Fensters

| | |
|---|---|
| Zeitraum | 15.07. 20:00 – 27.07. 20:15 = 12,01 Tage |
| M5-Kerzen (ohne Wochenenden) | **2321** |
| Rechenzeit P5/P2 (864 Pivot-Schritte) | **164 ms** |
| Rechenzeit P20/P10 (204 Schritte) | **8 ms** |
| Backend-Budget (`M5_DETECTION_LOOKBACK_HOURS` = 21 Tage) | reicht |
| Frontend-Budget (`TRADE_SETUP_M5_CANDLE_COUNT` = 2500) | reicht **knapp** — 2321 von 2500 |

Rechnerisch also guenstig. Das Frontend-Budget ist der einzige harte Punkt: ein laengerer
1h-Trend als dieser reisst die 2500er-Grenze, dann braucht es einen hoeheren Wert oder einen
eigenen Fetch.

### Ergebnis — und warum es Philips Erwartung nur halb trifft

Trendphasen ueber die volle Range, Phase = zusammenhaengender Abschnitt gleichen Trends auf der
innersten bestaetigten Ebene:

| Perioden | DOWN-Phasen | UP-Phasen |
|---|---|---|
| P5/P2 | 3 (oe 74,4h, oe −42,2 Pips) | **14 (oe 0,3h, oe −1,0 Pips, Spanne 8 Pips)** |
| P10/P5 | 4 (oe 44,1h, oe −38,5 Pips) | 7 (oe 0,5h, oe −1,5 Pips) |
| P20/P10 | 4 (oe 37,3h, oe −26,3 Pips) | **0** |

Die Down-Dominanz ist eindeutig und bestaetigt die Hypothese. **Die "Up-Phasen" sind aber keine
korrektiven Aufwaertsbewegungen** — sie dauern 12–40 Minuten, bewegen 8 Pips und haben im Mittel
ein *negatives* Netto-Ergebnis. Das ist Rauschen, kein Gegenimpuls.

**Entscheidend:** die von Philip benannte korrektive Aufwaertsbewegung 23.07. 17:00 → 27.07. 04:00
taucht in KEINER Variante als eigene UP-Phase auf. Sie steckt komplett in der langen DOWN-Phase
20.07. 17:30 → 27.07. 20:05 (170,6h, −125,5 Pips). Der M5-Trend bleibt dort durchgehend
"downtrend", obwohl der Kurs steigt.

Der Trend-Output allein (up/down) bildet also genau das nicht ab, was Philip sehen will. Die
Unterscheidung impulsiv vs. korrektiv ist **keine Groesse, die der Struktur-Algo kennt** — sie
muesste als eigene Kennzahl definiert werden (Kandidaten: Pips/Stunde, Spanne je Phase,
Anteil Kerzen in Trendrichtung, Verhaeltnis Bewegung zu Gegenbewegung). Das ist der eigentliche
offene Punkt, nicht der Anker und nicht die Rechenzeit.

**Methodenhinweis:** die obige Phasen-Auswertung ist ein Analyse-Entwurf (Schleife aus
`buildMarketStructureState` nachgebaut, Protokoll nach jedem Pivot, "innerste bestaetigte
Ebene" als Trend). Die negativen Netto-Pips der UP-Phasen deuten darauf hin, dass diese Heuristik
fuer die Phasenbildung fragwuerdig ist — vor einer Entscheidung darauf nachpruefen. Fuer solche
Laeufe existiert im Repo bereits das Muster `analysis/dr-reichweite/` (Script + Ergebnis-Dateien),
das ist der richtige Ort, nicht Produktionscode.

## OFFENE FRAGE an Philip: Chart-Darstellung des M5-Trends

Gestellt in der Nacht 23./24.09.2026, Philip antwortet am 24.09. ("muss jetzt schlafen gehen,
frag mich morgen nochmal"). Bis dahin steht Punkt 5c des Tasks
`m5-struktur-trend-algo-parametrisieren-anker-chart-tsc-anzeige` bewusst leer.

Der 1h-Structure zeichnet heute: Pfeile an range.high/low, protected-low-Linie, Trend-Label,
CHoCH-Linie, Fib-Level, ZigZag fuer abgeschlossene Ranges, LQ-Sweep-Label mit Preis+Alter. Bei
100+ M5-Pivots ist dasselbe Set unlesbar. Drei vorgelegte Varianten:

1. **Nur Trend + letzte Reaktion** (Empfehlung): aktuelle M5-Range als zwei Linien, Trendrichtung
   als Label, eine Markierung fuer die letzte CHoCH/BOS. Kein Fib, kein ZigZag, keine
   Pullback-Pivots. ~3 Objekte + 1 Label, skaliert.
2. **Volle Paritaet zum 1h**, nur eigene Farbe/Transparenz. ~25+ Objekte, vollstaendig aber
   vermutlich ueberladen — Philip muesste im Test selbst entscheiden, was er wegtoggelt.
3. **Trendphasen als Hintergrundbaender** ueber die Zeitachse, eines je Phase (rot down / gruen up),
   mit Dauer. Zeigt Abfolge und Dauer auf einen Blick und passt damit zur impulsiv/korrektiv-Frage,
   ist aber eine neue Darstellungsform im Chart.

Unabhaengig von der Wahl gesetzt (Philip am 23.09.): ein An/Aus-Toggle unter dem Menuepunkt
"Structure" (`src/views/Dashboard.vue:1928`) und Chart-Style-Tokens in `src/chartColors.js`
(Vorbild `rangesMarker`/`rangesMarker2`, :129/:133) — woertlich: "und chartstyle hast du ja
bisher auch noch nie vergessen."
