# Graph Report - trading-monitor  (2026-09-24)

## Corpus Check
- 586 files · ~618,299 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 3411 nodes · 6901 edges · 171 communities (147 shown, 16 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 124 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e5e814b4`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Dashboard.vue
- gbp_h1_uptrend_uptrend_break_of_structure_und_trendumkehr.ts
- usePriceChartLiquidity.js
- berlinDateStrFor
- PriceChart.vue
- gbp_h1_uptrend_mit_LQ_sweep_LONG_SETUP.ts
- gbp_h1_uptrend_mit_inner_structure.ts
- clipReplay
- usePriceChartRsi.js
- PLAN: M5-Trend algorithmisieren
- rsiDivergenceStats.ts
- TradeSetupCockpit.vue
- lineWidth
- DR-Reichweite — was taugen die erkannten Setups?
- tradeSetup.js
- TradeEditModal.vue
- package.json
- src/sessionOccurrences.js
- LoopStatus.vue
- Plan: POI-Strategie-Findung, Backtesting & Trade-Notifications
- Dealing-Range-Anlegen Skill
- biasCheck.ts
- newsMarkers.js
- priceChartObZones.js
- ctrader/client.ts
- db.ts
- tradeIntake.js
- chartTimeUtils.js
- lauf
- GoldH1Preview.vue
- backfillLiquidityLevels.ts
- sessions.js
- gbp_h1_uptrend_protected_low_gebrochen.ts
- LiquidityLineRenderer
- tradeSetups.js
- useHttpActivity.js
- tdd_mit_claude.ts
- tradingAccounts.js
- OrderBlockPrimitive
- armChartClick
- drQuoten.js
- liquidity.js
- supabaseClient.js
- orderBlocks.js
- trading-monitor-mcp/marketStructureAnalysis.ts
- priceChartConstants.js
- marketStructureAnalysis Rules Overview
- Laniakea Persona Command (/l)
- Plan: Sehr Große Dateien Refactoren (PriceChart.vue)
- fachdoku-router/SKILL.md
- pinContext.js
- drMerkmale.py
- annotations.js
- gbp_h1_uptrend.ts
- Trading-Monitor Project Overview (CLAUDE.md)
- PLAN: DR-Statistik in der UI anzeigen
- src/marketStructureAnalysis.ts
- chartColors.js
- pinEntryVisible
- trading-monitor-mcp/pretradeGates.ts
- findAntiConfluences.js
- newsEvents.js
- dealingRangeLoop.ts
- poi-watcher/index.ts
- State Machine for Lana's Trading Flow
- compilerOptions
- tradeEvidence.ts
- backfillTradeSetups.ts
- trade_evidence Table (Dual-Level, Confirmation/Confluence)
- AGENTS.md
- fmtPrice
- fmtDateTime
- tradeSetup.ts
- closed_rows
- Journal GBPUSD — Sicherung vor dem Quellenwechsel
- candleCache.js
- SessionBandPrimitive
- TradingFlow.vue
- applyMarketStructurePivot
- fxcmCandles.ts
- lade_setups
- Dealing-Range-Loop Diagram
- FXCM-Kerzenfeed
- App.vue
- AI Capabilities and Limitations Notes
- Vegapunk Slimming Results (-86%)
- useDrawings.js
- reads.ts
- pipScale.js
- twelvedata/client.ts
- Anleitung: State-Machine lesen & bedienen
- marketStructureAnalysis.test.js
- marketStructureRendering.ts
- trading-monitor-mcp/orderBlockDetection.js
- MCP-Server: Tiefere Referenz
- forbiddenSession.ts
- filterTrend.py
- messeFindTargets.py
- NewsModal.vue
- filterGegenkraft.py
- trades.ts
- useM5CandleClock
- /task do Mode
- hole_alle
- Fachdoku-Router Skill
- dailyPivotMarkers.js
- Lana-Fehlerdiagnose
- Agent Skills Pro Notes
- validationEvidence.ts
- fetch-trend-fixture.mjs
- ContextMenu.vue
- ctraderCandles.js
- Aufmerksamkeits-Level (Watch-Level-Strategie Schritt 5+)
- Debug-Metadata-Panel Notes
- AI Failure as Property Collision
- MCP Advanced Topics Notes
- forexCandles.js
- vite.config.js
- lana-git-pull.cjs
- dataExport.ts
- .mcp.json
- fxcm-xauusd-h4-20260924/analyze.py
- src/pipConfig.js
- trading-monitor index.html Entry
- marketStructureAnalysisInnerPivots.test.js
- Handbuch-Check
- trendIndicator.gbpusd-downtrend.test.js
- Claude Code Hooks Documentation Pointers
- mcp-server/src/scripts/backfillObZones.ts
- merkmale
- JsonTree.vue
- Pivot
- XAUUSD: begrenzter FXCM-H1-Kontotest, 24.09.2026
- Dealing Range anlegen
- .codex/hooks/lana-git-pull.cjs
- source-command-l
- tradingSchedules.js
- prefill-obs.mjs
- RangeLinePaneView
- supabaseRowCapGuard.test.js
- ArrowPaneView
- orderBlocks.ts
- removeConfirmationFromTrade
- Entschiedene Design-Fragen
- validate.js
- marketStructureAnalysisNestedNestedChoch.test.js
- tintFvgCandles
- vueComponentImportGuard.test.js
- MetadataPanel.vue
- messeFxcmKontext.ts
- tradeSetup.test.js
- test_saisonalitaet.py
- usePriceChartMarketStructure.js
- Die Filter
- router.js
- toPips
- Plan: Forex-Chart-Objekte Datengrundlage
- analyze.py
- fachdoku-router-reminder.cjs
- M5CandleClock.vue
- useTabScopedRef
- findTargets.js
- cTrader Open API as Forex Candle Source

## God Nodes (most connected - your core abstractions)
1. `berlinDateStrFor()` - 46 edges
2. `cssColor()` - 40 edges
3. `fmtPrice()` - 36 edges
4. `berlinDateTimeStrFor()` - 34 edges
5. `pricePrecisionForInstrument()` - 33 edges
6. `fetchForexCandles()` - 31 edges
7. `json()` - 30 edges
8. `clipReplay()` - 28 edges
9. `lineWidth()` - 26 edges
10. `logDecision()` - 25 edges

## Surprising Connections (you probably didn't know these)
- `Archive-First Auto-Reload Pattern (Tried, Then Reverted)` --semantically_similar_to--> `Persisted Forex Candle Archive (forex_candles Pilot)`  [INFERRED] [semantically similar]
  PLAN-chart-objekte-forex.md → PLAN-notifications.md
- `/task do Mode` --semantically_similar_to--> `milk-city Task Status Convention`  [INFERRED] [semantically similar]
  .claude/commands/task.md → CLAUDE.md
- `Laniakea milk-city Task-Status Rule` --semantically_similar_to--> `milk-city Task Status Convention`  [INFERRED] [semantically similar]
  .claude/commands/l.md → CLAUDE.md
- `Trading-Monitor Project Overview (CLAUDE.md)` --conceptually_related_to--> `BTC Scope Removal from Chart-Objects Plan`  [INFERRED]
  CLAUDE.md → PLAN-chart-objekte-forex.md
- `Bestätigungen (Sweeps & OBs) Feature` --semantically_similar_to--> `Confirmation/Confluence/Anti-Confluence Categories`  [INFERRED] [semantically similar]
  PLAN-trade-confluences.md → .claude/skills/dealing-range-anlegen/SKILL.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **State-Machine Doc + Diagram Pair** — docs_state_machine_doc, docs_diagrams_dealing_range_loop_doc, docs_diagrams_trading_steps_ablauf_doc [EXTRACTED 1.00]
- **OB-Zone Canonical FK Consolidation Initiative** — plan_chart_objekte_forex_consolidation_approach, db_ob_zones, src_tradesetup, db_trade_evidence [INFERRED 0.80]
- **AI Fluency Diagnostic Toolkit Applied to Lana** — docs_ai_fluency_4d_doc, docs_steerabilty_doc, docs_steerabilty_working_memory_steerability_collision [INFERRED 0.85]
- **CHoCH-to-Promotion-to-Rendering Pipeline** — src_marketstructureanalysis_rules_nested_trend_choch, src_marketstructureanalysis_rules_promotion, src_marketstructureanalysis_rules_darstellung [INFERRED 0.85]
- **cTrader Forex Data Pipeline (Chart, MCP, Archive)** — supabase_functions__shared_ctrader_client, supabase_functions_forex_candles, src_forexcandles, db_forex_candles, plan_notifications_forex_candle_archive [INFERRED 0.85]
- **Root-Cause-Fix Skill Pattern (Structural Fix Over Output Patch)** — dra_skill_main, handbuch_check_main, lana_fehlerdiagnose_main [INFERRED 0.85]

## Communities (171 total, 16 thin omitted)

### Community 0 - "Dashboard.vue"
Cohesion: 0.01
Nodes (132): useSessionStorageRef(), antiConfluenceAddTrade, anyArmStateActive, ARM_HINTS, ARM_STATES, armedAction, armedTradeAction, armedTscSection (+124 more)

### Community 1 - "gbp_h1_uptrend_uptrend_break_of_structure_und_trendumkehr.ts"
Cohesion: 0.02
Nodes (101): candlesAroundBOS, candlesAroundBreak, p2Pivot1, p2Pivot10, p2Pivot11, p2Pivot12, p2Pivot13, p2Pivot14 (+93 more)

### Community 2 - "usePriceChartLiquidity.js"
Cohesion: 0.12
Nodes (25): usePriceChartLiquidity(), attachBonus(), refresh(), liquidityLevelNaturalKey(), buildLevel(), detectLiquidityLevels(), filterRelevantLevels(), isDownFractal() (+17 more)

### Community 3 - "berlinDateStrFor"
Cohesion: 0.08
Nodes (45): berlinDateStrFor(), berlinDateTimeStrFor(), DATE_FORMATTER, OFFSET_FORMATTER, TIME_FORMATTER, toPips(), postChartAnnotations(), buildServer() (+37 more)

### Community 4 - "PriceChart.vue"
Cohesion: 0.03
Nodes (78): activeMetadataSnapshot, allCandles, antiConfluencePickerCurrentPrice, antiConfluencePickerDivergenceCandidates, antiConfluencePickerHoveredLiquidityKey, antiConfluencePickerHoveredObKey, antiConfluencePickerInvalidationObCandidates, antiConfluencePickerObCandidates (+70 more)

### Community 5 - "gbp_h1_uptrend_mit_LQ_sweep_LONG_SETUP.ts"
Cohesion: 0.03
Nodes (60): p2Pivot1, p2Pivot10, p2Pivot11, p2Pivot12, p2Pivot13, p2Pivot14, p2Pivot15, p2Pivot16 (+52 more)

### Community 6 - "gbp_h1_uptrend_mit_inner_structure.ts"
Cohesion: 0.04
Nodes (55): p2Pivot1, p2Pivot10, p2Pivot11, p2Pivot12, p2Pivot13, p2Pivot14, p2Pivot15, p2Pivot16 (+47 more)

### Community 7 - "clipReplay"
Cohesion: 0.11
Nodes (33): tradesVisibleForCandles(), applyCandleData(), buildActiveMetadataSnapshotInternal(), clearTradeSetupFocus(), clipReplay(), computeTradeSetupsInternal(), focusTradeSetup(), loadInitial() (+25 more)

### Community 8 - "usePriceChartRsi.js"
Cohesion: 0.06
Nodes (36): drawIconLabel(), canShowLabels(), nativeLineWidth(), usePriceChartRsi(), applyColorOptions(), applyLineWidthOptions(), create(), refreshDivergence() (+28 more)

### Community 9 - "PLAN: M5-Trend algorithmisieren"
Cohesion: 0.07
Nodes (28): 1. `period * 3600` ist die einzige harte H1-Annahme, 2. Perioden-Wahl — die eigentliche Designfrage, 3. Fenster-Anker — geklaert, Analogie traegt, 4. Pivot-Kappung — kein Volumen-, sondern ein Nachvollziehbarkeitsproblem, 5. Wo der M5-Trend hin wirkt, Abweichung vom Trockenlauf oben — Phasen mit dem echten Code, Anker-Korrektur, Befund: der bestehende Algo läuft auf M5-Kerzen bereits (+20 more)

### Community 10 - "rsiDivergenceStats.ts"
Cohesion: 0.09
Nodes (38): buildDivergenceEntry(), collectDivergenceHistory(), computeRsi(), DEFAULT_DIVERGENCE_FRACTAL_PERIOD, DEFAULT_DIVERGENCE_HISTORY_COUNT, DEFAULT_DIVERGENCE_LOOKBACK_BARS, DEFAULT_RSI_PERIOD, detectRsiDivergence() (+30 more)

### Community 11 - "TradeSetupCockpit.vue"
Cohesion: 0.05
Nodes (50): Plan: find_targets Algorithmus, TSC-Neuaufbau Precondition, trendChain, accentStyle, antiConfluences, canTransfer, confirmationLabel(), confirmations (+42 more)

### Community 12 - "lineWidth"
Cohesion: 0.13
Nodes (11): lineWidth(), drawEntryPoint(), drawExitPoint(), drawHaloRing(), drawLabel(), drawTick(), renderTradeMarkers(), TradeMarkerPaneView (+3 more)

### Community 13 - "DR-Reichweite — was taugen die erkannten Setups?"
Cohesion: 0.12
Nodes (16): Aktueller FXCM-Stand: 2025 und 2026, Definitionen, DR-Reichweite — was taugen die erkannten Setups?, Enge der DR — warum beide Einheiten nötig sind, find_targets, FVG-Größe — der stärkste Einzelfilter, den wir bisher gemessen haben, Grenzen, Historische Befunde vor dem FXCM-Wechsel (+8 more)

### Community 14 - "tradeSetup.js"
Cohesion: 0.18
Nodes (18): Two Runtimes, One Algorithm Set (Deliberate Duplication), computeTradeSetups(), closesBeyondLevel(), collectObSweeps(), detectSetupObs(), detectTradeSetups(), findAllProtectedFractals(), findBestLsMatch() (+10 more)

### Community 15 - "TradeEditModal.vue"
Cohesion: 0.05
Nodes (47): emit, commission, confirmationLabel(), emit, entryPrice, entryTimeInput, exitPrice, exitTimeInput (+39 more)

### Community 16 - "package.json"
Cohesion: 0.06
Nodes (33): lightweight-charts, mermaid, dependencies, lightweight-charts, mermaid, @supabase/supabase-js, vue, vue-router (+25 more)

### Community 17 - "src/sessionOccurrences.js"
Cohesion: 0.24
Nodes (12): createSessionBonusResolver(), ALL_DAYS, attachRangeExtremes(), bonusLabelForPivot(), buildSessionContextLookup(), contextForPivot(), daysOrAll(), localMidnightUtc() (+4 more)

### Community 18 - "LoopStatus.vue"
Cohesion: 0.07
Nodes (24): fetchLoopStateHistory(), fetchLoopStatesForDate(), LOOP_INSTRUMENTS, rowToLoopState(), fetchStateMachineLog(), rowToDecision(), activeByInstrument, { data, refresh } (+16 more)

### Community 19 - "Plan: POI-Strategie-Findung, Backtesting & Trade-Notifications"
Cohesion: 0.18
Nodes (14): Supabase/PostgREST ~1000 Row Cap Gotcha, daily_structure_pivots Table, forex_candles Table, get_forex_candles_archive MCP Tool, BTC-USDT/OKX Complete Removal (2026-08-21), 1D-Periode-4-Pivot Market-Structure Startpoint (2026-08-30), Persisted Forex Candle Archive (forex_candles Pilot), Kronos LLM Forecast Entry-Filter Experiment (Shelved) (+6 more)

### Community 20 - "Dealing-Range-Anlegen Skill"
Cohesion: 0.14
Nodes (15): kind=pivot = Liquidity-Sweep-Only Semantics, Dealing-Range-Anlegen Skill, milk-city Task: Confluence-Tracking bei Dealing Ranges, trading/liquidität.md (Liquiditäts-Sweep-Mechanismus), AI Capabilities Framework (Next Token Prediction/Knowledge/Working Memory/Steerability), Diagnose-to-Fix Routing Table, Lana-Fehlerdiagnose Skill, docs/steerabilty-vs-wrong-ai-outputs.md (+7 more)

### Community 21 - "biasCheck.ts"
Cohesion: 0.09
Nodes (47): berlinDayRangeUtcMs(), buildPendingDecisions(), findIntermediateLevel(), FindIntermediateLevelArgs, IntermediateLevelCandidate, isSpreadHourPivot(), PendingDecision, findNearestLiquidityTargets() (+39 more)

### Community 22 - "newsMarkers.js"
Cohesion: 0.11
Nodes (13): usePriceChartSessionsAndNews(), refreshNewsMarkers(), refreshSessions(), DAY_KEY_FORMATTER, extrapolatedX(), formatEventLabel(), isSameBerlinDay(), NewsMarkerPaneView (+5 more)

### Community 23 - "priceChartObZones.js"
Cohesion: 0.14
Nodes (25): emit, obZoneCtx(), onAntiConfluencePickerHover(), onAntiConfluencePickerSelect(), onTargetPickerHover(), onTargetPickerSelect(), refreshLiquidityInternal(), refreshPoiZonesInternal() (+17 more)

### Community 24 - "ctrader/client.ts"
Cohesion: 0.11
Nodes (26): CORS_HEADERS, authAccount(), authenticate(), cachedSymbolIds, Candle, concat(), connectWithTimeout(), CTraderConnection (+18 more)

### Community 25 - "db.ts"
Cohesion: 0.08
Nodes (45): addPinEntry(), addPinM5LiquidityEntry(), addPinM5ObEntry(), addPinRsiDivergenceEntry(), addTradeConfirmation(), AddTradeConfirmationArgs, AddTradeTargetArgs, asOfProbeCandles() (+37 more)

### Community 26 - "tradeIntake.js"
Cohesion: 0.15
Nodes (22): addConfirmationToTrade(), addPositionToDealingRange(), addRangeConfirmation(), addTargetToTrade(), createDealingRange(), directionForSetup(), findMatchingTradeSetupId(), findOrCreateLiquidityLevelId() (+14 more)

### Community 27 - "chartTimeUtils.js"
Cohesion: 0.14
Nodes (8): computeNextReplayTime(), mergeRecent(), nextCandleAfter(), replayFetchToMs(), snapToBarTime(), ScalePaneView, ScalePrimitive, ScaleRenderer

### Community 28 - "lauf"
Cohesion: 0.16
Nodes (15): ev(), Erwartungswert in R ueber die ENTSCHIEDENEN DRs (Treffer oder Stopp, nicht…, kam_retest(), lade_kerzen(), lauf(), mess_gedeckelt(), mess_pips_gedeckelt(), Laeuft die M5-Kerzen ab FVG-Bestaetigung ab -> 'win' | 'loss' | 'offen'. Beides… (+7 more)

### Community 29 - "GoldH1Preview.vue"
Cohesion: 0.16
Nodes (15): berlin, container, count, error, load(), loading, obCount, fetchGoldH1Preview() (+7 more)

### Community 30 - "backfillLiquidityLevels.ts"
Cohesion: 0.11
Nodes (18): DB_READ_PAGE_SIZE, fetchAllRows(), ArchivableCandle, backfillOne(), BAR_CONFIG, BARS, CandleRow, correctMissedTouches() (+10 more)

### Community 31 - "sessions.js"
Cohesion: 0.12
Nodes (18): minutesToTimeInput(), timeInputToMinutes(), emit, instrumentSessions, props, WEEKDAY_DISPLAY_ORDER, addSession(), currentSessionDanger() (+10 more)

### Community 32 - "gbp_h1_uptrend_protected_low_gebrochen.ts"
Cohesion: 0.08
Nodes (25): ClosedRange, MarketStructureState, PivotBase, PivotHigh, PivotLow, PivotTouched, PivotTypeAll, PivotUntouched (+17 more)

### Community 34 - "tradeSetups.js"
Cohesion: 0.26
Nodes (10): fetchTradeSetupForCockpit(), fetchTradeSetups(), sweepLevel(), toSec(), tradeSetupFromRow(), { data: dbTradeSetups, refresh: refreshDbTradeSetups }, onIsolateTrade(), onSelectTrade() (+2 more)

### Community 35 - "useHttpActivity.js"
Cohesion: 0.22
Nodes (10): copiedId, { errors }, counts, dismissHttpError(), errors, extractErrorMessage(), installHttpActivityTracking(), labelFor() (+2 more)

### Community 36 - "tdd_mit_claude.ts"
Cohesion: 0.08
Nodes (24): nextPivot1, nextPivot10, nextPivot11, nextPivot2, nextPivot3, nextPivot4, nextPivot5, nextPivot6 (+16 more)

### Community 37 - "tradingAccounts.js"
Cohesion: 0.05
Nodes (49): clampedX, clampedY, confirm(), emit, note, onKeydown(), onWindowMousedown(), props (+41 more)

### Community 38 - "OrderBlockPrimitive"
Cohesion: 0.08
Nodes (22): findClickedDivergence(), findClickedFibLevel(), findClickedLiquidityLevel(), findClickedOBZone(), findClickedSetup(), findClickedTarget(), getCurrentFibLevels(), OrderBlockPrimitive (+14 more)

### Community 39 - "armChartClick"
Cohesion: 0.12
Nodes (20): deleteDealingRange(), armChartClick(), clearArmStatesExcept(), disarmChartClick(), onAddAntiConfluenceRequest(), onAddConfirmationRequest(), onAddConfluenceRequest(), onAddRangeAntiConfluenceRequest() (+12 more)

### Community 40 - "drQuoten.js"
Cohesion: 0.15
Nodes (16): kopfzeile, props, tabelle, FVG_BAENDER, FVG_BAND_LABELS, FVG_BAND_N, FVG_REFERENZ, FVG_ZIELE (+8 more)

### Community 41 - "liquidity.js"
Cohesion: 0.12
Nodes (23): cssColor(), cssColorScaled(), hexToRgba(), ageReferenceTime(), businessSecondsBetween(), formatAge(), refreshTradeConfirmationLinksInternal(), refreshTradeTargetLinksInternal() (+15 more)

### Community 42 - "supabaseClient.js"
Cohesion: 0.14
Nodes (17): fetchAlarmLog(), fetchTouchedLiquidityLevels(), fetchTradeSetups(), fetchDailyStructurePivots(), DB_READ_PAGE_SIZE, fetchAllRows(), fetchLiquidityLevelsHtf(), fetchObZones() (+9 more)

### Community 43 - "orderBlocks.js"
Cohesion: 0.11
Nodes (18): HTF_FOREX_MIN_GAP_PIPS Constant, LOWER_TF_MIN_GAP_PIPS Constant, Pip-/Pixel-Schwellwerte Übersicht, MIN_PIXELS_PER_HOUR_FOR_LABELS Constants, PIP_SIZE Constant, RANGE_FIB_MIN_PP_DISTANCE_PIPS Constant, TRADE_SETUP_LS_MAX_DISTANCE_M5 Constant, poi-watcher 4H+1H OB-Zonen-Wächter Edge Function (+10 more)

### Community 44 - "trading-monitor-mcp/marketStructureAnalysis.ts"
Cohesion: 0.19
Nodes (25): advanceNestedTrend(), applyInnerMarketStructurePivot(), applyInnerMarketStructurePivotCore(), applyMarketStructurePivot(), applyMarketStructurePivotCore(), buildMarketStructureState(), Candle, closesAboveOldHigh() (+17 more)

### Community 45 - "priceChartConstants.js"
Cohesion: 0.06
Nodes (38): usePriceChartTradeSetups(), fetchM5Candles(), fetchTrendAnalysisM5History(), getTrendAnalysisM5Candles(), CALLOUT_STACK_GAP_PX, CATEGORY_COLOR_KEY, CATEGORY_ICON, COPIED_FEEDBACK_MS (+30 more)

### Community 46 - "marketStructureAnalysis Rules Overview"
Cohesion: 0.22
Nodes (15): Arbitrary Nesting Depth (2026-08-09), Rendering Rules (renderMarketStructureAnalysis), marketStructureAnalysis Rules Overview, Docht-vs-Bruch (Wick vs Close-Break) Unification, Standalone Downtrend Detection/Invalidation, Fibonacci Level (computeFibLevels/collectFibLevels), Inner-Pivots (Period 2) Fast Pre-Detection, LQ-Sweep Classification (markLqSweeps) (+7 more)

### Community 47 - "Laniakea Persona Command (/l)"
Cohesion: 0.13
Nodes (18): 00-trading-steps.md Entry Point, Laniakea Persona Command (/l), trading/claude-project-instructions.md, trading-runs Relative Link Path Convention, 00-trading-steps.md#visuelle-antworten-chart-annotationen, 06-anti-confluence.md, glossar.md Consistency Check, kontext-ausführung.md (+10 more)

### Community 48 - "Plan: Sehr Große Dateien Refactoren (PriceChart.vue)"
Cohesion: 0.18
Nodes (11): Keep Codebase Clean / ~1000 Line Backstop Convention, liquidity_levels Table, Pip-Distance Server-Side Query Filter, Plan: Sehr Große Dateien Refactoren (PriceChart.vue), Phase 1: Candle-/Zeit-Helfer -> priceChartCandles.js, Phase 3: Liquidity-Merge -> priceChartLiquidity.js, Phase 4: RSI-Divergenz-Pin-Merge, Phase 5: Klick-Hittest-Funktionen (priceChartHitTest.js) (+3 more)

### Community 49 - "fachdoku-router/SKILL.md"
Cohesion: 0.18
Nodes (10): Fachdoku-Router, News Events Seed Workflow (ForexFactory Screenshot), News Events Seeding Notes, news_events Consumption (No-Go + Chart Markers), Settings-Sync Notes, localStorage-first / Supabase-Source-of-Truth Pattern, trading_loop_state Table Design, TSC No-Gos and Anti-Confluences Notes (+2 more)

### Community 50 - "pinContext.js"
Cohesion: 0.16
Nodes (21): addPinEntry(), addPinM5LiquidityEntry(), addPinM5ObEntry(), addPinRsiDivergenceEntry(), addPinTscSetupEntry(), fetchPinContext(), REF_COLUMN, removePinEntry() (+13 more)

### Community 51 - "drMerkmale.py"
Cohesion: 0.27
Nodes (4): gruppiere_drs(), messe_drs(), Eine DR = ein M5-OB, Zeilen desselben OB werden zusammengefasst.…, Reichweite/Risiko/Invalidierungszeit je DR, gemessen ab FVG-Bestaetigung…

### Community 52 - "annotations.js"
Cohesion: 0.08
Nodes (21): ANNOTATION_COLOR, annotationAnchorPoint(), AnnotationsPaneView, AnnotationsPrimitive, AnnotationsRenderer, parseAnnotations(), renderAnnotations(), resolveLabelPlacements() (+13 more)

### Community 53 - "gbp_h1_uptrend.ts"
Cohesion: 0.10
Nodes (20): pivot1, pivot10, pivot11, pivot12, pivot13, pivot2, pivot3, pivot4 (+12 more)

### Community 54 - "Trading-Monitor Project Overview (CLAUDE.md)"
Cohesion: 0.15
Nodes (12): cTrader ACCESS_DENIED Lockout (No Auto-Recovery), DRY Within a Single Runtime Convention, CLAUDE.md Pointer to /l Persona, npm run build Command, Trading-Monitor Project Overview (CLAUDE.md), Rename Consistency Convention, REPLAY_LOOKAHEAD_SEC M1 Scaling Gotcha, ctrader_oauth_tokens Table (+4 more)

### Community 55 - "PLAN: DR-Statistik in der UI anzeigen"
Cohesion: 0.13
Nodes (15): Beide Leitern nach festem Risiko-Band, Definitionen (nicht neu herleiten), Die Falle: Path B hat kein echtes Invalidierungslevel — ERLEDIGT 20.09.2026, Die Zahlen (Stand 23.09.2026, n=3179), Grenzen, die in die Anzeige gehören, Idee: wie wir den Trend doch noch dazubekommen, PLAN: DR-Statistik in der UI anzeigen, Reihenfolge (+7 more)

### Community 56 - "src/marketStructureAnalysis.ts"
Cohesion: 0.21
Nodes (20): advanceNestedTrend(), applyInnerMarketStructurePivot(), applyInnerMarketStructurePivotCore(), applyMarketStructurePivotCore(), closesAboveOldHigh(), closesBelowLevel(), evaluateConfirmingBreak(), invalidateDowntrend() (+12 more)

### Community 57 - "chartColors.js"
Cohesion: 0.08
Nodes (18): chartColors, DEFAULT_CHART_COLORS, resetChartColors(), chartLineWidths, DEFAULT_CHART_LINE_WIDTHS, resetChartLineWidths(), collapsed, emit (+10 more)

### Community 58 - "pinEntryVisible"
Cohesion: 0.14
Nodes (18): liquidityLevelEntryNaturalKey(), m5LiquidityEntryNaturalKey(), obZoneEntryNaturalKey(), hoveredPinLiquidityLevelKey, hoveredPinObZoneKey, onSelectPin(), pinEntryVisible(), pinJumpHint (+10 more)

### Community 59 - "trading-monitor-mcp/pretradeGates.ts"
Cohesion: 0.16
Nodes (15): BERLIN_HM_FORMATTER, BERLIN_WEEKDAY_FORMATTER, berlinWeekdayAndMinutes(), isWithinTradingWindows(), TradingWindows, WeekdayGroup, ClassifiedNewsEvent, NEWS_IMMINENT_MINUTES (+7 more)

### Community 60 - "findAntiConfluences.js"
Cohesion: 0.38
Nodes (11): byDistance(), findAntiConfluenceCandidates(), findAntiConfluenceDivergenceCandidates(), findAntiConfluenceObCandidates(), findAntiConfluenceSweepCandidates(), findInvalidationObCandidates(), inBand(), INDUCEMENT_TIMEFRAMES (+3 more)

### Community 61 - "newsEvents.js"
Cohesion: 0.32
Nodes (8): usePriceChartCockpit(), refreshCockpit(), currentNewsNoGo(), INSTRUMENT_CURRENCIES, NEWS_NOGO_WINDOW_MINUTES, newsEvents, newsEventsForInstrument(), sessions

### Community 62 - "dealingRangeLoop.ts"
Cohesion: 0.06
Nodes (64): AgeTier, businessSecondsBetween(), classifyAge(), computeSweepAgeHours(), MAJOR_MIN_HOURS, MINOR_MAX_HOURS, assessInducement(), checkFallFour() (+56 more)

### Community 63 - "poi-watcher/index.ts"
Cohesion: 0.11
Nodes (21): unprocessedTimeframes(), fmt(), InstrumentConfig, INSTRUMENTS, isInWindows(), LiquidityLevelRow, localMinutesAndWeekday(), ObZoneRow (+13 more)

### Community 64 - "State Machine for Lana's Trading Flow"
Cohesion: 0.14
Nodes (18): Trading-Steps-Ablauf Diagram, Fall 4 -> Zurück zu Schritt 3, Two Permanent LLM-Only Steps (3 and 6), News-Pause Doesn't Replace the Cron, State Machine for Lana's Trading Flow, get_tsc_range Deliberately Not a Graph Node, Problem: GBPUSD 28.08.2026 Fall-4 Deviation Incident, trading-runs/*.md Loses Purpose (+10 more)

### Community 65 - "compilerOptions"
Cohesion: 0.12
Nodes (16): src/marketStructureAnalysis.ts, src/marketStructureRendering.ts, src/pivotMarkers.ts, test/tdd_mit_claude/ranges/tdd_mit_claude.ts, compilerOptions, allowJs, checkJs, esModuleInterop (+8 more)

### Community 66 - "tradeEvidence.ts"
Cohesion: 0.12
Nodes (22): AgeTier, classifyAge(), MAJOR_MIN_SECONDS, MINOR_MAX_SECONDS, sweepTier, targetLabel(), evidenceAgeSeconds(), evidenceAgeTier() (+14 more)

### Community 67 - "backfillTradeSetups.ts"
Cohesion: 0.14
Nodes (13): readForexCandlesArchiveFrom(), LiquidityLevel, DEFAULT_TRADE_SETUP_PARAMS, TRADE_SETUP_H1_FRACTAL_PERIOD, TRADE_SETUP_M5_FRACTAL_PERIOD, persistTradeSetupSweeps(), alarmFenster, Candle (+5 more)

### Community 68 - "trade_evidence Table (Dual-Level, Confirmation/Confluence)"
Cohesion: 0.16
Nodes (14): dealing_ranges Table, trade_evidence Table (Dual-Level, Confirmation/Confluence), trade_partial_exits Table, trade_positions Table, trade_targets Table, Confirmation/Confluence/Anti-Confluence Categories, trading repo trade-from-poi.md (Confirmation/Confluence/Anti-Confluence Definition), OB-Zones Canonical FK Consolidation Approach (+6 more)

### Community 69 - "AGENTS.md"
Cohesion: 0.14
Nodes (12): Architecture, Commands, Conventions, Forex candle data: FXCM ForexConnect, Frontend data flow (`PriceChart.vue`), Gotchas, graphify, "Laniakea" persona (`/l`) (+4 more)

### Community 70 - "fmtPrice"
Cohesion: 0.06
Nodes (38): candidateLabel(), candidatePrice(), emit, mergedCandidates, precision, props, emit, noteSaveTimers (+30 more)

### Community 71 - "fmtDateTime"
Cohesion: 0.36
Nodes (8): buildActiveMetadataSnapshot(), earliestRelevantTime(), hasActiveMetadata(), selectActiveMetadataSections(), fmtDateTime(), ALL_OFF, BASE_CTX, SECTIONS

### Community 72 - "tradeSetup.ts"
Cohesion: 0.21
Nodes (17): LiquidityLevel, closesBeyondLevel(), collectObSweeps(), DetectedTradeSetup, detectTradeSetup(), findBestLsMatch(), findFirstSetupObAfter(), findImmediateLsSetup() (+9 more)

### Community 73 - "closed_rows"
Cohesion: 0.19
Nodes (11): main(), Begrenzter History-Test ohne Datenbank, Upload oder Handelsrequests (SDK Python…, main(), Begrenzter History-Test ohne Datenbank, Upload oder Handelsrequests (SDK Python…, closed_rows(), Normalisierung der nativen FXCM-Bid-Kerzen, unabhängig vom SDK testbar., main(), Geschlossene Bid-Kerzen: FXCM -> lokaler Puffer -> Supabase-Ingest. (+3 more)

### Community 74 - "Journal GBPUSD — Sicherung vor dem Quellenwechsel"
Cohesion: 0.10
Nodes (19): 03.06.2026 · Short · DR#40, 03.08.2026 · Short · DR#27, 07.08.2026 · Long · DR#29, 07.08.2026 · Short · DR#28, 07.08.2026 · Short · DR#30, 10.08.2026 · Short · DR#41, 14.07.2026 · Short · DR#44, 25.08.2026 · Long · DR#46 (+11 more)

### Community 75 - "candleCache.js"
Cohesion: 0.11
Nodes (25): cachedCandlesUpTo(), cacheKey(), fetchCandlesCached(), getCachedCandles(), hasLargeCandleGap(), mergeCandles(), openDb(), safeCompleteUpTo() (+17 more)

### Community 76 - "SessionBandPrimitive"
Cohesion: 0.14
Nodes (3): SessionBandPaneView, SessionBandPrimitive, SessionBandRenderer

### Community 77 - "TradingFlow.vue"
Cohesion: 0.10
Nodes (22): cache, useLocalStorageRef(), buildMermaidSource(), EDGES, getNextActionHint(), mermaidEscape(), NODES, activeByInstrument (+14 more)

### Community 78 - "applyMarketStructurePivot"
Cohesion: 0.08
Nodes (32): applyMarketStructurePivot(), initMarketStructureState(), RANGE_FIB_MIN_PP_DISTANCE_PIPS, chochConfirmedState(), confirmBreak, confirmedUptrendState(), originHigh, originLow (+24 more)

### Community 79 - "fxcmCandles.ts"
Cohesion: 0.22
Nodes (5): headers, fetchForexBatch(), FxcmCandle, PERIODS, readFxcmCandles()

### Community 80 - "lade_setups"
Cohesion: 0.20
Nodes (4): lade_bekannte_level(), lade_setups(), Die simulierten Zeilen tragen keine DB-id -- die Auswertung braucht aber einen…, Schluessel der in liquidity_levels persistierten Level -- die Tabelle fuehrt…

### Community 81 - "Dealing-Range-Loop Diagram"
Cohesion: 0.17
Nodes (12): Dealing-Range-Loop Diagram, News-Blackout Mid-Loop Pause, Pin-Aufräumen after TSC-Link, Target Selection Remains Lana's Judgment, Pin Tools (tools/pins.ts), poi-watcher Alert-Cron Notes, poi-watcher 3-Tier Fetch Throttling, UTC-Hours Exception for Refresh Ticks (+4 more)

### Community 82 - "FXCM-Kerzenfeed"
Cohesion: 0.22
Nodes (9): Betrieb, Datenfluss, Demokonto abgelaufen oder gesperrt, FXCM-Kerzenfeed, Historie nachholen und Sicherungen, Neuaufbau und Wartung, Umstellung und Sicherung, Wenn keine neuen Kerzen kommen (+1 more)

### Community 83 - "App.vue"
Cohesion: 0.11
Nodes (18): activeHint, { activeLabels, isActive }, isFresh, { lastSuccessAt }, lastUpdateText, now, showDrawingsModal, statusDotClass (+10 more)

### Community 84 - "AI Capabilities and Limitations Notes"
Cohesion: 0.17
Nodes (12): Delegation (4D Framework), Description (4D Framework), Diligence (4D Framework), Discernment (4D Framework), AI Fluency: 4D Framework Notes, calc_rr Tool Idea (Deterministic RR Calc), AI Capabilities and Limitations Notes, Letter-over-Spirit Failure Mode (+4 more)

### Community 85 - "Vegapunk Slimming Results (-86%)"
Cohesion: 0.17
Nodes (13): get_data_export Tool, Tool 2: run_bias_check, Lana Test Data README, Chronological MCP Tool Call Sequence, Output-too-large Problem, Vegapunk Slimming Results (-86%), marketStructureAnalysis Developer Notes, File Separation: Algorithm vs Rendering (+5 more)

### Community 86 - "useDrawings.js"
Cohesion: 0.09
Nodes (28): berlinDateStrFor(), emit, error, { instrument, dateStr, drawings, loading, add, remove, setDrawingVisible }, removeDrawing(), removingId, saving, text (+20 more)

### Community 87 - "reads.ts"
Cohesion: 0.08
Nodes (42): isBoxInvalidated(), detectSetupObs(), findRecentTradeSetupIdsByKey(), getForexCandlesArchive(), getForexCandlesArchiveUpTo(), getJournal(), getNewsEvents(), getTradeSetups() (+34 more)

### Community 88 - "pipScale.js"
Cohesion: 0.31
Nodes (9): labelMitQuote(), KEINE_SKALA, PIP_SCALE_HIGHLIGHT, PIP_SCALE_STEPS, pipScaleLevels(), pipScaleSpec(), scaleAnchor(), longSetup (+1 more)

### Community 89 - "twelvedata/client.ts"
Cohesion: 0.21
Nodes (11): Candle, fetchCandles(), FetchCandlesOptions, INTERVAL_MAP, requestTimeSeries(), resample(), RESAMPLE_BUCKET_SEC, SUPPORTED_PERIODS (+3 more)

### Community 90 - "Anleitung: State-Machine lesen & bedienen"
Cohesion: 0.25
Nodes (7): Ablaufbeispiel, Anleitung: State-Machine lesen & bedienen, Grundprinzip, Maschine bedienen, Menschlicher Gegencheck, `replayUntilSec` — der EINE Zeit-Parameter (alle Tools), State lesen, ohne die Maschine zu bewegen

### Community 91 - "marketStructureAnalysis.test.js"
Cohesion: 0.22
Nodes (8): pivot1, pivot2, pivot3, pivot4, pivot5, pivot6, pivot7, pivot8

### Community 92 - "marketStructureRendering.ts"
Cohesion: 0.09
Nodes (17): Candle, ArrowPrimitive, collectFibLevels(), collectStructureLqLevels(), computeFibLevels(), fibBetween(), FibTickPaneView, FibTickPrimitive (+9 more)

### Community 93 - "trading-monitor-mcp/orderBlockDetection.js"
Cohesion: 0.13
Nodes (17): firstObFormationTimeAfter(), TriggerCandle, detectOrderBlocks(), HTF_FOREX_LABELS, HTF_FOREX_MIN_GAP_PIPS, LOWER_TF_LABELS, LOWER_TF_MIN_GAP_PIPS, backfillOne() (+9 more)

### Community 94 - "MCP-Server: Tiefere Referenz"
Cohesion: 0.20
Nodes (10): MCP Auth & Table Permissions, Backfill Scripts, Candle Archive (forex_candles), MCP Server Deployment (Supabase Edge Function), MCP-Server: Tiefere Referenz, get_forex_rsi / get_forex_ema Tools, Single Deno Copy (Dual-Copy Removed), Trade-Journal Write Tools (tools/trades.ts) (+2 more)

### Community 95 - "forbiddenSession.ts"
Cohesion: 0.28
Nodes (5): berlinOffsetFromSec(), forbiddenSessionAt(), SessionDangerConfig, EURUSD, GBPUSD

### Community 96 - "filterTrend.py"
Cohesion: 0.20
Nodes (6): lade_trend(), Steht die DR mit dem 1H-Trend oder gegen ihn? uptrend + long = mit dem Trend.…, dr_schluessel -> {trend, nestedTrend}, geschrieben von messeTrendJeDr.py. Fehlt…, trendlage(), quote(), Nur ENTSCHIEDENE DRs: Ziel erreicht oder invalidiert. Eine DR, die binnen 24h…

### Community 97 - "messeFindTargets.py"
Cohesion: 0.21
Nodes (15): dr_schluessel(), Stabile Identitaet einer DR ueber Datenstaende hinweg: Richtung + Impuls-Kerze.…, drs_laden(), ergebnis(), ev(), kandidaten(), main(), mcp() (+7 more)

### Community 98 - "NewsModal.vue"
Cohesion: 0.18
Nodes (11): CURRENCIES, emit, LIST_FORMATTER, newCurrency, newDateTime, newTitle, saving, submit() (+3 more)

### Community 99 - "filterGegenkraft.py"
Cohesion: 0.31
Nodes (8): Ehrliche Dreiteilung statt einer unvollstaendigen Zuordnung: HTF sicher : in…, sweep_herkunft(), analyse(), build(), konstellation(), -> (reach, t_inval_min|None, t_target_min|None), Welche Gegenkraft-Lage liegt zum Start dieser DR vor? Gefaehrlich ist eine…, walk()

### Community 100 - "trades.ts"
Cohesion: 0.10
Nodes (31): addTradePosition(), addTradeTarget(), createTrade(), deleteTradeTarget(), getDealingRangeById(), insertTradePosition(), resolvePivotLiquidityLevelId(), updateDealingRange() (+23 more)

### Community 101 - "useM5CandleClock"
Cohesion: 0.46
Nodes (5): m5ClockState(), useM5CandleClock(), refresh(), retry(), tick()

### Community 102 - "/task do Mode"
Cohesion: 0.38
Nodes (7): Laniakea milk-city Task-Status Rule, /task Default Data-Maintenance Mode, /task do Mode, /task new Mode, /task refine Mode, /task Command Router, milk-city Task Status Convention

### Community 104 - "Fachdoku-Router Skill"
Cohesion: 0.15
Nodes (13): poi-watcher UTC Refresh-Tick Exception, Trading-Hours/Timezone Handling (Europe/Berlin), sessions Table, trading_schedules Table, docs/debug-metadata-panel.md, Fachdoku-Router Skill, src/marketStructureAnalysis.notes.md, docs/mcp-server.md (+5 more)

### Community 105 - "dailyPivotMarkers.js"
Cohesion: 0.14
Nodes (7): usePriceChartDailyPivots(), refresh(), DailyPivotMarkerPaneView, DailyPivotMarkerPrimitive, DailyPivotMarkerRenderer, drawTriangle(), renderDailyPivotMarkers()

### Community 106 - "Lana-Fehlerdiagnose"
Cohesion: 0.33
Nodes (5): Ablauf, Ergebnis, Lana-Fehlerdiagnose, Routing: Diagnose → typischer Fix-Ort, Wann aufrufen

### Community 107 - "Agent Skills Pro Notes"
Cohesion: 0.29
Nodes (7): allowed-tools Skill Config, Context-free Scripts in Skills, Agent Skills Pro Notes, Progressive Disclosure in Skills, Skill Sharing & Troubleshooting, Skills Embedded in Subagents, Skills vs CLAUDE.md vs Hooks vs Subagents

### Community 108 - "validationEvidence.ts"
Cohesion: 0.11
Nodes (32): fromPips(), createDealingRange(), deleteDealingRange(), fetchActiveTscRangeId(), fetchDealingRangeCockpit(), getOpenOppositeDealingRanges(), toLiquidityLevel(), computeEvidenceScore() (+24 more)

### Community 109 - "fetch-trend-fixture.mjs"
Cohesion: 0.38
Nodes (5): fetchAllSince(), fetchCandles(), fetchRecent(), FIXTURES_DIR, m5StartSec

### Community 110 - "ContextMenu.vue"
Cohesion: 0.38
Nodes (6): clampedX, clampedY, emit, onKeydown(), onWindowMousedown(), props

### Community 111 - "ctraderCandles.js"
Cohesion: 0.48
Nodes (6): ctraderPeriodFor(), fetchCandles(), fetchInitialCandles(), fetchOlderCandles(), fetchRecentCandles(), PERIOD_MAP

### Community 112 - "Aufmerksamkeits-Level (Watch-Level-Strategie Schritt 5+)"
Cohesion: 0.22
Nodes (9): a) Aufmerksamkeitslevel niedrig — kein DR, Markt gibt nichts her (Fall 3), Aufmerksamkeits-Level (Watch-Level-Strategie Schritt 5+), b) Aufmerksamkeitslevel hoch — Dealing Range bildet sich (Fall 2), Bekannter Bug (07.09.2026, behoben), c) Aufmerksamkeitslevel hoch — Dealing Range bestätigt (Fall 1), d) Aufmerksamkeitslevel höchste — Dealing Range validiert (Schritt 7, Find Entry), HTF-Watch-Kanal (13.09.2026, implementiert), Offen / TODO (+1 more)

### Community 113 - "Debug-Metadata-Panel Notes"
Cohesion: 0.33
Nodes (6): Autosave vs Manual Copy Separation, .debug/metadata.json Snapshot, Debug-Metadata-Panel Notes, buildActiveMetadataSnapshot (PriceChart.vue), debugMetadata.js Gating Logic, saveDebugMetadataLocally (vite.config.js)

### Community 114 - "AI Failure as Property Collision"
Cohesion: 1.00
Nodes (6): AI Failure as Property Collision, Knowledge, Next Token Prediction, Steerability, When Properties Collide (Diagram), Working Memory

### Community 115 - "MCP Advanced Topics Notes"
Cohesion: 0.33
Nodes (6): MCP Advanced Topics Notes, MCP Advanced: Why Not Relevant Yet, MCP Log & Progress Notifications, MCP Roots, MCP Sampling, MCP Transports (STDIO/StreamableHTTP)

### Community 116 - "forexCandles.js"
Cohesion: 0.27
Nodes (14): DB_ARCHIVED_BARS, fetchArchivedPage(), fetchArchivedUpTo(), fetchCandles(), fetchCandlesBatchOnce(), fetchCandlesOnce(), fetchInitialCandles(), fetchOlderCandles() (+6 more)

### Community 117 - "vite.config.js"
Cohesion: 0.40
Nodes (3): DEBUG_DIR, DEBUG_FILE, __dirname

### Community 118 - "lana-git-pull.cjs"
Cohesion: 0.50
Nodes (3): { execFileSync }, path, TRADING_REPO

### Community 119 - "dataExport.ts"
Cohesion: 0.05
Nodes (70): berlinOffsetMinutes(), buildLevel(), detectLiquidityLevels(), filterRelevantLevels(), isDownFractal(), isUpFractal(), LIQUIDITY_FRACTAL_PERIOD, LIQUIDITY_MAX_RELEVANT (+62 more)

### Community 122 - "src/pipConfig.js"
Cohesion: 0.26
Nodes (10): fromPips(), KEINE_SKALA, R_SCALE_MINIMUM, R_SCALE_STEPS, rScaleLevels(), rScaleSpec(), STOPP_DECKEL_PIPS, longSetup (+2 more)

### Community 124 - "marketStructureAnalysisInnerPivots.test.js"
Cohesion: 0.25
Nodes (7): h1Candles, p2Pivot3, p2Pivot4, p2Pivot5, pivot1, pivot2, pivot3

### Community 125 - "Handbuch-Check"
Cohesion: 0.40
Nodes (4): Ergebnis, Handbuch-Check, Prüfpunkte, Wann aufrufen

### Community 131 - "merkmale"
Cohesion: 0.29
Nodes (7): handelsstunden(), merkmale(), Alle Nicht-Preis-Merkmale einer DR aus ihrer Setup-Zeile., Stunden zwischen a und b, Samstag/Sonntag herausgerechnet (wie…, quote(), Statische, reproduzierbare Übersicht der gemessenen FXCM-Reichweiten., table()

### Community 132 - "JsonTree.vue"
Cohesion: 0.25
Nodes (5): entries, expanded, isArray, isObject, props

### Community 133 - "Pivot"
Cohesion: 0.13
Nodes (9): FibLevel, Candle, PivotMarkerGroup, PivotMarkerPaneView, PivotMarkerPrimitive, PivotMarkerRenderer, RenderOptions, Pivot (+1 more)

### Community 134 - "XAUUSD: begrenzter FXCM-H1-Kontotest, 24.09.2026"
Cohesion: 0.20
Nodes (10): Datenprüfung, Ergebnis und Umfang, H1-Order-Block-Prefill nach Testfreigabe, Handelspausen, Kosten und Kapazität, Nachkontrolle und Artefakte, Nachträglich autorisierte DB-/UI-Vorbereitung, Noch offen für vollständige Anbindung (+2 more)

### Community 135 - "Dealing Range anlegen"
Cohesion: 0.50
Nodes (3): Ablauf, Dealing Range anlegen, Warum ein eigener Skill (nicht nur eine Doku-Zeile)

### Community 136 - ".codex/hooks/lana-git-pull.cjs"
Cohesion: 0.50
Nodes (3): { execFileSync }, path, TRADING_REPO

### Community 138 - "tradingSchedules.js"
Cohesion: 0.23
Nodes (10): addWindow(), cloneWindows(), DEFAULT_SCHEDULES, EMPTY_WINDOWS, loadInitial(), removeWindow(), syncFromRemote(), tradingSchedules (+2 more)

### Community 141 - "prefill-obs.mjs"
Cohesion: 0.24
Nodes (7): base, candles, data, iso(), rows, zones, GOLD_H1_MIN_FVG_USD

### Community 147 - "supabaseRowCapGuard.test.js"
Cohesion: 0.33
Nodes (8): ALLOWLIST, blankComments(), findUnbounded(), overCap(), readChain(), ROOT, SCAN_DIRS, walk()

### Community 149 - "orderBlocks.ts"
Cohesion: 0.12
Nodes (16): CORS_HEADERS, ExistingPivotRow, INSTRUMENTS, buildLevel(), detectLiquidityLevels(), isDownFractal(), isUpFractal(), Candle (+8 more)

### Community 153 - "removeConfirmationFromTrade"
Cohesion: 0.50
Nodes (4): removeConfirmationFromTrade(), onTscRemoveAntiConfluence(), onTscRemoveConfirmation(), onTscRemoveConfluence()

### Community 155 - "Entschiedene Design-Fragen"
Cohesion: 0.20
Nodes (10): Das Kriterium ist das Sweep-ALTER, nicht die Herkunft — korrigiert 20.09.2026, Der gedeckelte Stopp — durchgängige Konvention seit 20.09.2026, Die 50er-Schwelle ist erfüllt — kein Blocker mehr, Die FVG-Größe — der stärkste Schnitt, gemessen 23.09.2026, Die Pip-Leiter — gegen denselben gedeckelten Stopp, Ein zweiter Schnitt wäre möglich — aber zurückgestellt (siehe oben), Entschiedene Design-Fragen, Erwartungswert je Ziel — und warum die Anzeige nicht empfehlen soll (+2 more)

### Community 156 - "validate.js"
Cohesion: 0.38
Nodes (4): SECONDS, validateCandles(), candle, closedAt

### Community 158 - "marketStructureAnalysisNestedNestedChoch.test.js"
Cohesion: 0.17
Nodes (11): confirmBreak, originHigh, originLow, pivotB, pivotC, pivotD, pivotE, pivotF (+3 more)

### Community 161 - "tintFvgCandles"
Cohesion: 0.70
Nodes (3): fvgCandleTimes(), tintFvgCandles(), kerzen

### Community 164 - "MetadataPanel.vue"
Cohesion: 0.24
Nodes (10): emit, height, left, onDrag(), panelEl, props, startDrag(), stopDrag() (+2 more)

### Community 165 - "messeFxcmKontext.ts"
Cohesion: 0.32
Nodes (4): createAnalysisSnapshotFetch(), compressed, root, rows

### Community 168 - "usePriceChartMarketStructure.js"
Cohesion: 0.16
Nodes (19): M5_STRUCTURE_STYLE_KEYS, m5EventLabeler(), usePriceChartMarketStructure(), computeRangesPivotsAndMetadata(), computeRangesPivotsFor(), refreshM5Structure(), refreshMarketStructure(), structureRenderOptions() (+11 more)

### Community 169 - "Die Filter"
Cohesion: 0.40
Nodes (5): Die Filter, Gegenkraft — teilweise gekippt, Handelszeit — als Fenster tot, als Stunde lebendig, Sweep-Alter — der größte Effekt, Sweep-Herkunft — der stärkste, und er hält

### Community 170 - "router.js"
Cohesion: 0.24
Nodes (8): ALARM_TYPES, fetchAlarmSettings(), setAlarmEnabled(), router, alarms, errorText, loading, toggle()

### Community 173 - "toPips"
Cohesion: 0.39
Nodes (7): formatDatedTime(), formatPips(), MEASURE_COLOR, measureDrawing(), toPips(), onMeasureDone(), tscFvgPips

### Community 174 - "Plan: Forex-Chart-Objekte Datengrundlage"
Cohesion: 0.22
Nodes (11): ob_zones Table, Archive-First Auto-Reload Pattern (Tried, Then Reverted), BTC Scope Removal from Chart-Objects Plan, 1H/4H DB-Read vs Live-Recompute Decision, Four Independent OB Render Passes Problem, "Historische OBs"-Toggle Semantics, LQ-Sweep Relevance Criterion (Recent OR Pip-Range), Plan: Forex-Chart-Objekte Datengrundlage (+3 more)

### Community 180 - "fachdoku-router-reminder.cjs"
Cohesion: 0.40
Nodes (3): { join }, { readFileSync }, SKILL

### Community 183 - "M5CandleClock.vue"
Cohesion: 0.50
Nodes (3): countdown, latest, props

### Community 188 - "findTargets.js"
Cohesion: 0.21
Nodes (11): MAX_TARGET_DISTANCE_PIPS Constant, find_targets Target-Candidate Algorithm Design, openAntiConfluencePicker(), openTargetPicker(), getCurrentLiquidityLevels(), DEFAULT_LIQUIDITY_TARGET_LIMIT, DEFAULT_OB_TARGET_LIMIT, findNearestLiquidityTargets() (+3 more)

### Community 191 - "cTrader Open API as Forex Candle Source"
Cohesion: 0.40
Nodes (5): cTrader Open API as Forex Candle Source, cTrader Wire Protocol Implementation (Manual Protobuf), supabase/functions/_shared/ctrader/client.ts, supabase/functions/_shared/twelvedata/client.ts (Unwired), supabase/functions/forex-candles

## Ambiguous Edges - Review These
- `Trading-Steps-Ablauf Diagram` → `calc_rr Tool Idea (Deterministic RR Calc)`  [AMBIGUOUS]
  docs/steerabilty-vs-wrong-ai-outputs.md · relation: references

## Knowledge Gaps
- **1243 isolated node(s):** `{ readFileSync }`, `{ join }`, `SKILL`, `{ execFileSync }`, `path` (+1238 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1534 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **16 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Trading-Steps-Ablauf Diagram` and `calc_rr Tool Idea (Deterministic RR Calc)`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **Why does `marketStructureAnalysis Developer Notes` connect `Vegapunk Slimming Results (-86%)` to `fachdoku-router/SKILL.md`, `marketStructureAnalysis Rules Overview`?**
  _High betweenness centrality (0.074) - this node is a cross-community bridge._
- **Why does `renderMarketStructureAnalysis()` connect `marketStructureRendering.ts` to `usePriceChartMarketStructure.js`, `liquidity.js`, `lineWidth`, `Vegapunk Slimming Results (-86%)`?**
  _High betweenness centrality (0.059) - this node is a cross-community bridge._
- **Why does `File Separation: Algorithm vs Rendering` connect `Vegapunk Slimming Results (-86%)` to `marketStructureRendering.ts`?**
  _High betweenness centrality (0.059) - this node is a cross-community bridge._
- **What connects `{ readFileSync }`, `{ join }`, `SKILL` to the rest of the system?**
  _1243 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Dashboard.vue` be split into smaller, more focused modules?**
  _Cohesion score 0.014665889665889666 - nodes in this community are weakly interconnected._
- **Should `gbp_h1_uptrend_uptrend_break_of_structure_und_trendumkehr.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0196078431372549 - nodes in this community are weakly interconnected._