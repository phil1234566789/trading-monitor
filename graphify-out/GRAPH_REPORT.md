# Graph Report - trading-monitor  (2026-09-06)

## Corpus Check
- 406 files · ~426,902 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2791 nodes · 5610 edges · 134 communities (123 shown, 9 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 109 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `1dbaa640`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Dashboard.vue
- gbp_h1_uptrend_uptrend_break_of_structure_und_trendumkehr.ts
- machineState.ts
- dataExport.ts
- PriceChart.vue
- gbp_h1_uptrend_mit_LQ_sweep_LONG_SETUP.ts
- gbp_h1_uptrend_mit_inner_structure.ts
- db.ts
- usePriceChartRsi.js
- marketStructureRendering.ts
- rsiDivergenceStats.ts
- DataExportModal.vue
- canShowLabels
- biasCheck.ts
- trading-monitor-mcp/index.ts
- TradeEditModal.vue
- package.json
- TargetPickerModal.vue
- LoopStatus.vue
- format.js
- newsEvents.js
- reads.ts
- tradeTargets.ts
- usePriceChartLiquidity.js
- ctrader/client.ts
- chartColors.js
- tradeIntake.js
- trades.js
- backfillTradeSetupOutcomes.ts
- priceChartObZones.js
- chartTimeUtils.js
- sessions.js
- gbp_h1_uptrend_protected_low_gebrochen.ts
- tradingAccounts.js
- Dealing-Range-Anlegen Skill
- dataExport.js
- tdd_mit_claude.ts
- dataSnapshot.ts
- priceChartHitTest.test.js
- TradeSetupCockpit.vue
- applyMarketStructurePivot
- tradeMarkers.js
- tradeSetup.js
- useClaudeAnnotations.js
- trading-monitor-mcp/marketStructureAnalysis.ts
- /task do Mode
- pinContext.js
- Laniakea Persona Command (/l)
- Plan: Sehr Große Dateien Refactoren (PriceChart.vue)
- clipReplay
- pivotMarkers.ts
- newsMarkers.js
- NewsModal.vue
- gbp_h1_uptrend.ts
- tradeSetupCockpit.ts
- snapToBarTime
- src/marketStructureAnalysis.ts
- trading-monitor-mcp/pretradeGates.ts
- pinEntryVisible
- orderBlocks.ts
- fetchForexCandles
- Plan: POI-Strategie-Findung, Backtesting & Trade-Notifications
- liquidity.js
- poi-watcher/index.ts
- State Machine for Lana's Trading Flow
- compilerOptions
- usePriceChartTradeSetups.js
- claudeAnnotations.js
- usePriceChartMarketStructure
- MetadataPanel.vue
- Plan: Forex-Chart-Objekte Datengrundlage
- Protokoll.vue
- tradingSchedules.js
- src/sessionOccurrences.js
- forexCandles.js
- marketStructureAnalysis Rules Overview
- SessionBandPaneView
- TradingFlow.vue
- clearArmStatesExcept
- Fachdoku-Router Skill
- trade_evidence Table (Dual-Level, Confirmation/Confluence)
- Dealing-Range-Loop Diagram
- debugMetadata.js
- App.vue
- AI Capabilities and Limitations Notes
- Vegapunk Slimming Results (-86%)
- tradeEvidence.ts
- router.js
- PinAddPopup.vue
- twelvedata/client.ts
- supabaseClient.js
- dealingRangeLoop.ts
- cssColor
- marketStructureAnalysisNestedNestedChoch.test.js
- MCP-Server: Tiefere Referenz
- refreshTscRange
- backfillObZones.ts
- marketStructureAnalysis.test.js
- Konten.vue
- updateDealingRange
- PinPanel.vue
- AntiConfluencePickerModal.vue
- applyInnerMarketStructurePivot
- JsonTree.vue
- marketStructureAnalysisInnerPivots.test.js
- marketStructureAnalysisLqSweep.test.js
- ZoneRenderer
- Agent Skills Pro Notes
- News Events Seeding Notes
- fetch-trend-fixture.mjs
- ContextMenu.vue
- ctraderCandles.js
- marketStructureAnalysisFib.test.js
- Debug-Metadata-Panel Notes
- AI Failure as Property Collision
- MCP Advanced Topics Notes
- Pip-/Pixel-Schwellwerte Übersicht
- vite.config.js
- lana-git-pull.cjs
- localStorage-first / Supabase-Source-of-Truth Pattern
- .mcp.json
- src/pipConfig.js
- detectLiquidityLevels
- trading-monitor index.html Entry
- SessionBandRenderer
- Trading-Monitor Project Overview (CLAUDE.md)
- trendIndicator.gbpusd-downtrend.test.js
- Claude Code Hooks Documentation Pointers
- mcp-server/src/scripts/backfillObZones.ts
- toDatetimeLocal
- useTabScopedRef
- fetchTradeSetupForCockpit

## God Nodes (most connected - your core abstractions)
1. `cssColor()` - 34 edges
2. `berlinDateStrFor()` - 33 edges
3. `fetchForexCandles()` - 31 edges
4. `pricePrecisionForInstrument()` - 30 edges
5. `fmtPrice()` - 28 edges
6. `clipReplay()` - 27 edges
7. `berlinDateTimeStrFor()` - 26 edges
8. `lineWidth()` - 24 edges
9. `refreshChart()` - 24 edges
10. `logDecision()` - 23 edges

## Surprising Connections (you probably didn't know these)
- `Archive-First Auto-Reload Pattern (Tried, Then Reverted)` --semantically_similar_to--> `Persisted Forex Candle Archive (forex_candles Pilot)`  [INFERRED] [semantically similar]
  PLAN-chart-objekte-forex.md → PLAN-notifications.md
- `Trading-Monitor Project Overview (CLAUDE.md)` --conceptually_related_to--> `BTC Scope Removal from Chart-Objects Plan`  [INFERRED]
  CLAUDE.md → PLAN-chart-objekte-forex.md
- `/task do Mode` --semantically_similar_to--> `milk-city Task Status Convention`  [INFERRED] [semantically similar]
  .claude/commands/task.md → CLAUDE.md
- `Laniakea milk-city Task-Status Rule` --semantically_similar_to--> `milk-city Task Status Convention`  [INFERRED] [semantically similar]
  .claude/commands/l.md → CLAUDE.md
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

## Communities (134 total, 9 thin omitted)

### Community 0 - "Dashboard.vue"
Cohesion: 0.02
Nodes (116): useSessionStorageRef(), fetchDailyStructurePivots(), fetchLiquidityLevelsHtf(), fetchObZones(), antiConfluenceAddTrade, anyArmStateActive, ARM_STATES, closeTradeEditModal() (+108 more)

### Community 1 - "gbp_h1_uptrend_uptrend_break_of_structure_und_trendumkehr.ts"
Cohesion: 0.02
Nodes (101): candlesAroundBOS, candlesAroundBreak, p2Pivot1, p2Pivot10, p2Pivot11, p2Pivot12, p2Pivot13, p2Pivot14 (+93 more)

### Community 2 - "machineState.ts"
Cohesion: 0.08
Nodes (56): berlinDateStrFor(), berlinDateTimeStrFor(), getNewsEvents(), getOpenOppositeDealingRanges(), getTradingSchedule(), computeEvidenceScore(), EvidenceScoreBreakdownEntry, EvidenceScoreInput (+48 more)

### Community 3 - "dataExport.ts"
Cohesion: 0.06
Nodes (67): filterRelevantLevels(), LIQUIDITY_MAX_RELEVANT, berlinOffsetMinutes(), applyAsOf(), applyAsOfZones(), dropLowerTfDuplicates(), fetchAllRows(), filterRelevantRows() (+59 more)

### Community 4 - "PriceChart.vue"
Cohesion: 0.03
Nodes (83): activeMetadataSnapshot, allCandles, antiConfluencePickerCurrentPrice, antiConfluencePickerDivergenceCandidates, antiConfluencePickerHoveredLiquidityKey, antiConfluencePickerHoveredObKey, antiConfluencePickerInvalidationObCandidates, antiConfluencePickerObCandidates (+75 more)

### Community 5 - "gbp_h1_uptrend_mit_LQ_sweep_LONG_SETUP.ts"
Cohesion: 0.03
Nodes (60): p2Pivot1, p2Pivot10, p2Pivot11, p2Pivot12, p2Pivot13, p2Pivot14, p2Pivot15, p2Pivot16 (+52 more)

### Community 6 - "gbp_h1_uptrend_mit_inner_structure.ts"
Cohesion: 0.04
Nodes (55): p2Pivot1, p2Pivot10, p2Pivot11, p2Pivot12, p2Pivot13, p2Pivot14, p2Pivot15, p2Pivot16 (+47 more)

### Community 7 - "db.ts"
Cohesion: 0.06
Nodes (61): InducementClass, addPinEntry(), addPinM5LiquidityEntry(), addPinM5ObEntry(), addPinRsiDivergenceEntry(), addTradeConfirmation(), AddTradeConfirmationArgs, addTradePosition() (+53 more)

### Community 8 - "usePriceChartRsi.js"
Cohesion: 0.09
Nodes (37): nativeLineWidth(), usePriceChartRsi(), applyColorOptions(), applyLineWidthOptions(), create(), refreshEma(), refreshRsi(), computeEma() (+29 more)

### Community 9 - "marketStructureRendering.ts"
Cohesion: 0.06
Nodes (26): refreshMarketStructure(), bullBearLabelSide(), Candle, ArrowPaneView, ArrowPrimitive, ArrowRenderer, collectFibLevels(), collectH1LqLevels() (+18 more)

### Community 10 - "rsiDivergenceStats.ts"
Cohesion: 0.09
Nodes (38): buildDivergenceEntry(), collectDivergenceHistory(), computeRsi(), DEFAULT_DIVERGENCE_FRACTAL_PERIOD, DEFAULT_DIVERGENCE_HISTORY_COUNT, DEFAULT_DIVERGENCE_LOOKBACK_BARS, DEFAULT_RSI_PERIOD, detectRsiDivergence() (+30 more)

### Community 11 - "DataExportModal.vue"
Cohesion: 0.09
Nodes (22): asset, copied, copyResult(), currentSymbol, dateStr, error, generate(), loading (+14 more)

### Community 12 - "canShowLabels"
Cohesion: 0.09
Nodes (10): drawIconLabel(), canShowLabels(), MIN_PIXELS_PER_HOUR_FOR_LABELS, MIN_PIXELS_PER_HOUR_FOR_LABELS_INTRADAY, LiquidityLineRenderer, positionsBox(), DivergenceLinePaneView, DivergenceLinePrimitive (+2 more)

### Community 13 - "biasCheck.ts"
Cohesion: 0.15
Nodes (23): buildPendingDecisions(), determineTrendForce(), findIntermediateLevel(), FindIntermediateLevelArgs, IntermediateLevelCandidate, isSpreadHourPivot(), PendingDecision, TrendForceConfidence (+15 more)

### Community 14 - "trading-monitor-mcp/index.ts"
Cohesion: 0.14
Nodes (17): postChartAnnotations(), buildServer(), MCP_TOKEN, toPips(), ANNOTATION_SCHEMA, DRAWING_GROUP_SCHEMA, registerAnnotationTools(), VALID_TYPES (+9 more)

### Community 15 - "TradeEditModal.vue"
Cohesion: 0.06
Nodes (31): commission, entryPrice, entryTimeInput, exitPrice, exitTimeInput, instrumentMismatch, invalidation, invalidationJustSaved (+23 more)

### Community 16 - "package.json"
Cohesion: 0.06
Nodes (33): lightweight-charts, mermaid, dependencies, lightweight-charts, mermaid, @supabase/supabase-js, vue, vue-router (+25 more)

### Community 17 - "TargetPickerModal.vue"
Cohesion: 0.16
Nodes (14): MAX_TARGET_DISTANCE_PIPS Constant, find_targets Target-Candidate Algorithm Design, Plan: find_targets Algorithmus, TSC-Neuaufbau Precondition, candidateLabel(), emit, mergedCandidates, precision (+6 more)

### Community 18 - "LoopStatus.vue"
Cohesion: 0.07
Nodes (21): fetchLoopStateHistory(), fetchLoopStatesForDate(), LOOP_INSTRUMENTS, rowToLoopState(), fetchStateMachineLog(), rowToDecision(), activeByInstrument, { data } (+13 more)

### Community 19 - "format.js"
Cohesion: 0.10
Nodes (17): emit, OUTCOME_LABEL, precision, props, sortedDivergences, stats, emit, lessonBadges() (+9 more)

### Community 20 - "newsEvents.js"
Cohesion: 0.24
Nodes (11): usePriceChartCockpit(), refreshCockpit(), usePriceChartSessionsAndNews(), refreshNewsMarkers(), refreshSessions(), currentNewsNoGo(), INSTRUMENT_CURRENCIES, NEWS_NOGO_WINDOW_MINUTES (+3 more)

### Community 21 - "reads.ts"
Cohesion: 0.10
Nodes (33): berlinDayRangeUtcMs(), DATE_FORMATTER, OFFSET_FORMATTER, TIME_FORMATTER, getForexCandlesArchive(), getJournal(), getTradeSetups(), getTradeSetupWinrate() (+25 more)

### Community 22 - "tradeTargets.ts"
Cohesion: 0.21
Nodes (10): AgeTier, targetLabel(), targetLabel(), formatTargetLabel(), KIND_LABEL, kindLabel(), targetAgeSeconds(), targetAgeTier() (+2 more)

### Community 23 - "usePriceChartLiquidity.js"
Cohesion: 0.17
Nodes (15): usePriceChartLiquidity(), refresh(), liquidityLevelNaturalKey(), renderLiquidityLevels(), LIQUIDITY_FRACTAL_PERIOD, LIQUIDITY_MAX_RELEVANT, selectRelevantHtfLevels(), LQ_RELEVANCE (+7 more)

### Community 24 - "ctrader/client.ts"
Cohesion: 0.08
Nodes (37): CORS_HEADERS, CORS_HEADERS, ExistingPivotRow, INSTRUMENTS, CORS_HEADERS, PERIOD_MAP, PERSISTABLE_BARS, persistIfArchivable() (+29 more)

### Community 25 - "chartColors.js"
Cohesion: 0.08
Nodes (18): chartColors, DEFAULT_CHART_COLORS, resetChartColors(), chartLineWidths, DEFAULT_CHART_LINE_WIDTHS, resetChartLineWidths(), collapsed, emit (+10 more)

### Community 26 - "tradeIntake.js"
Cohesion: 0.11
Nodes (32): direction, emit, entryPrice, errorMsg, levels, precision, props, reasoning (+24 more)

### Community 27 - "trades.js"
Cohesion: 0.15
Nodes (14): pnlClass, props, stats, winrateClass, fmtR(), computeTradeStats(), fetchActiveTscRangeId(), fetchDealingRangeCockpit() (+6 more)

### Community 28 - "backfillTradeSetupOutcomes.ts"
Cohesion: 0.13
Nodes (27): classifyInducementAge(), classifyOutcome(), computeSlTp(), computeSweepAgeHours(), deriveEntryInvalidation(), inducementAgeRange(), MAJOR_INDUCEMENT_MIN_HOURS, MAX_SL_PIPS (+19 more)

### Community 29 - "priceChartObZones.js"
Cohesion: 0.15
Nodes (25): emit, obZoneCtx(), onAntiConfluencePickerHover(), onAntiConfluencePickerSelect(), onTargetPickerHover(), onTargetPickerSelect(), openAntiConfluencePicker(), openTargetPicker() (+17 more)

### Community 30 - "chartTimeUtils.js"
Cohesion: 0.12
Nodes (20): computeNextReplayTime(), formatAge(), isTimeCovered(), mergeRecent(), nextCandleAfter(), replayFetchToMs(), jumpToDivergence(), jumpToPin() (+12 more)

### Community 31 - "sessions.js"
Cohesion: 0.14
Nodes (16): emit, instrumentSessions, props, WEEKDAY_DISPLAY_ORDER, addSession(), currentSessionDanger(), DANGER_LEVELS, DANGER_SEVERITY (+8 more)

### Community 32 - "gbp_h1_uptrend_protected_low_gebrochen.ts"
Cohesion: 0.08
Nodes (25): ClosedRange, MarketStructureState, PivotBase, PivotHigh, PivotLow, PivotTouched, PivotTypeAll, PivotUntouched (+17 more)

### Community 33 - "tradingAccounts.js"
Cohesion: 0.17
Nodes (9): currentLabel, open, selectedAccount, wrapperRef, cache, useLocalStorageRef(), accounts, ALL_ACCOUNTS_ID (+1 more)

### Community 34 - "Dealing-Range-Anlegen Skill"
Cohesion: 0.18
Nodes (12): kind=pivot = Liquidity-Sweep-Only Semantics, Dealing-Range-Anlegen Skill, milk-city Task: Confluence-Tracking bei Dealing Ranges, trading/liquidität.md (Liquiditäts-Sweep-Mechanismus), Diagnose-to-Fix Routing Table, Lana-Fehlerdiagnose Skill, docs/steerabilty-vs-wrong-ai-outputs.md, add_trade_confirmation MCP Tool (+4 more)

### Community 35 - "dataExport.js"
Cohesion: 0.14
Nodes (25): trendChain, berlinDayRangeUtcMs(), berlinOffsetMinutes(), buildDataExport(), compute1hStructureState(), computeExportTimeframeData(), computeLiquidityLevelsForExport(), computeObZonesForExport() (+17 more)

### Community 36 - "tdd_mit_claude.ts"
Cohesion: 0.08
Nodes (24): nextPivot1, nextPivot10, nextPivot11, nextPivot2, nextPivot3, nextPivot4, nextPivot5, nextPivot6 (+16 more)

### Community 37 - "dataSnapshot.ts"
Cohesion: 0.14
Nodes (24): LiquidityLevel, isBoxInvalidated(), closesBeyondLevel(), DEFAULT_TRADE_SETUP_PARAMS, DetectedTradeSetup, detectTradeSetup(), findBestLsMatch(), findFirstSetupObAfter() (+16 more)

### Community 38 - "priceChartHitTest.test.js"
Cohesion: 0.12
Nodes (19): findClickedDivergence(), findClickedLiquidityLevel(), findClickedOBZone(), findClickedSetup(), findClickedTarget(), DIVERGENCE_CLICK_TOLERANCE_PX, FIB_TICK_CLICK_TOLERANCE_PX, findNearbyPinCandidates() (+11 more)

### Community 39 - "TradeSetupCockpit.vue"
Cohesion: 0.08
Nodes (24): emit, emit, accentStyle, antiConfluences, canTransfer, confirmations, confluences, dateLabel (+16 more)

### Community 40 - "applyMarketStructurePivot"
Cohesion: 0.13
Nodes (20): applyMarketStructurePivot(), initMarketStructureState(), chochConfirmedState(), confirmBreak, confirmedUptrendState(), originHigh, originLow, pullback (+12 more)

### Community 41 - "tradeMarkers.js"
Cohesion: 0.13
Nodes (10): drawEntryPoint(), drawExitPoint(), drawHaloRing(), drawLabel(), drawTick(), renderTradeMarkers(), TradeMarkerPaneView, TradeMarkerPrimitive (+2 more)

### Community 42 - "tradeSetup.js"
Cohesion: 0.14
Nodes (16): Two Runtimes, One Algorithm Set (Deliberate Duplication), computeTradeSetups(), closesBeyondLevel(), detectSetupObs(), detectTradeSetups(), findAllProtectedFractals(), findBestLsMatch(), findFirstSetupObAfter() (+8 more)

### Community 43 - "useClaudeAnnotations.js"
Cohesion: 0.09
Nodes (29): addClaudeAnnotationDrawing(), fetchClaudeAnnotations(), removeClaudeAnnotationDrawing(), setClaudeAnnotationDrawingVisible(), applyText(), emit, error, { instrument, dateStr, drawings, loading, add, remove, setDrawingVisible } (+21 more)

### Community 44 - "trading-monitor-mcp/marketStructureAnalysis.ts"
Cohesion: 0.11
Nodes (38): buildLevel(), detectLiquidityLevels(), isDownFractal(), isUpFractal(), LIQUIDITY_FRACTAL_PERIOD, LiquidityLevel, advanceNestedTrend(), advanceNestedTrendInner() (+30 more)

### Community 45 - "/task do Mode"
Cohesion: 0.38
Nodes (7): Laniakea milk-city Task-Status Rule, /task Default Data-Maintenance Mode, /task do Mode, /task new Mode, /task refine Mode, /task Command Router, milk-city Task Status Convention

### Community 46 - "pinContext.js"
Cohesion: 0.16
Nodes (21): addPinEntry(), addPinM5LiquidityEntry(), addPinM5ObEntry(), addPinRsiDivergenceEntry(), addPinTscSetupEntry(), fetchPinContext(), REF_COLUMN, removePinEntry() (+13 more)

### Community 47 - "Laniakea Persona Command (/l)"
Cohesion: 0.11
Nodes (21): 00-trading-steps.md Entry Point, Laniakea Persona Command (/l), trading/claude-project-instructions.md, trading-runs Relative Link Path Convention, 00-trading-steps.md#visuelle-antworten-chart-annotationen, 06-anti-confluence.md, glossar.md Consistency Check, kontext-ausführung.md (+13 more)

### Community 48 - "Plan: Sehr Große Dateien Refactoren (PriceChart.vue)"
Cohesion: 0.18
Nodes (11): Keep Codebase Clean / ~1000 Line Backstop Convention, liquidity_levels Table, Pip-Distance Server-Side Query Filter, Plan: Sehr Große Dateien Refactoren (PriceChart.vue), Phase 1: Candle-/Zeit-Helfer -> priceChartCandles.js, Phase 3: Liquidity-Merge -> priceChartLiquidity.js, Phase 4: RSI-Divergenz-Pin-Merge, Phase 5: Klick-Hittest-Funktionen (priceChartHitTest.js) (+3 more)

### Community 49 - "clipReplay"
Cohesion: 0.15
Nodes (26): tradesVisibleForCandles(), buildActiveMetadataSnapshotInternal(), clearTradeSetupFocus(), clipReplay(), computeTradeSetupsInternal(), focusTradeSetup(), loadTradeSetupM5(), refreshChart() (+18 more)

### Community 50 - "pivotMarkers.ts"
Cohesion: 0.14
Nodes (7): Candle, PivotMarkerGroup, PivotMarkerPaneView, PivotMarkerPrimitive, PivotMarkerRenderer, RenderOptions, renderPivotMarkers()

### Community 51 - "newsMarkers.js"
Cohesion: 0.13
Nodes (10): DAY_KEY_FORMATTER, extrapolatedX(), formatEventLabel(), isSameBerlinDay(), NewsMarkerPaneView, NewsMarkerPrimitive, NewsMarkerRenderer, renderNewsMarkers() (+2 more)

### Community 52 - "NewsModal.vue"
Cohesion: 0.18
Nodes (11): CURRENCIES, emit, LIST_FORMATTER, newCurrency, newDateTime, newTitle, saving, submit() (+3 more)

### Community 53 - "gbp_h1_uptrend.ts"
Cohesion: 0.10
Nodes (20): pivot1, pivot10, pivot11, pivot12, pivot13, pivot2, pivot3, pivot4 (+12 more)

### Community 54 - "tradeSetupCockpit.ts"
Cohesion: 0.13
Nodes (18): trendChainDisplay, RangeTrend, ANTI_CONFLUENCE_COLOR, ANTI_CONFLUENCE_THRESHOLD, AntiConfluence, CockpitState, computeAntiConfluences(), computeCockpitState() (+10 more)

### Community 55 - "snapToBarTime"
Cohesion: 0.10
Nodes (9): snapToBarTime(), usePriceChartDailyPivots(), refresh(), DailyPivotMarkerPaneView, DailyPivotMarkerPrimitive, DailyPivotMarkerRenderer, drawTriangle(), renderDailyPivotMarkers() (+1 more)

### Community 56 - "src/marketStructureAnalysis.ts"
Cohesion: 0.27
Nodes (17): advanceNestedTrend(), applyInnerMarketStructurePivotCore(), applyMarketStructurePivotCore(), buildMarketStructureState(), closesAboveOldHigh(), closesBelowLevel(), computeRangesPivots(), evaluateConfirmingBreak() (+9 more)

### Community 57 - "trading-monitor-mcp/pretradeGates.ts"
Cohesion: 0.17
Nodes (17): BERLIN_HM_FORMATTER, BERLIN_WEEKDAY_FORMATTER, berlinWeekdayAndMinutes(), isWithinTradingWindows(), TradingWindows, WeekdayGroup, ClassifiedNewsEvent, evaluateNewsGate() (+9 more)

### Community 58 - "pinEntryVisible"
Cohesion: 0.13
Nodes (19): liquidityLevelEntryNaturalKey(), m5LiquidityEntryNaturalKey(), obZoneEntryNaturalKey(), barSecondsForTimeframeCi(), hoveredPinLiquidityLevelKey, hoveredPinObZoneKey, onSelectPin(), pinEntryVisible() (+11 more)

### Community 59 - "orderBlocks.ts"
Cohesion: 0.14
Nodes (14): buildLevel(), detectLiquidityLevels(), isDownFractal(), isUpFractal(), Candle, detectOrderBlocks(), HTF_FOREX_LABELS, HTF_FOREX_MIN_GAP_PIPS (+6 more)

### Community 60 - "fetchForexCandles"
Cohesion: 0.18
Nodes (19): getForexCandlesArchiveUpTo(), byDistance(), findAntiConfluenceCandidates(), findAntiConfluenceDivergenceCandidates(), findAntiConfluenceObCandidates(), findAntiConfluenceSweepCandidates(), findInvalidationObCandidates(), inBand() (+11 more)

### Community 61 - "Plan: POI-Strategie-Findung, Backtesting & Trade-Notifications"
Cohesion: 0.19
Nodes (13): daily_structure_pivots Table, forex_candles Table, get_forex_candles_archive MCP Tool, BTC-USDT/OKX Complete Removal (2026-08-21), 1D-Periode-4-Pivot Market-Structure Startpoint (2026-08-30), Persisted Forex Candle Archive (forex_candles Pilot), Kronos LLM Forecast Entry-Filter Experiment (Shelved), Plan: POI-Strategie-Findung, Backtesting & Trade-Notifications (+5 more)

### Community 62 - "liquidity.js"
Cohesion: 0.42
Nodes (9): classifyAge(), ageReferenceTime(), businessSecondsBetween(), ageSuffix(), formatLiquidityLevelLabel(), formatLsLabel(), levelOptions(), LIQUIDITY_STYLE_KEYS (+1 more)

### Community 63 - "poi-watcher/index.ts"
Cohesion: 0.12
Nodes (14): fetchForexBatch(), fmt(), InstrumentConfig, INSTRUMENTS, isInWindows(), LiquidityLevelRow, localMinutesAndWeekday(), ObZoneRow (+6 more)

### Community 64 - "State Machine for Lana's Trading Flow"
Cohesion: 0.16
Nodes (17): Trading-Steps-Ablauf Diagram, Fall 4 -> Zurück zu Schritt 3, Two Permanent LLM-Only Steps (3 and 6), News-Pause Doesn't Replace the Cron, State Machine for Lana's Trading Flow, get_tsc_range Deliberately Not a Graph Node, Problem: GBPUSD 28.08.2026 Fall-4 Deviation Incident, trading-runs/*.md Loses Purpose (+9 more)

### Community 65 - "compilerOptions"
Cohesion: 0.12
Nodes (16): src/marketStructureAnalysis.ts, src/marketStructureRendering.ts, src/pivotMarkers.ts, test/tdd_mit_claude/ranges/tdd_mit_claude.ts, compilerOptions, allowJs, checkJs, esModuleInterop (+8 more)

### Community 66 - "usePriceChartTradeSetups.js"
Cohesion: 0.09
Nodes (29): REPLAY_LOOKAHEAD_SEC M1 Scaling Gotcha, REPLAY_LOOKAHEAD_SEC M1 Scaling Bug (Origin), cachedCandlesUpTo(), cacheKey(), fetchCandlesCached(), getCachedCandles(), mergeCandles(), openDb() (+21 more)

### Community 67 - "claudeAnnotations.js"
Cohesion: 0.09
Nodes (15): ANNOTATION_COLOR, annotationAnchorPoint(), AnnotationsPaneView, AnnotationsPrimitive, AnnotationsRenderer, parseAnnotations(), renderClaudeAnnotations(), resolveLabelPlacements() (+7 more)

### Community 68 - "usePriceChartMarketStructure"
Cohesion: 0.12
Nodes (16): findClickedFibLevel(), loadRangesCandles(), rangesNeedsData(), refreshRangesPollingState(), scheduleNextPoll(), scheduleNextRangesPoll(), scheduleNextTradeSetupM5Poll(), sleep() (+8 more)

### Community 69 - "MetadataPanel.vue"
Cohesion: 0.24
Nodes (10): emit, height, left, onDrag(), panelEl, props, startDrag(), stopDrag() (+2 more)

### Community 70 - "Plan: Forex-Chart-Objekte Datengrundlage"
Cohesion: 0.21
Nodes (12): ob_zones Table, Archive-First Auto-Reload Pattern (Tried, Then Reverted), BTC Scope Removal from Chart-Objects Plan, OB-Zones Canonical FK Consolidation Approach, 1H/4H DB-Read vs Live-Recompute Decision, Four Independent OB Render Passes Problem, "Historische OBs"-Toggle Semantics, LQ-Sweep Relevance Criterion (Recent OR Pip-Range) (+4 more)

### Community 71 - "Protokoll.vue"
Cohesion: 0.31
Nodes (5): usePolledFetch(), lastSuccessAt, useStatusBar(), currentSymbol, SYMBOLS

### Community 72 - "tradingSchedules.js"
Cohesion: 0.19
Nodes (12): minutesToTimeInput(), timeInputToMinutes(), addWindow(), cloneWindows(), DEFAULT_SCHEDULES, EMPTY_WINDOWS, loadInitial(), removeWindow() (+4 more)

### Community 73 - "src/sessionOccurrences.js"
Cohesion: 0.24
Nodes (12): attachBonus(), ALL_DAYS, attachRangeExtremes(), bonusLabelForPivot(), buildSessionContextLookup(), contextForPivot(), daysOrAll(), localMidnightUtc() (+4 more)

### Community 74 - "forexCandles.js"
Cohesion: 0.27
Nodes (14): DB_ARCHIVED_BARS, fetchArchivedPage(), fetchArchivedUpTo(), fetchCandles(), fetchCandlesBatchOnce(), fetchCandlesOnce(), fetchInitialCandles(), fetchOlderCandles() (+6 more)

### Community 75 - "marketStructureAnalysis Rules Overview"
Cohesion: 0.22
Nodes (15): Arbitrary Nesting Depth (2026-08-09), Rendering Rules (renderMarketStructureAnalysis), marketStructureAnalysis Rules Overview, Docht-vs-Bruch (Wick vs Close-Break) Unification, Standalone Downtrend Detection/Invalidation, Fibonacci Level (computeFibLevels/collectFibLevels), Inner-Pivots (Period 2) Fast Pre-Detection, LQ-Sweep Classification (markLqSweeps) (+7 more)

### Community 77 - "TradingFlow.vue"
Cohesion: 0.11
Nodes (19): buildMermaidSource(), EDGES, mermaidEscape(), NODES, activeByInstrument, berlinTimeFormatter, currentLoop, currentNode (+11 more)

### Community 78 - "clearArmStatesExcept"
Cohesion: 0.15
Nodes (14): clearArmStatesExcept(), onAddAntiConfluenceRequest(), onAddConfirmationRequest(), onAddConfluenceRequest(), onAddRangeAntiConfluenceRequest(), onAddRangeConfirmationRequest(), onAddRangeConfluenceRequest(), onAddTargetRequest() (+6 more)

### Community 79 - "Fachdoku-Router Skill"
Cohesion: 0.15
Nodes (13): poi-watcher UTC Refresh-Tick Exception, Trading-Hours/Timezone Handling (Europe/Berlin), sessions Table, trading_schedules Table, docs/debug-metadata-panel.md, Fachdoku-Router Skill, src/marketStructureAnalysis.notes.md, docs/mcp-server.md (+5 more)

### Community 80 - "trade_evidence Table (Dual-Level, Confirmation/Confluence)"
Cohesion: 0.18
Nodes (13): dealing_ranges Table, trade_evidence Table (Dual-Level, Confirmation/Confluence), trade_partial_exits Table, trade_positions Table, trade_targets Table, Confirmation/Confluence/Anti-Confluence Categories, trading repo trade-from-poi.md (Confirmation/Confluence/Anti-Confluence Definition), Anti-Confluences Snapshot Feature (Planned) (+5 more)

### Community 81 - "Dealing-Range-Loop Diagram"
Cohesion: 0.15
Nodes (13): Dealing-Range-Loop Diagram, News-Blackout Mid-Loop Pause, Pin-Aufräumen after TSC-Link, Target Selection Remains Lana's Judgment, Pin Tools (tools/pins.ts), poi-watcher Alert-Cron Notes, poi-watcher 3-Tier Fetch Throttling, UTC-Hours Exception for Refresh Ticks (+5 more)

### Community 82 - "debugMetadata.js"
Cohesion: 0.39
Nodes (7): buildActiveMetadataSnapshot(), earliestRelevantTime(), hasActiveMetadata(), selectActiveMetadataSections(), ALL_OFF, BASE_CTX, SECTIONS

### Community 83 - "App.vue"
Cohesion: 0.11
Nodes (20): { activeLabels, isActive }, isFresh, { lastSuccessAt }, lastUpdateText, now, showClaudeAnnotationsModal, showDataExport, statusDotClass (+12 more)

### Community 84 - "AI Capabilities and Limitations Notes"
Cohesion: 0.17
Nodes (12): Delegation (4D Framework), Description (4D Framework), Diligence (4D Framework), Discernment (4D Framework), AI Fluency: 4D Framework Notes, calc_rr Tool Idea (Deterministic RR Calc), AI Capabilities and Limitations Notes, Letter-over-Spirit Failure Mode (+4 more)

### Community 85 - "Vegapunk Slimming Results (-86%)"
Cohesion: 0.18
Nodes (12): get_data_export Tool, Lana Test Data README, Chronological MCP Tool Call Sequence, Output-too-large Problem, Vegapunk Slimming Results (-86%), marketStructureAnalysis Developer Notes, File Separation: Algorithm vs Rendering, Rules Doc Maintenance Convention (+4 more)

### Community 86 - "tradeEvidence.ts"
Cohesion: 0.24
Nodes (10): confirmationLabel(), confirmationLabel(), evidenceAgeSeconds(), evidenceAgeTier(), formatEvidenceLabel(), KIND_LABEL, kindLabel(), TradeEvidence (+2 more)

### Community 87 - "router.js"
Cohesion: 0.24
Nodes (8): ALARM_TYPES, fetchAlarmSettings(), setAlarmEnabled(), router, alarms, errorText, loading, toggle()

### Community 88 - "PinAddPopup.vue"
Cohesion: 0.29
Nodes (9): clampedX, clampedY, confirm(), emit, note, onKeydown(), onWindowMousedown(), props (+1 more)

### Community 89 - "twelvedata/client.ts"
Cohesion: 0.21
Nodes (11): Candle, fetchCandles(), FetchCandlesOptions, INTERVAL_MAP, requestTimeSeries(), resample(), RESAMPLE_BUCKET_SEC, SUPPORTED_PERIODS (+3 more)

### Community 90 - "supabaseClient.js"
Cohesion: 0.29
Nodes (6): fetchAlarmLog(), fetchTouchedLiquidityLevels(), fetchTradeSetups(), fetchTouchedZones(), supabase, { data: rows, refresh }

### Community 91 - "dealingRangeLoop.ts"
Cohesion: 0.09
Nodes (30): checkFallFour(), CheckFallFourInput, computeWatchLevels(), FallFourResult, hasReaction(), HasReactionInput, hitCounterLevel(), hitTarget() (+22 more)

### Community 92 - "cssColor"
Cohesion: 0.13
Nodes (19): cssColor(), cssColorScaled(), hexToRgba(), lineWidth(), refreshInvalidationLinesInternal(), refreshTradeConfirmationLinksInternal(), refreshTradeTargetLinksInternal(), refreshRangesMarkers() (+11 more)

### Community 93 - "marketStructureAnalysisNestedNestedChoch.test.js"
Cohesion: 0.18
Nodes (10): confirmBreak, originHigh, originLow, pivotB, pivotC, pivotD, pivotE, pivotF (+2 more)

### Community 94 - "MCP-Server: Tiefere Referenz"
Cohesion: 0.20
Nodes (10): MCP Auth & Table Permissions, Backfill Scripts, Candle Archive (forex_candles), MCP Server Deployment (Supabase Edge Function), MCP-Server: Tiefere Referenz, get_forex_rsi / get_forex_ema Tools, Single Deno Copy (Dual-Copy Removed), Trade-Journal Write Tools (tools/trades.ts) (+2 more)

### Community 95 - "refreshTscRange"
Cohesion: 0.22
Nodes (11): onRemoveConfirmation(), onRemoveTarget(), removeConfirmationFromTrade(), removeTargetFromTrade(), onAddAntiConfluenceFromPicker(), onAddTargetFromPicker(), onTscRemoveAntiConfluence(), onTscRemoveConfirmation() (+3 more)

### Community 96 - "backfillObZones.ts"
Cohesion: 0.29
Nodes (9): backfillOne(), BAR_CONFIG, BARS, CandleRow, correctStaleZones(), fetchAllCandles(), fetchCorrectionCandidates(), INSTRUMENTS (+1 more)

### Community 97 - "marketStructureAnalysis.test.js"
Cohesion: 0.22
Nodes (8): pivot1, pivot2, pivot3, pivot4, pivot5, pivot6, pivot7, pivot8

### Community 98 - "Konten.vue"
Cohesion: 0.25
Nodes (10): accountsLoaded, createAccount(), deleteAccount(), updateAccount(), adding, newName, onAdd(), onDelete() (+2 more)

### Community 99 - "updateDealingRange"
Cohesion: 0.27
Nodes (10): emit, flashInvalidationSaved(), linkLesson(), onDelete(), save(), saveInvalidation(), toggleFavorite(), unlinkLesson() (+2 more)

### Community 100 - "PinPanel.vue"
Cohesion: 0.32
Nodes (7): emit, noteSaveTimers, onEntryClick(), onNoteInput(), OUTCOME_LABEL, props, rows

### Community 101 - "AntiConfluencePickerModal.vue"
Cohesion: 0.29
Nodes (6): candidateLabel(), candidatePrice(), emit, mergedCandidates, precision, props

### Community 102 - "applyInnerMarketStructurePivot"
Cohesion: 0.25
Nodes (6): advanceNestedTrendInner(), applyInnerMarketStructurePivot(), confirmBreak, originHigh, originLow, pullback

### Community 103 - "JsonTree.vue"
Cohesion: 0.25
Nodes (5): entries, expanded, isArray, isObject, props

### Community 104 - "marketStructureAnalysisInnerPivots.test.js"
Cohesion: 0.25
Nodes (7): h1Candles, p2Pivot3, p2Pivot4, p2Pivot5, pivot1, pivot2, pivot3

### Community 105 - "marketStructureAnalysisLqSweep.test.js"
Cohesion: 0.25
Nodes (7): baseState(), candles, levelRealBreak, levelSweep, levelUntouched, origin, triggerPivot

### Community 107 - "Agent Skills Pro Notes"
Cohesion: 0.29
Nodes (7): allowed-tools Skill Config, Context-free Scripts in Skills, Agent Skills Pro Notes, Progressive Disclosure in Skills, Skill Sharing & Troubleshooting, Skills Embedded in Subagents, Skills vs CLAUDE.md vs Hooks vs Subagents

### Community 108 - "News Events Seeding Notes"
Cohesion: 0.29
Nodes (7): News Events Seed Workflow (ForexFactory Screenshot), News Events Seeding Notes, news_events Consumption (No-Go + Chart Markers), TSC No-Gos and Anti-Confluences Notes, find_anti_confluences Mechanical Candidate Search, AntiConfluence.isNoGo Hard Block, Anti-Confluence Zone Rule

### Community 109 - "fetch-trend-fixture.mjs"
Cohesion: 0.38
Nodes (5): fetchAllSince(), fetchCandles(), fetchRecent(), FIXTURES_DIR, m5StartSec

### Community 110 - "ContextMenu.vue"
Cohesion: 0.38
Nodes (6): clampedX, clampedY, emit, onKeydown(), onWindowMousedown(), props

### Community 111 - "ctraderCandles.js"
Cohesion: 0.48
Nodes (6): ctraderPeriodFor(), fetchCandles(), fetchInitialCandles(), fetchOlderCandles(), fetchRecentCandles(), PERIOD_MAP

### Community 112 - "marketStructureAnalysisFib.test.js"
Cohesion: 0.29
Nodes (6): RANGE_FIB_MIN_PP_DISTANCE_PIPS, confirmBreak, confirmedUptrendState(), originHigh, originLow, pullback

### Community 113 - "Debug-Metadata-Panel Notes"
Cohesion: 0.33
Nodes (6): Autosave vs Manual Copy Separation, .debug/metadata.json Snapshot, Debug-Metadata-Panel Notes, buildActiveMetadataSnapshot (PriceChart.vue), debugMetadata.js Gating Logic, saveDebugMetadataLocally (vite.config.js)

### Community 114 - "AI Failure as Property Collision"
Cohesion: 1.00
Nodes (6): AI Failure as Property Collision, Knowledge, Next Token Prediction, Steerability, When Properties Collide (Diagram), Working Memory

### Community 115 - "MCP Advanced Topics Notes"
Cohesion: 0.33
Nodes (6): MCP Advanced Topics Notes, MCP Advanced: Why Not Relevant Yet, MCP Log & Progress Notifications, MCP Roots, MCP Sampling, MCP Transports (STDIO/StreamableHTTP)

### Community 116 - "Pip-/Pixel-Schwellwerte Übersicht"
Cohesion: 0.28
Nodes (9): HTF_FOREX_MIN_GAP_PIPS Constant, LOWER_TF_MIN_GAP_PIPS Constant, Pip-/Pixel-Schwellwerte Übersicht, MIN_PIXELS_PER_HOUR_FOR_LABELS Constants, PIP_SIZE Constant, RANGE_FIB_MIN_PP_DISTANCE_PIPS Constant, TRADE_SETUP_LS_MAX_DISTANCE_M5 Constant, poi-watcher 4H+1H OB-Zonen-Wächter Edge Function (+1 more)

### Community 117 - "vite.config.js"
Cohesion: 0.40
Nodes (3): DEBUG_DIR, DEBUG_FILE, __dirname

### Community 118 - "lana-git-pull.cjs"
Cohesion: 0.50
Nodes (3): { execFileSync }, path, TRADING_REPO

### Community 119 - "localStorage-first / Supabase-Source-of-Truth Pattern"
Cohesion: 0.67
Nodes (3): Settings-Sync Notes, localStorage-first / Supabase-Source-of-Truth Pattern, trading_loop_state Table Design

### Community 121 - "src/pipConfig.js"
Cohesion: 0.29
Nodes (5): HTF_FOREX_LABELS, HTF_FOREX_MIN_GAP_PIPS, LOWER_TF_LABELS, LOWER_TF_MIN_GAP_PIPS, PIP_SIZE

### Community 122 - "detectLiquidityLevels"
Cohesion: 0.70
Nodes (4): buildLevel(), detectLiquidityLevels(), isDownFractal(), isUpFractal()

### Community 125 - "Trading-Monitor Project Overview (CLAUDE.md)"
Cohesion: 0.12
Nodes (16): cTrader ACCESS_DENIED Lockout (No Auto-Recovery), cTrader Open API as Forex Candle Source, DRY Within a Single Runtime Convention, CLAUDE.md Pointer to /l Persona, npm run build Command, Trading-Monitor Project Overview (CLAUDE.md), Supabase/PostgREST ~1000 Row Cap Gotcha, Rename Consistency Convention (+8 more)

### Community 131 - "toDatetimeLocal"
Cohesion: 0.50
Nodes (4): rangesFixedStartInputValue, rangesPivotStartDisplay, replayInputValue, toDatetimeLocal()

### Community 133 - "fetchTradeSetupForCockpit"
Cohesion: 0.67
Nodes (3): fetchTradeSetupForCockpit(), onIsolateTrade(), onSelectTrade()

## Ambiguous Edges - Review These
- `Trading-Steps-Ablauf Diagram` → `calc_rr Tool Idea (Deterministic RR Calc)`  [AMBIGUOUS]
  docs/steerabilty-vs-wrong-ai-outputs.md · relation: references

## Knowledge Gaps
- **1047 isolated node(s):** `errorText`, `{ data }`, `loading`, `activeByInstrument`, `historyByInstrument` (+1042 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1254 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Trading-Steps-Ablauf Diagram` and `calc_rr Tool Idea (Deterministic RR Calc)`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **Why does `trading_schedules Table` connect `Fachdoku-Router Skill` to `trading-monitor-mcp/pretradeGates.ts`?**
  _High betweenness centrality (0.333) - this node is a cross-community bridge._
- **Why does `Trading-Monitor Project Overview (CLAUDE.md)` connect `Trading-Monitor Project Overview (CLAUDE.md)` to `usePriceChartTradeSetups.js`, `Plan: Forex-Chart-Objekte Datengrundlage`, `tradeSetup.js`, `/task do Mode`, `Fachdoku-Router Skill`, `Plan: Sehr Große Dateien Refactoren (PriceChart.vue)`, `Plan: POI-Strategie-Findung, Backtesting & Trade-Notifications`?**
  _High betweenness centrality (0.314) - this node is a cross-community bridge._
- **Why does `Trading-Hours/Timezone Handling (Europe/Berlin)` connect `Fachdoku-Router Skill` to `Trading-Monitor Project Overview (CLAUDE.md)`?**
  _High betweenness centrality (0.290) - this node is a cross-community bridge._
- **What connects `errorText`, `{ data }`, `loading` to the rest of the system?**
  _1047 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Dashboard.vue` be split into smaller, more focused modules?**
  _Cohesion score 0.016351744186046513 - nodes in this community are weakly interconnected._
- **Should `gbp_h1_uptrend_uptrend_break_of_structure_und_trendumkehr.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0196078431372549 - nodes in this community are weakly interconnected._