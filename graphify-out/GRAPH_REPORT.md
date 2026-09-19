# Graph Report - trading-monitor  (2026-09-19)

## Corpus Check
- 479 files · ~473,923 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 3006 nodes · 6142 edges · 152 communities (134 shown, 12 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 109 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `b6ae8845`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Dashboard.vue
- gbp_h1_uptrend_uptrend_break_of_structure_und_trendumkehr.ts
- reads.ts
- tradeMarkers.js
- PriceChart.vue
- gbp_h1_uptrend_mit_LQ_sweep_LONG_SETUP.ts
- gbp_h1_uptrend_mit_inner_structure.ts
- db.ts
- usePriceChartRsi.js
- marketStructureRendering.ts
- rsiDivergenceStats.ts
- DataExportModal.vue
- dataSnapshot.ts
- tools/pretradeGates.ts
- Plan: POI-Strategie-Findung, Backtesting & Trade-Notifications
- TradeEditModal.vue
- package.json
- src/sessionOccurrences.js
- LoopStatus.vue
- backfillTradeSetupOutcomes.ts
- Dealing-Range-Anlegen Skill
- trading-monitor-mcp/pipConfig.js
- newsMarkers.js
- nearRelevantLiquidityLevels.ts
- ctrader/client.ts
- marketStructureAnalysis Rules Overview
- tradeIntake.js
- trades.js
- trades.ts
- orderBlocks.js
- chartLineWidths.js
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
- Plan: Forex-Chart-Objekte Datengrundlage
- fachdoku-router/SKILL.md
- marketStructureAnalysisNestedNestedChoch.test.js
- forexCandles.ts
- usePriceChartLiquidity.js
- gbp_h1_uptrend.ts
- tradeSetupCockpit.ts
- DR-Reichweite — Grundmessung + Filter-Auswertungen
- src/marketStructureAnalysis.ts
- biasCheck.ts
- pinEntryVisible
- tradeEvidence.ts
- findTargetCandidates.js
- tradeSetup.js
- pivotMarkers.ts
- poi-watcher/index.ts
- State Machine for Lana's Trading Flow
- compilerOptions
- dailyPivotMarkers.js
- claudeAnnotations.js
- pricePrecisionForInstrument
- AGENTS.md
- Trading-Monitor Project Overview (CLAUDE.md)
- LiquidityLineRenderer
- daily-structure-pivots/index.ts
- liquidityDetection.ts
- clearArmStatesExcept
- forexCandles.js
- SessionBandPaneView
- TradingFlow.vue
- ArrowPaneView
- Fachdoku-Router Skill
- clipReplay
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
- barSecondsFor
- chartTimeUtils.js
- MCP-Server: Tiefere Referenz
- TradeMarkerPrimitive
- liquidity.js
- drMerkmale.py
- NewsModal.vue
- trade_evidence Table (Dual-Level, Confirmation/Confluence)
- MetadataPanel.vue
- findAntiConfluenceCandidates.js
- /task do Mode
- findTargets.js
- newsEvents.js
- berlinDateStrFor
- Lana-Fehlerdiagnose
- Agent Skills Pro Notes
- chartColors.test.js
- fetch-trend-fixture.mjs
- ContextMenu.vue
- ctraderCandles.js
- Aufmerksamkeits-Level (Watch-Level-Strategie Schritt 5+)
- Debug-Metadata-Panel Notes
- AI Failure as Property Collision
- MCP Advanced Topics Notes
- usePriceChartMarketStructure.js
- vite.config.js
- lana-git-pull.cjs
- tradeTargets.ts
- .mcp.json
- DivergenceLinePrimitive
- marketStructureAnalysis.test.js
- trading-monitor index.html Entry
- debugMetadata.js
- Handbuch-Check
- trendIndicator.gbpusd-downtrend.test.js
- Claude Code Hooks Documentation Pointers
- mcp-server/src/scripts/backfillObZones.ts
- fetchForexCandles
- src/pipConfig.js
- marketStructureAnalysisInnerPivots.test.js
- canShowLabels
- Dealing Range anlegen
- .codex/hooks/lana-git-pull.cjs
- source-command-l
- tradingSchedules.js
- supabaseClient.js
- liquidity.ts
- JsonTree.vue
- PivotMarkerRenderer
- annotations.ts
- usePolledFetch.js
- addPositionToDealingRange
- useTabScopedRef
- fetchTradeSetupForCockpit

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
- `/task do Mode` --semantically_similar_to--> `milk-city Task Status Convention`  [INFERRED] [semantically similar]
  .claude/commands/task.md → CLAUDE.md
- `Laniakea milk-city Task-Status Rule` --semantically_similar_to--> `milk-city Task Status Convention`  [INFERRED] [semantically similar]
  .claude/commands/l.md → CLAUDE.md
- `Archive-First Auto-Reload Pattern (Tried, Then Reverted)` --semantically_similar_to--> `Persisted Forex Candle Archive (forex_candles Pilot)`  [INFERRED] [semantically similar]
  PLAN-chart-objekte-forex.md → PLAN-notifications.md
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

## Communities (152 total, 12 thin omitted)

### Community 0 - "Dashboard.vue"
Cohesion: 0.02
Nodes (120): useSessionStorageRef(), fetchDailyStructurePivots(), fetchLiquidityLevelsHtf(), fetchObZones(), antiConfluenceAddTrade, anyArmStateActive, ARM_STATES, closeTradeEditModal() (+112 more)

### Community 1 - "gbp_h1_uptrend_uptrend_break_of_structure_und_trendumkehr.ts"
Cohesion: 0.02
Nodes (101): candlesAroundBOS, candlesAroundBreak, p2Pivot1, p2Pivot10, p2Pivot11, p2Pivot12, p2Pivot13, p2Pivot14 (+93 more)

### Community 2 - "reads.ts"
Cohesion: 0.18
Nodes (21): getForexCandlesArchive(), getJournal(), getNewsEvents(), getTradeSetups(), getTradeSetupWinrate(), getTradingAccounts(), getTradingSchedule(), computeEma() (+13 more)

### Community 3 - "tradeMarkers.js"
Cohesion: 0.26
Nodes (8): drawEntryPoint(), drawExitPoint(), drawHaloRing(), drawLabel(), drawTick(), renderTradeMarkers(), TradeMarkerRenderer, tradeOptions()

### Community 4 - "PriceChart.vue"
Cohesion: 0.03
Nodes (74): activeMetadataSnapshot, allCandles, antiConfluencePickerCurrentPrice, antiConfluencePickerDivergenceCandidates, antiConfluencePickerHoveredLiquidityKey, antiConfluencePickerHoveredObKey, antiConfluencePickerInvalidationObCandidates, antiConfluencePickerObCandidates (+66 more)

### Community 5 - "gbp_h1_uptrend_mit_LQ_sweep_LONG_SETUP.ts"
Cohesion: 0.03
Nodes (60): p2Pivot1, p2Pivot10, p2Pivot11, p2Pivot12, p2Pivot13, p2Pivot14, p2Pivot15, p2Pivot16 (+52 more)

### Community 6 - "gbp_h1_uptrend_mit_inner_structure.ts"
Cohesion: 0.04
Nodes (55): p2Pivot1, p2Pivot10, p2Pivot11, p2Pivot12, p2Pivot13, p2Pivot14, p2Pivot15, p2Pivot16 (+47 more)

### Community 7 - "db.ts"
Cohesion: 0.07
Nodes (45): InducementClass, addPinEntry(), addPinM5LiquidityEntry(), addPinM5ObEntry(), addPinRsiDivergenceEntry(), addTradeConfirmation(), AddTradeConfirmationArgs, AddTradeTargetArgs (+37 more)

### Community 8 - "usePriceChartRsi.js"
Cohesion: 0.09
Nodes (37): nativeLineWidth(), usePriceChartRsi(), applyColorOptions(), applyLineWidthOptions(), create(), refreshEma(), refreshRsi(), computeEma() (+29 more)

### Community 9 - "marketStructureRendering.ts"
Cohesion: 0.12
Nodes (18): Candle, ArrowPrimitive, collectFibLevels(), collectH1LqLevels(), collectNestedChain(), computeFibLevels(), fibBetween(), FibLevel (+10 more)

### Community 10 - "rsiDivergenceStats.ts"
Cohesion: 0.09
Nodes (38): buildDivergenceEntry(), collectDivergenceHistory(), computeRsi(), DEFAULT_DIVERGENCE_FRACTAL_PERIOD, DEFAULT_DIVERGENCE_HISTORY_COUNT, DEFAULT_DIVERGENCE_LOOKBACK_BARS, DEFAULT_RSI_PERIOD, detectRsiDivergence() (+30 more)

### Community 11 - "DataExportModal.vue"
Cohesion: 0.09
Nodes (22): asset, copied, copyResult(), currentSymbol, dateStr, error, generate(), loading (+14 more)

### Community 12 - "dataSnapshot.ts"
Cohesion: 0.08
Nodes (44): isBoxInvalidated(), detectSetupObs(), berlinDateTimeStrFor(), DATE_FORMATTER, OFFSET_FORMATTER, TIME_FORMATTER, fetchDealingRangeCockpit(), findRecentTradeSetupIdsByKey() (+36 more)

### Community 13 - "tools/pretradeGates.ts"
Cohesion: 0.16
Nodes (19): BERLIN_HM_FORMATTER, BERLIN_WEEKDAY_FORMATTER, berlinWeekdayAndMinutes(), isWithinTradingWindows(), TradingWindows, WeekdayGroup, ClassifiedNewsEvent, evaluateNewsGate() (+11 more)

### Community 14 - "Plan: POI-Strategie-Findung, Backtesting & Trade-Notifications"
Cohesion: 0.16
Nodes (16): Supabase/PostgREST ~1000 Row Cap Gotcha, daily_structure_pivots Table, forex_candles Table, get_forex_candles_archive MCP Tool, Archive-First Auto-Reload Pattern (Tried, Then Reverted), 1H/4H DB-Read vs Live-Recompute Decision, BTC-USDT/OKX Complete Removal (2026-08-21), 1D-Periode-4-Pivot Market-Structure Startpoint (2026-08-30) (+8 more)

### Community 15 - "TradeEditModal.vue"
Cohesion: 0.06
Nodes (42): commission, emit, entryPrice, entryTimeInput, exitPrice, exitTimeInput, flashInvalidationSaved(), instrumentMismatch (+34 more)

### Community 16 - "package.json"
Cohesion: 0.06
Nodes (33): lightweight-charts, mermaid, dependencies, lightweight-charts, mermaid, @supabase/supabase-js, vue, vue-router (+25 more)

### Community 17 - "src/sessionOccurrences.js"
Cohesion: 0.24
Nodes (11): attachBonus(), ALL_DAYS, attachRangeExtremes(), bonusLabelForPivot(), buildSessionContextLookup(), daysOrAll(), localMidnightUtc(), localWeekday() (+3 more)

### Community 18 - "LoopStatus.vue"
Cohesion: 0.07
Nodes (24): fetchLoopStateHistory(), fetchLoopStatesForDate(), LOOP_INSTRUMENTS, rowToLoopState(), fetchStateMachineLog(), rowToDecision(), activeByInstrument, { data, refresh } (+16 more)

### Community 19 - "backfillTradeSetupOutcomes.ts"
Cohesion: 0.10
Nodes (33): businessSecondsBetween(), classifyAge(), classifyInducementAge(), inducementAgeRange(), MAJOR_MIN_HOURS, MINOR_MAX_HOURS, MINOR_MAX_SECONDS, classifyOutcome() (+25 more)

### Community 20 - "Dealing-Range-Anlegen Skill"
Cohesion: 0.14
Nodes (15): kind=pivot = Liquidity-Sweep-Only Semantics, Dealing-Range-Anlegen Skill, milk-city Task: Confluence-Tracking bei Dealing Ranges, trading/liquidität.md (Liquiditäts-Sweep-Mechanismus), AI Capabilities Framework (Next Token Prediction/Knowledge/Working Memory/Steerability), Diagnose-to-Fix Routing Table, Lana-Fehlerdiagnose Skill, docs/steerabilty-vs-wrong-ai-outputs.md (+7 more)

### Community 21 - "trading-monitor-mcp/pipConfig.js"
Cohesion: 0.12
Nodes (18): firstObFormationTimeAfter(), TriggerCandle, detectOrderBlocks(), HTF_FOREX_LABELS, HTF_FOREX_MIN_GAP_PIPS, LOWER_TF_LABELS, LOWER_TF_MIN_GAP_PIPS, PIP_SIZE (+10 more)

### Community 22 - "newsMarkers.js"
Cohesion: 0.12
Nodes (13): usePriceChartSessionsAndNews(), refreshNewsMarkers(), refreshSessions(), DAY_KEY_FORMATTER, extrapolatedX(), formatEventLabel(), isSameBerlinDay(), NewsMarkerPaneView (+5 more)

### Community 23 - "nearRelevantLiquidityLevels.ts"
Cohesion: 0.23
Nodes (14): berlinOffsetMinutes(), ALL_DAYS, attachRangeExtremes(), bonusLabelForPivot(), buildSessionContextLookup(), contextForPivot(), daysOrAll(), localMidnightUtc() (+6 more)

### Community 24 - "ctrader/client.ts"
Cohesion: 0.12
Nodes (24): CORS_HEADERS, authAccount(), authenticate(), cachedSymbolIds, Candle, concat(), connectWithTimeout(), CTraderConnection (+16 more)

### Community 25 - "marketStructureAnalysis Rules Overview"
Cohesion: 0.22
Nodes (15): Arbitrary Nesting Depth (2026-08-09), Rendering Rules (renderMarketStructureAnalysis), marketStructureAnalysis Rules Overview, Docht-vs-Bruch (Wick vs Close-Break) Unification, Standalone Downtrend Detection/Invalidation, Fibonacci Level (computeFibLevels/collectFibLevels), Inner-Pivots (Period 2) Fast Pre-Detection, LQ-Sweep Classification (markLqSweeps) (+7 more)

### Community 26 - "tradeIntake.js"
Cohesion: 0.13
Nodes (27): direction, emit, entryPrice, errorMsg, levels, precision, props, reasoning (+19 more)

### Community 27 - "trades.js"
Cohesion: 0.10
Nodes (24): onRemoveTarget(), pnlClass, props, stats, winrateClass, fmtR(), removeConfirmationFromTrade(), removeTargetFromTrade() (+16 more)

### Community 28 - "trades.ts"
Cohesion: 0.13
Nodes (26): addTradePosition(), addTradeTarget(), createTrade(), deleteTradeTarget(), findOrCreateLiquidityLevelId(), getDealingRangeById(), insertTradePosition(), resolvePivotLiquidityLevelId() (+18 more)

### Community 29 - "orderBlocks.js"
Cohesion: 0.15
Nodes (24): emit, onAntiConfluencePickerHover(), onAntiConfluencePickerSelect(), onTargetPickerHover(), onTargetPickerSelect(), refreshLiquidityInternal(), refreshPoiZonesInternal(), detectOrderBlocks() (+16 more)

### Community 30 - "chartLineWidths.js"
Cohesion: 0.16
Nodes (9): chartColors, resetChartColors(), chartLineWidths, DEFAULT_CHART_LINE_WIDTHS, resetChartLineWidths(), collapsed, emit, GROUPS (+1 more)

### Community 31 - "sessions.js"
Cohesion: 0.14
Nodes (16): emit, instrumentSessions, props, WEEKDAY_DISPLAY_ORDER, addSession(), currentSessionDanger(), DANGER_LEVELS, DANGER_SEVERITY (+8 more)

### Community 32 - "gbp_h1_uptrend_protected_low_gebrochen.ts"
Cohesion: 0.08
Nodes (25): ClosedRange, MarketStructureState, PivotBase, PivotHigh, PivotLow, PivotTouched, PivotTypeAll, PivotUntouched (+17 more)

### Community 33 - "tradingAccounts.js"
Cohesion: 0.13
Nodes (17): currentLabel, open, selectedAccount, wrapperRef, accounts, accountsLoaded, ALL_ACCOUNTS_ID, createAccount() (+9 more)

### Community 34 - "dealingRangeLoop.ts"
Cohesion: 0.06
Nodes (60): AgeTier, assessInducement(), checkFallFour(), CheckFallFourInput, computeHtfWatchLevels(), computeWatchLevels(), FallFourResult, hasReaction() (+52 more)

### Community 35 - "dataExport.js"
Cohesion: 0.15
Nodes (23): marketStructureTree, berlinOffsetMinutes(), buildDataExport(), compute1hStructureState(), computeExportTimeframeData(), computeLiquidityLevelsForExport(), computeObZonesForExport(), computeTrendChainAges() (+15 more)

### Community 36 - "tdd_mit_claude.ts"
Cohesion: 0.08
Nodes (24): nextPivot1, nextPivot10, nextPivot11, nextPivot2, nextPivot3, nextPivot4, nextPivot5, nextPivot6 (+16 more)

### Community 37 - "orderBlocks.ts"
Cohesion: 0.18
Nodes (9): Candle, detectOrderBlocks(), HTF_FOREX_LABELS, HTF_FOREX_MIN_GAP_PIPS, LOWER_TF_LABELS, LOWER_TF_MIN_GAP_PIPS, Zone, DailyPivotLike (+1 more)

### Community 38 - "priceChartHitTest.test.js"
Cohesion: 0.07
Nodes (24): findClickedDivergence(), findClickedFibLevel(), findClickedLiquidityLevel(), findClickedOBZone(), findClickedSetup(), findClickedTarget(), getCurrentFibLevels(), OrderBlockPrimitive (+16 more)

### Community 39 - "TradeSetupCockpit.vue"
Cohesion: 0.08
Nodes (24): emit, emit, accentStyle, antiConfluences, canTransfer, confirmations, confluences, dateLabel (+16 more)

### Community 40 - "applyMarketStructurePivot"
Cohesion: 0.10
Nodes (25): applyMarketStructurePivot(), initMarketStructureState(), RANGE_FIB_MIN_PP_DISTANCE_PIPS, chochConfirmedState(), confirmBreak, confirmedUptrendState(), originHigh, originLow (+17 more)

### Community 41 - "FibTickPrimitive"
Cohesion: 0.15
Nodes (3): FibTickPaneView, FibTickPrimitive, FibTickRenderer

### Community 42 - "rsiRendering.js"
Cohesion: 0.27
Nodes (3): drawIconLabel(), DivergenceLineRenderer, mergePinnedDivergences()

### Community 43 - "useClaudeAnnotations.js"
Cohesion: 0.09
Nodes (29): addClaudeAnnotationDrawing(), fetchClaudeAnnotations(), removeClaudeAnnotationDrawing(), setClaudeAnnotationDrawingVisible(), applyText(), emit, error, { instrument, dateStr, drawings, loading, add, remove, setDrawingVisible } (+21 more)

### Community 44 - "trading-monitor-mcp/marketStructureAnalysis.ts"
Cohesion: 0.21
Nodes (23): advanceNestedTrend(), advanceNestedTrendInner(), applyInnerMarketStructurePivot(), applyInnerMarketStructurePivotCore(), applyMarketStructurePivot(), applyMarketStructurePivotCore(), buildMarketStructureState(), Candle (+15 more)

### Community 45 - "priceChartConstants.js"
Cohesion: 0.08
Nodes (31): usePriceChartTradeSetups(), fetchM5Candles(), fetchTrendAnalysisM5History(), getTrendAnalysisM5Candles(), CALLOUT_STACK_GAP_PX, CLOSE_POLL_BUFFER_MS, COPIED_FEEDBACK_MS, DEBUG_AUTOSAVE_INTERVAL_MS (+23 more)

### Community 46 - "pinContext.js"
Cohesion: 0.16
Nodes (21): addPinEntry(), addPinM5LiquidityEntry(), addPinM5ObEntry(), addPinRsiDivergenceEntry(), addPinTscSetupEntry(), fetchPinContext(), REF_COLUMN, removePinEntry() (+13 more)

### Community 47 - "Laniakea Persona Command (/l)"
Cohesion: 0.13
Nodes (18): 00-trading-steps.md Entry Point, Laniakea Persona Command (/l), trading/claude-project-instructions.md, trading-runs Relative Link Path Convention, 00-trading-steps.md#visuelle-antworten-chart-annotationen, 06-anti-confluence.md, glossar.md Consistency Check, kontext-ausführung.md (+10 more)

### Community 48 - "Plan: Forex-Chart-Objekte Datengrundlage"
Cohesion: 0.11
Nodes (21): Keep Codebase Clean / ~1000 Line Backstop Convention, liquidity_levels Table, ob_zones Table, BTC Scope Removal from Chart-Objects Plan, OB-Zones Canonical FK Consolidation Approach, Four Independent OB Render Passes Problem, "Historische OBs"-Toggle Semantics, LQ-Sweep Relevance Criterion (Recent OR Pip-Range) (+13 more)

### Community 49 - "fachdoku-router/SKILL.md"
Cohesion: 0.18
Nodes (10): Fachdoku-Router, News Events Seed Workflow (ForexFactory Screenshot), News Events Seeding Notes, news_events Consumption (No-Go + Chart Markers), Settings-Sync Notes, localStorage-first / Supabase-Source-of-Truth Pattern, trading_loop_state Table Design, TSC No-Gos and Anti-Confluences Notes (+2 more)

### Community 50 - "marketStructureAnalysisNestedNestedChoch.test.js"
Cohesion: 0.10
Nodes (17): advanceNestedTrendInner(), applyInnerMarketStructurePivot(), confirmBreak, originHigh, originLow, pullback, confirmBreak, originHigh (+9 more)

### Community 51 - "forexCandles.ts"
Cohesion: 0.18
Nodes (13): Candle, fetchLiveForexCandles(), fetchLiveForexCandlesOnce(), isRetryable(), ALL_BARS, backfillOne(), Bar, BARS (+5 more)

### Community 52 - "usePriceChartLiquidity.js"
Cohesion: 0.14
Nodes (22): usePriceChartLiquidity(), refresh(), liquidityLevelNaturalKey(), renderLiquidityLevels(), buildLevel(), detectLiquidityLevels(), filterRelevantLevels(), isDownFractal() (+14 more)

### Community 53 - "gbp_h1_uptrend.ts"
Cohesion: 0.10
Nodes (20): pivot1, pivot10, pivot11, pivot12, pivot13, pivot2, pivot3, pivot4 (+12 more)

### Community 54 - "tradeSetupCockpit.ts"
Cohesion: 0.07
Nodes (32): cssColor(), cssColorScaled(), hexToRgba(), trendChain, trendChainDisplay, rowStyle(), refreshDivergence(), usePriceChartTradeSetupDrawing() (+24 more)

### Community 55 - "DR-Reichweite — Grundmessung + Filter-Auswertungen"
Cohesion: 0.10
Nodes (20): 1. Handelszeit — größter Effekt, größte Stichprobe, 2. Gegenkraft — Paarvergleich nach Sweep-Stärke, 3. HTF-Sweep, 4. Sweep-Alter — höchster Median, kleinste Stichprobe, Basis, Das Angebot stimmt, Datenquellen (vor dem Lauf ziehen), Definitionen (+12 more)

### Community 56 - "src/marketStructureAnalysis.ts"
Cohesion: 0.25
Nodes (18): refreshMarketStructure(), advanceNestedTrend(), applyInnerMarketStructurePivotCore(), applyMarketStructurePivotCore(), buildMarketStructureState(), closesAboveOldHigh(), closesBelowLevel(), computeRangesPivots() (+10 more)

### Community 57 - "biasCheck.ts"
Cohesion: 0.13
Nodes (31): berlinDayRangeUtcMs(), buildPendingDecisions(), findIntermediateLevel(), FindIntermediateLevelArgs, IntermediateLevelCandidate, isSpreadHourPivot(), PendingDecision, upsertBiasFields() (+23 more)

### Community 58 - "pinEntryVisible"
Cohesion: 0.14
Nodes (18): liquidityLevelEntryNaturalKey(), m5LiquidityEntryNaturalKey(), obZoneEntryNaturalKey(), hoveredPinLiquidityLevelKey, hoveredPinObZoneKey, onSelectPin(), pinEntryVisible(), pinJumpHint (+10 more)

### Community 59 - "tradeEvidence.ts"
Cohesion: 0.18
Nodes (15): AgeTier, classifyAge(), MAJOR_MIN_SECONDS, MINOR_MAX_SECONDS, confirmationLabel(), confirmationLabel(), evidenceAgeSeconds(), evidenceAgeTier() (+7 more)

### Community 60 - "findTargetCandidates.js"
Cohesion: 0.16
Nodes (14): DEFAULT_LIQUIDITY_TARGET_LIMIT, DEFAULT_OB_TARGET_LIMIT, findNearestLiquidityTargets(), findNearestObTargets(), findTargetCandidates(), isTooFarFromPrice(), MAX_TARGET_DISTANCE_PIPS, M5_BAR_SECONDS (+6 more)

### Community 61 - "tradeSetup.js"
Cohesion: 0.14
Nodes (16): Two Runtimes, One Algorithm Set (Deliberate Duplication), computeTradeSetups(), closesBeyondLevel(), detectSetupObs(), detectTradeSetups(), findAllProtectedFractals(), findBestLsMatch(), findFirstSetupObAfter() (+8 more)

### Community 62 - "pivotMarkers.ts"
Cohesion: 0.20
Nodes (5): Candle, PivotMarkerGroup, PivotMarkerPaneView, PivotMarkerPrimitive, RenderOptions

### Community 63 - "poi-watcher/index.ts"
Cohesion: 0.12
Nodes (14): fetchForexBatch(), fmt(), InstrumentConfig, INSTRUMENTS, isInWindows(), LiquidityLevelRow, localMinutesAndWeekday(), ObZoneRow (+6 more)

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
Cohesion: 0.09
Nodes (16): ANNOTATION_COLOR, annotationAnchorPoint(), AnnotationsPaneView, AnnotationsPrimitive, AnnotationsRenderer, parseAnnotations(), renderClaudeAnnotations(), resolveLabelPlacements() (+8 more)

### Community 68 - "pricePrecisionForInstrument"
Cohesion: 0.07
Nodes (35): candidateLabel(), candidatePrice(), emit, mergedCandidates, precision, props, emit, noteSaveTimers (+27 more)

### Community 69 - "AGENTS.md"
Cohesion: 0.14
Nodes (12): Architecture, Commands, Conventions, Forex candle data: cTrader Open API, not Twelve Data, Frontend data flow (`PriceChart.vue`), Gotchas, graphify, "Laniakea" persona (`/l`) (+4 more)

### Community 70 - "Trading-Monitor Project Overview (CLAUDE.md)"
Cohesion: 0.11
Nodes (17): cTrader ACCESS_DENIED Lockout (No Auto-Recovery), cTrader Open API as Forex Candle Source, DRY Within a Single Runtime Convention, CLAUDE.md Pointer to /l Persona, npm run build Command, Trading-Monitor Project Overview (CLAUDE.md), Rename Consistency Convention, REPLAY_LOOKAHEAD_SEC M1 Scaling Gotcha (+9 more)

### Community 72 - "daily-structure-pivots/index.ts"
Cohesion: 0.16
Nodes (13): CORS_HEADERS, ExistingPivotRow, INSTRUMENTS, CORS_HEADERS, PERIOD_MAP, PERSISTABLE_BARS, persistIfArchivable(), RefreshedTokens (+5 more)

### Community 73 - "liquidityDetection.ts"
Cohesion: 0.17
Nodes (16): buildLevel(), detectLiquidityLevels(), isDownFractal(), isUpFractal(), LIQUIDITY_FRACTAL_PERIOD, LIQUIDITY_MAX_RELEVANT, LiquidityLevel, backfillOne() (+8 more)

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

### Community 80 - "clipReplay"
Cohesion: 0.12
Nodes (31): lineWidth(), tradesVisibleForCandles(), buildActiveMetadataSnapshotInternal(), clearTradeSetupFocus(), clipReplay(), computeTradeSetupsInternal(), focusTradeSetup(), loadTradeSetupM5() (+23 more)

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
Cohesion: 0.16
Nodes (17): filterRelevantLevels(), getLatestDailyStructureStartTime(), computeRangesPivots(), capStructurePivots(), coincidesWithHtf(), compute1hStructureState(), computeM5LiquidityAndObZones(), computeTrendChainAges() (+9 more)

### Community 87 - "router.js"
Cohesion: 0.27
Nodes (7): fetchAlarmSettings(), setAlarmEnabled(), router, alarms, errorText, loading, toggle()

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
Cohesion: 0.18
Nodes (16): LiquidityLevel, closesBeyondLevel(), DEFAULT_TRADE_SETUP_PARAMS, DetectedTradeSetup, detectTradeSetup(), findBestLsMatch(), findFirstSetupObAfter(), findImmediateLsSetup() (+8 more)

### Community 92 - "barSecondsFor"
Cohesion: 0.25
Nodes (14): applyAsOf(), applyAsOfZones(), earliestAmbiguousEventSec(), existsAsOf(), M5_SECONDS, ProbeCandle, resolveEventSec(), toSec() (+6 more)

### Community 93 - "chartTimeUtils.js"
Cohesion: 0.17
Nodes (16): computeNextReplayTime(), isTimeCovered(), mergeRecent(), nextCandleAfter(), replayFetchToMs(), snapToBarTime(), jumpToDivergence(), jumpToPin() (+8 more)

### Community 94 - "MCP-Server: Tiefere Referenz"
Cohesion: 0.20
Nodes (10): MCP Auth & Table Permissions, Backfill Scripts, Candle Archive (forex_candles), MCP Server Deployment (Supabase Edge Function), MCP-Server: Tiefere Referenz, get_forex_rsi / get_forex_ema Tools, Single Deno Copy (Dual-Copy Removed), Trade-Journal Write Tools (tools/trades.ts) (+2 more)

### Community 96 - "liquidity.js"
Cohesion: 0.39
Nodes (10): ageReferenceTime(), businessSecondsBetween(), formatAge(), ageSuffix(), bullBearLabelSide(), formatLiquidityLevelLabel(), formatLsLabel(), levelOptions() (+2 more)

### Community 97 - "drMerkmale.py"
Cohesion: 0.08
Nodes (35): handelsstunden(), lade_bekannte_level(), lade_kerzen(), lade_setups(), lade_trend(), merkmale(), Steht die DR mit dem 1H-Trend oder gegen ihn? uptrend + long = mit dem Trend.…, Schluessel der in liquidity_levels persistierten Level -- die Tabelle fuehrt… (+27 more)

### Community 98 - "NewsModal.vue"
Cohesion: 0.18
Nodes (11): CURRENCIES, emit, LIST_FORMATTER, newCurrency, newDateTime, newTitle, saving, submit() (+3 more)

### Community 99 - "trade_evidence Table (Dual-Level, Confirmation/Confluence)"
Cohesion: 0.18
Nodes (13): dealing_ranges Table, trade_evidence Table (Dual-Level, Confirmation/Confluence), trade_partial_exits Table, trade_positions Table, trade_targets Table, Confirmation/Confluence/Anti-Confluence Categories, trading repo trade-from-poi.md (Confirmation/Confluence/Anti-Confluence Definition), Anti-Confluences Snapshot Feature (Planned) (+5 more)

### Community 100 - "MetadataPanel.vue"
Cohesion: 0.24
Nodes (10): emit, height, left, onDrag(), panelEl, props, startDrag(), stopDrag() (+2 more)

### Community 101 - "findAntiConfluenceCandidates.js"
Cohesion: 0.40
Nodes (10): byDistance(), findAntiConfluenceCandidates(), findAntiConfluenceDivergenceCandidates(), findAntiConfluenceObCandidates(), findAntiConfluenceSweepCandidates(), findInvalidationObCandidates(), inBand(), MAX_HELD_OB_AGE_DAYS (+2 more)

### Community 102 - "/task do Mode"
Cohesion: 0.38
Nodes (7): Laniakea milk-city Task-Status Rule, /task Default Data-Maintenance Mode, /task do Mode, /task new Mode, /task refine Mode, /task Command Router, milk-city Task Status Convention

### Community 103 - "findTargets.js"
Cohesion: 0.17
Nodes (14): MAX_TARGET_DISTANCE_PIPS Constant, find_targets Target-Candidate Algorithm Design, Plan: find_targets Algorithmus, TSC-Neuaufbau Precondition, openAntiConfluencePicker(), openTargetPicker(), mergedCandidates, getCurrentLiquidityLevels() (+6 more)

### Community 104 - "newsEvents.js"
Cohesion: 0.32
Nodes (8): usePriceChartCockpit(), refreshCockpit(), currentNewsNoGo(), INSTRUMENT_CURRENCIES, NEWS_NOGO_WINDOW_MINUTES, newsEvents, newsEventsForInstrument(), sessions

### Community 105 - "berlinDateStrFor"
Cohesion: 0.22
Nodes (18): berlinDateStrFor(), getOpenOppositeDealingRanges(), computeEvidenceScore(), EvidenceScoreBreakdownEntry, EvidenceScoreInput, EvidenceScoreResult, loadMachineForDay(), transition() (+10 more)

### Community 106 - "Lana-Fehlerdiagnose"
Cohesion: 0.33
Nodes (5): Ablauf, Ergebnis, Lana-Fehlerdiagnose, Routing: Diagnose → typischer Fix-Ort, Wann aufrufen

### Community 107 - "Agent Skills Pro Notes"
Cohesion: 0.29
Nodes (7): allowed-tools Skill Config, Context-free Scripts in Skills, Agent Skills Pro Notes, Progressive Disclosure in Skills, Skill Sharing & Troubleshooting, Skills Embedded in Subagents, Skills vs CLAUDE.md vs Hooks vs Subagents

### Community 108 - "chartColors.test.js"
Cohesion: 0.18
Nodes (9): DEFAULT_CHART_COLORS, allSourceFiles, EXCLUDED_FROM_USAGE_SCAN, fieldsBlocks, SOURCE_EXTENSIONS, SRC_DIR, styleModalFieldKeys, styleModalSource (+1 more)

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

### Community 116 - "usePriceChartMarketStructure.js"
Cohesion: 0.13
Nodes (19): cachedCandlesUpTo(), cacheKey(), fetchCandlesCached(), getCachedCandles(), mergeCandles(), openDb(), safeCompleteUpTo(), setCachedCandles() (+11 more)

### Community 117 - "vite.config.js"
Cohesion: 0.40
Nodes (3): DEBUG_DIR, DEBUG_FILE, __dirname

### Community 118 - "lana-git-pull.cjs"
Cohesion: 0.50
Nodes (3): { execFileSync }, path, TRADING_REPO

### Community 119 - "tradeTargets.ts"
Cohesion: 0.24
Nodes (9): targetLabel(), targetLabel(), formatTargetLabel(), KIND_LABEL, kindLabel(), targetAgeSeconds(), targetAgeTier(), TradeTarget (+1 more)

### Community 122 - "marketStructureAnalysis.test.js"
Cohesion: 0.22
Nodes (8): pivot1, pivot2, pivot3, pivot4, pivot5, pivot6, pivot7, pivot8

### Community 124 - "debugMetadata.js"
Cohesion: 0.39
Nodes (7): buildActiveMetadataSnapshot(), earliestRelevantTime(), hasActiveMetadata(), selectActiveMetadataSections(), ALL_OFF, BASE_CTX, SECTIONS

### Community 125 - "Handbuch-Check"
Cohesion: 0.40
Nodes (4): Ergebnis, Handbuch-Check, Prüfpunkte, Wann aufrufen

### Community 131 - "fetchForexCandles"
Cohesion: 0.22
Nodes (18): asOfProbeCandles(), fetchAllRows(), getForexCandlesArchiveUpTo(), getLiquidityLevels(), getObZones(), getSessions(), buildCandidatePool(), fetchForexCandles() (+10 more)

### Community 132 - "src/pipConfig.js"
Cohesion: 0.15
Nodes (14): HTF_FOREX_MIN_GAP_PIPS Constant, LOWER_TF_MIN_GAP_PIPS Constant, Pip-/Pixel-Schwellwerte Übersicht, MIN_PIXELS_PER_HOUR_FOR_LABELS Constants, PIP_SIZE Constant, RANGE_FIB_MIN_PP_DISTANCE_PIPS Constant, TRADE_SETUP_LS_MAX_DISTANCE_M5 Constant, poi-watcher 4H+1H OB-Zonen-Wächter Edge Function (+6 more)

### Community 133 - "marketStructureAnalysisInnerPivots.test.js"
Cohesion: 0.25
Nodes (7): h1Candles, p2Pivot3, p2Pivot4, p2Pivot5, pivot1, pivot2, pivot3

### Community 134 - "canShowLabels"
Cohesion: 0.29
Nodes (4): canShowLabels(), MIN_PIXELS_PER_HOUR_FOR_LABELS, MIN_PIXELS_PER_HOUR_FOR_LABELS_INTRADAY, positionsBox()

### Community 135 - "Dealing Range anlegen"
Cohesion: 0.50
Nodes (3): Ablauf, Dealing Range anlegen, Warum ein eigener Skill (nicht nur eine Doku-Zeile)

### Community 136 - ".codex/hooks/lana-git-pull.cjs"
Cohesion: 0.50
Nodes (3): { execFileSync }, path, TRADING_REPO

### Community 138 - "tradingSchedules.js"
Cohesion: 0.19
Nodes (12): minutesToTimeInput(), timeInputToMinutes(), addWindow(), cloneWindows(), DEFAULT_SCHEDULES, EMPTY_WINDOWS, loadInitial(), removeWindow() (+4 more)

### Community 139 - "supabaseClient.js"
Cohesion: 0.19
Nodes (9): fetchAlarmLog(), fetchTouchedLiquidityLevels(), fetchTradeSetups(), ALARM_TYPES, fetchTouchedZones(), supabase, currentSymbol, { data: rows, refresh } (+1 more)

### Community 141 - "liquidity.ts"
Cohesion: 0.70
Nodes (4): buildLevel(), detectLiquidityLevels(), isDownFractal(), isUpFractal()

### Community 143 - "JsonTree.vue"
Cohesion: 0.25
Nodes (5): entries, expanded, isArray, isObject, props

### Community 145 - "annotations.ts"
Cohesion: 0.38
Nodes (6): postChartAnnotations(), ANNOTATION_SCHEMA, DRAWING_GROUP_SCHEMA, registerAnnotationTools(), VALID_TYPES, validateAnnotations()

### Community 146 - "usePolledFetch.js"
Cohesion: 0.43
Nodes (5): usePolledFetch(), load(), lastSuccessAt, useStatusBar(), markSuccess()

### Community 147 - "addPositionToDealingRange"
Cohesion: 0.67
Nodes (3): addPositionToDealingRange(), confirmationAnchorTime(), onTscTransferToTrades()

### Community 149 - "fetchTradeSetupForCockpit"
Cohesion: 0.67
Nodes (3): fetchTradeSetupForCockpit(), onIsolateTrade(), onSelectTrade()

## Ambiguous Edges - Review These
- `Trading-Steps-Ablauf Diagram` → `calc_rr Tool Idea (Deterministic RR Calc)`  [AMBIGUOUS]
  docs/steerabilty-vs-wrong-ai-outputs.md · relation: references

## Knowledge Gaps
- **1116 isolated node(s):** `Datenquellen (vor dem Lauf ziehen)`, `Definitionen`, `Skripte`, `Basis`, `1. Handelszeit — größter Effekt, größte Stichprobe` (+1111 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1354 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Trading-Steps-Ablauf Diagram` and `calc_rr Tool Idea (Deterministic RR Calc)`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **Why does `businessSecondsBetween()` connect `backfillTradeSetupOutcomes.ts` to `dealingRangeLoop.ts`, `tradeEvidence.ts`, `dataExport.ts`?**
  _High betweenness centrality (0.094) - this node is a cross-community bridge._
- **Why does `marketStructureAnalysis Developer Notes` connect `Vegapunk Slimming Results (-86%)` to `fachdoku-router/SKILL.md`, `marketStructureAnalysis Rules Overview`?**
  _High betweenness centrality (0.074) - this node is a cross-community bridge._
- **Why does `businessSecondsBetween()` connect `liquidity.js` to `PriceChart.vue`, `clipReplay`, `tradeSetupCockpit.ts`, `tradeTargets.ts`, `tradeEvidence.ts`, `chartTimeUtils.js`?**
  _High betweenness centrality (0.074) - this node is a cross-community bridge._
- **What connects `Datenquellen (vor dem Lauf ziehen)`, `Definitionen`, `Skripte` to the rest of the system?**
  _1116 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Dashboard.vue` be split into smaller, more focused modules?**
  _Cohesion score 0.016176805650489862 - nodes in this community are weakly interconnected._
- **Should `gbp_h1_uptrend_uptrend_break_of_structure_und_trendumkehr.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0196078431372549 - nodes in this community are weakly interconnected._