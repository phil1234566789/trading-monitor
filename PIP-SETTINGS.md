# Pip-/Pixel-Schwellwerte: Übersicht

Verstreute Konstanten in einer Liste statt in fünf verschiedenen Dateien einzeln nachzuschlagen —
Pointer-Stil wie [`src/marketStructureAnalysis.rules.md`](src/marketStructureAnalysis.rules.md):
Datei:Zeile + 1-Satz-Zweck, nicht die volle Herleitung (die steht am jeweiligen Code-Kommentar).
Bei Zweifel zählt der Code, nicht diese Zeile.

Angelegt Chat 2026-07-30, als Nebenzug zum 0,5er-Fib-Feature (zu viele verstreute `*_PIPS`-
Konstanten ohne zentrale Übersicht).

## Pip-Größe

- **`PIP_SIZE`** — [`src/pipConfig.js`](src/pipConfig.js) — `0.0001`, zentrale Pip-Größe für
  GBPUSD/EURUSD (die einzigen unterstützten FX-Paare). Vorher 3x unabhängig dupliziert
  (`orderBlocks.js`, `dataExport.js`, `PriceChart.vue` als `TRADE_SETUP_PIP_SIZE`) — seit
  Chat 2026-07-30 zentralisiert, alle Stellen importieren von hier.

## Pip-Schwellen (Mindestgröße/-abstand)

- **`LOWER_TF_MIN_GAP_PIPS`** — [`src/orderBlockDetection.js:21`](src/orderBlockDetection.js#L21)
  (Backend-Duplikat: [`supabase/functions/_shared/orderBlocks.ts:15`](supabase/functions/_shared/orderBlocks.ts#L15))
  — Mindest-Gap (in Pips) für eine FVG/Order-Block-Zone auf M1/M3/M5, statt der prozentualen
  `IRRELEVANT_PCT`-Schwelle (die auf Forex-Kursniveau für Intraday-TFs zu grob wäre).
- **`HTF_FOREX_MIN_GAP_PIPS`** — [`src/orderBlockDetection.js:30`](src/orderBlockDetection.js#L30)
  (Backend-Duplikat: [`supabase/functions/_shared/orderBlocks.ts:25`](supabase/functions/_shared/orderBlocks.ts#L25))
  — dasselbe für 1H/4H, nur bei Forex. 1H seit 2026-08-11 bei 1,5 Pip (vorher 4 — verschluckte eine
  reale GBPUSD-FVG).
  Die Erkennungslogik selbst zog seit Chat 2026-08-02 von `src/orderBlocks.js` nach
  `src/orderBlockDetection.js` um (Node-Safety fürs MCP-Backfill-Script) — `orderBlocks.js`
  re-exportiert `detectOrderBlocks` nur noch, die Konstanten selbst stehen nicht mehr dort.
- **`TRADE_SETUP_LS_MAX_DISTANCE_M5`** — [`src/components/PriceChart.vue:224`](src/components/PriceChart.vue#L224)
  — `5 * PIP_SIZE`, maximaler Preisabstand zwischen M5-Fraktal und Liquidity-Sweep für einen
  gültigen Trade-Setup-Pfad A/B (`lsMaxDistancePipsM5` im Pine-Original).
- **`RANGE_FIB_MIN_PP_DISTANCE_PIPS`** — [`src/marketStructureAnalysis.ts:1499`](src/marketStructureAnalysis.ts#L1499)
  — `50`, Mindestabstand zwischen einem `protected-low`/`-high` und der gegenüberliegenden
  Range-Kante, ab dem das "Protected-Fib" (siehe `computeFibLevels`) überhaupt gezeichnet/als
  Bestätigung angeboten wird — bei kleinerem Abstand ist ein 0,5er-Fib-Level nicht aussagekräftig.

## Pixel-Schwellen (Label-Sichtbarkeit beim Zoomen)

- **`MIN_PIXELS_PER_HOUR_FOR_LABELS`** / **`MIN_PIXELS_PER_HOUR_FOR_LABELS_INTRADAY`** —
  [`src/chartZoom.js:16`](src/chartZoom.js#L16) / [`:25`](src/chartZoom.js#L25) — ab wie viel
  Pixel pro Stunde Chart-Zeit Text-Labels noch gezeichnet werden (Liquidität/Structure/Sessions/
  OBs/Trade-Marker); eigener (höherer) Schwellwert für Timeframes unter 1h, weil Indikator-Events
  dort dichter clustern. Kein Pip-Wert, aber dieselbe "ab wann blende ich was aus"-Kategorie.

## Bewusst nicht aufgenommen

Zeit-/Gewichts-Schwellen ohne Pip-/Pixel-Bezug (z.B. `NEWS_NOGO_WINDOW_MINUTES`,
`ANTI_CONFLUENCE_THRESHOLD`, `TRADE_SETUP_OB_WIDTH_SEC`) — eigene Kategorie, gehören eher zu einer
möglichen späteren "TSC-/Timing-Konfiguration"-Übersicht als hierher.
