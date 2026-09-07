# Graph Report - trading-monitor  (2026-09-07)

## Corpus Check
- 417 files · ~430,623 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2806 nodes · 5630 edges · 126 communities (116 shown, 8 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 109 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `9ba8fc96`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Dashboard.vue
- gbp_h1_uptrend_uptrend_break_of_structure_und_trendumkehr.ts
- dealingRangeLoop.ts
- dataExport.ts
- PriceChart.vue
- gbp_h1_uptrend_mit_LQ_sweep_LONG_SETUP.ts
- gbp_h1_uptrend_mit_inner_structure.ts
- db.ts
- usePriceChartRsi.js
- marketStructureRendering.ts
- rsiDivergenceStats.ts
- DataExportModal.vue
- orderBlocks.js
- biasCheck.ts
- trading-monitor-mcp/index.ts
- TradeEditModal.vue
- package.json
- findTargets.js
- LoopStatus.vue
- liquidity.js
- priceChartConstants.js
- reads.ts
- NewsModal.vue
- usePriceChartLiquidity.js
- ctrader/client.ts
- chartColors.js
- tradeIntake.js
- trades.js
- backfillTradeSetupOutcomes.ts
- priceChartObZones.js
- lineWidth
- sessions.js
- gbp_h1_uptrend_protected_low_gebrochen.ts
- tradingAccounts.js
- Dealing-Range-Anlegen Skill
- dataExport.js
- tdd_mit_claude.ts
- tradeSetup.ts
- priceChartHitTest.test.js
- TradeSetupCockpit.vue
- applyMarketStructurePivot
- tools/pretradeGates.ts
- tradeSetup.js
- useClaudeAnnotations.js
- trading-monitor-mcp/marketStructureAnalysis.ts
- /task do Mode
- pinContext.js
- Laniakea Persona Command (/l)
- Plan: Forex-Chart-Objekte Datengrundlage
- cssColor
- trading-monitor-mcp/sessionOccurrences.js
- newsMarkers.js
- daily-structure-pivots/index.ts
- gbp_h1_uptrend.ts
- tradeSetupCockpit.ts
- chartTimeUtils.js
- src/marketStructureAnalysis.ts
- FibTickPrimitive
- pinEntryVisible
- orderBlocks.ts
- forexCandles.ts
- App.vue
- pricePrecisionForInstrument
- poi-watcher/index.ts
- State Machine for Lana's Trading Flow
- compilerOptions
- candleCache.js
- claudeAnnotations.js
- Pip-/Pixel-Schwellwerte Übersicht
- MetadataPanel.vue
- Trading-Monitor Project Overview (CLAUDE.md)
- src/pipConfig.js
- tradingSchedules.js
- src/sessionOccurrences.js
- forexCandles.js
- marketStructureAnalysis Rules Overview
- SessionBandPaneView
- TradingFlow.vue
- clearArmStatesExcept
- Fachdoku-Router Skill
- supabaseClient.js
- Dealing-Range-Loop Diagram
- marketStructureAnalysisDowntrend.test.js
- useHttpActivity.js
- AI Capabilities and Limitations Notes
- Vegapunk Slimming Results (-86%)
- alarmLog.js
- router.js
- PinAddPopup.vue
- twelvedata/client.ts
- newsEvents.js
- fallClassifier.ts
- LiquidityLinePrimitive
- marketStructureAnalysisNestedNestedChoch.test.js
- MCP-Server: Tiefere Referenz
- pivotMarkers.ts
- backfillObZones.ts
- marketStructureAnalysis.test.js
- jumpToTimeRange
- trade_evidence Table (Dual-Level, Confirmation/Confluence)
- RangeLinePaneView
- marketStructureAnalysisInnerPivots.test.js
- Agent Skills Pro Notes
- News Events Seeding Notes
- fetch-trend-fixture.mjs
- ContextMenu.vue
- ctraderCandles.js
- Debug-Metadata-Panel Notes
- AI Failure as Property Collision
- MCP Advanced Topics Notes
- vite.config.js
- lana-git-pull.cjs
- localStorage-first / Supabase-Source-of-Truth Pattern
- .mcp.json
- cTrader Open API as Forex Candle Source
- trading-monitor index.html Entry
- Plan: Trade-Journal Konfluenzen & Kontext
- Plan: POI-Strategie-Findung, Backtesting & Trade-Notifications
- trendIndicator.gbpusd-downtrend.test.js
- Claude Code Hooks Documentation Pointers
- mcp-server/src/scripts/backfillObZones.ts
- CrudListSection.vue
- nextActionMap.ts
- TSC-Neuaufbau Precondition

## God Nodes (most connected - your core abstractions)
1. `berlinDateStrFor()` - 38 edges
2. `cssColor()` - 34 edges
3. `fetchForexCandles()` - 31 edges
4. `pricePrecisionForInstrument()` - 30 edges
5. `berlinDateTimeStrFor()` - 28 edges
6. `fmtPrice()` - 28 edges
7. `clipReplay()` - 27 edges
8. `logDecision()` - 25 edges
9. `lineWidth()` - 24 edges
10. `refreshChart()` - 24 edges

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

## Communities (126 total, 8 thin omitted)

### Community 0 - "Dashboard.vue"
Cohesion: 0.02
Nodes (121): useSessionStorageRef(), useTabScopedRef(), addPositionToDealingRange(), fetchTradeSetupForCockpit(), antiConfluenceAddTrade, anyArmStateActive, ARM_STATES, closeTradeEditModal() (+113 more)

### Community 1 - "gbp_h1_uptrend_uptrend_break_of_structure_und_trendumkehr.ts"
Cohesion: 0.02
Nodes (101): candlesAroundBOS, candlesAroundBreak, p2Pivot1, p2Pivot10, p2Pivot11, p2Pivot12, p2Pivot13, p2Pivot14 (+93 more)

### Community 2 - "dealingRangeLoop.ts"
Cohesion: 0.06
Nodes (73): berlinDateStrFor(), berlinDateTimeStrFor(), getOpenOppositeDealingRanges(), computeEvidenceScore(), EvidenceScoreBreakdownEntry, EvidenceScoreInput, EvidenceScoreResult, computeWatchLevels() (+65 more)

### Community 3 - "dataExport.ts"
Cohesion: 0.06
Nodes (59): buildLevel(), detectLiquidityLevels(), filterRelevantLevels(), isDownFractal(), isUpFractal(), LIQUIDITY_MAX_RELEVANT, LiquidityLevel, applyAsOfZones() (+51 more)

### Community 4 - "PriceChart.vue"
Cohesion: 0.03
Nodes (67): activeMetadataSnapshot, allCandles, antiConfluencePickerCurrentPrice, antiConfluencePickerDivergenceCandidates, antiConfluencePickerHoveredLiquidityKey, antiConfluencePickerHoveredObKey, antiConfluencePickerInvalidationObCandidates, antiConfluencePickerObCandidates (+59 more)

### Community 5 - "gbp_h1_uptrend_mit_LQ_sweep_LONG_SETUP.ts"
Cohesion: 0.03
Nodes (60): p2Pivot1, p2Pivot10, p2Pivot11, p2Pivot12, p2Pivot13, p2Pivot14, p2Pivot15, p2Pivot16 (+52 more)

### Community 6 - "gbp_h1_uptrend_mit_inner_structure.ts"
Cohesion: 0.04
Nodes (55): p2Pivot1, p2Pivot10, p2Pivot11, p2Pivot12, p2Pivot13, p2Pivot14, p2Pivot15, p2Pivot16 (+47 more)

### Community 7 - "db.ts"
Cohesion: 0.06
Nodes (55): InducementClass, addPinEntry(), addPinM5LiquidityEntry(), addPinM5ObEntry(), addPinRsiDivergenceEntry(), addTradeConfirmation(), AddTradeConfirmationArgs, addTradePosition() (+47 more)

### Community 8 - "usePriceChartRsi.js"
Cohesion: 0.09
Nodes (37): nativeLineWidth(), usePriceChartRsi(), applyColorOptions(), applyLineWidthOptions(), create(), refreshEma(), refreshRsi(), computeEma() (+29 more)

### Community 9 - "marketStructureRendering.ts"
Cohesion: 0.09
Nodes (26): Candle, ArrowPaneView, ArrowPrimitive, ArrowRenderer, collectFibLevels(), collectH1LqLevels(), collectNestedChain(), computeFibLevels() (+18 more)

### Community 10 - "rsiDivergenceStats.ts"
Cohesion: 0.07
Nodes (49): byDistance(), findAntiConfluenceCandidates(), findAntiConfluenceDivergenceCandidates(), findAntiConfluenceObCandidates(), findAntiConfluenceSweepCandidates(), findInvalidationObCandidates(), inBand(), MAX_HELD_OB_AGE_DAYS (+41 more)

### Community 11 - "DataExportModal.vue"
Cohesion: 0.06
Nodes (34): asset, copied, copyResult(), currentSymbol, dateStr, error, generate(), loading (+26 more)

### Community 12 - "orderBlocks.js"
Cohesion: 0.06
Nodes (16): drawIconLabel(), canShowLabels(), MIN_PIXELS_PER_HOUR_FOR_LABELS, MIN_PIXELS_PER_HOUR_FOR_LABELS_INTRADAY, refreshDivergence(), OB_ZONE_KEYS, OrderBlockPrimitive, positionsBox() (+8 more)

### Community 13 - "biasCheck.ts"
Cohesion: 0.17
Nodes (19): buildPendingDecisions(), determineTrendForce(), findIntermediateLevel(), FindIntermediateLevelArgs, IntermediateLevelCandidate, isSpreadHourPivot(), PendingDecision, TrendForceConfidence (+11 more)

### Community 14 - "trading-monitor-mcp/index.ts"
Cohesion: 0.11
Nodes (23): createDealingRange(), deleteDealingRange(), fetchActiveTscRangeId(), fetchDealingRangeCockpit(), postChartAnnotations(), toLiquidityLevel(), buildServer(), MCP_TOKEN (+15 more)

### Community 15 - "TradeEditModal.vue"
Cohesion: 0.05
Nodes (46): commission, confirmationLabel(), emit, entryPrice, entryTimeInput, exitPrice, exitTimeInput, flashInvalidationSaved() (+38 more)

### Community 16 - "package.json"
Cohesion: 0.06
Nodes (33): lightweight-charts, mermaid, dependencies, lightweight-charts, mermaid, @supabase/supabase-js, vue, vue-router (+25 more)

### Community 17 - "findTargets.js"
Cohesion: 0.14
Nodes (17): MAX_TARGET_DISTANCE_PIPS Constant, find_targets Target-Candidate Algorithm Design, emit, onAntiConfluencePickerHover(), onAntiConfluencePickerSelect(), onTargetPickerHover(), onTargetPickerSelect(), openAntiConfluencePicker() (+9 more)

### Community 18 - "LoopStatus.vue"
Cohesion: 0.07
Nodes (21): fetchLoopStateHistory(), fetchLoopStatesForDate(), LOOP_INSTRUMENTS, rowToLoopState(), fetchStateMachineLog(), rowToDecision(), activeByInstrument, { data } (+13 more)

### Community 19 - "liquidity.js"
Cohesion: 0.12
Nodes (28): AgeTier, classifyAge(), ageReferenceTime(), businessSecondsBetween(), formatAge(), usePriceChartTradeSetupDrawing(), ageSuffix(), bullBearLabelSide() (+20 more)

### Community 20 - "priceChartConstants.js"
Cohesion: 0.07
Nodes (36): usePriceChartTradeSetups(), computeTradeSetups(), fetchM5Candles(), fetchTrendAnalysisM5History(), getTrendAnalysisM5Candles(), CALLOUT_STACK_GAP_PX, CLOSE_POLL_BUFFER_MS, COPIED_FEEDBACK_MS (+28 more)

### Community 21 - "reads.ts"
Cohesion: 0.10
Nodes (40): isBoxInvalidated(), detectSetupObs(), berlinDayRangeUtcMs(), berlinOffsetMinutes(), DATE_FORMATTER, OFFSET_FORMATTER, TIME_FORMATTER, findRecentTradeSetupIdsByKey() (+32 more)

### Community 22 - "NewsModal.vue"
Cohesion: 0.18
Nodes (11): CURRENCIES, emit, LIST_FORMATTER, newCurrency, newDateTime, newTitle, saving, submit() (+3 more)

### Community 23 - "usePriceChartLiquidity.js"
Cohesion: 0.17
Nodes (19): refresh(), liquidityLevelNaturalKey(), renderLiquidityLevels(), buildLevel(), detectLiquidityLevels(), filterRelevantLevels(), isDownFractal(), isUpFractal() (+11 more)

### Community 24 - "ctrader/client.ts"
Cohesion: 0.12
Nodes (24): CORS_HEADERS, authAccount(), authenticate(), cachedSymbolIds, Candle, concat(), connectWithTimeout(), CTraderConnection (+16 more)

### Community 25 - "chartColors.js"
Cohesion: 0.08
Nodes (18): chartColors, DEFAULT_CHART_COLORS, resetChartColors(), chartLineWidths, DEFAULT_CHART_LINE_WIDTHS, resetChartLineWidths(), collapsed, emit (+10 more)

### Community 26 - "tradeIntake.js"
Cohesion: 0.13
Nodes (27): direction, emit, entryPrice, errorMsg, levels, precision, props, reasoning (+19 more)

### Community 27 - "trades.js"
Cohesion: 0.11
Nodes (22): onRemoveConfirmation(), pnlClass, props, stats, winrateClass, fmtR(), removeConfirmationFromTrade(), computeTradeStats() (+14 more)

### Community 28 - "backfillTradeSetupOutcomes.ts"
Cohesion: 0.13
Nodes (27): classifyInducementAge(), classifyOutcome(), computeSlTp(), computeSweepAgeHours(), deriveEntryInvalidation(), inducementAgeRange(), MAJOR_INDUCEMENT_MIN_HOURS, MAX_SL_PIPS (+19 more)

### Community 29 - "priceChartObZones.js"
Cohesion: 0.26
Nodes (12): detectOrderBlocks(), collectObsZones(), currentPriceEstimate(), filterDbObZones(), filterHistorical(), firstCandleTouch(), firstCandleTouchRange(), liveObZonesForTimeframe() (+4 more)

### Community 30 - "lineWidth"
Cohesion: 0.13
Nodes (11): lineWidth(), drawEntryPoint(), drawExitPoint(), drawHaloRing(), drawLabel(), drawTick(), renderTradeMarkers(), TradeMarkerPaneView (+3 more)

### Community 31 - "sessions.js"
Cohesion: 0.12
Nodes (18): minutesToTimeInput(), timeInputToMinutes(), emit, instrumentSessions, props, WEEKDAY_DISPLAY_ORDER, addSession(), currentSessionDanger() (+10 more)

### Community 32 - "gbp_h1_uptrend_protected_low_gebrochen.ts"
Cohesion: 0.08
Nodes (25): ClosedRange, MarketStructureState, PivotBase, PivotHigh, PivotLow, PivotTouched, PivotTypeAll, PivotUntouched (+17 more)

### Community 33 - "tradingAccounts.js"
Cohesion: 0.12
Nodes (19): currentLabel, open, selectedAccount, wrapperRef, cache, useLocalStorageRef(), accounts, accountsLoaded (+11 more)

### Community 34 - "Dealing-Range-Anlegen Skill"
Cohesion: 0.14
Nodes (15): kind=pivot = Liquidity-Sweep-Only Semantics, Dealing-Range-Anlegen Skill, milk-city Task: Confluence-Tracking bei Dealing Ranges, trading/liquidität.md (Liquiditäts-Sweep-Mechanismus), AI Capabilities Framework (Next Token Prediction/Knowledge/Working Memory/Steerability), Diagnose-to-Fix Routing Table, Lana-Fehlerdiagnose Skill, docs/steerabilty-vs-wrong-ai-outputs.md (+7 more)

### Community 35 - "dataExport.js"
Cohesion: 0.13
Nodes (25): marketStructureTree, dateStr, berlinDateStrFor(), berlinOffsetMinutes(), buildDataExport(), compute1hStructureState(), computeExportTimeframeData(), computeLiquidityLevelsForExport() (+17 more)

### Community 36 - "tdd_mit_claude.ts"
Cohesion: 0.08
Nodes (24): nextPivot1, nextPivot10, nextPivot11, nextPivot2, nextPivot3, nextPivot4, nextPivot5, nextPivot6 (+16 more)

### Community 37 - "tradeSetup.ts"
Cohesion: 0.18
Nodes (16): LiquidityLevel, closesBeyondLevel(), DEFAULT_TRADE_SETUP_PARAMS, DetectedTradeSetup, detectTradeSetup(), findBestLsMatch(), findFirstSetupObAfter(), findImmediateLsSetup() (+8 more)

### Community 38 - "priceChartHitTest.test.js"
Cohesion: 0.11
Nodes (21): findClickedDivergence(), findClickedFibLevel(), findClickedLiquidityLevel(), findClickedOBZone(), findClickedSetup(), findClickedTarget(), getCurrentFibLevels(), DIVERGENCE_CLICK_TOLERANCE_PX (+13 more)

### Community 39 - "TradeSetupCockpit.vue"
Cohesion: 0.08
Nodes (25): emit, accentStyle, antiConfluences, canTransfer, confirmationLabel(), confirmations, confluences, dateLabel (+17 more)

### Community 40 - "applyMarketStructurePivot"
Cohesion: 0.09
Nodes (28): advanceNestedTrendInner(), applyInnerMarketStructurePivot(), applyMarketStructurePivot(), initMarketStructureState(), chochConfirmedState(), confirmBreak, confirmedUptrendState(), originHigh (+20 more)

### Community 41 - "tools/pretradeGates.ts"
Cohesion: 0.16
Nodes (20): berlinWeekdayAndMinutes(), isWithinTradingWindows(), getNewsEvents(), getTradingSchedule(), ClassifiedNewsEvent, evaluateNewsGate(), evaluateTradingHoursGate(), NEWS_IMMINENT_MINUTES (+12 more)

### Community 42 - "tradeSetup.js"
Cohesion: 0.16
Nodes (13): Two Runtimes, One Algorithm Set (Deliberate Duplication), closesBeyondLevel(), detectTradeSetups(), findAllProtectedFractals(), findBestLsMatch(), findFirstSetupObAfter(), findImmediateLsSetups(), findLsInArray() (+5 more)

### Community 43 - "useClaudeAnnotations.js"
Cohesion: 0.10
Nodes (27): addClaudeAnnotationDrawing(), fetchClaudeAnnotations(), removeClaudeAnnotationDrawing(), setClaudeAnnotationDrawingVisible(), applyText(), emit, error, { instrument, dateStr, drawings, loading, add, remove, setDrawingVisible } (+19 more)

### Community 44 - "trading-monitor-mcp/marketStructureAnalysis.ts"
Cohesion: 0.21
Nodes (23): advanceNestedTrend(), advanceNestedTrendInner(), applyInnerMarketStructurePivot(), applyInnerMarketStructurePivotCore(), applyMarketStructurePivot(), applyMarketStructurePivotCore(), buildMarketStructureState(), Candle (+15 more)

### Community 45 - "/task do Mode"
Cohesion: 0.38
Nodes (7): Laniakea milk-city Task-Status Rule, /task Default Data-Maintenance Mode, /task do Mode, /task new Mode, /task refine Mode, /task Command Router, milk-city Task Status Convention

### Community 46 - "pinContext.js"
Cohesion: 0.16
Nodes (21): addPinEntry(), addPinM5LiquidityEntry(), addPinM5ObEntry(), addPinRsiDivergenceEntry(), addPinTscSetupEntry(), fetchPinContext(), REF_COLUMN, removePinEntry() (+13 more)

### Community 47 - "Laniakea Persona Command (/l)"
Cohesion: 0.13
Nodes (18): 00-trading-steps.md Entry Point, Laniakea Persona Command (/l), trading/claude-project-instructions.md, trading-runs Relative Link Path Convention, 00-trading-steps.md#visuelle-antworten-chart-annotationen, 06-anti-confluence.md, glossar.md Consistency Check, kontext-ausführung.md (+10 more)

### Community 48 - "Plan: Forex-Chart-Objekte Datengrundlage"
Cohesion: 0.11
Nodes (21): Keep Codebase Clean / ~1000 Line Backstop Convention, liquidity_levels Table, ob_zones Table, BTC Scope Removal from Chart-Objects Plan, OB-Zones Canonical FK Consolidation Approach, Four Independent OB Render Passes Problem, "Historische OBs"-Toggle Semantics, LQ-Sweep Relevance Criterion (Recent OR Pip-Range) (+13 more)

### Community 49 - "cssColor"
Cohesion: 0.15
Nodes (32): cssColor(), cssColorScaled(), hexToRgba(), tradesVisibleForCandles(), buildActiveMetadataSnapshotInternal(), clipReplay(), computeTradeSetupsInternal(), loadTradeSetupM5() (+24 more)

### Community 50 - "trading-monitor-mcp/sessionOccurrences.js"
Cohesion: 0.30
Nodes (11): ALL_DAYS, attachRangeExtremes(), bonusLabelForPivot(), buildSessionContextLookup(), contextForPivot(), daysOrAll(), localMidnightUtc(), localWeekday() (+3 more)

### Community 51 - "newsMarkers.js"
Cohesion: 0.14
Nodes (7): DAY_KEY_FORMATTER, extrapolatedX(), NewsMarkerPaneView, NewsMarkerPrimitive, NewsMarkerRenderer, TIME_FORMATTER, WEEKDAY_FORMATTER

### Community 52 - "daily-structure-pivots/index.ts"
Cohesion: 0.16
Nodes (13): CORS_HEADERS, ExistingPivotRow, INSTRUMENTS, CORS_HEADERS, PERIOD_MAP, PERSISTABLE_BARS, persistIfArchivable(), RefreshedTokens (+5 more)

### Community 53 - "gbp_h1_uptrend.ts"
Cohesion: 0.10
Nodes (20): pivot1, pivot10, pivot11, pivot12, pivot13, pivot2, pivot3, pivot4 (+12 more)

### Community 54 - "tradeSetupCockpit.ts"
Cohesion: 0.12
Nodes (20): trendChain, trendChainDisplay, RangeTrend, ANTI_CONFLUENCE_COLOR, ANTI_CONFLUENCE_THRESHOLD, AntiConfluence, computeAntiConfluences(), computeCockpitState() (+12 more)

### Community 55 - "chartTimeUtils.js"
Cohesion: 0.11
Nodes (12): computeNextReplayTime(), mergeRecent(), nextCandleAfter(), replayFetchToMs(), snapToBarTime(), usePriceChartDailyPivots(), refresh(), DailyPivotMarkerPaneView (+4 more)

### Community 56 - "src/marketStructureAnalysis.ts"
Cohesion: 0.27
Nodes (17): advanceNestedTrend(), applyInnerMarketStructurePivotCore(), applyMarketStructurePivotCore(), buildMarketStructureState(), closesAboveOldHigh(), closesBelowLevel(), computeRangesPivots(), evaluateConfirmingBreak() (+9 more)

### Community 57 - "FibTickPrimitive"
Cohesion: 0.15
Nodes (3): FibTickPaneView, FibTickPrimitive, FibTickRenderer

### Community 58 - "pinEntryVisible"
Cohesion: 0.13
Nodes (19): liquidityLevelEntryNaturalKey(), m5LiquidityEntryNaturalKey(), obZoneEntryNaturalKey(), barSecondsForTimeframeCi(), hoveredPinLiquidityLevelKey, hoveredPinObZoneKey, onSelectPin(), pinEntryVisible() (+11 more)

### Community 59 - "orderBlocks.ts"
Cohesion: 0.15
Nodes (13): buildLevel(), detectLiquidityLevels(), isDownFractal(), isUpFractal(), Candle, detectOrderBlocks(), HTF_FOREX_LABELS, HTF_FOREX_MIN_GAP_PIPS (+5 more)

### Community 60 - "forexCandles.ts"
Cohesion: 0.09
Nodes (28): LIQUIDITY_FRACTAL_PERIOD, getForexCandlesArchiveUpTo(), BAR_SECONDS, barSecondsFor(), Candle, fetchLiveForexCandles(), fetchLiveForexCandlesOnce(), isRetryable() (+20 more)

### Community 61 - "App.vue"
Cohesion: 0.18
Nodes (10): { activeLabels, isActive }, isFresh, { lastSuccessAt }, lastUpdateText, now, showClaudeAnnotationsModal, showDataExport, statusDotClass (+2 more)

### Community 62 - "pricePrecisionForInstrument"
Cohesion: 0.05
Nodes (46): candidateLabel(), candidatePrice(), emit, mergedCandidates, precision, props, emit, noteSaveTimers (+38 more)

### Community 63 - "poi-watcher/index.ts"
Cohesion: 0.10
Nodes (18): fetchForexBatch(), fmt(), InstrumentConfig, INSTRUMENTS, isInWindows(), LiquidityLevelRow, localMinutesAndWeekday(), ObZoneRow (+10 more)

### Community 64 - "State Machine for Lana's Trading Flow"
Cohesion: 0.16
Nodes (17): Trading-Steps-Ablauf Diagram, Fall 4 -> Zurück zu Schritt 3, Two Permanent LLM-Only Steps (3 and 6), News-Pause Doesn't Replace the Cron, State Machine for Lana's Trading Flow, get_tsc_range Deliberately Not a Graph Node, Problem: GBPUSD 28.08.2026 Fall-4 Deviation Incident, trading-runs/*.md Loses Purpose (+9 more)

### Community 65 - "compilerOptions"
Cohesion: 0.12
Nodes (16): src/marketStructureAnalysis.ts, src/marketStructureRendering.ts, src/pivotMarkers.ts, test/tdd_mit_claude/ranges/tdd_mit_claude.ts, compilerOptions, allowJs, checkJs, esModuleInterop (+8 more)

### Community 66 - "candleCache.js"
Cohesion: 0.11
Nodes (27): cachedCandlesUpTo(), cacheKey(), fetchCandlesCached(), getCachedCandles(), mergeCandles(), openDb(), safeCompleteUpTo(), setCachedCandles() (+19 more)

### Community 67 - "claudeAnnotations.js"
Cohesion: 0.09
Nodes (16): ANNOTATION_COLOR, annotationAnchorPoint(), AnnotationsPaneView, AnnotationsPrimitive, AnnotationsRenderer, parseAnnotations(), renderClaudeAnnotations(), resolveLabelPlacements() (+8 more)

### Community 68 - "Pip-/Pixel-Schwellwerte Übersicht"
Cohesion: 0.28
Nodes (9): HTF_FOREX_MIN_GAP_PIPS Constant, LOWER_TF_MIN_GAP_PIPS Constant, Pip-/Pixel-Schwellwerte Übersicht, MIN_PIXELS_PER_HOUR_FOR_LABELS Constants, PIP_SIZE Constant, RANGE_FIB_MIN_PP_DISTANCE_PIPS Constant, TRADE_SETUP_LS_MAX_DISTANCE_M5 Constant, poi-watcher 4H+1H OB-Zonen-Wächter Edge Function (+1 more)

### Community 69 - "MetadataPanel.vue"
Cohesion: 0.24
Nodes (10): emit, height, left, onDrag(), panelEl, props, startDrag(), stopDrag() (+2 more)

### Community 70 - "Trading-Monitor Project Overview (CLAUDE.md)"
Cohesion: 0.15
Nodes (12): cTrader ACCESS_DENIED Lockout (No Auto-Recovery), DRY Within a Single Runtime Convention, CLAUDE.md Pointer to /l Persona, npm run build Command, Trading-Monitor Project Overview (CLAUDE.md), Rename Consistency Convention, REPLAY_LOOKAHEAD_SEC M1 Scaling Gotcha, ctrader_oauth_tokens Table (+4 more)

### Community 71 - "src/pipConfig.js"
Cohesion: 0.29
Nodes (5): HTF_FOREX_LABELS, HTF_FOREX_MIN_GAP_PIPS, LOWER_TF_LABELS, LOWER_TF_MIN_GAP_PIPS, PIP_SIZE

### Community 72 - "tradingSchedules.js"
Cohesion: 0.23
Nodes (10): addWindow(), cloneWindows(), DEFAULT_SCHEDULES, EMPTY_WINDOWS, loadInitial(), removeWindow(), syncFromRemote(), tradingSchedules (+2 more)

### Community 73 - "src/sessionOccurrences.js"
Cohesion: 0.18
Nodes (12): usePriceChartLiquidity(), attachBonus(), ALL_DAYS, attachRangeExtremes(), bonusLabelForPivot(), buildSessionContextLookup(), daysOrAll(), localMidnightUtc() (+4 more)

### Community 74 - "forexCandles.js"
Cohesion: 0.27
Nodes (14): DB_ARCHIVED_BARS, fetchArchivedPage(), fetchArchivedUpTo(), fetchCandles(), fetchCandlesBatchOnce(), fetchCandlesOnce(), fetchInitialCandles(), fetchOlderCandles() (+6 more)

### Community 75 - "marketStructureAnalysis Rules Overview"
Cohesion: 0.22
Nodes (15): Arbitrary Nesting Depth (2026-08-09), Rendering Rules (renderMarketStructureAnalysis), marketStructureAnalysis Rules Overview, Docht-vs-Bruch (Wick vs Close-Break) Unification, Standalone Downtrend Detection/Invalidation, Fibonacci Level (computeFibLevels/collectFibLevels), Inner-Pivots (Period 2) Fast Pre-Detection, LQ-Sweep Classification (markLqSweeps) (+7 more)

### Community 76 - "SessionBandPaneView"
Cohesion: 0.14
Nodes (3): SessionBandPaneView, SessionBandPrimitive, SessionBandRenderer

### Community 77 - "TradingFlow.vue"
Cohesion: 0.11
Nodes (20): buildMermaidSource(), EDGES, getNextActionHint(), mermaidEscape(), NODES, activeByInstrument, berlinTimeFormatter, currentLoop (+12 more)

### Community 78 - "clearArmStatesExcept"
Cohesion: 0.15
Nodes (14): clearArmStatesExcept(), onAddAntiConfluenceRequest(), onAddConfirmationRequest(), onAddConfluenceRequest(), onAddRangeAntiConfluenceRequest(), onAddRangeConfirmationRequest(), onAddRangeConfluenceRequest(), onAddTargetRequest() (+6 more)

### Community 79 - "Fachdoku-Router Skill"
Cohesion: 0.15
Nodes (13): poi-watcher UTC Refresh-Tick Exception, Trading-Hours/Timezone Handling (Europe/Berlin), sessions Table, trading_schedules Table, docs/debug-metadata-panel.md, Fachdoku-Router Skill, src/marketStructureAnalysis.notes.md, docs/mcp-server.md (+5 more)

### Community 80 - "supabaseClient.js"
Cohesion: 0.23
Nodes (7): fetchDailyStructurePivots(), fetchLiquidityLevelsHtf(), fetchObZones(), supabase, { data: dbDailyPivots }, { data: dbLiquidityLevelsHtf }, { data: dbObZones }

### Community 81 - "Dealing-Range-Loop Diagram"
Cohesion: 0.15
Nodes (13): Dealing-Range-Loop Diagram, News-Blackout Mid-Loop Pause, Pin-Aufräumen after TSC-Link, Target Selection Remains Lana's Judgment, Pin Tools (tools/pins.ts), poi-watcher Alert-Cron Notes, poi-watcher 3-Tier Fetch Throttling, UTC-Hours Exception for Refresh Ticks (+5 more)

### Community 82 - "marketStructureAnalysisDowntrend.test.js"
Cohesion: 0.40
Nodes (4): confirmBreak, originHigh, originLow, pullback

### Community 83 - "useHttpActivity.js"
Cohesion: 0.22
Nodes (10): copiedId, { errors }, counts, dismissHttpError(), errors, extractErrorMessage(), installHttpActivityTracking(), labelFor() (+2 more)

### Community 84 - "AI Capabilities and Limitations Notes"
Cohesion: 0.17
Nodes (12): Delegation (4D Framework), Description (4D Framework), Diligence (4D Framework), Discernment (4D Framework), AI Fluency: 4D Framework Notes, calc_rr Tool Idea (Deterministic RR Calc), AI Capabilities and Limitations Notes, Letter-over-Spirit Failure Mode (+4 more)

### Community 85 - "Vegapunk Slimming Results (-86%)"
Cohesion: 0.18
Nodes (12): get_data_export Tool, Lana Test Data README, Chronological MCP Tool Call Sequence, Output-too-large Problem, Vegapunk Slimming Results (-86%), marketStructureAnalysis Developer Notes, File Separation: Algorithm vs Rendering, Rules Doc Maintenance Convention (+4 more)

### Community 86 - "alarmLog.js"
Cohesion: 0.20
Nodes (10): fetchAlarmLog(), fetchTouchedLiquidityLevels(), fetchTradeSetups(), usePolledFetch(), lastSuccessAt, useStatusBar(), fetchTouchedZones(), currentSymbol (+2 more)

### Community 87 - "router.js"
Cohesion: 0.24
Nodes (8): ALARM_TYPES, fetchAlarmSettings(), setAlarmEnabled(), router, alarms, errorText, loading, toggle()

### Community 88 - "PinAddPopup.vue"
Cohesion: 0.23
Nodes (11): clampedX, clampedY, confirm(), emit, note, onKeydown(), onWindowMousedown(), props (+3 more)

### Community 89 - "twelvedata/client.ts"
Cohesion: 0.21
Nodes (11): Candle, fetchCandles(), FetchCandlesOptions, INTERVAL_MAP, requestTimeSeries(), resample(), RESAMPLE_BUCKET_SEC, SUPPORTED_PERIODS (+3 more)

### Community 90 - "newsEvents.js"
Cohesion: 0.19
Nodes (14): usePriceChartCockpit(), refreshCockpit(), usePriceChartSessionsAndNews(), refreshNewsMarkers(), refreshSessions(), currentNewsNoGo(), INSTRUMENT_CURRENCIES, NEWS_NOGO_WINDOW_MINUTES (+6 more)

### Community 91 - "fallClassifier.ts"
Cohesion: 0.19
Nodes (12): checkFallFour(), CheckFallFourInput, FallFourResult, hasReaction(), HasReactionInput, hitCounterLevel(), hitTarget(), TargetHit (+4 more)

### Community 92 - "LiquidityLinePrimitive"
Cohesion: 0.14
Nodes (3): LiquidityLinePrimitive, LiquidityLineRenderer, LiquidityPaneView

### Community 93 - "marketStructureAnalysisNestedNestedChoch.test.js"
Cohesion: 0.17
Nodes (11): confirmBreak, originHigh, originLow, pivotB, pivotC, pivotD, pivotE, pivotF (+3 more)

### Community 94 - "MCP-Server: Tiefere Referenz"
Cohesion: 0.20
Nodes (10): MCP Auth & Table Permissions, Backfill Scripts, Candle Archive (forex_candles), MCP Server Deployment (Supabase Edge Function), MCP-Server: Tiefere Referenz, get_forex_rsi / get_forex_ema Tools, Single Deno Copy (Dual-Copy Removed), Trade-Journal Write Tools (tools/trades.ts) (+2 more)

### Community 95 - "pivotMarkers.ts"
Cohesion: 0.14
Nodes (6): Candle, PivotMarkerGroup, PivotMarkerPaneView, PivotMarkerPrimitive, PivotMarkerRenderer, RenderOptions

### Community 96 - "backfillObZones.ts"
Cohesion: 0.29
Nodes (9): backfillOne(), BAR_CONFIG, BARS, CandleRow, correctStaleZones(), fetchAllCandles(), fetchCorrectionCandidates(), INSTRUMENTS (+1 more)

### Community 97 - "marketStructureAnalysis.test.js"
Cohesion: 0.22
Nodes (8): pivot1, pivot2, pivot3, pivot4, pivot5, pivot6, pivot7, pivot8

### Community 98 - "jumpToTimeRange"
Cohesion: 0.29
Nodes (9): isTimeCovered(), jumpToDivergence(), jumpToPin(), jumpToTimeRange(), jumpToTrade(), computeJumpViewport(), loadCandlesAroundTrade(), candle() (+1 more)

### Community 99 - "trade_evidence Table (Dual-Level, Confirmation/Confluence)"
Cohesion: 0.28
Nodes (9): dealing_ranges Table, trade_evidence Table (Dual-Level, Confirmation/Confluence), trade_partial_exits Table, trade_positions Table, trade_targets Table, Confirmation/Confluence/Anti-Confluence Categories, trading repo trade-from-poi.md (Confirmation/Confluence/Anti-Confluence Definition), Bestätigungen (Sweeps & OBs) Feature (+1 more)

### Community 104 - "marketStructureAnalysisInnerPivots.test.js"
Cohesion: 0.25
Nodes (7): h1Candles, p2Pivot3, p2Pivot4, p2Pivot5, pivot1, pivot2, pivot3

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

### Community 119 - "localStorage-first / Supabase-Source-of-Truth Pattern"
Cohesion: 0.67
Nodes (3): Settings-Sync Notes, localStorage-first / Supabase-Source-of-Truth Pattern, trading_loop_state Table Design

### Community 121 - "cTrader Open API as Forex Candle Source"
Cohesion: 0.40
Nodes (5): cTrader Open API as Forex Candle Source, cTrader Wire Protocol Implementation (Manual Protobuf), supabase/functions/_shared/ctrader/client.ts, supabase/functions/_shared/twelvedata/client.ts (Unwired), supabase/functions/forex-candles

### Community 124 - "Plan: Trade-Journal Konfluenzen & Kontext"
Cohesion: 0.50
Nodes (4): Anti-Confluences Snapshot Feature (Planned), Plan: Trade-Journal Konfluenzen & Kontext, Session-Kontext Feature (Planned), Trend-Kontext Feature (Planned)

### Community 125 - "Plan: POI-Strategie-Findung, Backtesting & Trade-Notifications"
Cohesion: 0.16
Nodes (16): Supabase/PostgREST ~1000 Row Cap Gotcha, daily_structure_pivots Table, forex_candles Table, get_forex_candles_archive MCP Tool, Archive-First Auto-Reload Pattern (Tried, Then Reverted), 1H/4H DB-Read vs Live-Recompute Decision, BTC-USDT/OKX Complete Removal (2026-08-21), 1D-Periode-4-Pivot Market-Structure Startpoint (2026-08-30) (+8 more)

### Community 132 - "nextActionMap.ts"
Cohesion: 0.50
Nodes (3): NEXT_ACTION_FALLBACK, NEXT_ACTION_MAP, NextActionEntry

## Ambiguous Edges - Review These
- `Trading-Steps-Ablauf Diagram` → `calc_rr Tool Idea (Deterministic RR Calc)`  [AMBIGUOUS]
  docs/steerabilty-vs-wrong-ai-outputs.md · relation: references

## Knowledge Gaps
- **1053 isolated node(s):** `BATCH_CANDLES`, `TickResult`, `DealingRangeLoopArgs`, `LogFallClassificationArgs`, `RetractFall1ClassificationArgs` (+1048 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1261 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Trading-Steps-Ablauf Diagram` and `calc_rr Tool Idea (Deterministic RR Calc)`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **Why does `trading_schedules Table` connect `Fachdoku-Router Skill` to `tools/pretradeGates.ts`?**
  _High betweenness centrality (0.338) - this node is a cross-community bridge._
- **Why does `Trading-Monitor Project Overview (CLAUDE.md)` connect `Trading-Monitor Project Overview (CLAUDE.md)` to `tradeSetup.js`, `/task do Mode`, `Fachdoku-Router Skill`, `Plan: Forex-Chart-Objekte Datengrundlage`, `cTrader Open API as Forex Candle Source`, `Plan: POI-Strategie-Findung, Backtesting & Trade-Notifications`?**
  _High betweenness centrality (0.311) - this node is a cross-community bridge._
- **Why does `Trading-Hours/Timezone Handling (Europe/Berlin)` connect `Fachdoku-Router Skill` to `Trading-Monitor Project Overview (CLAUDE.md)`?**
  _High betweenness centrality (0.296) - this node is a cross-community bridge._
- **What connects `BATCH_CANDLES`, `TickResult`, `DealingRangeLoopArgs` to the rest of the system?**
  _1053 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Dashboard.vue` be split into smaller, more focused modules?**
  _Cohesion score 0.016013071895424835 - nodes in this community are weakly interconnected._
- **Should `gbp_h1_uptrend_uptrend_break_of_structure_und_trendumkehr.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0196078431372549 - nodes in this community are weakly interconnected._