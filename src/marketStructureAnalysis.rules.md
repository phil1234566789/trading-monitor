# marketStructureAnalysis: Regelübersicht

Ein-Satz-Zusammenfassung pro Regel + Verweis auf den Test, der sie tatsächlich absichert. Bei
Zweifel zählt der Test/Code, nicht diese Zeile — hier steht nur "was", nicht "wie genau".
Implementierung: [marketStructureAnalysis.ts](marketStructureAnalysis.ts).

## Pipeline (Kerzen -> Pivots -> State)

`computeRangesPivots(candles, period, cutoff, formatTime?)` und
`buildMarketStructureState(pivotsOuter, pivotsInner, periodOuter, periodInner, candles)` sind seit
Chat 2026-07-24 die EINZIGE Quelle für "Kerzen -> Pivots -> State", exportiert aus
`marketStructureAnalysis.ts`. Vorher lebte diese Logik nur als lokale Funktion in
`PriceChart.vue` (`computeRangesPivotsFor`/`computeMarketStructureState`) — Tests liefen deshalb
zwangsläufig gegen eine von Hand nachgebaute Kopie statt gegen exakt den Code, den die App
tatsächlich ausführt (Bug-Report Philip: "wie kann es sein, dass Tests grün laufen, aber der Algo
trotzdem nicht das macht, was die Tests eigentlich sicherstellen sollen?"). `PriceChart.vue`
delegiert jetzt an diese beiden Funktionen, statt sie zu duplizieren — ein Test, der sie direkt mit
echten Kerzen aus `.debug/metadata.json` aufruft (`marketStructureAnalysisRealPipeline.test.js`),
prüft damit 1:1 denselben Pfad wie die Live-App.

## Grundbegriffe

- **Outer-Pivot** (Periode 5, `applyMarketStructurePivot`) vs. **Inner-Pivot** (Periode 2,
  `applyInnerMarketStructurePivot`) — Inner erkennt einen Trend schneller (feinere Auflösung),
  wird aber bei jedem Outer-Pivot geleert (`innerStructurePivots: []`). Nur `trend` und
  `structurePivots` überleben dauerhaft.
- `currRange.high`/`currRange.low` — die aktuell gültigen, unbestätigten Rand-Pivots.
- `structurePivots` — Pullbacks seit Range-Beginn, überlebt jeden Pivot.
- `innerStructurePivots` — Pullbacks seit dem letzten Outer-Pivot, wird ständig geleert.

## Range-Grenzen

| Regel | Test |
|---|---|
| Erste zwei gelesene Pivots (ein High, ein Low) werden `currRange`, `trend` startet `unknown`. | `marketStructureAnalysis.test.js`: *rangeState1* |
| Ein Outer-Pivot mit niedrigerem Preis als `currRange.low` ersetzt `currRange.low` sofort, ohne Bestätigungsprüfung. | `marketStructureAnalysis.test.js`: *rangeState2* |
| Ein Outer-Pivot innerhalb der Range (bricht weder High noch Low) landet unverändert in `structurePivots`. | `marketStructureAnalysis.test.js`: *rangeState3*, *rangeState5+6* |

## Trendbestätigung (Uptrend)

| Regel | Test |
|---|---|
| Ein High-Bruch bestätigt NUR, wenn `currRange.high` zeitlich NACH `currRange.low` liegt ("eligible") — gilt nur für die allererste Bestätigung. | `marketStructureAnalysis.test.js`: *"bestätigt NICHT, wenn ... alle VOR dem aktuellen range-high gelesen wurden"* |
| Kandidat fürs protected-low: Typ `low` ODER `LQ-sweep`, zeitlich NACH dem gebrochenen High, UND zum Bestätigungsmoment noch ungetoucht — kommt aus `structurePivots` ODER `innerStructurePivots`. | `marketStructureAnalysisInnerPivots.test.js`: *rangeState1_4* (Inner-Pivot bestätigt mit); `marketStructureAnalysisProtectedLow.test.js` (Touch-Zeitpunkt-Fälle) |
| Unter mehreren Kandidaten gewinnt der ZEITLICH JÜNGSTE, nicht der tiefste. | `marketStructureAnalysis.test.js`: *rangeState7*; `marketStructureAnalysisProtectedLow.test.js`: *"bei mehreren komplett ungetouchten Kandidaten gewinnt weiterhin der jüngste, nicht der tiefste"* |
| Ohne mindestens einen qualifizierenden Pullback: keine Bestätigung, `currRange.high` wird trotzdem ersetzt. | `marketStructureAnalysis.test.js`: *rangeState4* |
| **Bestätigung läuft bei JEDEM weiteren High-Bruch neu**, nicht nur beim ersten Mal — protected-low rückt auf einen neueren ungetouchten Pullback weiter, der alte fällt zurück auf `low`. Kein neuerer Kandidat -> alter bleibt stehen. | `marketStructureAnalysisProtectedLow.test.js`: *"protected-low rückt bei einem weiteren HH-Bruch auf den neueren ungetouchten Pullback weiter..."*, *"ohne einen neueren ungetouchten Pullback bleibt der bisherige protected-low stehen..."* |
| Ein per Inner-Pivot gesetztes protected-low wird vor jedem `innerStructurePivots`-Reset nach `structurePivots` migriert, statt verloren zu gehen. | `marketStructureAnalysisProtectedLow.test.js`: *"ein per eingebettetem Pivot bestätigtes protected-low überlebt den nächsten übergeordneten Pivot..."* |
| Downtrend-BESTÄTIGUNG (ein "protected-high" als Pendant zum protected-low): seit Chat 2026-07-25 implementiert — läuft aber NICHT als Fortsetzung nach einer Trend-Invalidierung, sondern parallel zum noch laufenden Uptrend, siehe Abschnitt "Nested-Trend / CHoCH-Erkennung" unten. | siehe dort |

## Inner-Pivots (Periode 2) — schnellere Vorab-Erkennung

| Regel | Test |
|---|---|
| Inner-Pivot innerhalb der Range -> reiner Pullback, landet in `innerStructurePivots`. | `marketStructureAnalysisInnerPivots.test.js`: *rangeState1_2* |
| Inner-Pivot bricht `currRange.high` preislich, aber KEINE Kerze schließt drüber -> nur `sweeped-high` (Preis/Zeit von `currRange.high` bleiben), kein echter Bruch. | `marketStructureAnalysisInnerPivots.test.js`: *rangeState2_1* |
| Inner-Pivot bricht `currRange.high` preislich UND mindestens eine Kerze schließt seit dem alten High tatsächlich drüber -> echter Bruch, `currRange.high` wird ersetzt, Bestätigungslogik läuft mit. | `marketStructureAnalysisInnerPivots.test.js`: *rangeState1_4* |
| Ohne Kerzendaten gilt ein Preis-Bruch konservativ als ECHTER Bruch (nicht als Sweep) — fehlender Candle-Fetch soll nicht heimlich jeden Bruch abwerten. | Code-Kommentar `closesAboveOldHigh`, kein dedizierter Test |

## Trend-Invalidierung (Uptrend-Bruch durch Inner-Pivot)

Spiegelbildlich zum Inner-High-Bruch oben, seit 2026-07-24 implementiert (live beobachtet: ein
Periode-2-Pivot bildete sich unter `currRange.low`, mehrere Kerzen schlossen danach tatsächlich
drunter). Kein direkter Sprung zu `downtrend` — nur Invalidierung, der Algo startet komplett neu
(siehe `test/tdd_mit_claude/ranges/gbp_h1_uptrend_uptrend_break_of_structure_und_trendumkehr.ts`
für das reale Ausgangsszenario).

| Regel | Test |
|---|---|
| Inner-Pivot bricht `currRange.low` preislich, aber KEINE Kerze schließt drunter -> nur `sweeped-low` (Preis/Zeit von `currRange.low` bleiben), Uptrend bleibt bestehen. | `marketStructureAnalysisTrendInvalidation.test.js`: *"bricht currRange.low NUR preislich (kein Close drunter) -> nur 'sweeped-low'..."* |
| War der Uptrend noch NICHT bestätigt (`trend==='unknown'`) und eine Kerze schließt echt drunter -> `currRange.low` wird einfach ausgeweitet, nichts zu invalidieren (spiegelbildlich zum unconfirmed Outer-Low-Bruch). | `marketStructureAnalysisTrendInvalidation.test.js`: *"Uptrend noch NICHT bestätigt ... currRange.low wird nur ausgeweitet..."* |
| War der Uptrend schon bestätigt (`trend==='uptrend'`) und eine Kerze schließt echt drunter, UND läuft KEIN bereits bestätigter Nested-Trend (siehe unten): Trend zurück auf `'unknown'`, komplett frischer Start: `currRange.high` bleibt der ALTE High (weiterverwendet, nicht verworfen — zeitlich VOR dem neuen Low, bärische Origin-Konstellation), `currRange.low` wird der brechende Pivot, `structurePivots`/`innerStructurePivots` geleert, `appliedPivots` nur noch die zwei neuen Origin-Pivots. | `marketStructureAnalysisTrendInvalidation.test.js`: *"bricht currRange.low PREISLICH UND eine Kerze schließt tatsächlich drunter -> Trend zurück auf 'unknown'..."*; `marketStructureAnalysisChoch.test.js`: *"Fallback bleibt erhalten..."* |
| **PROMOTION** (Chat 2026-07-25): läuft zum Invalidierungszeitpunkt bereits ein bestätigter Nested-Trend (`nestedTrend.trend === 'downtrend'`, siehe "Nested-Trend / CHoCH-Erkennung" unten), übernimmt DER als neuer Outer-Trend statt des vollen Resets — `trend`/`currRange`/`structurePivots`/`appliedPivots` kommen 1:1 vom Nested-State, `nestedTrend` wird `null`. Die alte (jetzt abgeschlossene) Uptrend-Range wird in `closedRanges` archiviert (`{low: alter currRange.low, high: alter currRange.high, trend: 'uptrend'}`) — nur für die Darstellung (einfache Linie, kein Zigzag), keine Zustandslogik hängt daran. | `marketStructureAnalysisChoch.test.js`: *"echte Invalidierung ... übernimmt den bestätigten Nested-Trend statt komplett zurückzusetzen"* |
| Ein Outer-Pivot bricht `currRange.low` NICHT über Inner-Pivots — der spiegelbildliche Fall für `applyMarketStructurePivot` selbst (Outer-Pivot bricht `currRange.low`, während der Uptrend schon bestätigt ist) ist **nicht implementiert**; die bestehende Outer-Regel weitet `currRange.low` immer nur ohne Invalidierungs-/Kerzen-Check aus. | — (kein Test, kein Code) |

## Nested-Trend / CHoCH-Erkennung (`advanceNestedTrend`)

Live beobachtet (GBPUSD 1h, siehe `test/tdd_mit_claude/ranges/gbp_h1_uptrend_uptrend_break_of_structure_und_trendumkehr.ts`): ein Downtrend kündigt sich oft lange VOR der eigentlichen Invalidierung an — die Outer-Pivots 1.35583 (H) -> 1.35206 (L) -> 1.35429 (LH) -> 1.34601 (LL) bilden bereits eine bestätigte bärische Struktur (Change of Character), obwohl `currRange.low` des Haupttrends formal erst später real bricht. Ein zweiter, gegenläufiger Trend-Tracker (`state.nestedTrend`, dieselbe Form wie `MarketStructureState`) läuft dafür parallel mit, gefüttert über **dieselbe** Bestätigungslogik wie der Haupttrend, nur mit `direction="down"` statt `"up"` (siehe `tryConfirmTrend`/`applyMarketStructurePivot`/`markLqSweeps` — parametrisiert statt dupliziert, `protected-high` ist dafür jetzt kein reines Stub-Literal mehr).

| Regel | Test |
|---|---|
| Läuft über Outer-(Periode-5-)Pivots (`advanceNestedTrend`, für Seeding/Reseeding zuständig) UND, seit Chat 2026-07-25 zweite Runde ("range.low vom nestedTrend sollte schon tiefer sein, ein innerPivot hat sich bereits gebildet"), auch über Periode-2-Pivots (`advanceNestedTrendInner`, verfeinert nur einen BEREITS existierenden Nested-Tracker, reseeded selbst nicht — das bleibt exklusiv Sache der Outer-Pivots, weil der Ursprung `appliedPivots[0]` immer ein Outer-High ist) — und nur, solange der Haupttrend bereits `'uptrend'` ist. | `marketStructureAnalysisChoch.test.js` (gesamte Datei), insbesondere *"Periode-2-Verfeinerung des Nested-Trackers"* |
| Die AKTUELLE `currRange.high` ist IMMER der einzig gültige Ursprung — ein neues, ECHTES HH verwirft einen zuvor getrackten Gegentrend-Kandidaten komplett (reseeded auf `null`, wartet auf den nächsten Pullback-Low als neuen Pairing-Punkt). Gilt seit Chat 2026-07-25 explizit AUCH für einen bereits bestätigten (`trend:'downtrend'`) Nested-Tracker — bricht der Haupttrend NACH der CHoCH-Bestätigung noch ein weiteres neues Hoch (widerspricht der Lower-High-Prämisse), war der CHoCH überholt und wird verworfen, statt für den kompletten Rest der Uptrend-Laufzeit stehen zu bleiben (Bug-Report Philip: "Choch Linie immernoch zu weit"). | `marketStructureAnalysisChoch.test.js`: *"Reseed: eine weitere reguläre HH VOR der CHoCH-Bestätigung verwirft den bisherigen Nested-Tracker"*, *"ein bereits bestätigter Nested-Trend wird verworfen, sobald der Haupttrend danach noch ein ECHTES neues Hoch bricht"* |
| Bestätigung läuft exakt wie beim Haupttrend gespiegelt: ein Bruch von `nestedTrend.currRange.low` (dem ersten Pullback-Low nach dem Nested-Origin-High) durch einen weiteren Low-Pivot bestätigt, sofern ein qualifizierender Pullback-High seit diesem Low existiert -> `protected-high`, `nestedTrend.trend` wird `'downtrend'`. Das ist exakt der CHoCH-Moment. | `marketStructureAnalysisChoch.test.js`: *"CHoCH-Bestätigung: Bruch von pivotB löst tryConfirmTrend(direction='down') aus..."* |
| Solange der Ursprung (`currRange.high`) unverändert bleibt, wird ein bereits bestätigter Nested-Tracker NICHT reseeded, läuft aber über weitere Outer-Pivots normal weiter (`protected-high` kann noch weiterrücken, `currRange.low` kann weiter Richtung Promotion wandern) — er ist ab hier bereit für die Promotion (siehe oben). | `marketStructureAnalysisChoch.test.js`: *"firstConfirmedAt bleibt eingefroren, auch wenn der noch nicht promotete Nested-Trend über pivotD hinaus weiterwandert"* |
| `firstConfirmedAt` (auf `MarketStructureState`, von `tryConfirmTrend` EINMALIG gesetzt, sobald `trend` von `'unknown'` auf `'uptrend'`/`'downtrend'` kippt) friert exakt den Pivot ein, der die ALLERERSTE Bestätigung ausgelöst hat — bleibt unverändert, auch wenn `currRange` bei jeder weiteren Bestätigung normal weiterwandert. Existiert speziell, weil `currRange.low` für die CHoCH-Darstellung der FALSCHE Anker ist (Bug-Report Philip 2026-07-25: "CHOCH Linie geht noch zu weit" — sie wuchs vorher bei jedem weiteren Bruch mit). | `marketStructureAnalysisChoch.test.js`: *"firstConfirmedAt bleibt eingefroren..."* |
| Der Haupttrend selbst bleibt vom CHoCH komplett unberührt (reines Vorlauf-Signal, kein Reset) — erst die spätere ECHTE Invalidierung (siehe oben) verwertet ihn per Promotion. | `marketStructureAnalysisChoch.test.js`: *"CHoCH-Bestätigung..."* (`state.trend` bleibt `'uptrend'`) |
| Gespiegelte Richtung (ein bullischer CHoCH innerhalb eines bereits bestätigten Downtrends) ist NICHT verdrahtet — `tryConfirmTrend`/`applyMarketStructurePivot`/`markLqSweeps` sind zwar durch den `direction`-Parameter dafür bereits generisch genug, aber `advanceNestedTrend` selbst prüft aktuell nur `state.trend === 'uptrend'`. Bewusst offen gelassen (Chat 2026-07-25), analog zum bisherigen Muster in dieser Datei. | — (kein Test, kein Code) |

## LQ-Sweep (`markLqSweeps`)

| Regel | Test |
|---|---|
| Ein getouchtes `low`/`LQ-sweep`/`protected-low`, seit dessen eigener Kerze NIE eine Kerze drunter geschlossen hat, ist ein Liquidity-Grab -> wird/bleibt `LQ-sweep`. | `marketStructureAnalysisLqSweep.test.js`: *"touched LOW ohne jeden Close drunter -> 'LQ-sweep'"* |
| Sobald irgendeine Kerze seit der eigenen Pivot-Kerze tatsächlich drunter geschlossen hat, gilt es als echter Bruch -> wird/bleibt `low`. | `marketStructureAnalysisLqSweep.test.js`: *"touched LOW MIT echtem Close drunter -> bleibt 'low'"* |
| Ohne Kerzendaten gilt konservativ KEIN Sweep (Default ist `low`, nicht `LQ-sweep`) — umgekehrter Default als bei `closesAboveOldHigh`. | `marketStructureAnalysisLqSweep.test.js`: *"ohne Kerzendaten (candles=[]) konservativ KEIN Sweep behaupten"* |
| Nie getouchte Pivots werden gar nicht erst geprüft/reklassifiziert — "getoucht" heißt hier **zum aktuellen Verarbeitungszeitpunkt (`toTime`) bereits getoucht** (`isUntouchedAsOf`), NICHT der rohe globale Touch-Endfakt. Ein Pivot, dessen `touchedTime` erst in der Zukunft (relativ zu `toTime`) liegt, bleibt bis dahin unangetastet. **Fix Chat 2026-07-24**, gefunden über den echten `.debug/metadata.json`-Snapshot: vorher degradierte ein frisch bestätigtes `protected-low` oft schon beim nächsten Verarbeitungsschritt zu `LQ-sweep`, Tage bevor der eigentliche Touch chronologisch überhaupt stattfand — einmal so fälschlich degradiert, konnte der spätere ECHTE Close-drunter nie mehr `break-of-structure` auslösen (griff nur noch der `LQ-sweep`->`low`-Zweig). | `marketStructureAnalysisLqSweep.test.js`: *"nie touched -> wird gar nicht erst geprüft, bleibt 'low'"*; `marketStructureAnalysisProtectedLow.test.js`: *"ein bereits zu 'LQ-sweep' reklassifizierter Pullback kann trotzdem protected-low werden..."* (Zwischenstand bleibt jetzt `low`, nicht `LQ-sweep`), *"ein protected-low wird zu 'LQ-sweep', sobald es touched ist..."*; `marketStructureAnalysisRealPipeline.test.js` |
| `toTime` für die Kerzenschluss-Prüfung ist die Zeit der ZULETZT GELADENEN Kerze (`candles[candles.length-1].time`), nicht die pivotTime des gerade ankommenden Pivots selbst — `candles` liegt als vollständige, bis "jetzt" geladene Historie längst vor. **Fix Chat 2026-07-24**: vorher blieb ein längst tatsächlich erfolgter Kerzenschluss unentdeckt, bis zufällig ein NEUER Pivot die Neubewertung anstieß — bei ruhigem Markt (keine neuen Fraktale) blieb ein reales `break-of-structure` so u.U. für Stunden/Tage unsichtbar, obwohl die Kerzendaten dafür längst vorlagen. | `marketStructureAnalysisRealPipeline.test.js`: *"buildMarketStructureState erkennt einen break-of-structure, sobald 1.33806 real unterschlossen wird"* (reproduziert den Live-Bug 1:1 mit echten Kerzen+Settings aus `.debug/metadata.json`) |
| Neubewertung läuft BIDIREKTIONAL bei jedem Inner-Pivot (auch schon als `LQ-sweep` markierte Pivots) — durch die beiden Fixes oben ist ein "zu früh markiert, korrigiert sich später zurück"-Fall inzwischen die Ausnahme statt die Regel: ein bereits in `candles` sichtbarer Close-drunter wird i.d.R. schon beim ersten Verarbeitungsschritt korrekt erkannt. | `marketStructureAnalysisLqSweep.test.js`: *"ein bereits in candles sichtbarer Close-drunter wird sofort erkannt, auch an einem frühen Zwischenschritt (kein Nachlauf mehr)"* |
| Ein `protected-low` zählt bei dieser Prüfung mit (kein Sonderfall) — wird getoucht und schließt nie eine Kerze drunter -> wird ebenfalls `LQ-sweep`. | `marketStructureAnalysisProtectedLow.test.js`: *"ein protected-low wird zu 'LQ-sweep', sobald es touched ist, aber nie eine Kerze drunter schließt"* |
| Bricht dagegen ein `protected-low` durch einen ECHTEN Kerzenschluss drunter, wird es NICHT nur `low`, sondern `break-of-structure` (Chat 2026-07-24: "Break of Structure", eigener Wert seit `range.type.ts` — strukturell schwerwiegender als ein gewöhnlicher Pullback, der bricht). `trend`/`currRange` bleiben dabei komplett unangetastet (bleibt `uptrend`) — reines Warnsignal, KEIN Reset wie bei der Trend-Invalidierung unten. | `marketStructureAnalysisLqSweep.test.js`: *"protected-low MIT echtem Close drunter -> wird 'break-of-structure'..."* |
| Einmal `break-of-structure` wird NICHT mehr zurückbewertet (fällt aus dem Reklassifizierungs-Filter raus) — anders als `low`/`LQ-sweep`, die bei neuen Kerzendaten weiter pendeln können, ist ein bestätigter Strukturbruch ein permanenter historischer Fakt. | `marketStructureAnalysisLqSweep.test.js`: *"einmal 'break-of-structure' bleibt dauerhaft..."* |
| `markLqSweeps` läuft bei JEDEM neuen Pivot, Outer (Periode 5) UND Inner (Periode 2) gleichermaßen — ein reiner Periode-5-Pivot kann LQ-sweep/break-of-structure also genauso auslösen wie ein Periode-2-Pivot, nur i.d.R. mit größerer Verzögerung (Chat 2026-07-24, Bug-Report: "allerspätestens mit Bildung des folgenden P5-Fraktals sollte ein BOS stehen" — vorher rief `applyMarketStructurePivot` `markLqSweeps` gar nicht auf). `applyMarketStructurePivot` braucht dafür jetzt ebenfalls ein `candles`-Argument (Default `[]`, siehe PriceChart.vue: `rangesCandles` wird an BEIDE Pfade durchgereicht). | `marketStructureAnalysisLqSweep.test.js`: *"ein reiner Periode-5-Pivot mit echtem Kerzenschluss reklassifiziert ein protected-low zu 'break-of-structure'"* |

## Darstellung (`renderMarketStructureAnalysis`)

Rein visuell, keine Zustandslogik — kein Test, nur Code-Kommentare in
`marketStructureAnalysis.ts` ab `renderMarketStructureAnalysis`:

- `currRange.high`: immer Pfeil + Linie, gestrichelt solange nur `sweeped-high`.
- `currRange.low`: immer Linie, gestrichelt solange nur `sweeped-low` ODER sobald irgendwo ein
  `break-of-structure` existiert (Schwäche-Signal, Chat 2026-07-24). Der grüne Pfeil ("hier long
  suchen") fällt komplett weg, sobald ein `break-of-structure` existiert — die Linie bleibt.
- `protected-low`: genau EINE Linie+Label ("1h protected low"), der jeweils aktuelle.
- `LQ-sweep`: JEDER aktuell so markierte `structurePivot` bekommt eine eigene goldene 1px-Linie
  (im Gegensatz zu protected-low potenziell mehrere gleichzeitig) — der goldene Pfeil nach oben
  fällt weg, sobald irgendwo ein `break-of-structure` existiert (keine Long-Andeutung mehr, siehe
  Chat 2026-07-24: "damit ich keine Longs suche").
- `break-of-structure`: JEDER aktuell so markierte `structurePivot` bekommt eine eigene gestrichelte
  rote Linie + Label ("BOS", ohne Altersangabe — anders als bei `LQ-sweep` für die Handelsentscheidung
  nicht relevant, Chat 2026-07-24), mittig über der Linie im Uptrend / mittig darunter im (noch nicht
  implementierten) Downtrend, kein eigener Pfeil (reines Warnsignal).
- Verbindungslinie der AKTUELL laufenden Range (Chat 2026-07-25, Bug-Report Philip: "auch den
  jetzigen bestätigten uptrend auch verbunden"): sobald `state.trend !== 'unknown'`, eine einfache
  gerade Linie von `currRange.low` nach `currRange.high` (`RangeLinePrimitive`, kein Zigzag —
  bewusst so gewünscht), Farbe nach Trendrichtung (`rangeClosed` grün bullisch, `rangeChoch` rot
  bärisch — nach einer Promotion ist `state.trend` selbst `'downtrend'`).
- `closedRanges` (Chat 2026-07-25, Promotion): JE archivierter Range dieselbe Linie wie oben, nur
  fest auf `low`/`high` zum Archivierungszeitpunkt, immer `rangeClosed` (grün, war ja ein Uptrend).
  `LiquidityLinePrimitive` kann das nicht (zeichnet nur horizontale Preis-Level), daher eine eigene
  kleine Primitive (`RangeLinePrimitive`) nach demselben Muster wie `ArrowPrimitive`.
- Nested-Gegentrend-Struktur/CHoCH (Chat 2026-07-25): solange `state.nestedTrend?.trend ===
  'downtrend'` (bestätigt, aber noch nicht promoted) ZWEI Elemente — (1) dieselbe rote
  Verbindungslinie über `nestedTrend.currRange.low` -> `nestedTrend.currRange.high` (Bug-Report
  Philip: "eine rote Verbindungslinie von 1.35583 bis 1.34601"), UND (2) ein Linie+Label ("CHoCH")
  von der URSPRÜNGLICHEN Nested-Origin-Low (`nestedTrend.appliedPivots[1]`, NICHT
  `nestedTrend.currRange.low` — das ist nach der Bestätigung der brechende Pivot, nicht die
  gebrochene Ursprungsstruktur; Bug-Report Philip: "IST 1.34601, SOLL 1.35206") BIS ZU der ERSTEN
  Kerze (aus den angezeigten, meist feineren Candles — z.B. M5 bei H1-Pivots), die tatsächlich
  unter diesem Level SCHLIESST (`firstCloseBelow`). Kurzzeitig auf reine Docht-Berührung
  umgestellt gewesen (Chat: "das reine Zeichnen ist doch nur bis Kerzenberührung, da reicht sogar
  ein Docht"), dann aber zurückgebaut (Bug-Report Philip: "entsteht der choch pivot im
  outer-pivot bereich und direkt paar minuten später berührt ein innerpivot den choch schon") —
  der H1-Periode-5-Ursprungspivot sitzt auf grober Stundenrasterung, sein `pivotTime` markiert
  nicht zwingend exakt den echten M5-Extrempunkt; ein Docht-Check direkt danach greift durch
  normales Kerzenrauschen fast immer sofort. Ein echter Kerzenschluss ist robust genug dagegen —
  dieselbe Docht-vs-Bruch-Unterscheidung wie bei der Erkennung selbst (`closesBelowLevel`), nur für
  die Zeichnung statt für die LQ-Sweep/Strukturbruch-Klassifizierung. Weder
  `nestedTrend.firstConfirmedAt` (der H1-Periode-5-Fraktal-Pivot selbst, Stunden NACH dem
  eigentlichen Kerzenschluss bestätigt — nur noch Fallback, falls keine Kerze tatsächlich drunter
  schließt) noch `toLevel`s "bis zur letzten geladenen Kerze" noch `currRange.low` (wandert weiter,
  solange nicht promoted) sind der richtige Endpunkt — alle drei ließen die Linie in früheren
  Anläufen zu weit wachsen (Bug-Reports Philip: "CHOCH Linie geht noch zu weit", "Linie sollte
  irgendwo in der MMM am 16.07. 10:30-13:00 enden"). Eigene Farbe (`rangeChoch`). Reiner
  Vorlauf-Hinweis — nach der Promotion ist `nestedTrend` wieder `null`, dann übernimmt die reguläre
  `currRange`-Darstellung (inkl. der Live-Verbindungslinie oben) den neuen (jetzt primären) Trend.
