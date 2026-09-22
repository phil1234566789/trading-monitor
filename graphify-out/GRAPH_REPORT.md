# Graph Report - trading-monitor  (2026-09-22)

## Corpus Check
- 521 files · ~516,033 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 3164 nodes · 6418 edges · 157 communities (138 shown, 12 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 113 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `2d199a40`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Dashboard.vue
- gbp_h1_uptrend_uptrend_break_of_structure_und_trendumkehr.ts
- chartTimeUtils.js
- _shared/ageTier.ts
- PriceChart.vue
- gbp_h1_uptrend_mit_LQ_sweep_LONG_SETUP.ts
- gbp_h1_uptrend_mit_inner_structure.ts
- Plan: Forex-Chart-Objekte Datengrundlage
- usePriceChartRsi.js
- FibTickPrimitive
- rsiDivergenceStats.ts
- DataExportModal.vue
- src/pipConfig.js
- db.ts
- dealingRangeLoop.ts
- TradeEditModal.vue
- package.json
- src/sessionOccurrences.js
- LoopStatus.vue
- findTargetCandidates.js
- Dealing-Range-Anlegen Skill
- backfillObZones.ts
- newsMarkers.js
- marketStructureAnalysisNestedNestedChoch.test.js
- ctrader/client.ts
- pricePrecisionForInstrument
- tradeIntake.js
- trades.js
- trading-monitor-mcp/index.ts
- Plan: POI-Strategie-Findung, Backtesting & Trade-Notifications
- tradeMarkers.js
- sessions.js
- gbp_h1_uptrend_protected_low_gebrochen.ts
- tradingAccounts.js
- tradeSetups.js
- dataExport.js
- tdd_mit_claude.ts
- orderBlocks.ts
- priceChartHitTest.test.js
- TradeSetupCockpit.vue
- MetadataPanel.vue
- priceChartObZones.js
- alarmLog.js
- useClaudeAnnotations.js
- trading-monitor-mcp/marketStructureAnalysis.ts
- priceChartConstants.js
- pinContext.js
- Laniakea Persona Command (/l)
- Plan: Sehr Große Dateien Refactoren (PriceChart.vue)
- fachdoku-router/SKILL.md
- barSecondsFor
- machineState.ts
- candleCache.js
- gbp_h1_uptrend.ts
- tradeSetupCockpit.ts
- DR-Reichweite — was taugen die erkannten Setups?
- src/marketStructureAnalysis.ts
- chartColors.js
- pinEntryVisible
- usePriceChartRsi
- trading-monitor-mcp/pretradeGates.ts
- usePriceChartLiquidity.js
- cssColor
- poi-watcher/index.ts
- State Machine for Lana's Trading Flow
- compilerOptions
- dailyPivotMarkers.js
- claudeAnnotations.js
- pivotMarkers.ts
- AGENTS.md
- Trading-Monitor Project Overview (CLAUDE.md)
- marketStructureAnalysis Rules Overview
- backfillTradeSetups.ts
- closed_rows
- Journal GBPUSD — Sicherung vor dem Quellenwechsel
- tradeSetup.ts
- SessionBandPaneView
- TradingFlow.vue
- biasCheck.ts
- debugMetadata.js
- clipReplay
- Dealing-Range-Loop Diagram
- PLAN: DR-Statistik in der UI anzeigen
- useHttpActivity.js
- AI Capabilities and Limitations Notes
- Vegapunk Slimming Results (-86%)
- tradeSetup.js
- reads.ts
- PinAddPopup.vue
- twelvedata/client.ts
- Anleitung: State-Machine lesen & bedienen
- JsonTree.vue
- cTrader Open API as Forex Candle Source
- dataExport.ts
- MCP-Server: Tiefere Referenz
- DivergenceLinePrimitive
- orderBlocks.js
- drMerkmale.py
- NewsModal.vue
- trade_evidence Table (Dual-Level, Confirmation/Confluence)
- src/orderBlockDetection.js
- applyInnerMarketStructurePivot
- /task do Mode
- hole_alle
- marketStructureAnalysisLqSweep.test.js
- marketStructureRendering.ts
- Lana-Fehlerdiagnose
- Agent Skills Pro Notes
- supabaseClient.js
- fetch-trend-fixture.mjs
- ContextMenu.vue
- ctraderCandles.js
- Aufmerksamkeits-Level (Watch-Level-Strategie Schritt 5+)
- Debug-Metadata-Panel Notes
- AI Failure as Property Collision
- MCP Advanced Topics Notes
- PinPanel.vue
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
- dataSnapshot.ts
- App.vue
- marketStructureAnalysisInnerPivots.test.js
- findTargets.js
- Dealing Range anlegen
- .codex/hooks/lana-git-pull.cjs
- source-command-l
- tradingSchedules.js
- liquidity.js
- findAntiConfluences.js
- CrudListSection.vue
- fxcmCandles.ts
- LiquidityLineRenderer
- tradeSetup.test.js
- marketStructureAnalysisFib.test.js
- applyMarketStructurePivot
- liveTouch.ts
- usePriceChartClaudeAnnotations
- usePriceChartMarketStructure
- forbiddenSession.test.js
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

## Communities (157 total, 12 thin omitted)

### Community 0 - "Dashboard.vue"
Cohesion: 0.02
Nodes (138): useSessionStorageRef(), useTabScopedRef(), rsiDivergenceEntryNaturalKey(), addPositionToDealingRange(), antiConfluenceAddTrade, anyArmStateActive, ARM_STATES, clearArmStatesExcept() (+130 more)

### Community 1 - "gbp_h1_uptrend_uptrend_break_of_structure_und_trendumkehr.ts"
Cohesion: 0.02
Nodes (101): candlesAroundBOS, candlesAroundBreak, p2Pivot1, p2Pivot10, p2Pivot11, p2Pivot12, p2Pivot13, p2Pivot14 (+93 more)

### Community 2 - "chartTimeUtils.js"
Cohesion: 0.10
Nodes (28): computeNextReplayTime(), isTimeCovered(), mergeRecent(), nextCandleAfter(), replayFetchToMs(), snapToBarTime(), jumpToDivergence(), jumpToPin() (+20 more)

### Community 3 - "_shared/ageTier.ts"
Cohesion: 0.22
Nodes (12): MAJOR_MIN_SECONDS, MINOR_MAX_SECONDS, businessSecondsBetween(), classifyAge(), computeSweepAgeHours(), MAJOR_MIN_HOURS, MAJOR_MIN_SECONDS, MINOR_MAX_HOURS (+4 more)

### Community 4 - "PriceChart.vue"
Cohesion: 0.04
Nodes (64): activeMetadataSnapshot, allCandles, antiConfluencePickerCurrentPrice, antiConfluencePickerDivergenceCandidates, antiConfluencePickerHoveredLiquidityKey, antiConfluencePickerHoveredObKey, antiConfluencePickerInvalidationObCandidates, antiConfluencePickerObCandidates (+56 more)

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
Cohesion: 0.17
Nodes (20): refreshDivergence(), buildDivergenceEntry(), collectDivergenceHistory(), computeRsi(), DEFAULT_DIVERGENCE_FRACTAL_PERIOD, DEFAULT_DIVERGENCE_HISTORY_COUNT, DEFAULT_DIVERGENCE_LOOKBACK_BARS, DEFAULT_RSI_PERIOD (+12 more)

### Community 9 - "FibTickPrimitive"
Cohesion: 0.15
Nodes (3): FibTickPaneView, FibTickPrimitive, FibTickRenderer

### Community 10 - "rsiDivergenceStats.ts"
Cohesion: 0.09
Nodes (38): buildDivergenceEntry(), collectDivergenceHistory(), computeRsi(), DEFAULT_DIVERGENCE_FRACTAL_PERIOD, DEFAULT_DIVERGENCE_HISTORY_COUNT, DEFAULT_DIVERGENCE_LOOKBACK_BARS, DEFAULT_RSI_PERIOD, detectRsiDivergence() (+30 more)

### Community 11 - "DataExportModal.vue"
Cohesion: 0.09
Nodes (21): asset, copied, copyResult(), currentSymbol, dateStr, error, generate(), loading (+13 more)

### Community 12 - "src/pipConfig.js"
Cohesion: 0.11
Nodes (14): fromPips(), KEINE_SKALA, R_SCALE_MINIMUM, R_SCALE_STEPS, rScaleLevels(), STOPP_DECKEL_PIPS, labelText(), RScalePaneView (+6 more)

### Community 13 - "db.ts"
Cohesion: 0.07
Nodes (52): fetchAllRows(), addTradeConfirmation(), AddTradeConfirmationArgs, addTradePosition(), addTradeTarget(), AddTradeTargetArgs, asOfProbeCandles(), createTrade() (+44 more)

### Community 14 - "dealingRangeLoop.ts"
Cohesion: 0.07
Nodes (66): AgeTier, berlinDateStrFor(), berlinDateTimeStrFor(), assessInducement(), checkFallFour(), CheckFallFourInput, computeHtfWatchLevels(), computeWatchLevels() (+58 more)

### Community 15 - "TradeEditModal.vue"
Cohesion: 0.05
Nodes (46): commission, confirmationLabel(), emit, entryPrice, entryTimeInput, exitPrice, exitTimeInput, flashInvalidationSaved() (+38 more)

### Community 16 - "package.json"
Cohesion: 0.06
Nodes (33): lightweight-charts, mermaid, dependencies, lightweight-charts, mermaid, @supabase/supabase-js, vue, vue-router (+25 more)

### Community 17 - "src/sessionOccurrences.js"
Cohesion: 0.24
Nodes (12): createSessionBonusResolver(), ALL_DAYS, attachRangeExtremes(), bonusLabelForPivot(), buildSessionContextLookup(), contextForPivot(), daysOrAll(), localMidnightUtc() (+4 more)

### Community 18 - "LoopStatus.vue"
Cohesion: 0.07
Nodes (24): fetchLoopStateHistory(), fetchLoopStatesForDate(), LOOP_INSTRUMENTS, rowToLoopState(), fetchStateMachineLog(), rowToDecision(), activeByInstrument, { data, refresh } (+16 more)

### Community 19 - "findTargetCandidates.js"
Cohesion: 0.10
Nodes (37): fromPips(), createDealingRange(), deleteDealingRange(), fetchActiveTscRangeId(), fetchDealingRangeCockpit(), findRecentTradeSetupIdsByKey(), getOpenOppositeDealingRanges(), toLiquidityLevel() (+29 more)

### Community 20 - "Dealing-Range-Anlegen Skill"
Cohesion: 0.14
Nodes (15): kind=pivot = Liquidity-Sweep-Only Semantics, Dealing-Range-Anlegen Skill, milk-city Task: Confluence-Tracking bei Dealing Ranges, trading/liquidität.md (Liquiditäts-Sweep-Mechanismus), AI Capabilities Framework (Next Token Prediction/Knowledge/Working Memory/Steerability), Diagnose-to-Fix Routing Table, Lana-Fehlerdiagnose Skill, docs/steerabilty-vs-wrong-ai-outputs.md (+7 more)

### Community 21 - "backfillObZones.ts"
Cohesion: 0.29
Nodes (9): backfillOne(), BAR_CONFIG, BARS, CandleRow, correctStaleZones(), fetchAllCandles(), fetchCorrectionCandidates(), INSTRUMENTS (+1 more)

### Community 22 - "newsMarkers.js"
Cohesion: 0.13
Nodes (12): usePriceChartSessionsAndNews(), refreshNewsMarkers(), DAY_KEY_FORMATTER, extrapolatedX(), formatEventLabel(), isSameBerlinDay(), NewsMarkerPaneView, NewsMarkerPrimitive (+4 more)

### Community 23 - "marketStructureAnalysisNestedNestedChoch.test.js"
Cohesion: 0.18
Nodes (10): confirmBreak, originHigh, originLow, pivotB, pivotC, pivotD, pivotE, pivotF (+2 more)

### Community 24 - "ctrader/client.ts"
Cohesion: 0.11
Nodes (26): CORS_HEADERS, authAccount(), authenticate(), cachedSymbolIds, Candle, concat(), connectWithTimeout(), CTraderConnection (+18 more)

### Community 25 - "pricePrecisionForInstrument"
Cohesion: 0.08
Nodes (30): candidateLabel(), candidatePrice(), emit, mergedCandidates, precision, props, emit, OUTCOME_LABEL (+22 more)

### Community 26 - "tradeIntake.js"
Cohesion: 0.14
Nodes (27): direction, emit, entryPrice, errorMsg, levels, precision, props, reasoning (+19 more)

### Community 27 - "trades.js"
Cohesion: 0.11
Nodes (22): onRemoveConfirmation(), pnlClass, props, stats, winrateClass, fmtR(), removeConfirmationFromTrade(), computeTradeStats() (+14 more)

### Community 28 - "trading-monitor-mcp/index.ts"
Cohesion: 0.07
Nodes (48): DATE_FORMATTER, OFFSET_FORMATTER, TIME_FORMATTER, addPinEntry(), addPinM5LiquidityEntry(), addPinM5ObEntry(), addPinRsiDivergenceEntry(), findOrCreateObZoneId() (+40 more)

### Community 29 - "Plan: POI-Strategie-Findung, Backtesting & Trade-Notifications"
Cohesion: 0.17
Nodes (15): Supabase/PostgREST ~1000 Row Cap Gotcha, daily_structure_pivots Table, forex_candles Table, get_forex_candles_archive MCP Tool, Archive-First Auto-Reload Pattern (Tried, Then Reverted), BTC-USDT/OKX Complete Removal (2026-08-21), 1D-Periode-4-Pivot Market-Structure Startpoint (2026-08-30), Persisted Forex Candle Archive (forex_candles Pilot) (+7 more)

### Community 30 - "tradeMarkers.js"
Cohesion: 0.13
Nodes (10): drawEntryPoint(), drawExitPoint(), drawHaloRing(), drawLabel(), drawTick(), renderTradeMarkers(), TradeMarkerPaneView, TradeMarkerPrimitive (+2 more)

### Community 31 - "sessions.js"
Cohesion: 0.13
Nodes (18): emit, instrumentSessions, props, WEEKDAY_DISPLAY_ORDER, refreshSessions(), addSession(), currentSessionDanger(), DANGER_LEVELS (+10 more)

### Community 32 - "gbp_h1_uptrend_protected_low_gebrochen.ts"
Cohesion: 0.08
Nodes (25): ClosedRange, MarketStructureState, PivotBase, PivotHigh, PivotLow, PivotTouched, PivotTypeAll, PivotUntouched (+17 more)

### Community 33 - "tradingAccounts.js"
Cohesion: 0.13
Nodes (17): currentLabel, open, selectedAccount, wrapperRef, accounts, accountsLoaded, ALL_ACCOUNTS_ID, createAccount() (+9 more)

### Community 34 - "tradeSetups.js"
Cohesion: 0.24
Nodes (11): fetchTradeSetupForCockpit(), fetchTradeSetups(), mergeDbTradeSetups(), sweepLevel(), toSec(), tradeSetupFromRow(), { data: dbTradeSetups, refresh: refreshDbTradeSetups }, onIsolateTrade() (+3 more)

### Community 35 - "dataExport.js"
Cohesion: 0.15
Nodes (23): marketStructureTree, berlinOffsetMinutes(), buildDataExport(), compute1hStructureState(), computeExportTimeframeData(), computeLiquidityLevelsForExport(), computeObZonesForExport(), computeTrendChainAges() (+15 more)

### Community 36 - "tdd_mit_claude.ts"
Cohesion: 0.08
Nodes (24): nextPivot1, nextPivot10, nextPivot11, nextPivot2, nextPivot3, nextPivot4, nextPivot5, nextPivot6 (+16 more)

### Community 37 - "orderBlocks.ts"
Cohesion: 0.20
Nodes (9): Candle, detectOrderBlocks(), HTF_FOREX_LABELS, HTF_FOREX_MIN_GAP_PIPS, isBoxInvalidated(), LOWER_TF_LABELS, LOWER_TF_MIN_GAP_PIPS, Zone (+1 more)

### Community 38 - "priceChartHitTest.test.js"
Cohesion: 0.08
Nodes (20): findClickedDivergence(), findClickedLiquidityLevel(), findClickedOBZone(), findClickedSetup(), findClickedTarget(), OrderBlockPrimitive, ZonePaneView, DIVERGENCE_CLICK_TOLERANCE_PX (+12 more)

### Community 39 - "TradeSetupCockpit.vue"
Cohesion: 0.08
Nodes (25): emit, accentStyle, antiConfluences, canTransfer, confirmationLabel(), confirmations, confluences, dateLabel (+17 more)

### Community 40 - "MetadataPanel.vue"
Cohesion: 0.24
Nodes (10): emit, height, left, onDrag(), panelEl, props, startDrag(), stopDrag() (+2 more)

### Community 41 - "priceChartObZones.js"
Cohesion: 0.15
Nodes (26): emit, onAntiConfluencePickerHover(), onAntiConfluencePickerSelect(), onTargetPickerHover(), onTargetPickerSelect(), openAntiConfluencePicker(), openTargetPicker(), refreshLiquidityInternal() (+18 more)

### Community 42 - "alarmLog.js"
Cohesion: 0.29
Nodes (7): fetchAlarmLog(), fetchTouchedLiquidityLevels(), fetchTradeSetups(), fetchTouchedZones(), currentSymbol, { data: rows, refresh }, SYMBOLS

### Community 43 - "useClaudeAnnotations.js"
Cohesion: 0.09
Nodes (29): addClaudeAnnotationDrawing(), fetchClaudeAnnotations(), removeClaudeAnnotationDrawing(), setClaudeAnnotationDrawingVisible(), applyText(), emit, error, { instrument, dateStr, drawings, loading, add, remove, setDrawingVisible } (+21 more)

### Community 44 - "trading-monitor-mcp/marketStructureAnalysis.ts"
Cohesion: 0.09
Nodes (41): buildLevel(), detectLiquidityLevels(), isDownFractal(), isUpFractal(), LIQUIDITY_FRACTAL_PERIOD, LIQUIDITY_MAX_RELEVANT, LiquidityLevel, advanceNestedTrend() (+33 more)

### Community 45 - "priceChartConstants.js"
Cohesion: 0.07
Nodes (33): usePriceChartTradeSetups(), fetchM5Candles(), fetchTrendAnalysisM5History(), getTrendAnalysisM5Candles(), CALLOUT_STACK_GAP_PX, CLOSE_POLL_BUFFER_MS, COPIED_FEEDBACK_MS, DEBUG_AUTOSAVE_INTERVAL_MS (+25 more)

### Community 46 - "pinContext.js"
Cohesion: 0.19
Nodes (18): addPinEntry(), addPinM5LiquidityEntry(), addPinM5ObEntry(), addPinRsiDivergenceEntry(), addPinTscSetupEntry(), fetchPinContext(), REF_COLUMN, removePinEntry() (+10 more)

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
Cohesion: 0.13
Nodes (22): firstObFormationTimeAfter(), TriggerCandle, detectOrderBlocks(), HTF_FOREX_LABELS, HTF_FOREX_MIN_GAP_PIPS, LOWER_TF_LABELS, LOWER_TF_MIN_GAP_PIPS, applyAsOf() (+14 more)

### Community 51 - "machineState.ts"
Cohesion: 0.16
Nodes (26): getNewsEvents(), getTradingSchedule(), deriveStepAndCase(), LoadedMachine, loadMachineForDayOrNull(), loadOrCreateMachineForDay(), persistTransition(), rehydrateActor() (+18 more)

### Community 52 - "candleCache.js"
Cohesion: 0.22
Nodes (12): cachedCandlesUpTo(), cacheKey(), fetchCandlesCached(), getCachedCandles(), mergeCandles(), openDb(), safeCompleteUpTo(), setCachedCandles() (+4 more)

### Community 53 - "gbp_h1_uptrend.ts"
Cohesion: 0.10
Nodes (20): pivot1, pivot10, pivot11, pivot12, pivot13, pivot2, pivot3, pivot4 (+12 more)

### Community 54 - "tradeSetupCockpit.ts"
Cohesion: 0.12
Nodes (21): trendChain, trendChainDisplay, RangeTrend, ANTI_CONFLUENCE_COLOR, ANTI_CONFLUENCE_THRESHOLD, AntiConfluence, CockpitState, computeAntiConfluences() (+13 more)

### Community 55 - "DR-Reichweite — was taugen die erkannten Setups?"
Cohesion: 0.08
Nodes (22): Definitionen, Die Filter, DR-Reichweite — was taugen die erkannten Setups?, Enge der DR — warum beide Einheiten nötig sind, find_targets, Gegenkraft — teilweise gekippt, Grenzen, Handelszeit — als Fenster tot, als Stunde lebendig (+14 more)

### Community 56 - "src/marketStructureAnalysis.ts"
Cohesion: 0.27
Nodes (17): advanceNestedTrend(), applyInnerMarketStructurePivotCore(), applyMarketStructurePivotCore(), buildMarketStructureState(), closesAboveOldHigh(), closesBelowLevel(), computeRangesPivots(), evaluateConfirmingBreak() (+9 more)

### Community 57 - "chartColors.js"
Cohesion: 0.08
Nodes (18): chartColors, DEFAULT_CHART_COLORS, resetChartColors(), chartLineWidths, DEFAULT_CHART_LINE_WIDTHS, resetChartLineWidths(), collapsed, emit (+10 more)

### Community 58 - "pinEntryVisible"
Cohesion: 0.14
Nodes (18): liquidityLevelEntryNaturalKey(), m5LiquidityEntryNaturalKey(), obZoneEntryNaturalKey(), hoveredPinLiquidityLevelKey, hoveredPinObZoneKey, onSelectPin(), pinEntryVisible(), pinJumpHint (+10 more)

### Community 59 - "usePriceChartRsi"
Cohesion: 0.24
Nodes (8): nativeLineWidth(), usePriceChartRsi(), applyColorOptions(), applyLineWidthOptions(), create(), refreshEma(), refreshRsi(), computeEma()

### Community 60 - "trading-monitor-mcp/pretradeGates.ts"
Cohesion: 0.08
Nodes (28): poi-watcher UTC Refresh-Tick Exception, Trading-Hours/Timezone Handling (Europe/Berlin), sessions Table, trading_schedules Table, docs/debug-metadata-panel.md, Fachdoku-Router Skill, src/marketStructureAnalysis.notes.md, docs/mcp-server.md (+20 more)

### Community 61 - "usePriceChartLiquidity.js"
Cohesion: 0.13
Nodes (24): usePriceChartLiquidity(), attachBonus(), refresh(), liquidityLevelNaturalKey(), renderLiquidityLevels(), buildLevel(), detectLiquidityLevels(), filterRelevantLevels() (+16 more)

### Community 62 - "cssColor"
Cohesion: 0.11
Nodes (20): cssColor(), cssColorScaled(), hexToRgba(), lineWidth(), obZoneCtx(), refreshTradeConfirmationLinksInternal(), refreshTradeTargetLinksInternal(), tradeLikeEntriesForCandles() (+12 more)

### Community 63 - "poi-watcher/index.ts"
Cohesion: 0.11
Nodes (18): unprocessedTimeframes(), fmt(), InstrumentConfig, INSTRUMENTS, isInWindows(), LiquidityLevelRow, localMinutesAndWeekday(), ObZoneRow (+10 more)

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
Cohesion: 0.11
Nodes (13): ANNOTATION_COLOR, annotationAnchorPoint(), AnnotationsPaneView, AnnotationsPrimitive, AnnotationsRenderer, parseAnnotations(), resolveLabelPlacements(), resolveTime() (+5 more)

### Community 68 - "pivotMarkers.ts"
Cohesion: 0.14
Nodes (7): Candle, PivotMarkerGroup, PivotMarkerPaneView, PivotMarkerPrimitive, PivotMarkerRenderer, RenderOptions, renderPivotMarkers()

### Community 69 - "AGENTS.md"
Cohesion: 0.14
Nodes (12): Architecture, Commands, Conventions, Forex candle data: FXCM ForexConnect, Frontend data flow (`PriceChart.vue`), Gotchas, graphify, "Laniakea" persona (`/l`) (+4 more)

### Community 70 - "Trading-Monitor Project Overview (CLAUDE.md)"
Cohesion: 0.14
Nodes (13): cTrader ACCESS_DENIED Lockout (No Auto-Recovery), DRY Within a Single Runtime Convention, CLAUDE.md Pointer to /l Persona, npm run build Command, Trading-Monitor Project Overview (CLAUDE.md), Rename Consistency Convention, REPLAY_LOOKAHEAD_SEC M1 Scaling Gotcha, ctrader_oauth_tokens Table (+5 more)

### Community 71 - "marketStructureAnalysis Rules Overview"
Cohesion: 0.22
Nodes (15): Arbitrary Nesting Depth (2026-08-09), Rendering Rules (renderMarketStructureAnalysis), marketStructureAnalysis Rules Overview, Docht-vs-Bruch (Wick vs Close-Break) Unification, Standalone Downtrend Detection/Invalidation, Fibonacci Level (computeFibLevels/collectFibLevels), Inner-Pivots (Period 2) Fast Pre-Detection, LQ-Sweep Classification (markLqSweeps) (+7 more)

### Community 72 - "backfillTradeSetups.ts"
Cohesion: 0.12
Nodes (14): CORS_HEADERS, ExistingPivotRow, INSTRUMENTS, ArchivableCandle, readForexCandlesArchiveFrom(), SetupSweep, persistTradeSetupSweeps(), alarmFenster (+6 more)

### Community 73 - "closed_rows"
Cohesion: 0.26
Nodes (7): closed_rows(), Normalisierung der nativen FXCM-Bid-Kerzen, unabhängig vom SDK testbar., main(), Geschlossene Bid-Kerzen: FXCM -> lokaler Puffer -> Supabase-Ingest., read_config(), upload(), ClosedCandlesTest

### Community 74 - "Journal GBPUSD — Sicherung vor dem Quellenwechsel"
Cohesion: 0.10
Nodes (19): 03.06.2026 · Short · DR#40, 03.08.2026 · Short · DR#27, 07.08.2026 · Long · DR#29, 07.08.2026 · Short · DR#28, 07.08.2026 · Short · DR#30, 10.08.2026 · Short · DR#41, 14.07.2026 · Short · DR#44, 25.08.2026 · Long · DR#46 (+11 more)

### Community 75 - "tradeSetup.ts"
Cohesion: 0.25
Nodes (14): closesBeyondLevel(), collectObSweeps(), detectTradeSetup(), findBestLsMatch(), findFirstSetupObAfter(), findImmediateLsSetup(), findLsInArray(), findProtectedFractal() (+6 more)

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

### Community 80 - "clipReplay"
Cohesion: 0.15
Nodes (26): tradesVisibleForCandles(), buildActiveMetadataSnapshotInternal(), clearTradeSetupFocus(), clipReplay(), computeTradeSetupsInternal(), focusTradeSetup(), loadTradeSetupM5(), refreshChart() (+18 more)

### Community 81 - "Dealing-Range-Loop Diagram"
Cohesion: 0.17
Nodes (12): Dealing-Range-Loop Diagram, News-Blackout Mid-Loop Pause, Pin-Aufräumen after TSC-Link, Target Selection Remains Lana's Judgment, Pin Tools (tools/pins.ts), poi-watcher Alert-Cron Notes, poi-watcher 3-Tier Fetch Throttling, UTC-Hours Exception for Refresh Ticks (+4 more)

### Community 82 - "PLAN: DR-Statistik in der UI anzeigen"
Cohesion: 0.08
Nodes (23): Beide Leitern nach festem Risiko-Band, Das Kriterium ist das Sweep-ALTER, nicht die Herkunft — korrigiert 20.09.2026, Definitionen (nicht neu herleiten), Der gedeckelte Stopp — durchgängige Konvention seit 20.09.2026, Die 50er-Schwelle ist erfüllt — kein Blocker mehr, Die Falle: Path B hat kein echtes Invalidierungslevel — ERLEDIGT 20.09.2026, Die Zahlen (Stand 21.09.2026, n=1314), Ein zweiter Schnitt wäre möglich — aber zurückgestellt (siehe oben) (+15 more)

### Community 83 - "useHttpActivity.js"
Cohesion: 0.22
Nodes (10): copiedId, { errors }, counts, dismissHttpError(), errors, extractErrorMessage(), installHttpActivityTracking(), labelFor() (+2 more)

### Community 84 - "AI Capabilities and Limitations Notes"
Cohesion: 0.17
Nodes (12): Delegation (4D Framework), Description (4D Framework), Diligence (4D Framework), Discernment (4D Framework), AI Fluency: 4D Framework Notes, calc_rr Tool Idea (Deterministic RR Calc), AI Capabilities and Limitations Notes, Letter-over-Spirit Failure Mode (+4 more)

### Community 85 - "Vegapunk Slimming Results (-86%)"
Cohesion: 0.17
Nodes (13): get_data_export Tool, Tool 2: run_bias_check, Lana Test Data README, Chronological MCP Tool Call Sequence, Output-too-large Problem, Vegapunk Slimming Results (-86%), marketStructureAnalysis Developer Notes, File Separation: Algorithm vs Rendering (+5 more)

### Community 86 - "tradeSetup.js"
Cohesion: 0.21
Nodes (16): Two Runtimes, One Algorithm Set (Deliberate Duplication), computeTradeSetups(), closesBeyondLevel(), collectObSweeps(), detectSetupObs(), detectTradeSetups(), findAllProtectedFractals(), findBestLsMatch() (+8 more)

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

### Community 92 - "cTrader Open API as Forex Candle Source"
Cohesion: 0.40
Nodes (5): cTrader Open API as Forex Candle Source, cTrader Wire Protocol Implementation (Manual Protobuf), supabase/functions/_shared/ctrader/client.ts, supabase/functions/_shared/twelvedata/client.ts (Unwired), supabase/functions/forex-candles

### Community 93 - "dataExport.ts"
Cohesion: 0.06
Nodes (54): berlinOffsetMinutes(), filterRelevantLevels(), PIP_SIZE, toPips(), DailyPivotLike, resolveStructureStartTime(), ALL_DAYS, attachRangeExtremes() (+46 more)

### Community 94 - "MCP-Server: Tiefere Referenz"
Cohesion: 0.20
Nodes (10): MCP Auth & Table Permissions, Backfill Scripts, Candle Archive (forex_candles), MCP Server Deployment (Supabase Edge Function), MCP-Server: Tiefere Referenz, get_forex_rsi / get_forex_ema Tools, Single Deno Copy (Dual-Copy Removed), Trade-Journal Write Tools (tools/trades.ts) (+2 more)

### Community 96 - "orderBlocks.js"
Cohesion: 0.13
Nodes (9): drawIconLabel(), canShowLabels(), MIN_PIXELS_PER_HOUR_FOR_LABELS, MIN_PIXELS_PER_HOUR_FOR_LABELS_INTRADAY, OB_ZONE_KEYS, positionsBox(), ZoneRenderer, DivergenceLineRenderer (+1 more)

### Community 97 - "drMerkmale.py"
Cohesion: 0.06
Nodes (50): ev(), mess_gedeckelt(), -> (Quote, Treffer, unentschieden). Unentschieden = weder Ziel noch Stopp…, Erwartungswert in R ueber die ENTSCHIEDENEN DRs (Treffer oder Stopp, nicht…, dr_schluessel(), gruppiere_drs(), handelsstunden(), lade_bekannte_level() (+42 more)

### Community 98 - "NewsModal.vue"
Cohesion: 0.14
Nodes (18): CURRENCIES, emit, LIST_FORMATTER, newCurrency, newDateTime, newTitle, saving, submit() (+10 more)

### Community 99 - "trade_evidence Table (Dual-Level, Confirmation/Confluence)"
Cohesion: 0.18
Nodes (13): dealing_ranges Table, trade_evidence Table (Dual-Level, Confirmation/Confluence), trade_partial_exits Table, trade_positions Table, trade_targets Table, Confirmation/Confluence/Anti-Confluence Categories, trading repo trade-from-poi.md (Confirmation/Confluence/Anti-Confluence Definition), Anti-Confluences Snapshot Feature (Planned) (+5 more)

### Community 100 - "src/orderBlockDetection.js"
Cohesion: 0.16
Nodes (14): HTF_FOREX_MIN_GAP_PIPS Constant, LOWER_TF_MIN_GAP_PIPS Constant, Pip-/Pixel-Schwellwerte Übersicht, MIN_PIXELS_PER_HOUR_FOR_LABELS Constants, PIP_SIZE Constant, RANGE_FIB_MIN_PP_DISTANCE_PIPS Constant, TRADE_SETUP_LS_MAX_DISTANCE_M5 Constant, poi-watcher 4H+1H OB-Zonen-Wächter Edge Function (+6 more)

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
Cohesion: 0.08
Nodes (23): refreshMarketStructure(), Candle, ArrowPaneView, ArrowPrimitive, ArrowRenderer, collectFibLevels(), collectH1LqLevels(), collectNestedChain() (+15 more)

### Community 106 - "Lana-Fehlerdiagnose"
Cohesion: 0.33
Nodes (5): Ablauf, Ergebnis, Lana-Fehlerdiagnose, Routing: Diagnose → typischer Fix-Ort, Wann aufrufen

### Community 107 - "Agent Skills Pro Notes"
Cohesion: 0.29
Nodes (7): allowed-tools Skill Config, Context-free Scripts in Skills, Agent Skills Pro Notes, Progressive Disclosure in Skills, Skill Sharing & Troubleshooting, Skills Embedded in Subagents, Skills vs CLAUDE.md vs Hooks vs Subagents

### Community 108 - "supabaseClient.js"
Cohesion: 0.20
Nodes (8): ALARM_TYPES, fetchDailyStructurePivots(), fetchLiquidityLevelsHtf(), fetchObZones(), supabase, { data: dbDailyPivots }, { data: dbLiquidityLevelsHtf }, { data: dbObZones }

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

### Community 116 - "PinPanel.vue"
Cohesion: 0.32
Nodes (7): emit, noteSaveTimers, onEntryClick(), onNoteInput(), OUTCOME_LABEL, props, rows

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
Cohesion: 0.17
Nodes (14): fetchLiveForexCandles(), fetchLiveForexCandlesOnce(), isRetryable(), ALL_BARS, backfillOne(), Bar, BARS, INSTRUMENTS (+6 more)

### Community 122 - "marketStructureAnalysis.test.js"
Cohesion: 0.22
Nodes (8): pivot1, pivot2, pivot3, pivot4, pivot5, pivot6, pivot7, pivot8

### Community 124 - "router.js"
Cohesion: 0.27
Nodes (7): fetchAlarmSettings(), setAlarmEnabled(), router, alarms, errorText, loading, toggle()

### Community 125 - "Handbuch-Check"
Cohesion: 0.40
Nodes (4): Ergebnis, Handbuch-Check, Prüfpunkte, Wann aufrufen

### Community 131 - "dataSnapshot.ts"
Cohesion: 0.23
Nodes (11): buildLevel(), detectLiquidityLevels(), isDownFractal(), isUpFractal(), LiquidityLevel, DEFAULT_TRADE_SETUP_PARAMS, DetectedTradeSetup, TRADE_SETUP_H1_FRACTAL_PERIOD (+3 more)

### Community 132 - "App.vue"
Cohesion: 0.15
Nodes (13): { activeLabels, isActive }, isFresh, { lastSuccessAt }, lastUpdateText, now, showClaudeAnnotationsModal, showDataExport, statusDotClass (+5 more)

### Community 133 - "marketStructureAnalysisInnerPivots.test.js"
Cohesion: 0.25
Nodes (7): h1Candles, p2Pivot3, p2Pivot4, p2Pivot5, pivot1, pivot2, pivot3

### Community 134 - "findTargets.js"
Cohesion: 0.21
Nodes (10): MAX_TARGET_DISTANCE_PIPS Constant, find_targets Target-Candidate Algorithm Design, Plan: find_targets Algorithmus, TSC-Neuaufbau Precondition, mergedCandidates, DEFAULT_LIQUIDITY_TARGET_LIMIT, DEFAULT_OB_TARGET_LIMIT, findNearestLiquidityTargets() (+2 more)

### Community 135 - "Dealing Range anlegen"
Cohesion: 0.50
Nodes (3): Ablauf, Dealing Range anlegen, Warum ein eigener Skill (nicht nur eine Doku-Zeile)

### Community 136 - ".codex/hooks/lana-git-pull.cjs"
Cohesion: 0.50
Nodes (3): { execFileSync }, path, TRADING_REPO

### Community 138 - "tradingSchedules.js"
Cohesion: 0.19
Nodes (12): minutesToTimeInput(), timeInputToMinutes(), addWindow(), cloneWindows(), DEFAULT_SCHEDULES, EMPTY_WINDOWS, loadInitial(), removeWindow() (+4 more)

### Community 139 - "liquidity.js"
Cohesion: 0.14
Nodes (27): AgeTier, classifyAge(), ageReferenceTime(), businessSecondsBetween(), formatAge(), ageSuffix(), bullBearLabelSide(), formatLiquidityLevelLabel() (+19 more)

### Community 141 - "findAntiConfluences.js"
Cohesion: 0.47
Nodes (9): byDistance(), findAntiConfluenceCandidates(), findAntiConfluenceDivergenceCandidates(), findAntiConfluenceObCandidates(), findAntiConfluenceSweepCandidates(), findInvalidationObCandidates(), inBand(), MAX_HELD_OB_AGE_DAYS (+1 more)

### Community 144 - "fxcmCandles.ts"
Cohesion: 0.22
Nodes (5): headers, fetchForexBatch(), FxcmCandle, PERIODS, readFxcmCandles()

### Community 147 - "marketStructureAnalysisFib.test.js"
Cohesion: 0.29
Nodes (6): RANGE_FIB_MIN_PP_DISTANCE_PIPS, confirmBreak, confirmedUptrendState(), originHigh, originLow, pullback

### Community 148 - "applyMarketStructurePivot"
Cohesion: 0.13
Nodes (20): applyMarketStructurePivot(), initMarketStructureState(), chochConfirmedState(), confirmBreak, confirmedUptrendState(), originHigh, originLow, pullback (+12 more)

### Community 149 - "liveTouch.ts"
Cohesion: 0.39
Nodes (6): findLevelTouch(), findZoneTouch(), levelTouchPrice(), LIVE_TOUCH_WINDOW_SEC, recentCandles(), zoneTouchPrice()

### Community 153 - "usePriceChartClaudeAnnotations"
Cohesion: 0.40
Nodes (3): renderClaudeAnnotations(), usePriceChartClaudeAnnotations(), refresh()

### Community 154 - "usePriceChartMarketStructure"
Cohesion: 0.29
Nodes (6): findClickedFibLevel(), usePriceChartMarketStructure(), computeRangesPivotsAndMetadata(), computeRangesPivotsFor(), fetchRangesCandles(), getCurrentFibLevels()

### Community 156 - "validate.js"
Cohesion: 0.38
Nodes (4): SECONDS, validateCandles(), candle, closedAt

## Ambiguous Edges - Review These
- `Trading-Steps-Ablauf Diagram` → `calc_rr Tool Idea (Deterministic RR Calc)`  [AMBIGUOUS]
  docs/steerabilty-vs-wrong-ai-outputs.md · relation: references

## Knowledge Gaps
- **1162 isolated node(s):** `{ execFileSync }`, `path`, `TRADING_REPO`, `{ execFileSync }`, `path` (+1157 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1427 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Trading-Steps-Ablauf Diagram` and `calc_rr Tool Idea (Deterministic RR Calc)`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **Why does `businessSecondsBetween()` connect `_shared/ageTier.ts` to `biasCheck.ts`, `tradeSetup.ts`, `dataExport.ts`, `dealingRangeLoop.ts`?**
  _High betweenness centrality (0.088) - this node is a cross-community bridge._
- **Why does `Pivot` connect `marketStructureRendering.ts` to `gbp_h1_uptrend_protected_low_gebrochen.ts`, `gbp_h1_uptrend_uptrend_break_of_structure_und_trendumkehr.ts`, `pivotMarkers.ts`, `gbp_h1_uptrend_mit_LQ_sweep_LONG_SETUP.ts`, `gbp_h1_uptrend_mit_inner_structure.ts`, `tdd_mit_claude.ts`, `gbp_h1_uptrend.ts`, `tradeSetupCockpit.ts`, `src/marketStructureAnalysis.ts`?**
  _High betweenness centrality (0.056) - this node is a cross-community bridge._
- **Why does `marketStructureAnalysis Developer Notes` connect `Vegapunk Slimming Results (-86%)` to `fachdoku-router/SKILL.md`, `marketStructureAnalysis Rules Overview`?**
  _High betweenness centrality (0.053) - this node is a cross-community bridge._
- **What connects `{ execFileSync }`, `path`, `TRADING_REPO` to the rest of the system?**
  _1162 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Dashboard.vue` be split into smaller, more focused modules?**
  _Cohesion score 0.015307877536979705 - nodes in this community are weakly interconnected._
- **Should `gbp_h1_uptrend_uptrend_break_of_structure_und_trendumkehr.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0196078431372549 - nodes in this community are weakly interconnected._