# Graph Report - trading-monitor  (2026-09-06)

## Corpus Check
- 404 files · ~421,811 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2778 nodes · 5583 edges · 130 communities (117 shown, 12 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 110 edges (avg confidence: 0.85)
- Token cost: 0 input · 508,249 output

## Community Hubs (Navigation)
- Trade Cockpit UI State
- H1 Uptrend BOS Test Data
- Evidence Scoring & Dealing Ranges
- Liquidity Level Detection
- PriceChart Component State
- H1 Uptrend LQ-Sweep Test Data
- H1 Uptrend Inner-Structure Test Data
- Pin Tools & DB Layer
- RSI Chart Composable
- Market Structure Rendering
- RSI Divergence Detection
- Data Export Modal
- Chart Icon Labels & Zoom
- Trade Setups Chart Composable
- Dealing Range CRUD & OB Detection
- Trade Edit Modal
- NPM Dependencies
- Pip/Pixel Threshold Constants
- Trading Loop State Store
- Color Utils & Anti-Confluence Picker
- Journal & Archive Fetch Helpers
- Forex Candles Fetch (TS)
- OB Age Classification
- Liquidity Chart Composable
- Edge Function Auth & CORS
- Chart Colors Settings
- Take Trade Modal
- Trade Stats & Annotations Store
- Trade Setup Outcome Classification
- Anti-Confluence/Target Picker Handlers
- Chart Time/Replay Utils
- Sessions Modal
- Market Structure Types
- Trading Account Switcher
- Bias Engine (Trend Force)
- Data Export Builder
- TDD Ranges Test Fixture
- News Modal
- Chart Hit-Test Helpers
- Trade Setup Cockpit UI
- CHoCH Market Structure Tests
- Trade Markers Rendering
- Trade Setup Detection (Frontend)
- Claude Annotation Drawings
- Market Structure Analysis Core
- RSI Divergence Stats Panel
- Pin Context Helpers
- Trading-Steps Docs & Laniakea Persona
- OB-Zones Schema & Conventions
- Trade Setup Focus/Metadata Internals
- Pivot Markers Rendering
- News Markers Rendering
- Berlin Timezone Utils
- H1 Uptrend Test Fixture
- TSC Anti-Confluence Constants
- Daily Pivots Chart Composable
- Market Structure Core (Nested Trend)
- Trading Hours Gate
- Pin Natural Keys & Hover State
- Liquidity Levels (Backend)
- Anti-Confluence Candidate Search
- cTrader & Repo Conventions Notes
- Edge Function Boilerplate (Pivots)
- Poi-Watcher Cron Entry
- Trading-Steps Diagram & Fall 4
- TypeScript Scope Config
- Candle Cache
- Annotation Renderer Primitive
- Ranges Polling & Fib Click
- Trade Setup Detection (Backend)
- Candle Archive & Pagination Gotcha
- App.vue Root State
- Trading Schedules Editor Logic
- Session Occurrences & Bonus Labels
- Forex Candles Fetch (Frontend)
- Market Structure Rules Notes
- Session Band Chart Primitive
- Trading Flow Diagram Generator
- TSC Confirmation/Anti-Confluence Handlers
- Trading Hours Docs & Fachdoku Router
- Trade Journal Schema (Dealing Ranges)
- Dealing-Range-Loop Diagram Notes
- Debug Metadata Builder
- HTTP Error Banners
- AI Fluency 4D Framework
- Data Export Tool Notes
- Lana Fehlerdiagnose Skill
- Alarm Settings Store
- Pin Add Popup
- Candle API Client (Backend)
- Alarm Log & Protokoll Table
- Confirmation/Target Removal Handlers
- Liquidity Line Chart Primitive
- Nested CHoCH Tests
- MCP Server Deployment Notes
- Divergence Line Chart Primitive
- OB Zones Backfill Script
- Market Structure Base Tests
- Annotations Chart Primitive
- Claude Annotations Modal
- Pin Panel UI
- Lessons-Learned Linking
- Downtrend Market Structure Tests
- Range Line Chart Primitive
- Inner Pivots Market Structure Tests
- LQ-Sweep Market Structure Tests
- /task Command Modes
- Agent Skills Authoring Notes
- News Events & Anti-Confluence Notes
- Trend Fixture Fetch Script
- Context Menu Component
- cTrader Candles Fetch (Frontend)
- Fibonacci Market Structure Tests
- Debug Metadata Panel Notes
- AI Capabilities Collision Diagram
- MCP Advanced Topics Notes
- Claude Annotations Chart Composable
- Vite Debug Metadata Writer
- Lana Git-Pull Script
- Settings-Sync Pattern Notes
- MCP Server Registration Config
- Tab-Scoped Ref Utility
- TSC-to-Trade Transfer Helpers
- App Entry Points
- CRUD List Section Component
- Invalidation Field Component
- Downtrend Test Fixture
- Claude Code Hooks Doc Pointer
- OB Zones Backfill Script (path)

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
- `Laniakea milk-city Task-Status Rule` --semantically_similar_to--> `milk-city Task Status Convention`  [INFERRED] [semantically similar]
  .claude/commands/l.md → CLAUDE.md
- `/task do Mode` --semantically_similar_to--> `milk-city Task Status Convention`  [INFERRED] [semantically similar]
  .claude/commands/task.md → CLAUDE.md
- `Bestätigungen (Sweeps & OBs) Feature` --semantically_similar_to--> `Confirmation/Confluence/Anti-Confluence Categories`  [INFERRED] [semantically similar]
  PLAN-trade-confluences.md → .claude/skills/dealing-range-anlegen/SKILL.md
- `Trading-Monitor Project Overview (CLAUDE.md)` --conceptually_related_to--> `BTC Scope Removal from Chart-Objects Plan`  [INFERRED]
  CLAUDE.md → PLAN-chart-objekte-forex.md
- `Archive-First Auto-Reload Pattern (Tried, Then Reverted)` --semantically_similar_to--> `Persisted Forex Candle Archive (forex_candles Pilot)`  [INFERRED] [semantically similar]
  PLAN-chart-objekte-forex.md → PLAN-notifications.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Root-Cause-Fix Skill Pattern (Structural Fix Over Output Patch)** — dra_skill_main, handbuch_check_main, lana_fehlerdiagnose_main [INFERRED 0.85]
- **OB-Zone Canonical FK Consolidation Initiative** — plan_chart_objekte_forex_consolidation_approach, db_ob_zones, src_tradesetup, db_trade_evidence [INFERRED 0.80]
- **cTrader Forex Data Pipeline (Chart, MCP, Archive)** — supabase_functions__shared_ctrader_client, supabase_functions_forex_candles, src_forexcandles, db_forex_candles, plan_notifications_forex_candle_archive [INFERRED 0.85]
- **State-Machine Doc + Diagram Pair** — docs_state_machine_doc, docs_diagrams_dealing_range_loop_doc, docs_diagrams_trading_steps_ablauf_doc [EXTRACTED 1.00]
- **AI Fluency Diagnostic Toolkit Applied to Lana** — docs_ai_fluency_4d_doc, docs_steerabilty_doc, docs_steerabilty_working_memory_steerability_collision [INFERRED 0.85]
- **CHoCH-to-Promotion-to-Rendering Pipeline** — src_marketstructureanalysis_rules_nested_trend_choch, src_marketstructureanalysis_rules_promotion, src_marketstructureanalysis_rules_darstellung [INFERRED 0.85]

## Communities (130 total, 12 thin omitted)

### Community 0 - "Trade Cockpit UI State"
Cohesion: 0.02
Nodes (117): useSessionStorageRef(), fetchTradeSetupForCockpit(), antiConfluenceAddTrade, anyArmStateActive, ARM_STATES, closeTradeEditModal(), confirmationAddTrade, confluenceAddTrade (+109 more)

### Community 1 - "H1 Uptrend BOS Test Data"
Cohesion: 0.02
Nodes (101): candlesAroundBOS, candlesAroundBreak, p2Pivot1, p2Pivot10, p2Pivot11, p2Pivot12, p2Pivot13, p2Pivot14 (+93 more)

### Community 2 - "Evidence Scoring & Dealing Ranges"
Cohesion: 0.06
Nodes (75): berlinDateStrFor(), berlinDateTimeStrFor(), getOpenOppositeDealingRanges(), computeEvidenceScore(), EvidenceScoreBreakdownEntry, EvidenceScoreInput, EvidenceScoreResult, checkFallFour() (+67 more)

### Community 3 - "Liquidity Level Detection"
Cohesion: 0.06
Nodes (60): buildLevel(), detectLiquidityLevels(), filterRelevantLevels(), isDownFractal(), isUpFractal(), LIQUIDITY_FRACTAL_PERIOD, LIQUIDITY_MAX_RELEVANT, LiquidityLevel (+52 more)

### Community 4 - "PriceChart Component State"
Cohesion: 0.03
Nodes (64): activeMetadataSnapshot, allCandles, antiConfluencePickerCurrentPrice, antiConfluencePickerDivergenceCandidates, antiConfluencePickerHoveredLiquidityKey, antiConfluencePickerHoveredObKey, antiConfluencePickerInvalidationObCandidates, antiConfluencePickerObCandidates (+56 more)

### Community 5 - "H1 Uptrend LQ-Sweep Test Data"
Cohesion: 0.03
Nodes (60): p2Pivot1, p2Pivot10, p2Pivot11, p2Pivot12, p2Pivot13, p2Pivot14, p2Pivot15, p2Pivot16 (+52 more)

### Community 6 - "H1 Uptrend Inner-Structure Test Data"
Cohesion: 0.04
Nodes (55): p2Pivot1, p2Pivot10, p2Pivot11, p2Pivot12, p2Pivot13, p2Pivot14, p2Pivot15, p2Pivot16 (+47 more)

### Community 7 - "Pin Tools & DB Layer"
Cohesion: 0.07
Nodes (51): InducementClass, addPinEntry(), addPinM5LiquidityEntry(), addPinM5ObEntry(), addPinRsiDivergenceEntry(), addTradeConfirmation(), AddTradeConfirmationArgs, addTradePosition() (+43 more)

### Community 8 - "RSI Chart Composable"
Cohesion: 0.09
Nodes (37): nativeLineWidth(), usePriceChartRsi(), applyColorOptions(), applyLineWidthOptions(), create(), refreshEma(), refreshRsi(), computeEma() (+29 more)

### Community 9 - "Market Structure Rendering"
Cohesion: 0.08
Nodes (20): bullBearLabelSide(), Candle, ArrowPaneView, ArrowPrimitive, ArrowRenderer, collectFibLevels(), collectH1LqLevels(), collectNestedChain() (+12 more)

### Community 10 - "RSI Divergence Detection"
Cohesion: 0.09
Nodes (39): buildDivergenceEntry(), collectDivergenceHistory(), computeRsi(), DEFAULT_DIVERGENCE_FRACTAL_PERIOD, DEFAULT_DIVERGENCE_HISTORY_COUNT, DEFAULT_DIVERGENCE_LOOKBACK_BARS, DEFAULT_RSI_PERIOD, detectRsiDivergence() (+31 more)

### Community 11 - "Data Export Modal"
Cohesion: 0.05
Nodes (35): asset, copied, copyResult(), currentSymbol, dateStr, error, loading, ranges2LookbackHours (+27 more)

### Community 12 - "Chart Icon Labels & Zoom"
Cohesion: 0.07
Nodes (14): drawIconLabel(), canShowLabels(), MIN_PIXELS_PER_HOUR_FOR_LABELS, MIN_PIXELS_PER_HOUR_FOR_LABELS_INTRADAY, LiquidityLineRenderer, OB_ZONE_KEYS, OrderBlockPrimitive, positionsBox() (+6 more)

### Community 13 - "Trade Setups Chart Composable"
Cohesion: 0.07
Nodes (34): usePriceChartTradeSetups(), fetchM5Candles(), fetchTrendAnalysisM5History(), getTrendAnalysisM5Candles(), CALLOUT_STACK_GAP_PX, CLOSE_POLL_BUFFER_MS, COPIED_FEEDBACK_MS, DEBUG_AUTOSAVE_INTERVAL_MS (+26 more)

### Community 14 - "Dealing Range CRUD & OB Detection"
Cohesion: 0.10
Nodes (32): isBoxInvalidated(), detectSetupObs(), createDealingRange(), deleteDealingRange(), fetchActiveTscRangeId(), fetchDealingRangeCockpit(), findRecentTradeSetupIdsByKey(), postChartAnnotations() (+24 more)

### Community 15 - "Trade Edit Modal"
Cohesion: 0.06
Nodes (31): commission, entryPrice, entryTimeInput, exitPrice, exitTimeInput, instrumentMismatch, invalidation, invalidationJustSaved (+23 more)

### Community 16 - "NPM Dependencies"
Cohesion: 0.06
Nodes (33): lightweight-charts, mermaid, dependencies, lightweight-charts, mermaid, @supabase/supabase-js, vue, vue-router (+25 more)

### Community 17 - "Pip/Pixel Threshold Constants"
Cohesion: 0.08
Nodes (28): HTF_FOREX_MIN_GAP_PIPS Constant, LOWER_TF_MIN_GAP_PIPS Constant, Pip-/Pixel-Schwellwerte Übersicht, MAX_TARGET_DISTANCE_PIPS Constant, MIN_PIXELS_PER_HOUR_FOR_LABELS Constants, PIP_SIZE Constant, RANGE_FIB_MIN_PP_DISTANCE_PIPS Constant, TRADE_SETUP_LS_MAX_DISTANCE_M5 Constant (+20 more)

### Community 18 - "Trading Loop State Store"
Cohesion: 0.08
Nodes (20): fetchActiveLoopStates(), fetchLoopStateHistory(), LOOP_INSTRUMENTS, rowToLoopState(), fetchStateMachineLog(), rowToDecision(), activeByInstrument, { data } (+12 more)

### Community 19 - "Color Utils & Anti-Confluence Picker"
Cohesion: 0.13
Nodes (27): cssColor(), cssColorScaled(), hexToRgba(), lineWidth(), tradesVisibleForCandles(), candidateLabel(), candidatePrice(), emit (+19 more)

### Community 20 - "Journal & Archive Fetch Helpers"
Cohesion: 0.13
Nodes (29): inducementAgeRange(), berlinDayRangeUtcMs(), applyAsOfZones(), getForexCandlesArchive(), getJournal(), getNewsEvents(), getObZones(), getTradeSetups() (+21 more)

### Community 21 - "Forex Candles Fetch (TS)"
Cohesion: 0.09
Nodes (27): getForexCandlesArchiveUpTo(), BAR_SECONDS, barSecondsFor(), fetchForexCandles(), fetchLiveForexCandles(), fetchLiveForexCandlesOnce(), isRetryable(), ALL_BARS (+19 more)

### Community 22 - "OB Age Classification"
Cohesion: 0.12
Nodes (27): AgeTier, classifyAge(), ageReferenceTime(), businessSecondsBetween(), formatAge(), confirmationLabel(), targetLabel(), confirmationLabel() (+19 more)

### Community 23 - "Liquidity Chart Composable"
Cohesion: 0.14
Nodes (23): usePriceChartLiquidity(), refresh(), levelOptions(), LIQUIDITY_STYLE_KEYS, liquidityLevelNaturalKey(), liquidityStyleTimeframe(), renderLiquidityLevels(), buildLevel() (+15 more)

### Community 24 - "Edge Function Auth & CORS"
Cohesion: 0.12
Nodes (24): CORS_HEADERS, authAccount(), authenticate(), cachedSymbolIds, Candle, concat(), connectWithTimeout(), CTraderConnection (+16 more)

### Community 25 - "Chart Colors Settings"
Cohesion: 0.08
Nodes (18): chartColors, DEFAULT_CHART_COLORS, resetChartColors(), chartLineWidths, DEFAULT_CHART_LINE_WIDTHS, resetChartLineWidths(), collapsed, emit (+10 more)

### Community 26 - "Take Trade Modal"
Cohesion: 0.12
Nodes (29): direction, emit, entryPrice, errorMsg, levels, precision, props, reasoning (+21 more)

### Community 27 - "Trade Stats & Annotations Store"
Cohesion: 0.09
Nodes (21): pnlClass, props, stats, winrateClass, fetchDailyStructurePivots(), fmtR(), fetchLiquidityLevelsHtf(), fetchObZones() (+13 more)

### Community 28 - "Trade Setup Outcome Classification"
Cohesion: 0.14
Nodes (26): classifyInducementAge(), classifyOutcome(), computeSlTp(), computeSweepAgeHours(), deriveEntryInvalidation(), MAJOR_INDUCEMENT_MIN_HOURS, MAX_SL_PIPS, MINOR_INDUCEMENT_MAX_HOURS (+18 more)

### Community 29 - "Anti-Confluence/Target Picker Handlers"
Cohesion: 0.15
Nodes (25): emit, obZoneCtx(), onAntiConfluencePickerHover(), onAntiConfluencePickerSelect(), onTargetPickerHover(), onTargetPickerSelect(), openAntiConfluencePicker(), openTargetPicker() (+17 more)

### Community 30 - "Chart Time/Replay Utils"
Cohesion: 0.13
Nodes (21): computeNextReplayTime(), isTimeCovered(), mergeRecent(), nextCandleAfter(), replayFetchToMs(), snapToBarTime(), jumpToDivergence(), jumpToPin() (+13 more)

### Community 31 - "Sessions Modal"
Cohesion: 0.12
Nodes (20): emit, instrumentSessions, props, WEEKDAY_DISPLAY_ORDER, usePriceChartSessionsAndNews(), refreshNewsMarkers(), refreshSessions(), addSession() (+12 more)

### Community 32 - "Market Structure Types"
Cohesion: 0.08
Nodes (25): ClosedRange, MarketStructureState, PivotBase, PivotHigh, PivotLow, PivotTouched, PivotTypeAll, PivotUntouched (+17 more)

### Community 33 - "Trading Account Switcher"
Cohesion: 0.12
Nodes (19): currentLabel, open, selectedAccount, wrapperRef, cache, useLocalStorageRef(), accounts, accountsLoaded (+11 more)

### Community 34 - "Bias Engine (Trend Force)"
Cohesion: 0.15
Nodes (22): buildPendingDecisions(), determineTrendForce(), findIntermediateLevel(), FindIntermediateLevelArgs, IntermediateLevelCandidate, isSpreadHourPivot(), PendingDecision, TrendForceConfidence (+14 more)

### Community 35 - "Data Export Builder"
Cohesion: 0.15
Nodes (24): trendChain, berlinDayRangeUtcMs(), berlinOffsetMinutes(), buildDataExport(), compute1hStructureState(), computeExportTimeframeData(), computeLiquidityLevelsForExport(), computeObZonesForExport() (+16 more)

### Community 36 - "TDD Ranges Test Fixture"
Cohesion: 0.08
Nodes (24): nextPivot1, nextPivot10, nextPivot11, nextPivot2, nextPivot3, nextPivot4, nextPivot5, nextPivot6 (+16 more)

### Community 37 - "News Modal"
Cohesion: 0.13
Nodes (19): CURRENCIES, emit, LIST_FORMATTER, newCurrency, newDateTime, newTitle, saving, submit() (+11 more)

### Community 38 - "Chart Hit-Test Helpers"
Cohesion: 0.13
Nodes (18): findClickedDivergence(), findClickedLiquidityLevel(), findClickedOBZone(), findClickedSetup(), findClickedTarget(), DIVERGENCE_CLICK_TOLERANCE_PX, FIB_TICK_CLICK_TOLERANCE_PX, findNearbyPinCandidates() (+10 more)

### Community 39 - "Trade Setup Cockpit UI"
Cohesion: 0.10
Nodes (22): accentStyle, antiConfluences, canTransfer, confirmations, confluences, dateLabel, direction, emit (+14 more)

### Community 40 - "CHoCH Market Structure Tests"
Cohesion: 0.13
Nodes (20): applyMarketStructurePivot(), initMarketStructureState(), chochConfirmedState(), confirmBreak, confirmedUptrendState(), originHigh, originLow, pullback (+12 more)

### Community 41 - "Trade Markers Rendering"
Cohesion: 0.13
Nodes (10): drawEntryPoint(), drawExitPoint(), drawHaloRing(), drawLabel(), drawTick(), renderTradeMarkers(), TradeMarkerPaneView, TradeMarkerPrimitive (+2 more)

### Community 42 - "Trade Setup Detection (Frontend)"
Cohesion: 0.14
Nodes (16): Two Runtimes, One Algorithm Set (Deliberate Duplication), computeTradeSetups(), closesBeyondLevel(), detectSetupObs(), detectTradeSetups(), findAllProtectedFractals(), findBestLsMatch(), findFirstSetupObAfter() (+8 more)

### Community 43 - "Claude Annotation Drawings"
Cohesion: 0.12
Nodes (22): addClaudeAnnotationDrawing(), fetchClaudeAnnotations(), removeClaudeAnnotationDrawing(), setClaudeAnnotationDrawingVisible(), applyText(), removeDrawing(), toggleDrawingVisible(), add() (+14 more)

### Community 44 - "Market Structure Analysis Core"
Cohesion: 0.24
Nodes (21): advanceNestedTrend(), advanceNestedTrendInner(), applyInnerMarketStructurePivot(), applyInnerMarketStructurePivotCore(), applyMarketStructurePivot(), applyMarketStructurePivotCore(), buildMarketStructureState(), Candle (+13 more)

### Community 45 - "RSI Divergence Stats Panel"
Cohesion: 0.11
Nodes (16): emit, OUTCOME_LABEL, precision, props, sortedDivergences, stats, emit, lessonBadges() (+8 more)

### Community 46 - "Pin Context Helpers"
Cohesion: 0.16
Nodes (21): addPinEntry(), addPinM5LiquidityEntry(), addPinM5ObEntry(), addPinRsiDivergenceEntry(), addPinTscSetupEntry(), fetchPinContext(), REF_COLUMN, removePinEntry() (+13 more)

### Community 47 - "Trading-Steps Docs & Laniakea Persona"
Cohesion: 0.11
Nodes (21): 00-trading-steps.md Entry Point, Laniakea Persona Command (/l), trading/claude-project-instructions.md, trading-runs Relative Link Path Convention, 00-trading-steps.md#visuelle-antworten-chart-annotationen, 06-anti-confluence.md, glossar.md Consistency Check, kontext-ausführung.md (+13 more)

### Community 48 - "OB-Zones Schema & Conventions"
Cohesion: 0.11
Nodes (21): Keep Codebase Clean / ~1000 Line Backstop Convention, liquidity_levels Table, ob_zones Table, BTC Scope Removal from Chart-Objects Plan, OB-Zones Canonical FK Consolidation Approach, Four Independent OB Render Passes Problem, "Historische OBs"-Toggle Semantics, LQ-Sweep Relevance Criterion (Recent OR Pip-Range) (+13 more)

### Community 49 - "Trade Setup Focus/Metadata Internals"
Cohesion: 0.20
Nodes (21): buildActiveMetadataSnapshotInternal(), clearTradeSetupFocus(), clipReplay(), computeTradeSetupsInternal(), focusTradeSetup(), loadTradeSetupM5(), refreshChart(), refreshClaudeAnnotationsInternal() (+13 more)

### Community 50 - "Pivot Markers Rendering"
Cohesion: 0.12
Nodes (10): FibLevel, Candle, PivotMarkerGroup, PivotMarkerPaneView, PivotMarkerPrimitive, PivotMarkerRenderer, RenderOptions, renderPivotMarkers() (+2 more)

### Community 51 - "News Markers Rendering"
Cohesion: 0.13
Nodes (10): DAY_KEY_FORMATTER, extrapolatedX(), formatEventLabel(), isSameBerlinDay(), NewsMarkerPaneView, NewsMarkerPrimitive, NewsMarkerRenderer, renderNewsMarkers() (+2 more)

### Community 52 - "Berlin Timezone Utils"
Cohesion: 0.18
Nodes (18): berlinOffsetMinutes(), DATE_FORMATTER, OFFSET_FORMATTER, TIME_FORMATTER, ALL_DAYS, attachRangeExtremes(), bonusLabelForPivot(), buildSessionContextLookup() (+10 more)

### Community 53 - "H1 Uptrend Test Fixture"
Cohesion: 0.10
Nodes (20): pivot1, pivot10, pivot11, pivot12, pivot13, pivot2, pivot3, pivot4 (+12 more)

### Community 54 - "TSC Anti-Confluence Constants"
Cohesion: 0.14
Nodes (17): trendChainDisplay, RangeTrend, ANTI_CONFLUENCE_COLOR, ANTI_CONFLUENCE_THRESHOLD, AntiConfluence, computeAntiConfluences(), computeCockpitState(), formatTrendAge() (+9 more)

### Community 55 - "Daily Pivots Chart Composable"
Cohesion: 0.14
Nodes (7): usePriceChartDailyPivots(), refresh(), DailyPivotMarkerPaneView, DailyPivotMarkerPrimitive, DailyPivotMarkerRenderer, drawTriangle(), renderDailyPivotMarkers()

### Community 56 - "Market Structure Core (Nested Trend)"
Cohesion: 0.27
Nodes (17): advanceNestedTrend(), applyInnerMarketStructurePivotCore(), applyMarketStructurePivotCore(), buildMarketStructureState(), closesAboveOldHigh(), closesBelowLevel(), computeRangesPivots(), evaluateConfirmingBreak() (+9 more)

### Community 57 - "Trading Hours Gate"
Cohesion: 0.17
Nodes (16): BERLIN_HM_FORMATTER, BERLIN_WEEKDAY_FORMATTER, berlinWeekdayAndMinutes(), isWithinTradingWindows(), TradingWindows, WeekdayGroup, ClassifiedNewsEvent, evaluateTradingHoursGate() (+8 more)

### Community 58 - "Pin Natural Keys & Hover State"
Cohesion: 0.13
Nodes (19): liquidityLevelEntryNaturalKey(), m5LiquidityEntryNaturalKey(), obZoneEntryNaturalKey(), barSecondsForTimeframeCi(), hoveredPinLiquidityLevelKey, hoveredPinObZoneKey, onSelectPin(), pinEntryVisible() (+11 more)

### Community 59 - "Liquidity Levels (Backend)"
Cohesion: 0.15
Nodes (13): buildLevel(), detectLiquidityLevels(), isDownFractal(), isUpFractal(), Candle, detectOrderBlocks(), HTF_FOREX_LABELS, HTF_FOREX_MIN_GAP_PIPS (+5 more)

### Community 60 - "Anti-Confluence Candidate Search"
Cohesion: 0.20
Nodes (15): byDistance(), findAntiConfluenceCandidates(), findAntiConfluenceDivergenceCandidates(), findAntiConfluenceObCandidates(), findAntiConfluenceSweepCandidates(), findInvalidationObCandidates(), inBand(), MAX_HELD_OB_AGE_DAYS (+7 more)

### Community 61 - "cTrader & Repo Conventions Notes"
Cohesion: 0.11
Nodes (17): cTrader ACCESS_DENIED Lockout (No Auto-Recovery), cTrader Open API as Forex Candle Source, DRY Within a Single Runtime Convention, CLAUDE.md Pointer to /l Persona, npm run build Command, Trading-Monitor Project Overview (CLAUDE.md), Rename Consistency Convention, REPLAY_LOOKAHEAD_SEC M1 Scaling Gotcha (+9 more)

### Community 62 - "Edge Function Boilerplate (Pivots)"
Cohesion: 0.16
Nodes (13): CORS_HEADERS, ExistingPivotRow, INSTRUMENTS, CORS_HEADERS, PERIOD_MAP, PERSISTABLE_BARS, persistIfArchivable(), RefreshedTokens (+5 more)

### Community 63 - "Poi-Watcher Cron Entry"
Cohesion: 0.12
Nodes (14): fetchForexBatch(), fmt(), InstrumentConfig, INSTRUMENTS, isInWindows(), LiquidityLevelRow, localMinutesAndWeekday(), ObZoneRow (+6 more)

### Community 64 - "Trading-Steps Diagram & Fall 4"
Cohesion: 0.16
Nodes (17): Trading-Steps-Ablauf Diagram, Fall 4 -> Zurück zu Schritt 3, Two Permanent LLM-Only Steps (3 and 6), News-Pause Doesn't Replace the Cron, State Machine for Lana's Trading Flow, get_tsc_range Deliberately Not a Graph Node, Problem: GBPUSD 28.08.2026 Fall-4 Deviation Incident, trading-runs/*.md Loses Purpose (+9 more)

### Community 65 - "TypeScript Scope Config"
Cohesion: 0.12
Nodes (16): src/marketStructureAnalysis.ts, src/marketStructureRendering.ts, src/pivotMarkers.ts, test/tdd_mit_claude/ranges/tdd_mit_claude.ts, compilerOptions, allowJs, checkJs, esModuleInterop (+8 more)

### Community 66 - "Candle Cache"
Cohesion: 0.22
Nodes (12): cachedCandlesUpTo(), cacheKey(), fetchCandlesCached(), getCachedCandles(), mergeCandles(), openDb(), safeCompleteUpTo(), setCachedCandles() (+4 more)

### Community 67 - "Annotation Renderer Primitive"
Cohesion: 0.16
Nodes (10): ANNOTATION_COLOR, annotationAnchorPoint(), AnnotationsRenderer, parseAnnotations(), resolveLabelPlacements(), resolveTime(), VALID_TYPES, validateAnnotationList() (+2 more)

### Community 68 - "Ranges Polling & Fib Click"
Cohesion: 0.13
Nodes (14): findClickedFibLevel(), loadInitial(), loadRangesCandles(), replayToMs(), scheduleNextRangesPoll(), startRangesPolling(), load(), usePriceChartMarketStructure() (+6 more)

### Community 69 - "Trade Setup Detection (Backend)"
Cohesion: 0.18
Nodes (16): LiquidityLevel, closesBeyondLevel(), DEFAULT_TRADE_SETUP_PARAMS, DetectedTradeSetup, detectTradeSetup(), findBestLsMatch(), findFirstSetupObAfter(), findImmediateLsSetup() (+8 more)

### Community 70 - "Candle Archive & Pagination Gotcha"
Cohesion: 0.16
Nodes (16): Supabase/PostgREST ~1000 Row Cap Gotcha, daily_structure_pivots Table, forex_candles Table, get_forex_candles_archive MCP Tool, Archive-First Auto-Reload Pattern (Tried, Then Reverted), 1H/4H DB-Read vs Live-Recompute Decision, BTC-USDT/OKX Complete Removal (2026-08-21), 1D-Periode-4-Pivot Market-Structure Startpoint (2026-08-30) (+8 more)

### Community 71 - "App.vue Root State"
Cohesion: 0.15
Nodes (13): { activeLabels, isActive }, isFresh, { lastSuccessAt }, lastUpdateText, now, showClaudeAnnotationsModal, showDataExport, statusDotClass (+5 more)

### Community 72 - "Trading Schedules Editor Logic"
Cohesion: 0.19
Nodes (12): minutesToTimeInput(), timeInputToMinutes(), addWindow(), cloneWindows(), DEFAULT_SCHEDULES, EMPTY_WINDOWS, loadInitial(), removeWindow() (+4 more)

### Community 73 - "Session Occurrences & Bonus Labels"
Cohesion: 0.24
Nodes (12): attachBonus(), ALL_DAYS, attachRangeExtremes(), bonusLabelForPivot(), buildSessionContextLookup(), contextForPivot(), daysOrAll(), localMidnightUtc() (+4 more)

### Community 74 - "Forex Candles Fetch (Frontend)"
Cohesion: 0.27
Nodes (14): DB_ARCHIVED_BARS, fetchArchivedPage(), fetchArchivedUpTo(), fetchCandles(), fetchCandlesBatchOnce(), fetchCandlesOnce(), fetchInitialCandles(), fetchOlderCandles() (+6 more)

### Community 75 - "Market Structure Rules Notes"
Cohesion: 0.22
Nodes (15): Arbitrary Nesting Depth (2026-08-09), Rendering Rules (renderMarketStructureAnalysis), marketStructureAnalysis Rules Overview, Docht-vs-Bruch (Wick vs Close-Break) Unification, Standalone Downtrend Detection/Invalidation, Fibonacci Level (computeFibLevels/collectFibLevels), Inner-Pivots (Period 2) Fast Pre-Detection, LQ-Sweep Classification (markLqSweeps) (+7 more)

### Community 76 - "Session Band Chart Primitive"
Cohesion: 0.14
Nodes (3): SessionBandPaneView, SessionBandPrimitive, SessionBandRenderer

### Community 77 - "Trading Flow Diagram Generator"
Cohesion: 0.18
Nodes (12): buildMermaidSource(), EDGES, mermaidEscape(), NODES, activeByInstrument, currentLoop, currentNode, { data } (+4 more)

### Community 78 - "TSC Confirmation/Anti-Confluence Handlers"
Cohesion: 0.15
Nodes (14): clearArmStatesExcept(), onAddAntiConfluenceRequest(), onAddConfirmationRequest(), onAddConfluenceRequest(), onAddRangeAntiConfluenceRequest(), onAddRangeConfirmationRequest(), onAddRangeConfluenceRequest(), onAddTargetRequest() (+6 more)

### Community 79 - "Trading Hours Docs & Fachdoku Router"
Cohesion: 0.15
Nodes (13): poi-watcher UTC Refresh-Tick Exception, Trading-Hours/Timezone Handling (Europe/Berlin), sessions Table, trading_schedules Table, docs/debug-metadata-panel.md, Fachdoku-Router Skill, src/marketStructureAnalysis.notes.md, docs/mcp-server.md (+5 more)

### Community 80 - "Trade Journal Schema (Dealing Ranges)"
Cohesion: 0.18
Nodes (13): dealing_ranges Table, trade_evidence Table (Dual-Level, Confirmation/Confluence), trade_partial_exits Table, trade_positions Table, trade_targets Table, Confirmation/Confluence/Anti-Confluence Categories, trading repo trade-from-poi.md (Confirmation/Confluence/Anti-Confluence Definition), Anti-Confluences Snapshot Feature (Planned) (+5 more)

### Community 81 - "Dealing-Range-Loop Diagram Notes"
Cohesion: 0.15
Nodes (13): Dealing-Range-Loop Diagram, News-Blackout Mid-Loop Pause, Pin-Aufräumen after TSC-Link, Target Selection Remains Lana's Judgment, Pin Tools (tools/pins.ts), poi-watcher Alert-Cron Notes, poi-watcher 3-Tier Fetch Throttling, UTC-Hours Exception for Refresh Ticks (+5 more)

### Community 82 - "Debug Metadata Builder"
Cohesion: 0.23
Nodes (11): generate(), copyJson(), copyJsonAndSaveLocally(), buildActiveMetadataSnapshot(), earliestRelevantTime(), hasActiveMetadata(), saveDebugMetadataSection(), selectActiveMetadataSections() (+3 more)

### Community 83 - "HTTP Error Banners"
Cohesion: 0.22
Nodes (10): copiedId, { errors }, counts, dismissHttpError(), errors, extractErrorMessage(), installHttpActivityTracking(), labelFor() (+2 more)

### Community 84 - "AI Fluency 4D Framework"
Cohesion: 0.17
Nodes (12): Delegation (4D Framework), Description (4D Framework), Diligence (4D Framework), Discernment (4D Framework), AI Fluency: 4D Framework Notes, calc_rr Tool Idea (Deterministic RR Calc), AI Capabilities and Limitations Notes, Letter-over-Spirit Failure Mode (+4 more)

### Community 85 - "Data Export Tool Notes"
Cohesion: 0.18
Nodes (12): get_data_export Tool, Lana Test Data README, Chronological MCP Tool Call Sequence, Output-too-large Problem, Vegapunk Slimming Results (-86%), marketStructureAnalysis Developer Notes, File Separation: Algorithm vs Rendering, Rules Doc Maintenance Convention (+4 more)

### Community 86 - "Lana Fehlerdiagnose Skill"
Cohesion: 0.18
Nodes (12): kind=pivot = Liquidity-Sweep-Only Semantics, Dealing-Range-Anlegen Skill, milk-city Task: Confluence-Tracking bei Dealing Ranges, trading/liquidität.md (Liquiditäts-Sweep-Mechanismus), Diagnose-to-Fix Routing Table, Lana-Fehlerdiagnose Skill, docs/steerabilty-vs-wrong-ai-outputs.md, add_trade_confirmation MCP Tool (+4 more)

### Community 87 - "Alarm Settings Store"
Cohesion: 0.24
Nodes (8): ALARM_TYPES, fetchAlarmSettings(), setAlarmEnabled(), router, alarms, errorText, loading, toggle()

### Community 88 - "Pin Add Popup"
Cohesion: 0.23
Nodes (11): clampedX, clampedY, confirm(), emit, note, onKeydown(), onWindowMousedown(), props (+3 more)

### Community 89 - "Candle API Client (Backend)"
Cohesion: 0.21
Nodes (11): Candle, fetchCandles(), FetchCandlesOptions, INTERVAL_MAP, requestTimeSeries(), resample(), RESAMPLE_BUCKET_SEC, SUPPORTED_PERIODS (+3 more)

### Community 90 - "Alarm Log & Protokoll Table"
Cohesion: 0.29
Nodes (7): fetchAlarmLog(), fetchTouchedLiquidityLevels(), fetchTradeSetups(), fetchTouchedZones(), currentSymbol, { data: rows, refresh }, SYMBOLS

### Community 91 - "Confirmation/Target Removal Handlers"
Cohesion: 0.22
Nodes (11): onRemoveConfirmation(), onRemoveTarget(), removeConfirmationFromTrade(), removeTargetFromTrade(), onAddAntiConfluenceFromPicker(), onAddTargetFromPicker(), onTscRemoveAntiConfluence(), onTscRemoveConfirmation() (+3 more)

### Community 93 - "Nested CHoCH Tests"
Cohesion: 0.18
Nodes (10): confirmBreak, originHigh, originLow, pivotB, pivotC, pivotD, pivotE, pivotF (+2 more)

### Community 94 - "MCP Server Deployment Notes"
Cohesion: 0.20
Nodes (10): MCP Auth & Table Permissions, Backfill Scripts, Candle Archive (forex_candles), MCP Server Deployment (Supabase Edge Function), MCP-Server: Tiefere Referenz, get_forex_rsi / get_forex_ema Tools, Single Deno Copy (Dual-Copy Removed), Trade-Journal Write Tools (tools/trades.ts) (+2 more)

### Community 96 - "OB Zones Backfill Script"
Cohesion: 0.29
Nodes (9): backfillOne(), BAR_CONFIG, BARS, CandleRow, correctStaleZones(), fetchAllCandles(), fetchCorrectionCandidates(), INSTRUMENTS (+1 more)

### Community 97 - "Market Structure Base Tests"
Cohesion: 0.22
Nodes (8): pivot1, pivot2, pivot3, pivot4, pivot5, pivot6, pivot7, pivot8

### Community 99 - "Claude Annotations Modal"
Cohesion: 0.25
Nodes (7): emit, error, { instrument, dateStr, drawings, loading, add, remove, setDrawingVisible }, removingId, saving, text, togglingId

### Community 100 - "Pin Panel UI"
Cohesion: 0.32
Nodes (7): emit, noteSaveTimers, onEntryClick(), onNoteInput(), OUTCOME_LABEL, props, rows

### Community 101 - "Lessons-Learned Linking"
Cohesion: 0.36
Nodes (8): emit, flashInvalidationSaved(), linkLesson(), save(), saveInvalidation(), toggleFavorite(), unlinkLesson(), updateDealingRange()

### Community 102 - "Downtrend Market Structure Tests"
Cohesion: 0.25
Nodes (6): advanceNestedTrendInner(), applyInnerMarketStructurePivot(), confirmBreak, originHigh, originLow, pullback

### Community 104 - "Inner Pivots Market Structure Tests"
Cohesion: 0.25
Nodes (7): h1Candles, p2Pivot3, p2Pivot4, p2Pivot5, pivot1, pivot2, pivot3

### Community 105 - "LQ-Sweep Market Structure Tests"
Cohesion: 0.25
Nodes (7): baseState(), candles, levelRealBreak, levelSweep, levelUntouched, origin, triggerPivot

### Community 106 - "/task Command Modes"
Cohesion: 0.38
Nodes (7): Laniakea milk-city Task-Status Rule, /task Default Data-Maintenance Mode, /task do Mode, /task new Mode, /task refine Mode, /task Command Router, milk-city Task Status Convention

### Community 107 - "Agent Skills Authoring Notes"
Cohesion: 0.29
Nodes (7): allowed-tools Skill Config, Context-free Scripts in Skills, Agent Skills Pro Notes, Progressive Disclosure in Skills, Skill Sharing & Troubleshooting, Skills Embedded in Subagents, Skills vs CLAUDE.md vs Hooks vs Subagents

### Community 108 - "News Events & Anti-Confluence Notes"
Cohesion: 0.29
Nodes (7): News Events Seed Workflow (ForexFactory Screenshot), News Events Seeding Notes, news_events Consumption (No-Go + Chart Markers), TSC No-Gos and Anti-Confluences Notes, find_anti_confluences Mechanical Candidate Search, AntiConfluence.isNoGo Hard Block, Anti-Confluence Zone Rule

### Community 109 - "Trend Fixture Fetch Script"
Cohesion: 0.38
Nodes (5): fetchAllSince(), fetchCandles(), fetchRecent(), FIXTURES_DIR, m5StartSec

### Community 110 - "Context Menu Component"
Cohesion: 0.38
Nodes (6): clampedX, clampedY, emit, onKeydown(), onWindowMousedown(), props

### Community 111 - "cTrader Candles Fetch (Frontend)"
Cohesion: 0.48
Nodes (6): ctraderPeriodFor(), fetchCandles(), fetchInitialCandles(), fetchOlderCandles(), fetchRecentCandles(), PERIOD_MAP

### Community 112 - "Fibonacci Market Structure Tests"
Cohesion: 0.29
Nodes (6): RANGE_FIB_MIN_PP_DISTANCE_PIPS, confirmBreak, confirmedUptrendState(), originHigh, originLow, pullback

### Community 113 - "Debug Metadata Panel Notes"
Cohesion: 0.33
Nodes (6): Autosave vs Manual Copy Separation, .debug/metadata.json Snapshot, Debug-Metadata-Panel Notes, buildActiveMetadataSnapshot (PriceChart.vue), debugMetadata.js Gating Logic, saveDebugMetadataLocally (vite.config.js)

### Community 114 - "AI Capabilities Collision Diagram"
Cohesion: 1.00
Nodes (6): AI Failure as Property Collision, Knowledge, Next Token Prediction, Steerability, When Properties Collide (Diagram), Working Memory

### Community 115 - "MCP Advanced Topics Notes"
Cohesion: 0.33
Nodes (6): MCP Advanced Topics Notes, MCP Advanced: Why Not Relevant Yet, MCP Log & Progress Notifications, MCP Roots, MCP Sampling, MCP Transports (STDIO/StreamableHTTP)

### Community 116 - "Claude Annotations Chart Composable"
Cohesion: 0.40
Nodes (3): renderClaudeAnnotations(), usePriceChartClaudeAnnotations(), refresh()

### Community 117 - "Vite Debug Metadata Writer"
Cohesion: 0.40
Nodes (3): DEBUG_DIR, DEBUG_FILE, __dirname

### Community 118 - "Lana Git-Pull Script"
Cohesion: 0.50
Nodes (3): { execFileSync }, path, TRADING_REPO

### Community 119 - "Settings-Sync Pattern Notes"
Cohesion: 0.67
Nodes (3): Settings-Sync Notes, localStorage-first / Supabase-Source-of-Truth Pattern, trading_loop_state Table Design

### Community 122 - "TSC-to-Trade Transfer Helpers"
Cohesion: 0.67
Nodes (3): addPositionToDealingRange(), confirmationAnchorTime(), onTscTransferToTrades()

## Ambiguous Edges - Review These
- `calc_rr Tool Idea (Deterministic RR Calc)` → `Trading-Steps-Ablauf Diagram`  [AMBIGUOUS]
  docs/steerabilty-vs-wrong-ai-outputs.md · relation: references

## Knowledge Gaps
- **1038 isolated node(s):** `{ execFileSync }`, `path`, `TRADING_REPO`, `trading-monitor`, `milk-city` (+1033 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1244 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `calc_rr Tool Idea (Deterministic RR Calc)` and `Trading-Steps-Ablauf Diagram`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **Why does `trading_schedules Table` connect `Trading Hours Docs & Fachdoku Router` to `Trading Hours Gate`?**
  _High betweenness centrality (0.303) - this node is a cross-community bridge._
- **Why does `Trading-Monitor Project Overview (CLAUDE.md)` connect `cTrader & Repo Conventions Notes` to `Candle Archive & Pagination Gotcha`, `Trade Setup Detection (Frontend)`, `/task Command Modes`, `Trading Hours Docs & Fachdoku Router`, `OB-Zones Schema & Conventions`?**
  _High betweenness centrality (0.290) - this node is a cross-community bridge._
- **Why does `Trading-Hours/Timezone Handling (Europe/Berlin)` connect `Trading Hours Docs & Fachdoku Router` to `cTrader & Repo Conventions Notes`?**
  _High betweenness centrality (0.274) - this node is a cross-community bridge._
- **What connects `{ execFileSync }`, `path`, `TRADING_REPO` to the rest of the system?**
  _1038 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Trade Cockpit UI State` be split into smaller, more focused modules?**
  _Cohesion score 0.016457960644007157 - nodes in this community are weakly interconnected._
- **Should `H1 Uptrend BOS Test Data` be split into smaller, more focused modules?**
  _Cohesion score 0.0196078431372549 - nodes in this community are weakly interconnected._