# Graph Report - trading-monitor  (2026-09-15)

## Corpus Check
- 464 files · ~455,121 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2937 nodes · 6047 edges · 141 communities (126 shown, 10 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 109 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `2d4a9383`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Dashboard.vue
- gbp_h1_uptrend_uptrend_break_of_structure_und_trendumkehr.ts
- reads.ts
- AntiConfluencePickerModal.vue
- PriceChart.vue
- gbp_h1_uptrend_mit_LQ_sweep_LONG_SETUP.ts
- gbp_h1_uptrend_mit_inner_structure.ts
- db.ts
- usePriceChartRsi.js
- marketStructureRendering.ts
- rsiDivergenceStats.ts
- DataExportModal.vue
- validationEvidence.ts
- trading-monitor-mcp/pretradeGates.ts
- Plan: POI-Strategie-Findung, Backtesting & Trade-Notifications
- TradeEditModal.vue
- package.json
- src/sessionOccurrences.js
- LoopStatus.vue
- backfillTradeSetupOutcomes.ts
- Dealing-Range-Anlegen Skill
- backfillObZones.ts
- newsMarkers.js
- trading-monitor-mcp/index.ts
- ctrader/client.ts
- marketStructureAnalysis Rules Overview
- tradeIntake.js
- trades.js
- fallClassifier.ts
- orderBlocks.js
- chartColors.js
- sessions.js
- gbp_h1_uptrend_protected_low_gebrochen.ts
- tradingAccounts.js
- dealingRangeLoop.ts
- dataExport.js
- tdd_mit_claude.ts
- orderBlocks.ts
- priceChartHitTest.test.js
- TradeSetupCockpit.vue
- applyMarketStructurePivot
- FibTickPrimitive
- rsiRendering.js
- useClaudeAnnotations.js
- trading-monitor-mcp/marketStructureAnalysis.ts
- priceChartConstants.js
- pinContext.js
- Laniakea Persona Command (/l)
- Plan: Sehr Große Dateien Refactoren (PriceChart.vue)
- fachdoku-router/SKILL.md
- Plan: Forex-Chart-Objekte Datengrundlage
- snapToBarTime
- cTrader Open API as Forex Candle Source
- gbp_h1_uptrend.ts
- tradeSetupCockpit.ts
- berlinDateStrFor
- src/marketStructureAnalysis.ts
- biasCheck.ts
- pinEntryVisible
- liquidity.js
- biasEngine.ts
- tradeSetup.js
- pivotMarkers.ts
- poi-watcher/index.ts
- State Machine for Lana's Trading Flow
- compilerOptions
- dailyPivotMarkers.js
- claudeAnnotations.js
- format.js
- AGENTS.md
- Trading-Monitor Project Overview (CLAUDE.md)
- canShowLabels
- findAntiConfluences.js
- usePriceChartMarketStructure.js
- clearArmStatesExcept
- forexCandles.js
- SessionBandPaneView
- TradingFlow.vue
- ArrowPaneView
- Fachdoku-Router Skill
- ClaudeAnnotationsModal.vue
- Dealing-Range-Loop Diagram
- marketStructureAnalysisLqSweep.test.js
- App.vue
- AI Capabilities and Limitations Notes
- Vegapunk Slimming Results (-86%)
- dataExport.ts
- router.js
- PinAddPopup.vue
- twelvedata/client.ts
- Anleitung: State-Machine lesen & bedienen
- tradeSetup.ts
- usePriceChartRsi
- marketStructureAnalysisNestedNestedChoch.test.js
- MCP-Server: Tiefere Referenz
- newsEvents.js
- usePriceChartClaudeAnnotations
- cssColor
- AnnotationsPrimitive
- trade_evidence Table (Dual-Level, Confirmation/Confluence)
- MetadataPanel.vue
- RangeLinePaneView
- /task do Mode
- src/pipConfig.js
- marketStructureAnalysisInnerPivots.test.js
- TradeStats.vue
- Lana-Fehlerdiagnose
- Agent Skills Pro Notes
- NewsModal.vue
- fetch-trend-fixture.mjs
- ContextMenu.vue
- ctraderCandles.js
- Aufmerksamkeits-Level (Watch-Level-Strategie Schritt 5+)
- Debug-Metadata-Panel Notes
- AI Failure as Property Collision
- MCP Advanced Topics Notes
- candleCache.js
- vite.config.js
- lana-git-pull.cjs
- pricePrecisionForInstrument
- .mcp.json
- marketStructureAnalysis.test.js
- trading-monitor index.html Entry
- Handbuch-Check
- trendIndicator.gbpusd-downtrend.test.js
- Claude Code Hooks Documentation Pointers
- mcp-server/src/scripts/backfillObZones.ts
- supabaseClient.js
- Dealing Range anlegen
- .codex/hooks/lana-git-pull.cjs
- source-command-l
- chartTimeUtils.js
- alarmLog.js
- JsonTree.vue
- PinPanel.vue
- fmtDateTime

## God Nodes (most connected - your core abstractions)
1. `berlinDateStrFor()` - 45 edges
2. `cssColor()` - 34 edges
3. `berlinDateTimeStrFor()` - 33 edges
4. `fetchForexCandles()` - 31 edges
5. `json()` - 30 edges
6. `pricePrecisionForInstrument()` - 30 edges
7. `fmtPrice()` - 28 edges
8. `clipReplay()` - 27 edges
9. `logDecision()` - 25 edges
10. `lineWidth()` - 24 edges

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

## Communities (141 total, 10 thin omitted)

### Community 0 - "Dashboard.vue"
Cohesion: 0.02
Nodes (121): useSessionStorageRef(), useTabScopedRef(), addPositionToDealingRange(), fetchTradeSetupForCockpit(), antiConfluenceAddTrade, anyArmStateActive, ARM_STATES, closeTradeEditModal() (+113 more)

### Community 1 - "gbp_h1_uptrend_uptrend_break_of_structure_und_trendumkehr.ts"
Cohesion: 0.02
Nodes (101): candlesAroundBOS, candlesAroundBreak, p2Pivot1, p2Pivot10, p2Pivot11, p2Pivot12, p2Pivot13, p2Pivot14 (+93 more)

### Community 2 - "reads.ts"
Cohesion: 0.08
Nodes (43): isBoxInvalidated(), detectSetupObs(), berlinDayRangeUtcMs(), findRecentTradeSetupIdsByKey(), getForexCandlesArchive(), getForexCandlesArchiveUpTo(), getJournal(), getTradeSetups() (+35 more)

### Community 3 - "AntiConfluencePickerModal.vue"
Cohesion: 0.29
Nodes (6): candidateLabel(), candidatePrice(), emit, mergedCandidates, precision, props

### Community 4 - "PriceChart.vue"
Cohesion: 0.04
Nodes (65): activeMetadataSnapshot, allCandles, antiConfluencePickerCurrentPrice, antiConfluencePickerDivergenceCandidates, antiConfluencePickerHoveredLiquidityKey, antiConfluencePickerHoveredObKey, antiConfluencePickerInvalidationObCandidates, antiConfluencePickerObCandidates (+57 more)

### Community 5 - "gbp_h1_uptrend_mit_LQ_sweep_LONG_SETUP.ts"
Cohesion: 0.03
Nodes (60): p2Pivot1, p2Pivot10, p2Pivot11, p2Pivot12, p2Pivot13, p2Pivot14, p2Pivot15, p2Pivot16 (+52 more)

### Community 6 - "gbp_h1_uptrend_mit_inner_structure.ts"
Cohesion: 0.04
Nodes (55): p2Pivot1, p2Pivot10, p2Pivot11, p2Pivot12, p2Pivot13, p2Pivot14, p2Pivot15, p2Pivot16 (+47 more)

### Community 7 - "db.ts"
Cohesion: 0.06
Nodes (63): inducementAgeRange(), InducementClass, addPinEntry(), addPinM5LiquidityEntry(), addPinM5ObEntry(), addPinRsiDivergenceEntry(), addTradeConfirmation(), AddTradeConfirmationArgs (+55 more)

### Community 8 - "usePriceChartRsi.js"
Cohesion: 0.17
Nodes (19): buildDivergenceEntry(), collectDivergenceHistory(), computeRsi(), DEFAULT_DIVERGENCE_FRACTAL_PERIOD, DEFAULT_DIVERGENCE_HISTORY_COUNT, DEFAULT_DIVERGENCE_LOOKBACK_BARS, DEFAULT_RSI_PERIOD, detectRsiDivergence() (+11 more)

### Community 9 - "marketStructureRendering.ts"
Cohesion: 0.12
Nodes (21): Candle, ArrowPrimitive, collectFibLevels(), collectH1LqLevels(), collectNestedChain(), computeFibLevels(), fibBetween(), firstCloseBelow() (+13 more)

### Community 10 - "rsiDivergenceStats.ts"
Cohesion: 0.09
Nodes (38): buildDivergenceEntry(), collectDivergenceHistory(), computeRsi(), DEFAULT_DIVERGENCE_FRACTAL_PERIOD, DEFAULT_DIVERGENCE_HISTORY_COUNT, DEFAULT_DIVERGENCE_LOOKBACK_BARS, DEFAULT_RSI_PERIOD, detectRsiDivergence() (+30 more)

### Community 11 - "DataExportModal.vue"
Cohesion: 0.09
Nodes (22): asset, copied, copyResult(), currentSymbol, dateStr, error, generate(), loading (+14 more)

### Community 12 - "validationEvidence.ts"
Cohesion: 0.13
Nodes (28): createDealingRange(), deleteDealingRange(), fetchActiveTscRangeId(), fetchDealingRangeCockpit(), getOpenOppositeDealingRanges(), computeEvidenceScore(), EvidenceScoreBreakdownEntry, EvidenceScoreInput (+20 more)

### Community 13 - "trading-monitor-mcp/pretradeGates.ts"
Cohesion: 0.17
Nodes (16): BERLIN_HM_FORMATTER, BERLIN_WEEKDAY_FORMATTER, berlinWeekdayAndMinutes(), isWithinTradingWindows(), TradingWindows, WeekdayGroup, ClassifiedNewsEvent, evaluateTradingHoursGate() (+8 more)

### Community 14 - "Plan: POI-Strategie-Findung, Backtesting & Trade-Notifications"
Cohesion: 0.18
Nodes (14): Supabase/PostgREST ~1000 Row Cap Gotcha, daily_structure_pivots Table, forex_candles Table, get_forex_candles_archive MCP Tool, BTC-USDT/OKX Complete Removal (2026-08-21), 1D-Periode-4-Pivot Market-Structure Startpoint (2026-08-30), Persisted Forex Candle Archive (forex_candles Pilot), Kronos LLM Forecast Entry-Filter Experiment (Shelved) (+6 more)

### Community 15 - "TradeEditModal.vue"
Cohesion: 0.05
Nodes (44): commission, emit, entryPrice, entryTimeInput, exitPrice, exitTimeInput, flashInvalidationSaved(), instrumentMismatch (+36 more)

### Community 16 - "package.json"
Cohesion: 0.06
Nodes (33): lightweight-charts, mermaid, dependencies, lightweight-charts, mermaid, @supabase/supabase-js, vue, vue-router (+25 more)

### Community 17 - "src/sessionOccurrences.js"
Cohesion: 0.28
Nodes (10): attachRangeExtremes(), bonusLabelForPivot(), buildSessionContextLookup(), contextForPivot(), daysOrAll(), localMidnightUtc(), localWeekday(), sessionExtremeSuffix() (+2 more)

### Community 18 - "LoopStatus.vue"
Cohesion: 0.07
Nodes (24): fetchLoopStateHistory(), fetchLoopStatesForDate(), LOOP_INSTRUMENTS, rowToLoopState(), fetchStateMachineLog(), rowToDecision(), activeByInstrument, { data, refresh } (+16 more)

### Community 19 - "backfillTradeSetupOutcomes.ts"
Cohesion: 0.15
Nodes (24): classifyInducementAge(), classifyOutcome(), computeSlTp(), computeSweepAgeHours(), deriveEntryInvalidation(), MAX_SL_PIPS, OutcomeCandle, OutcomeResult (+16 more)

### Community 20 - "Dealing-Range-Anlegen Skill"
Cohesion: 0.14
Nodes (15): kind=pivot = Liquidity-Sweep-Only Semantics, Dealing-Range-Anlegen Skill, milk-city Task: Confluence-Tracking bei Dealing Ranges, trading/liquidität.md (Liquiditäts-Sweep-Mechanismus), AI Capabilities Framework (Next Token Prediction/Knowledge/Working Memory/Steerability), Diagnose-to-Fix Routing Table, Lana-Fehlerdiagnose Skill, docs/steerabilty-vs-wrong-ai-outputs.md (+7 more)

### Community 21 - "backfillObZones.ts"
Cohesion: 0.29
Nodes (9): backfillOne(), BAR_CONFIG, BARS, CandleRow, correctStaleZones(), fetchAllCandles(), fetchCorrectionCandidates(), INSTRUMENTS (+1 more)

### Community 22 - "newsMarkers.js"
Cohesion: 0.13
Nodes (11): refreshNewsMarkers(), DAY_KEY_FORMATTER, extrapolatedX(), formatEventLabel(), isSameBerlinDay(), NewsMarkerPaneView, NewsMarkerPrimitive, NewsMarkerRenderer (+3 more)

### Community 23 - "trading-monitor-mcp/index.ts"
Cohesion: 0.16
Nodes (20): postChartAnnotations(), buildServer(), MCP_TOKEN, json(), toPips(), ANNOTATION_SCHEMA, DRAWING_GROUP_SCHEMA, registerAnnotationTools() (+12 more)

### Community 24 - "ctrader/client.ts"
Cohesion: 0.08
Nodes (37): CORS_HEADERS, CORS_HEADERS, ExistingPivotRow, INSTRUMENTS, CORS_HEADERS, PERIOD_MAP, PERSISTABLE_BARS, persistIfArchivable() (+29 more)

### Community 25 - "marketStructureAnalysis Rules Overview"
Cohesion: 0.22
Nodes (15): Arbitrary Nesting Depth (2026-08-09), Rendering Rules (renderMarketStructureAnalysis), marketStructureAnalysis Rules Overview, Docht-vs-Bruch (Wick vs Close-Break) Unification, Standalone Downtrend Detection/Invalidation, Fibonacci Level (computeFibLevels/collectFibLevels), Inner-Pivots (Period 2) Fast Pre-Detection, LQ-Sweep Classification (markLqSweeps) (+7 more)

### Community 26 - "tradeIntake.js"
Cohesion: 0.13
Nodes (29): direction, emit, entryPrice, errorMsg, levels, precision, props, reasoning (+21 more)

### Community 27 - "trades.js"
Cohesion: 0.14
Nodes (17): onRemoveConfirmation(), removeConfirmationFromTrade(), fetchActiveTscRangeId(), fetchDealingRangeCockpit(), toLiquidityLevel(), fetchTrades(), toConfirmation(), groupBy() (+9 more)

### Community 28 - "fallClassifier.ts"
Cohesion: 0.10
Nodes (33): AgeTier, businessSecondsBetween(), classifyAge(), MAJOR_MIN_HOURS, MAJOR_MIN_SECONDS, MINOR_MAX_HOURS, MINOR_MAX_SECONDS, assessInducement() (+25 more)

### Community 29 - "orderBlocks.js"
Cohesion: 0.15
Nodes (24): emit, onAntiConfluencePickerHover(), onAntiConfluencePickerSelect(), onTargetPickerHover(), onTargetPickerSelect(), refreshLiquidityInternal(), refreshPoiZonesInternal(), detectOrderBlocks() (+16 more)

### Community 30 - "chartColors.js"
Cohesion: 0.05
Nodes (28): chartColors, DEFAULT_CHART_COLORS, resetChartColors(), chartLineWidths, DEFAULT_CHART_LINE_WIDTHS, resetChartLineWidths(), collapsed, emit (+20 more)

### Community 31 - "sessions.js"
Cohesion: 0.13
Nodes (17): emit, instrumentSessions, props, WEEKDAY_DISPLAY_ORDER, ALL_DAYS, addSession(), currentSessionDanger(), DANGER_LEVELS (+9 more)

### Community 32 - "gbp_h1_uptrend_protected_low_gebrochen.ts"
Cohesion: 0.08
Nodes (25): ClosedRange, MarketStructureState, PivotBase, PivotHigh, PivotLow, PivotTouched, PivotTypeAll, PivotUntouched (+17 more)

### Community 33 - "tradingAccounts.js"
Cohesion: 0.14
Nodes (16): currentLabel, open, selectedAccount, wrapperRef, accounts, accountsLoaded, createAccount(), deleteAccount() (+8 more)

### Community 34 - "dealingRangeLoop.ts"
Cohesion: 0.08
Nodes (45): computeHtfWatchLevels(), computeWatchLevels(), hasReaction(), isDrTrackingBusy(), ForceLiquidityInput, ForceObInput, appendHeartbeat(), closeLoopState() (+37 more)

### Community 35 - "dataExport.js"
Cohesion: 0.20
Nodes (17): berlinDayRangeUtcMs(), berlinOffsetMinutes(), buildDataExport(), computeExportTimeframeData(), computeLiquidityLevelsForExport(), computeObZonesForExport(), DATE_FORMATTER, fetchExportCandles() (+9 more)

### Community 36 - "tdd_mit_claude.ts"
Cohesion: 0.08
Nodes (24): nextPivot1, nextPivot10, nextPivot11, nextPivot2, nextPivot3, nextPivot4, nextPivot5, nextPivot6 (+16 more)

### Community 37 - "orderBlocks.ts"
Cohesion: 0.15
Nodes (13): buildLevel(), detectLiquidityLevels(), isDownFractal(), isUpFractal(), Candle, detectOrderBlocks(), HTF_FOREX_LABELS, HTF_FOREX_MIN_GAP_PIPS (+5 more)

### Community 38 - "priceChartHitTest.test.js"
Cohesion: 0.07
Nodes (22): findClickedDivergence(), findClickedLiquidityLevel(), findClickedOBZone(), findClickedSetup(), findClickedTarget(), OrderBlockPrimitive, ZonePaneView, ZoneRenderer (+14 more)

### Community 39 - "TradeSetupCockpit.vue"
Cohesion: 0.08
Nodes (26): Plan: find_targets Algorithmus, TSC-Neuaufbau Precondition, emit, emit, accentStyle, antiConfluences, canTransfer, confirmations (+18 more)

### Community 40 - "applyMarketStructurePivot"
Cohesion: 0.11
Nodes (25): advanceNestedTrendInner(), applyInnerMarketStructurePivot(), applyMarketStructurePivot(), initMarketStructureState(), chochConfirmedState(), confirmBreak, confirmedUptrendState(), originHigh (+17 more)

### Community 41 - "FibTickPrimitive"
Cohesion: 0.15
Nodes (3): FibTickPaneView, FibTickPrimitive, FibTickRenderer

### Community 42 - "rsiRendering.js"
Cohesion: 0.14
Nodes (6): drawIconLabel(), refreshDivergence(), DivergenceLinePaneView, DivergenceLinePrimitive, DivergenceLineRenderer, mergePinnedDivergences()

### Community 43 - "useClaudeAnnotations.js"
Cohesion: 0.16
Nodes (19): addClaudeAnnotationDrawing(), fetchClaudeAnnotations(), removeClaudeAnnotationDrawing(), setClaudeAnnotationDrawingVisible(), add(), currentSymbol, dateStr, drawings (+11 more)

### Community 44 - "trading-monitor-mcp/marketStructureAnalysis.ts"
Cohesion: 0.06
Nodes (59): buildLevel(), detectLiquidityLevels(), isDownFractal(), isUpFractal(), LIQUIDITY_FRACTAL_PERIOD, LiquidityLevel, advanceNestedTrend(), advanceNestedTrendInner() (+51 more)

### Community 45 - "priceChartConstants.js"
Cohesion: 0.07
Nodes (34): usePriceChartTradeSetupDrawing(), usePriceChartTradeSetups(), fetchM5Candles(), fetchTrendAnalysisM5History(), getTrendAnalysisM5Candles(), CALLOUT_STACK_GAP_PX, CLOSE_POLL_BUFFER_MS, COPIED_FEEDBACK_MS (+26 more)

### Community 46 - "pinContext.js"
Cohesion: 0.16
Nodes (19): addPinEntry(), addPinM5LiquidityEntry(), addPinM5ObEntry(), addPinRsiDivergenceEntry(), addPinTscSetupEntry(), fetchPinContext(), REF_COLUMN, removePinEntry() (+11 more)

### Community 47 - "Laniakea Persona Command (/l)"
Cohesion: 0.13
Nodes (18): 00-trading-steps.md Entry Point, Laniakea Persona Command (/l), trading/claude-project-instructions.md, trading-runs Relative Link Path Convention, 00-trading-steps.md#visuelle-antworten-chart-annotationen, 06-anti-confluence.md, glossar.md Consistency Check, kontext-ausführung.md (+10 more)

### Community 48 - "Plan: Sehr Große Dateien Refactoren (PriceChart.vue)"
Cohesion: 0.18
Nodes (11): Keep Codebase Clean / ~1000 Line Backstop Convention, liquidity_levels Table, Pip-Distance Server-Side Query Filter, Plan: Sehr Große Dateien Refactoren (PriceChart.vue), Phase 1: Candle-/Zeit-Helfer -> priceChartCandles.js, Phase 3: Liquidity-Merge -> priceChartLiquidity.js, Phase 4: RSI-Divergenz-Pin-Merge, Phase 5: Klick-Hittest-Funktionen (priceChartHitTest.js) (+3 more)

### Community 49 - "fachdoku-router/SKILL.md"
Cohesion: 0.18
Nodes (10): Fachdoku-Router, News Events Seed Workflow (ForexFactory Screenshot), News Events Seeding Notes, news_events Consumption (No-Go + Chart Markers), Settings-Sync Notes, localStorage-first / Supabase-Source-of-Truth Pattern, trading_loop_state Table Design, TSC No-Gos and Anti-Confluences Notes (+2 more)

### Community 50 - "Plan: Forex-Chart-Objekte Datengrundlage"
Cohesion: 0.22
Nodes (11): ob_zones Table, Archive-First Auto-Reload Pattern (Tried, Then Reverted), BTC Scope Removal from Chart-Objects Plan, 1H/4H DB-Read vs Live-Recompute Decision, Four Independent OB Render Passes Problem, "Historische OBs"-Toggle Semantics, LQ-Sweep Relevance Criterion (Recent OR Pip-Range), Plan: Forex-Chart-Objekte Datengrundlage (+3 more)

### Community 52 - "cTrader Open API as Forex Candle Source"
Cohesion: 0.40
Nodes (5): cTrader Open API as Forex Candle Source, cTrader Wire Protocol Implementation (Manual Protobuf), supabase/functions/_shared/ctrader/client.ts, supabase/functions/_shared/twelvedata/client.ts (Unwired), supabase/functions/forex-candles

### Community 53 - "gbp_h1_uptrend.ts"
Cohesion: 0.10
Nodes (20): pivot1, pivot10, pivot11, pivot12, pivot13, pivot2, pivot3, pivot4 (+12 more)

### Community 54 - "tradeSetupCockpit.ts"
Cohesion: 0.11
Nodes (24): trendChain, trendChainDisplay, computeTrendChainAges(), FibLevel, Pivot, RangeTrend, ANTI_CONFLUENCE_COLOR, ANTI_CONFLUENCE_THRESHOLD (+16 more)

### Community 55 - "berlinDateStrFor"
Cohesion: 0.13
Nodes (23): berlinDateStrFor(), berlinDateTimeStrFor(), DATE_FORMATTER, OFFSET_FORMATTER, TIME_FORMATTER, berlinTwinKey(), withBerlinTimes(), getLoopStateForDay() (+15 more)

### Community 56 - "src/marketStructureAnalysis.ts"
Cohesion: 0.34
Nodes (15): advanceNestedTrend(), applyInnerMarketStructurePivotCore(), applyMarketStructurePivotCore(), closesAboveOldHigh(), closesBelowLevel(), evaluateConfirmingBreak(), invalidateDowntrend(), invalidateUptrend() (+7 more)

### Community 57 - "biasCheck.ts"
Cohesion: 0.12
Nodes (33): buildPendingDecisions(), getNewsEvents(), getTradingSchedule(), findNearestLiquidityTargets(), findNearestObTargets(), findTargetCandidates(), isTooFarFromPrice(), upsertBiasFields() (+25 more)

### Community 58 - "pinEntryVisible"
Cohesion: 0.14
Nodes (18): liquidityLevelEntryNaturalKey(), m5LiquidityEntryNaturalKey(), obZoneEntryNaturalKey(), hoveredPinLiquidityLevelKey, hoveredPinObZoneKey, onSelectPin(), pinEntryVisible(), pinJumpHint (+10 more)

### Community 59 - "liquidity.js"
Cohesion: 0.06
Nodes (56): AgeTier, classifyAge(), MAJOR_MIN_SECONDS, MINOR_MAX_SECONDS, ageReferenceTime(), businessSecondsBetween(), formatAge(), confirmationLabel() (+48 more)

### Community 60 - "biasEngine.ts"
Cohesion: 0.36
Nodes (5): findIntermediateLevel(), FindIntermediateLevelArgs, IntermediateLevelCandidate, isSpreadHourPivot(), PendingDecision

### Community 61 - "tradeSetup.js"
Cohesion: 0.15
Nodes (15): Two Runtimes, One Algorithm Set (Deliberate Duplication), computeTradeSetups(), closesBeyondLevel(), detectSetupObs(), detectTradeSetups(), findAllProtectedFractals(), findBestLsMatch(), findFirstSetupObAfter() (+7 more)

### Community 62 - "pivotMarkers.ts"
Cohesion: 0.14
Nodes (7): Candle, PivotMarkerGroup, PivotMarkerPaneView, PivotMarkerPrimitive, PivotMarkerRenderer, RenderOptions, renderPivotMarkers()

### Community 63 - "poi-watcher/index.ts"
Cohesion: 0.12
Nodes (15): fetchForexBatch(), fmt(), InstrumentConfig, INSTRUMENTS, isInWindows(), LiquidityLevelRow, localMinutesAndWeekday(), ObZoneRow (+7 more)

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
Cohesion: 0.15
Nodes (11): ANNOTATION_COLOR, annotationAnchorPoint(), AnnotationsRenderer, parseAnnotations(), resolveLabelPlacements(), resolveTime(), VALID_TYPES, validateAnnotationList() (+3 more)

### Community 68 - "format.js"
Cohesion: 0.16
Nodes (11): emit, lessonBadges(), OUTCOME_LABEL, props, rangeLabel(), rowStyle(), showCommission, fmtDate() (+3 more)

### Community 69 - "AGENTS.md"
Cohesion: 0.14
Nodes (12): Architecture, Commands, Conventions, Forex candle data: cTrader Open API, not Twelve Data, Frontend data flow (`PriceChart.vue`), Gotchas, graphify, "Laniakea" persona (`/l`) (+4 more)

### Community 70 - "Trading-Monitor Project Overview (CLAUDE.md)"
Cohesion: 0.15
Nodes (12): cTrader ACCESS_DENIED Lockout (No Auto-Recovery), DRY Within a Single Runtime Convention, CLAUDE.md Pointer to /l Persona, npm run build Command, Trading-Monitor Project Overview (CLAUDE.md), Rename Consistency Convention, REPLAY_LOOKAHEAD_SEC M1 Scaling Gotcha, ctrader_oauth_tokens Table (+4 more)

### Community 71 - "canShowLabels"
Cohesion: 0.17
Nodes (6): MIN_PIXELS_PER_HOUR_FOR_LABELS Constants, canShowLabels(), MIN_PIXELS_PER_HOUR_FOR_LABELS, MIN_PIXELS_PER_HOUR_FOR_LABELS_INTRADAY, LiquidityLineRenderer, positionsBox()

### Community 72 - "findAntiConfluences.js"
Cohesion: 0.42
Nodes (10): byDistance(), findAntiConfluenceCandidates(), findAntiConfluenceDivergenceCandidates(), findAntiConfluenceObCandidates(), findAntiConfluenceSweepCandidates(), findInvalidationObCandidates(), inBand(), MAX_HELD_OB_AGE_DAYS (+2 more)

### Community 73 - "usePriceChartMarketStructure.js"
Cohesion: 0.22
Nodes (8): marketStructureTree, compute1hStructureState(), dropUnknownStructureLevels(), buildMarketStructureState(), computeRangesPivots(), summarizeMarketStructureState(), RANGES_CANDLE_BUFFER, BASE_CTX

### Community 74 - "clearArmStatesExcept"
Cohesion: 0.15
Nodes (14): clearArmStatesExcept(), onAddAntiConfluenceRequest(), onAddConfirmationRequest(), onAddConfluenceRequest(), onAddRangeAntiConfluenceRequest(), onAddRangeConfirmationRequest(), onAddRangeConfluenceRequest(), onAddTargetRequest() (+6 more)

### Community 75 - "forexCandles.js"
Cohesion: 0.27
Nodes (14): DB_ARCHIVED_BARS, fetchArchivedPage(), fetchArchivedUpTo(), fetchCandles(), fetchCandlesBatchOnce(), fetchCandlesOnce(), fetchInitialCandles(), fetchOlderCandles() (+6 more)

### Community 76 - "SessionBandPaneView"
Cohesion: 0.14
Nodes (3): SessionBandPaneView, SessionBandPrimitive, SessionBandRenderer

### Community 77 - "TradingFlow.vue"
Cohesion: 0.10
Nodes (22): cache, useLocalStorageRef(), buildMermaidSource(), EDGES, getNextActionHint(), mermaidEscape(), NODES, activeByInstrument (+14 more)

### Community 79 - "Fachdoku-Router Skill"
Cohesion: 0.15
Nodes (13): poi-watcher UTC Refresh-Tick Exception, Trading-Hours/Timezone Handling (Europe/Berlin), sessions Table, trading_schedules Table, docs/debug-metadata-panel.md, Fachdoku-Router Skill, src/marketStructureAnalysis.notes.md, docs/mcp-server.md (+5 more)

### Community 80 - "ClaudeAnnotationsModal.vue"
Cohesion: 0.20
Nodes (9): emit, error, { instrument, dateStr, drawings, loading, add, remove, setDrawingVisible }, removeDrawing(), removingId, saving, text, toggleDrawingVisible() (+1 more)

### Community 81 - "Dealing-Range-Loop Diagram"
Cohesion: 0.17
Nodes (12): Dealing-Range-Loop Diagram, News-Blackout Mid-Loop Pause, Pin-Aufräumen after TSC-Link, Target Selection Remains Lana's Judgment, Pin Tools (tools/pins.ts), poi-watcher Alert-Cron Notes, poi-watcher 3-Tier Fetch Throttling, UTC-Hours Exception for Refresh Ticks (+4 more)

### Community 82 - "marketStructureAnalysisLqSweep.test.js"
Cohesion: 0.25
Nodes (7): baseState(), candles, levelRealBreak, levelSweep, levelUntouched, origin, triggerPivot

### Community 83 - "App.vue"
Cohesion: 0.11
Nodes (20): { activeLabels, isActive }, isFresh, { lastSuccessAt }, lastUpdateText, now, showClaudeAnnotationsModal, showDataExport, statusDotClass (+12 more)

### Community 84 - "AI Capabilities and Limitations Notes"
Cohesion: 0.17
Nodes (12): Delegation (4D Framework), Description (4D Framework), Diligence (4D Framework), Discernment (4D Framework), AI Fluency: 4D Framework Notes, calc_rr Tool Idea (Deterministic RR Calc), AI Capabilities and Limitations Notes, Letter-over-Spirit Failure Mode (+4 more)

### Community 85 - "Vegapunk Slimming Results (-86%)"
Cohesion: 0.17
Nodes (13): get_data_export Tool, Tool 2: run_bias_check, Lana Test Data README, Chronological MCP Tool Call Sequence, Output-too-large Problem, Vegapunk Slimming Results (-86%), marketStructureAnalysis Developer Notes, File Separation: Algorithm vs Rendering (+5 more)

### Community 86 - "dataExport.ts"
Cohesion: 0.07
Nodes (60): filterRelevantLevels(), LIQUIDITY_MAX_RELEVANT, berlinOffsetMinutes(), asOfProbeCandles(), fetchAllRows(), getLatestDailyStructureStartTime(), getLiquidityLevels(), getObZones() (+52 more)

### Community 87 - "router.js"
Cohesion: 0.24
Nodes (8): ALARM_TYPES, fetchAlarmSettings(), setAlarmEnabled(), router, alarms, errorText, loading, toggle()

### Community 88 - "PinAddPopup.vue"
Cohesion: 0.23
Nodes (11): clampedX, clampedY, confirm(), emit, note, onKeydown(), onWindowMousedown(), props (+3 more)

### Community 89 - "twelvedata/client.ts"
Cohesion: 0.21
Nodes (11): Candle, fetchCandles(), FetchCandlesOptions, INTERVAL_MAP, requestTimeSeries(), resample(), RESAMPLE_BUCKET_SEC, SUPPORTED_PERIODS (+3 more)

### Community 90 - "Anleitung: State-Machine lesen & bedienen"
Cohesion: 0.25
Nodes (7): Ablaufbeispiel, Anleitung: State-Machine lesen & bedienen, Grundprinzip, Maschine bedienen, Menschlicher Gegencheck, `replayUntilSec` — der EINE Zeit-Parameter (alle Tools), State lesen, ohne die Maschine zu bewegen

### Community 91 - "tradeSetup.ts"
Cohesion: 0.20
Nodes (15): LiquidityLevel, closesBeyondLevel(), DetectedTradeSetup, detectTradeSetup(), findBestLsMatch(), findFirstSetupObAfter(), findImmediateLsSetup(), findLsInArray() (+7 more)

### Community 92 - "usePriceChartRsi"
Cohesion: 0.24
Nodes (8): nativeLineWidth(), usePriceChartRsi(), applyColorOptions(), applyLineWidthOptions(), create(), refreshEma(), refreshRsi(), computeEma()

### Community 93 - "marketStructureAnalysisNestedNestedChoch.test.js"
Cohesion: 0.17
Nodes (11): confirmBreak, originHigh, originLow, pivotB, pivotC, pivotD, pivotE, pivotF (+3 more)

### Community 94 - "MCP-Server: Tiefere Referenz"
Cohesion: 0.20
Nodes (10): MCP Auth & Table Permissions, Backfill Scripts, Candle Archive (forex_candles), MCP Server Deployment (Supabase Edge Function), MCP-Server: Tiefere Referenz, get_forex_rsi / get_forex_ema Tools, Single Deno Copy (Dual-Copy Removed), Trade-Journal Write Tools (tools/trades.ts) (+2 more)

### Community 95 - "newsEvents.js"
Cohesion: 0.25
Nodes (10): usePriceChartCockpit(), refreshCockpit(), usePriceChartSessionsAndNews(), refreshSessions(), currentNewsNoGo(), INSTRUMENT_CURRENCIES, NEWS_NOGO_WINDOW_MINUTES, newsEvents (+2 more)

### Community 96 - "usePriceChartClaudeAnnotations"
Cohesion: 0.40
Nodes (3): renderClaudeAnnotations(), usePriceChartClaudeAnnotations(), refresh()

### Community 97 - "cssColor"
Cohesion: 0.11
Nodes (36): cssColor(), cssColorScaled(), hexToRgba(), lineWidth(), tradesVisibleForCandles(), buildActiveMetadataSnapshotInternal(), clearTradeSetupFocus(), clipReplay() (+28 more)

### Community 99 - "trade_evidence Table (Dual-Level, Confirmation/Confluence)"
Cohesion: 0.16
Nodes (14): dealing_ranges Table, trade_evidence Table (Dual-Level, Confirmation/Confluence), trade_partial_exits Table, trade_positions Table, trade_targets Table, Confirmation/Confluence/Anti-Confluence Categories, trading repo trade-from-poi.md (Confirmation/Confluence/Anti-Confluence Definition), OB-Zones Canonical FK Consolidation Approach (+6 more)

### Community 100 - "MetadataPanel.vue"
Cohesion: 0.24
Nodes (10): emit, height, left, onDrag(), panelEl, props, startDrag(), stopDrag() (+2 more)

### Community 102 - "/task do Mode"
Cohesion: 0.38
Nodes (7): Laniakea milk-city Task-Status Rule, /task Default Data-Maintenance Mode, /task do Mode, /task new Mode, /task refine Mode, /task Command Router, milk-city Task Status Convention

### Community 103 - "src/pipConfig.js"
Cohesion: 0.09
Nodes (25): HTF_FOREX_MIN_GAP_PIPS Constant, LOWER_TF_MIN_GAP_PIPS Constant, Pip-/Pixel-Schwellwerte Übersicht, MAX_TARGET_DISTANCE_PIPS Constant, PIP_SIZE Constant, RANGE_FIB_MIN_PP_DISTANCE_PIPS Constant, TRADE_SETUP_LS_MAX_DISTANCE_M5 Constant, find_targets Target-Candidate Algorithm Design (+17 more)

### Community 104 - "marketStructureAnalysisInnerPivots.test.js"
Cohesion: 0.25
Nodes (7): h1Candles, p2Pivot3, p2Pivot4, p2Pivot5, pivot1, pivot2, pivot3

### Community 105 - "TradeStats.vue"
Cohesion: 0.33
Nodes (6): pnlClass, props, stats, winrateClass, fmtR(), computeTradeStats()

### Community 106 - "Lana-Fehlerdiagnose"
Cohesion: 0.33
Nodes (5): Ablauf, Ergebnis, Lana-Fehlerdiagnose, Routing: Diagnose → typischer Fix-Ort, Wann aufrufen

### Community 107 - "Agent Skills Pro Notes"
Cohesion: 0.29
Nodes (7): allowed-tools Skill Config, Context-free Scripts in Skills, Agent Skills Pro Notes, Progressive Disclosure in Skills, Skill Sharing & Troubleshooting, Skills Embedded in Subagents, Skills vs CLAUDE.md vs Hooks vs Subagents

### Community 108 - "NewsModal.vue"
Cohesion: 0.18
Nodes (11): CURRENCIES, emit, LIST_FORMATTER, newCurrency, newDateTime, newTitle, saving, submit() (+3 more)

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

### Community 116 - "candleCache.js"
Cohesion: 0.07
Nodes (39): cachedCandlesUpTo(), cacheKey(), fetchCandlesCached(), getCachedCandles(), mergeCandles(), openDb(), safeCompleteUpTo(), setCachedCandles() (+31 more)

### Community 117 - "vite.config.js"
Cohesion: 0.40
Nodes (3): DEBUG_DIR, DEBUG_FILE, __dirname

### Community 118 - "lana-git-pull.cjs"
Cohesion: 0.50
Nodes (3): { execFileSync }, path, TRADING_REPO

### Community 119 - "pricePrecisionForInstrument"
Cohesion: 0.11
Nodes (19): findClickedFibLevel(), emit, OUTCOME_LABEL, precision, props, sortedDivergences, stats, candidateLabel() (+11 more)

### Community 122 - "marketStructureAnalysis.test.js"
Cohesion: 0.22
Nodes (8): pivot1, pivot2, pivot3, pivot4, pivot5, pivot6, pivot7, pivot8

### Community 125 - "Handbuch-Check"
Cohesion: 0.40
Nodes (4): Ergebnis, Handbuch-Check, Prüfpunkte, Wann aufrufen

### Community 134 - "supabaseClient.js"
Cohesion: 0.24
Nodes (7): fetchDailyStructurePivots(), fetchLiquidityLevelsHtf(), fetchObZones(), supabase, { data: dbDailyPivots }, { data: dbLiquidityLevelsHtf }, { data: dbObZones }

### Community 135 - "Dealing Range anlegen"
Cohesion: 0.50
Nodes (3): Ablauf, Dealing Range anlegen, Warum ein eigener Skill (nicht nur eine Doku-Zeile)

### Community 136 - ".codex/hooks/lana-git-pull.cjs"
Cohesion: 0.50
Nodes (3): { execFileSync }, path, TRADING_REPO

### Community 138 - "chartTimeUtils.js"
Cohesion: 0.19
Nodes (12): minutesToTimeInput(), timeInputToMinutes(), addWindow(), cloneWindows(), DEFAULT_SCHEDULES, EMPTY_WINDOWS, loadInitial(), removeWindow() (+4 more)

### Community 139 - "alarmLog.js"
Cohesion: 0.22
Nodes (10): fetchAlarmLog(), fetchTouchedLiquidityLevels(), fetchTradeSetups(), usePolledFetch(), lastSuccessAt, useStatusBar(), fetchTouchedZones(), currentSymbol (+2 more)

### Community 143 - "JsonTree.vue"
Cohesion: 0.25
Nodes (5): entries, expanded, isArray, isObject, props

### Community 144 - "PinPanel.vue"
Cohesion: 0.32
Nodes (7): emit, noteSaveTimers, onEntryClick(), onNoteInput(), OUTCOME_LABEL, props, rows

### Community 153 - "fmtDateTime"
Cohesion: 0.36
Nodes (8): buildActiveMetadataSnapshot(), earliestRelevantTime(), hasActiveMetadata(), selectActiveMetadataSections(), fmtDateTime(), ALL_OFF, BASE_CTX, SECTIONS

## Ambiguous Edges - Review These
- `Trading-Steps-Ablauf Diagram` → `calc_rr Tool Idea (Deterministic RR Calc)`  [AMBIGUOUS]
  docs/steerabilty-vs-wrong-ai-outputs.md · relation: references

## Knowledge Gaps
- **1099 isolated node(s):** `DEFAULT_LIQUIDITY_TARGET_LIMIT`, `DEFAULT_OB_TARGET_LIMIT`, `MAX_TARGET_DISTANCE_PIPS`, `StructureConfig`, `TREND_AGE_DATE_FORMATTER` (+1094 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1317 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Trading-Steps-Ablauf Diagram` and `calc_rr Tool Idea (Deterministic RR Calc)`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **Why does `businessSecondsBetween()` connect `fallClassifier.ts` to `liquidity.js`, `backfillTradeSetupOutcomes.ts`, `dataExport.ts`?**
  _High betweenness centrality (0.084) - this node is a cross-community bridge._
- **Why does `businessSecondsBetween()` connect `liquidity.js` to `cssColor`, `PriceChart.vue`, `chartTimeUtils.js`, `candleCache.js`, `tradeSetupCockpit.ts`?**
  _High betweenness centrality (0.083) - this node is a cross-community bridge._
- **Why does `classifyAge()` connect `liquidity.js` to `cssColor`, `PriceChart.vue`?**
  _High betweenness centrality (0.058) - this node is a cross-community bridge._
- **What connects `DEFAULT_LIQUIDITY_TARGET_LIMIT`, `DEFAULT_OB_TARGET_LIMIT`, `MAX_TARGET_DISTANCE_PIPS` to the rest of the system?**
  _1099 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Dashboard.vue` be split into smaller, more focused modules?**
  _Cohesion score 0.016013071895424835 - nodes in this community are weakly interconnected._
- **Should `gbp_h1_uptrend_uptrend_break_of_structure_und_trendumkehr.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0196078431372549 - nodes in this community are weakly interconnected._