# Graph Report - trading-monitor  (2026-09-22)

## Corpus Check
- 526 files · ~518,779 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 3180 nodes · 6445 edges · 153 communities (133 shown, 13 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 114 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `61073f55`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Dashboard.vue
- gbp_h1_uptrend_uptrend_break_of_structure_und_trendumkehr.ts
- candleCache.js
- clipReplay
- PriceChart.vue
- gbp_h1_uptrend_mit_LQ_sweep_LONG_SETUP.ts
- gbp_h1_uptrend_mit_inner_structure.ts
- Plan: Forex-Chart-Objekte Datengrundlage
- usePriceChartRsi.js
- tradeSetup.js
- rsiDivergenceStats.ts
- DataExportModal.vue
- cssColor
- DR-Reichweite — was taugen die erkannten Setups?
- dealingRangeLoop.ts
- TradeEditModal.vue
- package.json
- src/sessionOccurrences.js
- LoopStatus.vue
- db.ts
- Dealing-Range-Anlegen Skill
- _shared/pipConfig.js
- newsMarkers.js
- marketStructureAnalysisNestedNestedChoch.test.js
- ctrader/client.ts
- pricePrecisionForInstrument
- tradeIntake.js
- trades.js
- berlinDateTimeStrFor
- Plan: POI-Strategie-Findung, Backtesting & Trade-Notifications
- lineWidth
- sessions.js
- gbp_h1_uptrend_protected_low_gebrochen.ts
- tradingAccounts.js
- tradeSetups.js
- dataExport.js
- tdd_mit_claude.ts
- App.vue
- priceChartHitTest.test.js
- TradeSetupCockpit.vue
- MetadataPanel.vue
- orderBlocks.js
- supabaseClient.js
- useClaudeAnnotations.js
- trading-monitor-mcp/marketStructureAnalysis.ts
- priceChartConstants.js
- pinContext.js
- Laniakea Persona Command (/l)
- Plan: Sehr Große Dateien Refactoren (PriceChart.vue)
- fachdoku-router/SKILL.md
- barSecondsFor
- machineState.ts
- trading-monitor-mcp/index.ts
- gbp_h1_uptrend.ts
- tradeSetupCockpit.ts
- PLAN: DR-Statistik in der UI anzeigen
- src/marketStructureAnalysis.ts
- chartLineWidths.js
- pinEntryVisible
- OrderBlockPrimitive
- tools/pretradeGates.ts
- liquidity.js
- findTargetCandidates.js
- poi-watcher/index.ts
- State Machine for Lana's Trading Flow
- compilerOptions
- dailyPivotMarkers.js
- claudeAnnotations.js
- usePriceChartMarketStructure.js
- AGENTS.md
- Trading-Monitor Project Overview (CLAUDE.md)
- src/pipConfig.js
- dataSnapshot.ts
- closed_rows
- Journal GBPUSD — Sicherung vor dem Quellenwechsel
- pins.ts
- SessionBandPaneView
- TradingFlow.vue
- biasCheck.ts
- debugMetadata.js
- nearRelevantLiquidityLevels.ts
- Dealing-Range-Loop Diagram
- FXCM-Kerzenfeed
- useHttpActivity.js
- AI Capabilities and Limitations Notes
- Vegapunk Slimming Results (-86%)
- clearArmStatesExcept
- reads.ts
- PinAddPopup.vue
- twelvedata/client.ts
- Anleitung: State-Machine lesen & bedienen
- JsonTree.vue
- jumpToTimeRange
- dataExport.ts
- MCP-Server: Tiefere Referenz
- LiquidityLinePrimitive
- AnnotationsPrimitive
- drMerkmale.py
- NewsModal.vue
- trade_evidence Table (Dual-Level, Confirmation/Confluence)
- Fachdoku-Router Skill
- applyInnerMarketStructurePivot
- /task do Mode
- hole_alle
- marketStructureAnalysisLqSweep.test.js
- marketStructureRendering.ts
- Lana-Fehlerdiagnose
- Agent Skills Pro Notes
- obZones.js
- fetch-trend-fixture.mjs
- ContextMenu.vue
- ctraderCandles.js
- Aufmerksamkeits-Level (Watch-Level-Strategie Schritt 5+)
- Debug-Metadata-Panel Notes
- AI Failure as Property Collision
- MCP Advanced Topics Notes
- tradeSetup.test.js
- vite.config.js
- lana-git-pull.cjs
- forexCandles.js
- .mcp.json
- forexCandles.ts
- marketStructureAnalysis.test.js
- trading-monitor index.html Entry
- router.js
- Handbuch-Check
- trendIndicator.gbpusd-downtrend.test.js
- Claude Code Hooks Documentation Pointers
- mcp-server/src/scripts/backfillObZones.ts
- forbiddenSession.test.js
- Plan: Trade-Journal Konfluenzen & Kontext
- marketStructureAnalysisInnerPivots.test.js
- openTargetPicker
- Dealing Range anlegen
- .codex/hooks/lana-git-pull.cjs
- source-command-l
- tradingSchedules.js
- chartTimeUtils.js
- CrudListSection.vue
- computeTrendAlignment
- fxcmCandles.ts
- berlinDateStrFor
- marketStructureAnalysisFib.test.js
- applyMarketStructurePivot
- usePriceChartClaudeAnnotations
- validate.js

## God Nodes (most connected - your core abstractions)
1. `berlinDateStrFor()` - 45 edges
2. `cssColor()` - 36 edges
3. `berlinDateTimeStrFor()` - 33 edges
4. `fetchForexCandles()` - 31 edges
5. `pricePrecisionForInstrument()` - 30 edges
6. `json()` - 30 edges
7. `fmtPrice()` - 28 edges
8. `clipReplay()` - 27 edges
9. `lineWidth()` - 26 edges
10. `logDecision()` - 25 edges

## Surprising Connections (you probably didn't know these)
- `/task do Mode` --semantically_similar_to--> `milk-city Task Status Convention`  [INFERRED] [semantically similar]
  .claude/commands/task.md → CLAUDE.md
- `Laniakea milk-city Task-Status Rule` --semantically_similar_to--> `milk-city Task Status Convention`  [INFERRED] [semantically similar]
  .claude/commands/l.md → CLAUDE.md
- `Archive-First Auto-Reload Pattern (Tried, Then Reverted)` --semantically_similar_to--> `Persisted Forex Candle Archive (forex_candles Pilot)`  [INFERRED] [semantically similar]
  PLAN-chart-objekte-forex.md → PLAN-notifications.md
- `Phase 2: OB-Zonen-Merge/Touch-Logik -> priceChartObZones.js` --shares_data_with--> `ob_zones Table`  [INFERRED]
  PLAN-large-file-refactor.md → PLAN-notifications.md
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

## Communities (153 total, 13 thin omitted)

### Community 0 - "Dashboard.vue"
Cohesion: 0.02
Nodes (125): useSessionStorageRef(), useTabScopedRef(), fetchDailyStructurePivots(), fetchLiquidityLevelsHtf(), addPositionToDealingRange(), antiConfluenceAddTrade, anyArmStateActive, ARM_STATES (+117 more)

### Community 1 - "gbp_h1_uptrend_uptrend_break_of_structure_und_trendumkehr.ts"
Cohesion: 0.02
Nodes (101): candlesAroundBOS, candlesAroundBreak, p2Pivot1, p2Pivot10, p2Pivot11, p2Pivot12, p2Pivot13, p2Pivot14 (+93 more)

### Community 2 - "candleCache.js"
Cohesion: 0.10
Nodes (29): REPLAY_LOOKAHEAD_SEC M1 Scaling Gotcha, REPLAY_LOOKAHEAD_SEC M1 Scaling Bug (Origin), cachedCandlesUpTo(), cacheKey(), fetchCandlesCached(), getCachedCandles(), mergeCandles(), openDb() (+21 more)

### Community 3 - "clipReplay"
Cohesion: 0.15
Nodes (26): tradesVisibleForCandles(), buildActiveMetadataSnapshotInternal(), clearTradeSetupFocus(), clipReplay(), computeTradeSetupsInternal(), focusTradeSetup(), loadTradeSetupM5(), refreshChart() (+18 more)

### Community 4 - "PriceChart.vue"
Cohesion: 0.03
Nodes (66): PIP_SIZE Constant, TRADE_SETUP_LS_MAX_DISTANCE_M5 Constant, activeMetadataSnapshot, allCandles, antiConfluencePickerCurrentPrice, antiConfluencePickerDivergenceCandidates, antiConfluencePickerHoveredLiquidityKey, antiConfluencePickerHoveredObKey (+58 more)

### Community 5 - "gbp_h1_uptrend_mit_LQ_sweep_LONG_SETUP.ts"
Cohesion: 0.03
Nodes (60): p2Pivot1, p2Pivot10, p2Pivot11, p2Pivot12, p2Pivot13, p2Pivot14, p2Pivot15, p2Pivot16 (+52 more)

### Community 6 - "gbp_h1_uptrend_mit_inner_structure.ts"
Cohesion: 0.04
Nodes (55): p2Pivot1, p2Pivot10, p2Pivot11, p2Pivot12, p2Pivot13, p2Pivot14, p2Pivot15, p2Pivot16 (+47 more)

### Community 7 - "Plan: Forex-Chart-Objekte Datengrundlage"
Cohesion: 0.31
Nodes (9): ob_zones Table, OB-Zones Canonical FK Consolidation Approach, 1H/4H DB-Read vs Live-Recompute Decision, Four Independent OB Render Passes Problem, "Historische OBs"-Toggle Semantics, LQ-Sweep Relevance Criterion (Recent OR Pip-Range), Plan: Forex-Chart-Objekte Datengrundlage, Persistierungs-Umfang: Nur Referenzierte Teilmenge (+1 more)

### Community 8 - "usePriceChartRsi.js"
Cohesion: 0.05
Nodes (38): drawIconLabel(), canShowLabels(), MIN_PIXELS_PER_HOUR_FOR_LABELS, MIN_PIXELS_PER_HOUR_FOR_LABELS_INTRADAY, nativeLineWidth(), usePriceChartRsi(), applyColorOptions(), applyLineWidthOptions() (+30 more)

### Community 9 - "tradeSetup.js"
Cohesion: 0.18
Nodes (18): Two Runtimes, One Algorithm Set (Deliberate Duplication), computeTradeSetups(), closesBeyondLevel(), collectObSweeps(), detectSetupObs(), detectTradeSetups(), findAllProtectedFractals(), findBestLsMatch() (+10 more)

### Community 10 - "rsiDivergenceStats.ts"
Cohesion: 0.07
Nodes (49): fromPips(), byDistance(), findAntiConfluenceCandidates(), findAntiConfluenceDivergenceCandidates(), findAntiConfluenceObCandidates(), findAntiConfluenceSweepCandidates(), findInvalidationObCandidates(), inBand() (+41 more)

### Community 11 - "DataExportModal.vue"
Cohesion: 0.09
Nodes (21): asset, copied, copyResult(), currentSymbol, dateStr, error, generate(), loading (+13 more)

### Community 12 - "cssColor"
Cohesion: 0.08
Nodes (19): cssColor(), cssColorScaled(), hexToRgba(), usePriceChartTradeSetupDrawing(), refresh(), toPips(), TRADE_SETUP_OB_BORDER_RATIO, TRADE_SETUP_OB_FILL_RATIO (+11 more)

### Community 13 - "DR-Reichweite — was taugen die erkannten Setups?"
Cohesion: 0.11
Nodes (18): Definitionen, Die Filter, DR-Reichweite — was taugen die erkannten Setups?, Enge der DR — warum beide Einheiten nötig sind, find_targets, Gegenkraft — teilweise gekippt, Grenzen, Handelszeit — als Fenster tot, als Stunde lebendig (+10 more)

### Community 14 - "dealingRangeLoop.ts"
Cohesion: 0.07
Nodes (51): AgeTier, assessInducement(), checkFallFour(), CheckFallFourInput, computeHtfWatchLevels(), computeWatchLevels(), FallFourResult, hasReaction() (+43 more)

### Community 15 - "TradeEditModal.vue"
Cohesion: 0.05
Nodes (44): commission, emit, entryPrice, entryTimeInput, exitPrice, exitTimeInput, flashInvalidationSaved(), instrumentMismatch (+36 more)

### Community 16 - "package.json"
Cohesion: 0.06
Nodes (33): lightweight-charts, mermaid, dependencies, lightweight-charts, mermaid, @supabase/supabase-js, vue, vue-router (+25 more)

### Community 17 - "src/sessionOccurrences.js"
Cohesion: 0.24
Nodes (12): createSessionBonusResolver(), ALL_DAYS, attachRangeExtremes(), bonusLabelForPivot(), buildSessionContextLookup(), contextForPivot(), daysOrAll(), localMidnightUtc() (+4 more)

### Community 18 - "LoopStatus.vue"
Cohesion: 0.07
Nodes (24): fetchLoopStateHistory(), fetchLoopStatesForDate(), LOOP_INSTRUMENTS, rowToLoopState(), fetchStateMachineLog(), rowToDecision(), activeByInstrument, { data, refresh } (+16 more)

### Community 19 - "db.ts"
Cohesion: 0.07
Nodes (49): addTradeConfirmation(), AddTradeConfirmationArgs, addTradePosition(), addTradeTarget(), AddTradeTargetArgs, createDealingRange(), createTrade(), CreateTradeArgs (+41 more)

### Community 20 - "Dealing-Range-Anlegen Skill"
Cohesion: 0.14
Nodes (15): kind=pivot = Liquidity-Sweep-Only Semantics, Dealing-Range-Anlegen Skill, milk-city Task: Confluence-Tracking bei Dealing Ranges, trading/liquidität.md (Liquiditäts-Sweep-Mechanismus), AI Capabilities Framework (Next Token Prediction/Knowledge/Working Memory/Steerability), Diagnose-to-Fix Routing Table, Lana-Fehlerdiagnose Skill, docs/steerabilty-vs-wrong-ai-outputs.md (+7 more)

### Community 21 - "_shared/pipConfig.js"
Cohesion: 0.10
Nodes (17): CORS_HEADERS, ExistingPivotRow, INSTRUMENTS, PIP_SIZE, toPips(), DailyPivotLike, resolveStructureStartTime(), firstObFormationTimeAfter() (+9 more)

### Community 22 - "newsMarkers.js"
Cohesion: 0.12
Nodes (12): usePriceChartSessionsAndNews(), refreshNewsMarkers(), DAY_KEY_FORMATTER, extrapolatedX(), formatEventLabel(), isSameBerlinDay(), NewsMarkerPaneView, NewsMarkerPrimitive (+4 more)

### Community 23 - "marketStructureAnalysisNestedNestedChoch.test.js"
Cohesion: 0.18
Nodes (10): confirmBreak, originHigh, originLow, pivotB, pivotC, pivotD, pivotE, pivotF (+2 more)

### Community 24 - "ctrader/client.ts"
Cohesion: 0.11
Nodes (26): CORS_HEADERS, authAccount(), authenticate(), cachedSymbolIds, Candle, concat(), connectWithTimeout(), CTraderConnection (+18 more)

### Community 25 - "pricePrecisionForInstrument"
Cohesion: 0.06
Nodes (38): candidateLabel(), candidatePrice(), emit, mergedCandidates, precision, props, emit, noteSaveTimers (+30 more)

### Community 26 - "tradeIntake.js"
Cohesion: 0.14
Nodes (26): direction, emit, entryPrice, errorMsg, levels, precision, props, reasoning (+18 more)

### Community 27 - "trades.js"
Cohesion: 0.10
Nodes (23): onRemoveConfirmation(), pnlClass, props, stats, winrateClass, fmtR(), removeConfirmationFromTrade(), computeTradeStats() (+15 more)

### Community 28 - "berlinDateTimeStrFor"
Cohesion: 0.12
Nodes (21): berlinDateTimeStrFor(), DATE_FORMATTER, OFFSET_FORMATTER, TIME_FORMATTER, berlinTwinKey(), withBerlinTimes(), getLoopStateForDay(), NEXT_ACTION_FALLBACK (+13 more)

### Community 29 - "Plan: POI-Strategie-Findung, Backtesting & Trade-Notifications"
Cohesion: 0.17
Nodes (15): Supabase/PostgREST ~1000 Row Cap Gotcha, daily_structure_pivots Table, forex_candles Table, get_forex_candles_archive MCP Tool, Archive-First Auto-Reload Pattern (Tried, Then Reverted), BTC-USDT/OKX Complete Removal (2026-08-21), 1D-Periode-4-Pivot Market-Structure Startpoint (2026-08-30), Persisted Forex Candle Archive (forex_candles Pilot) (+7 more)

### Community 30 - "lineWidth"
Cohesion: 0.13
Nodes (11): lineWidth(), drawEntryPoint(), drawExitPoint(), drawHaloRing(), drawLabel(), drawTick(), renderTradeMarkers(), TradeMarkerPaneView (+3 more)

### Community 31 - "sessions.js"
Cohesion: 0.13
Nodes (18): emit, instrumentSessions, props, WEEKDAY_DISPLAY_ORDER, refreshSessions(), addSession(), currentSessionDanger(), DANGER_LEVELS (+10 more)

### Community 32 - "gbp_h1_uptrend_protected_low_gebrochen.ts"
Cohesion: 0.08
Nodes (25): ClosedRange, MarketStructureState, PivotBase, PivotHigh, PivotLow, PivotTouched, PivotTypeAll, PivotUntouched (+17 more)

### Community 33 - "tradingAccounts.js"
Cohesion: 0.13
Nodes (17): currentLabel, open, selectedAccount, wrapperRef, accounts, accountsLoaded, createAccount(), deleteAccount() (+9 more)

### Community 34 - "tradeSetups.js"
Cohesion: 0.26
Nodes (10): fetchTradeSetupForCockpit(), fetchTradeSetups(), sweepLevel(), toSec(), tradeSetupFromRow(), { data: dbTradeSetups, refresh: refreshDbTradeSetups }, onIsolateTrade(), onSelectTrade() (+2 more)

### Community 35 - "dataExport.js"
Cohesion: 0.14
Nodes (24): marketStructureTree, dateStr, berlinDateStrFor(), buildDataExport(), compute1hStructureState(), computeExportTimeframeData(), computeLiquidityLevelsForExport(), computeObZonesForExport() (+16 more)

### Community 36 - "tdd_mit_claude.ts"
Cohesion: 0.08
Nodes (24): nextPivot1, nextPivot10, nextPivot11, nextPivot2, nextPivot3, nextPivot4, nextPivot5, nextPivot6 (+16 more)

### Community 37 - "App.vue"
Cohesion: 0.15
Nodes (13): { activeLabels, isActive }, isFresh, { lastSuccessAt }, lastUpdateText, now, showClaudeAnnotationsModal, showDataExport, statusDotClass (+5 more)

### Community 38 - "priceChartHitTest.test.js"
Cohesion: 0.12
Nodes (19): findClickedDivergence(), findClickedFibLevel(), findClickedLiquidityLevel(), findClickedOBZone(), findClickedSetup(), findClickedTarget(), getCurrentFibLevels(), DIVERGENCE_CLICK_TOLERANCE_PX (+11 more)

### Community 39 - "TradeSetupCockpit.vue"
Cohesion: 0.09
Nodes (21): emit, accentStyle, antiConfluences, canTransfer, confirmations, confluences, dateLabel, direction (+13 more)

### Community 40 - "MetadataPanel.vue"
Cohesion: 0.24
Nodes (10): emit, height, left, onDrag(), panelEl, props, startDrag(), stopDrag() (+2 more)

### Community 41 - "orderBlocks.js"
Cohesion: 0.13
Nodes (28): emit, obZoneCtx(), onAntiConfluencePickerHover(), onAntiConfluencePickerSelect(), onTargetPickerHover(), onTargetPickerSelect(), refreshLiquidityInternal(), refreshPoiZonesInternal() (+20 more)

### Community 42 - "supabaseClient.js"
Cohesion: 0.23
Nodes (8): fetchAlarmLog(), fetchTouchedLiquidityLevels(), fetchTradeSetups(), fetchTouchedZones(), supabase, currentSymbol, { data: rows, refresh }, SYMBOLS

### Community 43 - "useClaudeAnnotations.js"
Cohesion: 0.10
Nodes (26): addClaudeAnnotationDrawing(), fetchClaudeAnnotations(), removeClaudeAnnotationDrawing(), setClaudeAnnotationDrawingVisible(), emit, error, { instrument, dateStr, drawings, loading, add, remove, setDrawingVisible }, removeDrawing() (+18 more)

### Community 44 - "trading-monitor-mcp/marketStructureAnalysis.ts"
Cohesion: 0.21
Nodes (23): advanceNestedTrend(), advanceNestedTrendInner(), applyInnerMarketStructurePivot(), applyInnerMarketStructurePivotCore(), applyMarketStructurePivot(), applyMarketStructurePivotCore(), buildMarketStructureState(), Candle (+15 more)

### Community 45 - "priceChartConstants.js"
Cohesion: 0.07
Nodes (33): usePriceChartTradeSetups(), fetchM5Candles(), fetchTrendAnalysisM5History(), getTrendAnalysisM5Candles(), CALLOUT_STACK_GAP_PX, CLOSE_POLL_BUFFER_MS, COPIED_FEEDBACK_MS, DEBUG_AUTOSAVE_INTERVAL_MS (+25 more)

### Community 46 - "pinContext.js"
Cohesion: 0.16
Nodes (21): addPinEntry(), addPinM5LiquidityEntry(), addPinM5ObEntry(), addPinRsiDivergenceEntry(), addPinTscSetupEntry(), fetchPinContext(), REF_COLUMN, removePinEntry() (+13 more)

### Community 47 - "Laniakea Persona Command (/l)"
Cohesion: 0.13
Nodes (18): 00-trading-steps.md Entry Point, Laniakea Persona Command (/l), trading/claude-project-instructions.md, trading-runs Relative Link Path Convention, 00-trading-steps.md#visuelle-antworten-chart-annotationen, 06-anti-confluence.md, glossar.md Consistency Check, kontext-ausführung.md (+10 more)

### Community 48 - "Plan: Sehr Große Dateien Refactoren (PriceChart.vue)"
Cohesion: 0.17
Nodes (12): Keep Codebase Clean / ~1000 Line Backstop Convention, liquidity_levels Table, Pip-Distance Server-Side Query Filter, Plan: Sehr Große Dateien Refactoren (PriceChart.vue), Phase 1: Candle-/Zeit-Helfer -> priceChartCandles.js, Phase 2: OB-Zonen-Merge/Touch-Logik -> priceChartObZones.js, Phase 3: Liquidity-Merge -> priceChartLiquidity.js, Phase 4: RSI-Divergenz-Pin-Merge (+4 more)

### Community 49 - "fachdoku-router/SKILL.md"
Cohesion: 0.18
Nodes (10): Fachdoku-Router, News Events Seed Workflow (ForexFactory Screenshot), News Events Seeding Notes, news_events Consumption (No-Go + Chart Markers), Settings-Sync Notes, localStorage-first / Supabase-Source-of-Truth Pattern, trading_loop_state Table Design, TSC No-Gos and Anti-Confluences Notes (+2 more)

### Community 50 - "barSecondsFor"
Cohesion: 0.19
Nodes (18): asOfProbeCandles(), dropLowerTfDuplicates(), filterRelevantRows(), getLiquidityLevels(), applyAsOf(), applyAsOfZones(), earliestAmbiguousEventSec(), existsAsOf() (+10 more)

### Community 51 - "machineState.ts"
Cohesion: 0.20
Nodes (19): deriveStepAndCase(), LoadedMachine, loadMachineForDayOrNull(), loadOrCreateMachineForDay(), persistTransition(), rehydrateActor(), safeTransitionChain(), transitionIfPossible() (+11 more)

### Community 52 - "trading-monitor-mcp/index.ts"
Cohesion: 0.16
Nodes (23): deleteDealingRange(), postChartAnnotations(), buildServer(), MCP_TOKEN, json(), deprecatedTimeParam(), ANNOTATION_SCHEMA, DRAWING_GROUP_SCHEMA (+15 more)

### Community 53 - "gbp_h1_uptrend.ts"
Cohesion: 0.10
Nodes (20): pivot1, pivot10, pivot11, pivot12, pivot13, pivot2, pivot3, pivot4 (+12 more)

### Community 54 - "tradeSetupCockpit.ts"
Cohesion: 0.12
Nodes (21): trendChain, trendChainDisplay, RangeTrend, ANTI_CONFLUENCE_COLOR, ANTI_CONFLUENCE_THRESHOLD, AntiConfluence, CockpitState, computeAntiConfluences() (+13 more)

### Community 55 - "PLAN: DR-Statistik in der UI anzeigen"
Cohesion: 0.09
Nodes (23): Beide Leitern nach festem Risiko-Band, Das Kriterium ist das Sweep-ALTER, nicht die Herkunft — korrigiert 20.09.2026, Definitionen (nicht neu herleiten), Der gedeckelte Stopp — durchgängige Konvention seit 20.09.2026, Die 50er-Schwelle ist erfüllt — kein Blocker mehr, Die Falle: Path B hat kein echtes Invalidierungslevel — ERLEDIGT 20.09.2026, Die Zahlen (Stand 21.09.2026, n=1314), Ein zweiter Schnitt wäre möglich — aber zurückgestellt (siehe oben) (+15 more)

### Community 56 - "src/marketStructureAnalysis.ts"
Cohesion: 0.27
Nodes (17): advanceNestedTrend(), applyInnerMarketStructurePivotCore(), applyMarketStructurePivotCore(), buildMarketStructureState(), closesAboveOldHigh(), closesBelowLevel(), computeRangesPivots(), evaluateConfirmingBreak() (+9 more)

### Community 57 - "chartLineWidths.js"
Cohesion: 0.09
Nodes (18): chartColors, DEFAULT_CHART_COLORS, resetChartColors(), chartLineWidths, DEFAULT_CHART_LINE_WIDTHS, resetChartLineWidths(), collapsed, emit (+10 more)

### Community 58 - "pinEntryVisible"
Cohesion: 0.14
Nodes (18): liquidityLevelEntryNaturalKey(), m5LiquidityEntryNaturalKey(), obZoneEntryNaturalKey(), hoveredPinLiquidityLevelKey, hoveredPinObZoneKey, onSelectPin(), pinEntryVisible(), pinJumpHint (+10 more)

### Community 59 - "OrderBlockPrimitive"
Cohesion: 0.13
Nodes (4): OrderBlockPrimitive, ZonePaneView, ZoneRenderer, obPrimitiveAt()

### Community 60 - "tools/pretradeGates.ts"
Cohesion: 0.15
Nodes (22): BERLIN_HM_FORMATTER, BERLIN_WEEKDAY_FORMATTER, berlinWeekdayAndMinutes(), isWithinTradingWindows(), TradingWindows, WeekdayGroup, getNewsEvents(), getTradingSchedule() (+14 more)

### Community 61 - "liquidity.js"
Cohesion: 0.13
Nodes (26): usePriceChartLiquidity(), attachBonus(), refresh(), levelOptions(), LIQUIDITY_STYLE_KEYS, liquidityLevelNaturalKey(), liquidityStyleTimeframe(), renderLiquidityLevels() (+18 more)

### Community 62 - "findTargetCandidates.js"
Cohesion: 0.07
Nodes (37): compressed, root, rows, targets, trends, worker(), buildLevel(), detectLiquidityLevels() (+29 more)

### Community 63 - "poi-watcher/index.ts"
Cohesion: 0.10
Nodes (22): unprocessedTimeframes(), fmt(), InstrumentConfig, INSTRUMENTS, isInWindows(), LiquidityLevelRow, localMinutesAndWeekday(), ObZoneRow (+14 more)

### Community 64 - "State Machine for Lana's Trading Flow"
Cohesion: 0.14
Nodes (18): Trading-Steps-Ablauf Diagram, Fall 4 -> Zurück zu Schritt 3, Two Permanent LLM-Only Steps (3 and 6), News-Pause Doesn't Replace the Cron, State Machine for Lana's Trading Flow, get_tsc_range Deliberately Not a Graph Node, Problem: GBPUSD 28.08.2026 Fall-4 Deviation Incident, trading-runs/*.md Loses Purpose (+10 more)

### Community 65 - "compilerOptions"
Cohesion: 0.12
Nodes (16): src/marketStructureAnalysis.ts, src/marketStructureRendering.ts, src/pivotMarkers.ts, test/tdd_mit_claude/ranges/tdd_mit_claude.ts, compilerOptions, allowJs, checkJs, esModuleInterop (+8 more)

### Community 66 - "dailyPivotMarkers.js"
Cohesion: 0.14
Nodes (7): usePriceChartDailyPivots(), refresh(), DailyPivotMarkerPaneView, DailyPivotMarkerPrimitive, DailyPivotMarkerRenderer, drawTriangle(), renderDailyPivotMarkers()

### Community 67 - "claudeAnnotations.js"
Cohesion: 0.14
Nodes (13): ANNOTATION_COLOR, annotationAnchorPoint(), AnnotationsRenderer, parseAnnotations(), resolveLabelPlacements(), resolveTime(), VALID_TYPES, validateAnnotationList() (+5 more)

### Community 68 - "usePriceChartMarketStructure.js"
Cohesion: 0.10
Nodes (13): usePriceChartMarketStructure(), computeRangesPivotsAndMetadata(), computeRangesPivotsFor(), refreshRangesMarkers(), pivotForDisplay(), Candle, PivotMarkerGroup, PivotMarkerPaneView (+5 more)

### Community 69 - "AGENTS.md"
Cohesion: 0.14
Nodes (12): Architecture, Commands, Conventions, Forex candle data: FXCM ForexConnect, Frontend data flow (`PriceChart.vue`), Gotchas, graphify, "Laniakea" persona (`/l`) (+4 more)

### Community 70 - "Trading-Monitor Project Overview (CLAUDE.md)"
Cohesion: 0.12
Nodes (16): cTrader ACCESS_DENIED Lockout (No Auto-Recovery), cTrader Open API as Forex Candle Source, DRY Within a Single Runtime Convention, CLAUDE.md Pointer to /l Persona, npm run build Command, Trading-Monitor Project Overview (CLAUDE.md), Rename Consistency Convention, ctrader_oauth_tokens Table (+8 more)

### Community 71 - "src/pipConfig.js"
Cohesion: 0.06
Nodes (51): HTF_FOREX_MIN_GAP_PIPS Constant, LOWER_TF_MIN_GAP_PIPS Constant, Pip-/Pixel-Schwellwerte Übersicht, MAX_TARGET_DISTANCE_PIPS Constant, MIN_PIXELS_PER_HOUR_FOR_LABELS Constants, RANGE_FIB_MIN_PP_DISTANCE_PIPS Constant, find_targets Target-Candidate Algorithm Design, Plan: find_targets Algorithmus (+43 more)

### Community 72 - "dataSnapshot.ts"
Cohesion: 0.06
Nodes (49): ArchivableCandle, readForexCandlesArchiveFrom(), buildLevel(), detectLiquidityLevels(), isDownFractal(), isUpFractal(), LiquidityLevel, Candle (+41 more)

### Community 73 - "closed_rows"
Cohesion: 0.26
Nodes (7): closed_rows(), Normalisierung der nativen FXCM-Bid-Kerzen, unabhängig vom SDK testbar., main(), Geschlossene Bid-Kerzen: FXCM -> lokaler Puffer -> Supabase-Ingest., read_config(), upload(), ClosedCandlesTest

### Community 74 - "Journal GBPUSD — Sicherung vor dem Quellenwechsel"
Cohesion: 0.10
Nodes (19): 03.06.2026 · Short · DR#40, 03.08.2026 · Short · DR#27, 07.08.2026 · Long · DR#29, 07.08.2026 · Short · DR#28, 07.08.2026 · Short · DR#30, 10.08.2026 · Short · DR#41, 14.07.2026 · Short · DR#44, 25.08.2026 · Long · DR#46 (+11 more)

### Community 75 - "pins.ts"
Cohesion: 0.22
Nodes (12): addPinEntry(), addPinM5LiquidityEntry(), addPinM5ObEntry(), addPinRsiDivergenceEntry(), getPinContext(), getPinInstrumentById(), removePinEntry(), LogDecisionArgs (+4 more)

### Community 76 - "SessionBandPaneView"
Cohesion: 0.14
Nodes (3): SessionBandPaneView, SessionBandPrimitive, SessionBandRenderer

### Community 77 - "TradingFlow.vue"
Cohesion: 0.10
Nodes (22): cache, useLocalStorageRef(), buildMermaidSource(), EDGES, getNextActionHint(), mermaidEscape(), NODES, activeByInstrument (+14 more)

### Community 78 - "biasCheck.ts"
Cohesion: 0.17
Nodes (18): buildPendingDecisions(), findIntermediateLevel(), FindIntermediateLevelArgs, IntermediateLevelCandidate, isSpreadHourPivot(), PendingDecision, assessForce(), assessLiquidityForce() (+10 more)

### Community 79 - "debugMetadata.js"
Cohesion: 0.39
Nodes (7): buildActiveMetadataSnapshot(), earliestRelevantTime(), hasActiveMetadata(), selectActiveMetadataSections(), ALL_OFF, BASE_CTX, SECTIONS

### Community 80 - "nearRelevantLiquidityLevels.ts"
Cohesion: 0.12
Nodes (28): businessSecondsBetween(), classifyAge(), computeSweepAgeHours(), MAJOR_MIN_HOURS, MAJOR_MIN_SECONDS, MINOR_MAX_HOURS, MINOR_MAX_SECONDS, berlinOffsetMinutes() (+20 more)

### Community 81 - "Dealing-Range-Loop Diagram"
Cohesion: 0.17
Nodes (12): Dealing-Range-Loop Diagram, News-Blackout Mid-Loop Pause, Pin-Aufräumen after TSC-Link, Target Selection Remains Lana's Judgment, Pin Tools (tools/pins.ts), poi-watcher Alert-Cron Notes, poi-watcher 3-Tier Fetch Throttling, UTC-Hours Exception for Refresh Ticks (+4 more)

### Community 82 - "FXCM-Kerzenfeed"
Cohesion: 0.17
Nodes (9): Betrieb, Datenfluss, Demokonto abgelaufen oder gesperrt, FXCM-Kerzenfeed, Historie nachholen und Sicherungen, Neuaufbau und Wartung, Umstellung und Sicherung, Wenn keine neuen Kerzen kommen (+1 more)

### Community 83 - "useHttpActivity.js"
Cohesion: 0.22
Nodes (10): copiedId, { errors }, counts, dismissHttpError(), errors, extractErrorMessage(), installHttpActivityTracking(), labelFor() (+2 more)

### Community 84 - "AI Capabilities and Limitations Notes"
Cohesion: 0.17
Nodes (12): Delegation (4D Framework), Description (4D Framework), Diligence (4D Framework), Discernment (4D Framework), AI Fluency: 4D Framework Notes, calc_rr Tool Idea (Deterministic RR Calc), AI Capabilities and Limitations Notes, Letter-over-Spirit Failure Mode (+4 more)

### Community 85 - "Vegapunk Slimming Results (-86%)"
Cohesion: 0.17
Nodes (13): get_data_export Tool, Tool 2: run_bias_check, Lana Test Data README, Chronological MCP Tool Call Sequence, Output-too-large Problem, Vegapunk Slimming Results (-86%), marketStructureAnalysis Developer Notes, File Separation: Algorithm vs Rendering (+5 more)

### Community 86 - "clearArmStatesExcept"
Cohesion: 0.15
Nodes (14): clearArmStatesExcept(), onAddAntiConfluenceRequest(), onAddConfirmationRequest(), onAddConfluenceRequest(), onAddRangeAntiConfluenceRequest(), onAddRangeConfirmationRequest(), onAddRangeConfluenceRequest(), onAddTargetRequest() (+6 more)

### Community 87 - "reads.ts"
Cohesion: 0.20
Nodes (19): berlinDayRangeUtcMs(), getForexCandlesArchive(), getJournal(), getTradeSetups(), getTradingAccounts(), computeEma(), DayWindow, fetchM5WithWarmup() (+11 more)

### Community 88 - "PinAddPopup.vue"
Cohesion: 0.23
Nodes (11): clampedX, clampedY, confirm(), emit, note, onKeydown(), onWindowMousedown(), props (+3 more)

### Community 89 - "twelvedata/client.ts"
Cohesion: 0.21
Nodes (11): Candle, fetchCandles(), FetchCandlesOptions, INTERVAL_MAP, requestTimeSeries(), resample(), RESAMPLE_BUCKET_SEC, SUPPORTED_PERIODS (+3 more)

### Community 90 - "Anleitung: State-Machine lesen & bedienen"
Cohesion: 0.25
Nodes (7): Ablaufbeispiel, Anleitung: State-Machine lesen & bedienen, Grundprinzip, Maschine bedienen, Menschlicher Gegencheck, `replayUntilSec` — der EINE Zeit-Parameter (alle Tools), State lesen, ohne die Maschine zu bewegen

### Community 91 - "JsonTree.vue"
Cohesion: 0.25
Nodes (5): entries, expanded, isArray, isObject, props

### Community 92 - "jumpToTimeRange"
Cohesion: 0.29
Nodes (9): isTimeCovered(), jumpToDivergence(), jumpToPin(), jumpToTimeRange(), jumpToTrade(), computeJumpViewport(), loadCandlesAroundTrade(), candle() (+1 more)

### Community 93 - "dataExport.ts"
Cohesion: 0.12
Nodes (29): filterRelevantLevels(), getLatestDailyStructureStartTime(), getObZones(), getSessions(), Candle, computeRangesPivots(), buildDataExport(), capStructurePivots() (+21 more)

### Community 94 - "MCP-Server: Tiefere Referenz"
Cohesion: 0.20
Nodes (10): MCP Auth & Table Permissions, Backfill Scripts, Candle Archive (forex_candles), MCP Server Deployment (Supabase Edge Function), MCP-Server: Tiefere Referenz, get_forex_rsi / get_forex_ema Tools, Single Deno Copy (Dual-Copy Removed), Trade-Journal Write Tools (tools/trades.ts) (+2 more)

### Community 97 - "drMerkmale.py"
Cohesion: 0.06
Nodes (50): ev(), mess_gedeckelt(), -> (Quote, Treffer, unentschieden). Unentschieden = weder Ziel noch Stopp…, Erwartungswert in R ueber die ENTSCHIEDENEN DRs (Treffer oder Stopp, nicht…, dr_schluessel(), gruppiere_drs(), handelsstunden(), lade_bekannte_level() (+42 more)

### Community 98 - "NewsModal.vue"
Cohesion: 0.14
Nodes (18): CURRENCIES, emit, LIST_FORMATTER, newCurrency, newDateTime, newTitle, saving, submit() (+10 more)

### Community 99 - "trade_evidence Table (Dual-Level, Confirmation/Confluence)"
Cohesion: 0.28
Nodes (9): dealing_ranges Table, trade_evidence Table (Dual-Level, Confirmation/Confluence), trade_partial_exits Table, trade_positions Table, trade_targets Table, Confirmation/Confluence/Anti-Confluence Categories, trading repo trade-from-poi.md (Confirmation/Confluence/Anti-Confluence Definition), Bestätigungen (Sweeps & OBs) Feature (+1 more)

### Community 100 - "Fachdoku-Router Skill"
Cohesion: 0.15
Nodes (13): poi-watcher UTC Refresh-Tick Exception, Trading-Hours/Timezone Handling (Europe/Berlin), sessions Table, trading_schedules Table, docs/debug-metadata-panel.md, Fachdoku-Router Skill, src/marketStructureAnalysis.notes.md, docs/mcp-server.md (+5 more)

### Community 101 - "applyInnerMarketStructurePivot"
Cohesion: 0.25
Nodes (6): advanceNestedTrendInner(), applyInnerMarketStructurePivot(), confirmBreak, originHigh, originLow, pullback

### Community 102 - "/task do Mode"
Cohesion: 0.38
Nodes (7): Laniakea milk-city Task-Status Rule, /task Default Data-Maintenance Mode, /task do Mode, /task new Mode, /task refine Mode, /task Command Router, milk-city Task Status Convention

### Community 104 - "marketStructureAnalysisLqSweep.test.js"
Cohesion: 0.25
Nodes (7): baseState(), candles, levelRealBreak, levelSweep, levelUntouched, origin, triggerPivot

### Community 105 - "marketStructureRendering.ts"
Cohesion: 0.06
Nodes (25): refreshMarketStructure(), bullBearLabelSide(), Candle, ArrowPaneView, ArrowPrimitive, ArrowRenderer, collectFibLevels(), collectH1LqLevels() (+17 more)

### Community 106 - "Lana-Fehlerdiagnose"
Cohesion: 0.33
Nodes (5): Ablauf, Ergebnis, Lana-Fehlerdiagnose, Routing: Diagnose → typischer Fix-Ort, Wann aufrufen

### Community 107 - "Agent Skills Pro Notes"
Cohesion: 0.29
Nodes (7): allowed-tools Skill Config, Context-free Scripts in Skills, Agent Skills Pro Notes, Progressive Disclosure in Skills, Skill Sharing & Troubleshooting, Skills Embedded in Subagents, Skills vs CLAUDE.md vs Hooks vs Subagents

### Community 108 - "obZones.js"
Cohesion: 0.47
Nodes (4): fetchObZones(), fetchUntouchedZones(), { data: dbObZones }, { from }

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

### Community 117 - "vite.config.js"
Cohesion: 0.40
Nodes (3): DEBUG_DIR, DEBUG_FILE, __dirname

### Community 118 - "lana-git-pull.cjs"
Cohesion: 0.50
Nodes (3): { execFileSync }, path, TRADING_REPO

### Community 119 - "forexCandles.js"
Cohesion: 0.27
Nodes (14): DB_ARCHIVED_BARS, fetchArchivedPage(), fetchArchivedUpTo(), fetchCandles(), fetchCandlesBatchOnce(), fetchCandlesOnce(), fetchInitialCandles(), fetchOlderCandles() (+6 more)

### Community 121 - "forexCandles.ts"
Cohesion: 0.11
Nodes (23): getForexCandlesArchiveUpTo(), fetchLiveForexCandles(), fetchLiveForexCandlesOnce(), isRetryable(), ALL_BARS, backfillOne(), Bar, BARS (+15 more)

### Community 122 - "marketStructureAnalysis.test.js"
Cohesion: 0.22
Nodes (8): pivot1, pivot2, pivot3, pivot4, pivot5, pivot6, pivot7, pivot8

### Community 124 - "router.js"
Cohesion: 0.24
Nodes (8): ALARM_TYPES, fetchAlarmSettings(), setAlarmEnabled(), router, alarms, errorText, loading, toggle()

### Community 125 - "Handbuch-Check"
Cohesion: 0.40
Nodes (4): Ergebnis, Handbuch-Check, Prüfpunkte, Wann aufrufen

### Community 132 - "Plan: Trade-Journal Konfluenzen & Kontext"
Cohesion: 0.50
Nodes (4): Anti-Confluences Snapshot Feature (Planned), Plan: Trade-Journal Konfluenzen & Kontext, Session-Kontext Feature (Planned), Trend-Kontext Feature (Planned)

### Community 133 - "marketStructureAnalysisInnerPivots.test.js"
Cohesion: 0.25
Nodes (7): h1Candles, p2Pivot3, p2Pivot4, p2Pivot5, pivot1, pivot2, pivot3

### Community 134 - "openTargetPicker"
Cohesion: 0.40
Nodes (5): openAntiConfluencePicker(), openTargetPicker(), getCurrentLiquidityLevels(), findNearestLiquidityTargets(), findNearestObTargets()

### Community 135 - "Dealing Range anlegen"
Cohesion: 0.50
Nodes (3): Ablauf, Dealing Range anlegen, Warum ein eigener Skill (nicht nur eine Doku-Zeile)

### Community 136 - ".codex/hooks/lana-git-pull.cjs"
Cohesion: 0.50
Nodes (3): { execFileSync }, path, TRADING_REPO

### Community 138 - "tradingSchedules.js"
Cohesion: 0.19
Nodes (12): minutesToTimeInput(), timeInputToMinutes(), addWindow(), cloneWindows(), DEFAULT_SCHEDULES, EMPTY_WINDOWS, loadInitial(), removeWindow() (+4 more)

### Community 139 - "chartTimeUtils.js"
Cohesion: 0.09
Nodes (34): AgeTier, classifyAge(), MAJOR_MIN_SECONDS, MINOR_MAX_SECONDS, ageReferenceTime(), businessSecondsBetween(), computeNextReplayTime(), formatAge() (+26 more)

### Community 144 - "fxcmCandles.ts"
Cohesion: 0.22
Nodes (5): headers, fetchForexBatch(), FxcmCandle, PERIODS, readFxcmCandles()

### Community 145 - "berlinDateStrFor"
Cohesion: 0.21
Nodes (18): berlinDateStrFor(), fetchActiveTscRangeId(), getOpenOppositeDealingRanges(), computeEvidenceScore(), EvidenceScoreBreakdownEntry, EvidenceScoreInput, EvidenceScoreResult, loadMachineForDay() (+10 more)

### Community 147 - "marketStructureAnalysisFib.test.js"
Cohesion: 0.29
Nodes (6): RANGE_FIB_MIN_PP_DISTANCE_PIPS, confirmBreak, confirmedUptrendState(), originHigh, originLow, pullback

### Community 148 - "applyMarketStructurePivot"
Cohesion: 0.13
Nodes (20): applyMarketStructurePivot(), initMarketStructureState(), chochConfirmedState(), confirmBreak, confirmedUptrendState(), originHigh, originLow, pullback (+12 more)

### Community 153 - "usePriceChartClaudeAnnotations"
Cohesion: 0.40
Nodes (3): renderClaudeAnnotations(), usePriceChartClaudeAnnotations(), refresh()

### Community 156 - "validate.js"
Cohesion: 0.38
Nodes (4): SECONDS, validateCandles(), candle, closedAt

## Ambiguous Edges - Review These
- `Trading-Steps-Ablauf Diagram` → `calc_rr Tool Idea (Deterministic RR Calc)`  [AMBIGUOUS]
  docs/steerabilty-vs-wrong-ai-outputs.md · relation: references

## Knowledge Gaps
- **1173 isolated node(s):** `{ execFileSync }`, `path`, `TRADING_REPO`, `{ execFileSync }`, `path` (+1168 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1437 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **13 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Trading-Steps-Ablauf Diagram` and `calc_rr Tool Idea (Deterministic RR Calc)`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **Why does `businessSecondsBetween()` connect `nearRelevantLiquidityLevels.ts` to `dataSnapshot.ts`, `chartTimeUtils.js`, `biasCheck.ts`, `dealingRangeLoop.ts`, `dataExport.ts`?**
  _High betweenness centrality (0.090) - this node is a cross-community bridge._
- **Why does `marketStructureAnalysis Developer Notes` connect `Vegapunk Slimming Results (-86%)` to `fachdoku-router/SKILL.md`, `src/pipConfig.js`?**
  _High betweenness centrality (0.085) - this node is a cross-community bridge._
- **Why does `renderMarketStructureAnalysis()` connect `marketStructureRendering.ts` to `usePriceChartMarketStructure.js`, `chartTimeUtils.js`, `cssColor`, `Vegapunk Slimming Results (-86%)`, `lineWidth`, `LiquidityLinePrimitive`?**
  _High betweenness centrality (0.076) - this node is a cross-community bridge._
- **What connects `{ execFileSync }`, `path`, `TRADING_REPO` to the rest of the system?**
  _1173 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Dashboard.vue` be split into smaller, more focused modules?**
  _Cohesion score 0.01551901336073998 - nodes in this community are weakly interconnected._
- **Should `gbp_h1_uptrend_uptrend_break_of_structure_und_trendumkehr.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0196078431372549 - nodes in this community are weakly interconnected._