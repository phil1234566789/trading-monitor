# marketStructureAnalysis: Regelübersicht

Ein-Satz-Zusammenfassung pro Regel + Verweis auf den Test, der sie tatsächlich absichert. Bei
Zweifel zählt der Test/Code, nicht diese Zeile — hier steht nur "was", nicht "wie genau".
Implementierung: [marketStructureAnalysis.ts](marketStructureAnalysis.ts).

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
| Downtrend-Bestätigung (Low bricht, Pullback-Highs bestätigen spiegelbildlich): **nicht implementiert**, bewusst offen gelassen. | — (kein Test, kein Code) |

## Inner-Pivots (Periode 2) — schnellere Vorab-Erkennung

| Regel | Test |
|---|---|
| Inner-Pivot innerhalb der Range -> reiner Pullback, landet in `innerStructurePivots`. | `marketStructureAnalysisInnerPivots.test.js`: *rangeState1_2* |
| Inner-Pivot bricht `currRange.high` preislich, aber KEINE Kerze schließt drüber -> nur `sweeped-high` (Preis/Zeit von `currRange.high` bleiben), kein echter Bruch. | `marketStructureAnalysisInnerPivots.test.js`: *rangeState2_1* |
| Inner-Pivot bricht `currRange.high` preislich UND mindestens eine Kerze schließt seit dem alten High tatsächlich drüber -> echter Bruch, `currRange.high` wird ersetzt, Bestätigungslogik läuft mit. | `marketStructureAnalysisInnerPivots.test.js`: *rangeState1_4* |
| Ohne Kerzendaten gilt ein Preis-Bruch konservativ als ECHTER Bruch (nicht als Sweep) — fehlender Candle-Fetch soll nicht heimlich jeden Bruch abwerten. | Code-Kommentar `closesAboveOldHigh`, kein dedizierter Test |
| Ein Outer-Pivot bricht `currRange.low` NICHT von sich aus über Inner-Pivots — der spiegelbildliche Fall (Inner-Pivot bricht `currRange.low`) ist **nicht implementiert**. | — (kein Test, kein Code) |

## LQ-Sweep (`markLqSweeps`)

| Regel | Test |
|---|---|
| Ein getouchtes `low`/`LQ-sweep`/`protected-low`, seit dessen eigener Kerze NIE eine Kerze drunter geschlossen hat, ist ein Liquidity-Grab -> wird/bleibt `LQ-sweep`. | `marketStructureAnalysisLqSweep.test.js`: *"touched LOW ohne jeden Close drunter -> 'LQ-sweep'"* |
| Sobald irgendeine Kerze seit der eigenen Pivot-Kerze tatsächlich drunter geschlossen hat, gilt es als echter Bruch -> wird/bleibt `low`. | `marketStructureAnalysisLqSweep.test.js`: *"touched LOW MIT echtem Close drunter -> bleibt 'low'"* |
| Ohne Kerzendaten gilt konservativ KEIN Sweep (Default ist `low`, nicht `LQ-sweep`) — umgekehrter Default als bei `closesAboveOldHigh`. | `marketStructureAnalysisLqSweep.test.js`: *"ohne Kerzendaten (candles=[]) konservativ KEIN Sweep behaupten"* |
| Nie getouchte Pivots werden gar nicht erst geprüft/reklassifiziert. | `marketStructureAnalysisLqSweep.test.js`: *"nie touched -> wird gar nicht erst geprüft, bleibt 'low'"* |
| Neubewertung läuft BIDIREKTIONAL bei jedem Inner-Pivot (auch schon als `LQ-sweep` markierte Pivots), damit sich ein zu früh markierter Sweep bei einem späteren Replay-Schritt wieder zurück auf `low` korrigiert. | `marketStructureAnalysisLqSweep.test.js`: *"einmal fälschlich als LQ-sweep markiert ... korrigiert sich bei einem späteren Schritt wieder zurück zu 'low'"* |
| Ein `protected-low` zählt bei dieser Prüfung mit (kein Sonderfall) — wird getoucht und schließt nie eine Kerze drunter -> wird ebenfalls `LQ-sweep`. | `marketStructureAnalysisProtectedLow.test.js`: *"ein protected-low wird zu 'LQ-sweep', sobald es touched ist, aber nie eine Kerze drunter schließt"* |

## Darstellung (`renderMarketStructureAnalysis`)

Rein visuell, keine Zustandslogik — kein Test, nur Code-Kommentare in
`marketStructureAnalysis.ts` ab `renderMarketStructureAnalysis`:

- `currRange.high`/`.low`: immer Pfeil + Linie, gestrichelt solange nur `sweeped-high`/`sweeped-low`.
- `protected-low`: genau EINE Linie+Label ("1h protected low"), der jeweils aktuelle.
- `LQ-sweep`: JEDER aktuell so markierte `structurePivot` bekommt eine eigene goldene Linie + Pfeil
  (im Gegensatz zu protected-low potenziell mehrere gleichzeitig).
