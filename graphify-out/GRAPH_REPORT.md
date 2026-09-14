# Graph Report - trading-monitor  (2026-09-15)

## Corpus Check
- 454 files · ~450,826 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2928 nodes · 5938 edges · 153 communities (137 shown, 11 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 109 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `248b31f5`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Dashboard.vue
- gbp_h1_uptrend_uptrend_break_of_structure_und_trendumkehr.ts
- dealingRangeLoop.ts
- findTargetCandidates.js
- PriceChart.vue
- gbp_h1_uptrend_mit_LQ_sweep_LONG_SETUP.ts
- gbp_h1_uptrend_mit_inner_structure.ts
- db.ts
- usePriceChartRsi.js
- marketStructureRendering.ts
- rsiDivergenceStats.ts
- DataExportModal.vue
- daily-structure-pivots/index.ts
- tools/pretradeGates.ts
- Plan: POI-Strategie-Findung, Backtesting & Trade-Notifications
- TradeEditModal.vue
- package.json
- src/sessionOccurrences.js
- LoopStatus.vue
- clipReplay
- Dealing-Range-Anlegen Skill
- targetChoiceGuard.ts
- newsMarkers.js
- liquidity.js
- ctrader/client.ts
- usePriceChartMarketStructure
- tradeIntake.js
- trades.js
- backfillTradeSetupOutcomes.ts
- priceChartObZones.js
- chartLineWidths.js
- sessions.js
- gbp_h1_uptrend_protected_low_gebrochen.ts
- tradingAccounts.js
- machineState.ts
- dataExport.js
- tdd_mit_claude.ts
- tradeSetup.ts
- orderBlocks.js
- TradeSetupCockpit.vue
- applyMarketStructurePivot
- biasCheck.ts
- liquidity.ts
- useClaudeAnnotations.js
- trading-monitor-mcp/marketStructureAnalysis.ts
- priceChartConstants.js
- pinContext.js
- Laniakea Persona Command (/l)
- Plan: Sehr Große Dateien Refactoren (PriceChart.vue)
- fachdoku-router/SKILL.md
- MetadataPanel.vue
- _shared/ageTier.ts
- trading-monitor-mcp/index.ts
- gbp_h1_uptrend.ts
- tradeSetupCockpit.ts
- dailyPivotMarkers.js
- src/marketStructureAnalysis.ts
- dataExport.ts
- pinEntryVisible
- orderBlocks.ts
- fallClassifier.ts
- tradeSetup.js
- pivotMarkers.ts
- poi-watcher/index.ts
- State Machine for Lana's Trading Flow
- compilerOptions
- candleCache.js
- snapToBarTime
- format.js
- AGENTS.md
- Trading-Monitor Project Overview (CLAUDE.md)
- replayAsOf.ts
- tradingSchedules.js
- usePriceChartMarketStructure.js
- clearArmStatesExcept
- forexCandles.js
- SessionBandPaneView
- TradingFlow.vue
- marketStructureAnalysis Rules Overview
- Fachdoku-Router Skill
- supabaseClient.js
- Dealing-Range-Loop Diagram
- marketStructureAnalysisLqSweep.test.js
- useHttpActivity.js
- AI Capabilities and Limitations Notes
- Vegapunk Slimming Results (-86%)
- TargetPickerModal.vue
- router.js
- PinAddPopup.vue
- twelvedata/client.ts
- Anleitung: State-Machine lesen & bedienen
- src/pipConfig.js
- tsc.ts
- marketStructureAnalysisNestedNestedChoch.test.js
- MCP-Server: Tiefere Referenz
- chartColors.js
- NewsModal.vue
- cssColor
- reads.ts
- trade_evidence Table (Dual-Level, Confirmation/Confluence)
- tradeMarkers.js
- RangeLinePrimitive
- /task do Mode
- TradeMarkerPrimitive
- marketStructureAnalysisInnerPivots.test.js
- trendChainLevelDisplay
- Lana-Fehlerdiagnose
- Agent Skills Pro Notes
- newsEvents.js
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
- debugMetadata.js
- .mcp.json
- FibTickPrimitive
- marketStructureAnalysis.test.js
- trading-monitor index.html Entry
- JsonTree.vue
- Handbuch-Check
- trendIndicator.gbpusd-downtrend.test.js
- Claude Code Hooks Documentation Pointers
- mcp-server/src/scripts/backfillObZones.ts
- chartTimeUtils.js
- RsiDivergenceStatsPanel.vue
- tradeEvidence.ts
- alarmLog.js
- Dealing Range anlegen
- .codex/hooks/lana-git-pull.cjs
- source-command-l
- applyInnerMarketStructurePivot
- Pivot
- Plan: Forex-Chart-Objekte Datengrundlage
- TradeStats.vue
- PinPanel.vue
- detectLiquidityLevels
- Plan: Trade-Journal Konfluenzen & Kontext
- App.vue
- ArrowPaneView
- CrudListSection.vue
- cTrader Open API as Forex Candle Source
- computeTrendAlignment

## God Nodes (most connected - your core abstractions)
1. `berlinDateStrFor()` - 45 edges
2. `cssColor()` - 34 edges
3. `fetchForexCandles()` - 31 edges
4. `berlinDateTimeStrFor()` - 30 edges
5. `pricePrecisionForInstrument()` - 30 edges
6. `fmtPrice()` - 28 edges
7. `clipReplay()` - 27 edges
8. `logDecision()` - 25 edges
9. `refreshChart()` - 24 edges
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

## Communities (153 total, 11 thin omitted)

### Community 0 - "Dashboard.vue"
Cohesion: 0.02
Nodes (121): useSessionStorageRef(), useTabScopedRef(), addPositionToDealingRange(), fetchTradeSetupForCockpit(), antiConfluenceAddTrade, anyArmStateActive, ARM_STATES, closeTradeEditModal() (+113 more)

### Community 1 - "gbp_h1_uptrend_uptrend_break_of_structure_und_trendumkehr.ts"
Cohesion: 0.02
Nodes (101): candlesAroundBOS, candlesAroundBreak, p2Pivot1, p2Pivot10, p2Pivot11, p2Pivot12, p2Pivot13, p2Pivot14 (+93 more)

### Community 2 - "dealingRangeLoop.ts"
Cohesion: 0.07
Nodes (65): berlinDateStrFor(), berlinDateTimeStrFor(), DATE_FORMATTER, OFFSET_FORMATTER, TIME_FORMATTER, getOpenOppositeDealingRanges(), computeEvidenceScore(), EvidenceScoreBreakdownEntry (+57 more)

### Community 3 - "findTargetCandidates.js"
Cohesion: 0.12
Nodes (25): buildLevel(), detectLiquidityLevels(), filterRelevantLevels(), isDownFractal(), isUpFractal(), LIQUIDITY_FRACTAL_PERIOD, LIQUIDITY_MAX_RELEVANT, LiquidityLevel (+17 more)

### Community 4 - "PriceChart.vue"
Cohesion: 0.03
Nodes (69): activeMetadataSnapshot, allCandles, antiConfluencePickerCurrentPrice, antiConfluencePickerDivergenceCandidates, antiConfluencePickerHoveredLiquidityKey, antiConfluencePickerHoveredObKey, antiConfluencePickerInvalidationObCandidates, antiConfluencePickerObCandidates (+61 more)

### Community 5 - "gbp_h1_uptrend_mit_LQ_sweep_LONG_SETUP.ts"
Cohesion: 0.03
Nodes (60): p2Pivot1, p2Pivot10, p2Pivot11, p2Pivot12, p2Pivot13, p2Pivot14, p2Pivot15, p2Pivot16 (+52 more)

### Community 6 - "gbp_h1_uptrend_mit_inner_structure.ts"
Cohesion: 0.04
Nodes (55): p2Pivot1, p2Pivot10, p2Pivot11, p2Pivot12, p2Pivot13, p2Pivot14, p2Pivot15, p2Pivot16 (+47 more)

### Community 7 - "db.ts"
Cohesion: 0.07
Nodes (51): addPinEntry(), addPinM5LiquidityEntry(), addPinM5ObEntry(), addPinRsiDivergenceEntry(), addTradeConfirmation(), AddTradeConfirmationArgs, addTradePosition(), addTradeTarget() (+43 more)

### Community 8 - "usePriceChartRsi.js"
Cohesion: 0.09
Nodes (37): nativeLineWidth(), usePriceChartRsi(), applyColorOptions(), applyLineWidthOptions(), create(), refreshEma(), refreshRsi(), computeEma() (+29 more)

### Community 9 - "marketStructureRendering.ts"
Cohesion: 0.20
Nodes (16): refreshMarketStructure(), bullBearLabelSide(), collectFibLevels(), collectNestedChain(), computeFibLevels(), fibBetween(), firstCloseBelow(), RANGE_FIB_MIN_PP_DISTANCE_PIPS (+8 more)

### Community 10 - "rsiDivergenceStats.ts"
Cohesion: 0.09
Nodes (38): buildDivergenceEntry(), collectDivergenceHistory(), computeRsi(), DEFAULT_DIVERGENCE_FRACTAL_PERIOD, DEFAULT_DIVERGENCE_HISTORY_COUNT, DEFAULT_DIVERGENCE_LOOKBACK_BARS, DEFAULT_RSI_PERIOD, detectRsiDivergence() (+30 more)

### Community 11 - "DataExportModal.vue"
Cohesion: 0.09
Nodes (22): asset, copied, copyResult(), currentSymbol, dateStr, error, generate(), loading (+14 more)

### Community 12 - "daily-structure-pivots/index.ts"
Cohesion: 0.16
Nodes (13): CORS_HEADERS, ExistingPivotRow, INSTRUMENTS, CORS_HEADERS, PERIOD_MAP, PERSISTABLE_BARS, persistIfArchivable(), RefreshedTokens (+5 more)

### Community 13 - "tools/pretradeGates.ts"
Cohesion: 0.13
Nodes (24): BERLIN_HM_FORMATTER, BERLIN_WEEKDAY_FORMATTER, berlinWeekdayAndMinutes(), isWithinTradingWindows(), TradingWindows, WeekdayGroup, berlinDayRangeUtcMs(), getNewsEvents() (+16 more)

### Community 14 - "Plan: POI-Strategie-Findung, Backtesting & Trade-Notifications"
Cohesion: 0.16
Nodes (16): Supabase/PostgREST ~1000 Row Cap Gotcha, daily_structure_pivots Table, forex_candles Table, get_forex_candles_archive MCP Tool, Archive-First Auto-Reload Pattern (Tried, Then Reverted), 1H/4H DB-Read vs Live-Recompute Decision, BTC-USDT/OKX Complete Removal (2026-08-21), 1D-Periode-4-Pivot Market-Structure Startpoint (2026-08-30) (+8 more)

### Community 15 - "TradeEditModal.vue"
Cohesion: 0.05
Nodes (44): commission, emit, entryPrice, entryTimeInput, exitPrice, exitTimeInput, flashInvalidationSaved(), instrumentMismatch (+36 more)

### Community 16 - "package.json"
Cohesion: 0.06
Nodes (33): lightweight-charts, mermaid, dependencies, lightweight-charts, mermaid, @supabase/supabase-js, vue, vue-router (+25 more)

### Community 17 - "src/sessionOccurrences.js"
Cohesion: 0.26
Nodes (10): ALL_DAYS, attachRangeExtremes(), bonusLabelForPivot(), buildSessionContextLookup(), daysOrAll(), localMidnightUtc(), localWeekday(), sessionExtremeSuffix() (+2 more)

### Community 18 - "LoopStatus.vue"
Cohesion: 0.07
Nodes (24): fetchLoopStateHistory(), fetchLoopStatesForDate(), LOOP_INSTRUMENTS, rowToLoopState(), fetchStateMachineLog(), rowToDecision(), activeByInstrument, { data, refresh } (+16 more)

### Community 19 - "clipReplay"
Cohesion: 0.16
Nodes (25): buildActiveMetadataSnapshotInternal(), clearTradeSetupFocus(), clipReplay(), computeTradeSetupsInternal(), focusTradeSetup(), loadInitial(), loadTradeSetupM5(), refreshChart() (+17 more)

### Community 20 - "Dealing-Range-Anlegen Skill"
Cohesion: 0.14
Nodes (15): kind=pivot = Liquidity-Sweep-Only Semantics, Dealing-Range-Anlegen Skill, milk-city Task: Confluence-Tracking bei Dealing Ranges, trading/liquidität.md (Liquiditäts-Sweep-Mechanismus), AI Capabilities Framework (Next Token Prediction/Knowledge/Working Memory/Steerability), Diagnose-to-Fix Routing Table, Lana-Fehlerdiagnose Skill, docs/steerabilty-vs-wrong-ai-outputs.md (+7 more)

### Community 21 - "targetChoiceGuard.ts"
Cohesion: 0.29
Nodes (10): getDealingRangeById(), findUnexplainedNearerTargets(), flattenTargetCandidates(), formatPrice(), mentionedPrices(), TargetCandidatePrice, unexplainedNearerTargetsError(), assertTargetChoiceFromCandidates() (+2 more)

### Community 22 - "newsMarkers.js"
Cohesion: 0.13
Nodes (12): usePriceChartSessionsAndNews(), refreshNewsMarkers(), DAY_KEY_FORMATTER, extrapolatedX(), formatEventLabel(), isSameBerlinDay(), NewsMarkerPaneView, NewsMarkerPrimitive (+4 more)

### Community 23 - "liquidity.js"
Cohesion: 0.14
Nodes (21): usePriceChartLiquidity(), attachBonus(), refresh(), formatLiquidityLevelLabel(), levelOptions(), LIQUIDITY_STYLE_KEYS, liquidityLevelNaturalKey(), liquidityStyleTimeframe() (+13 more)

### Community 24 - "ctrader/client.ts"
Cohesion: 0.12
Nodes (24): CORS_HEADERS, authAccount(), authenticate(), cachedSymbolIds, Candle, concat(), connectWithTimeout(), CTraderConnection (+16 more)

### Community 25 - "usePriceChartMarketStructure"
Cohesion: 0.22
Nodes (9): findClickedFibLevel(), loadRangesCandles(), scheduleNextRangesPoll(), startRangesPolling(), usePriceChartMarketStructure(), computeRangesPivotsAndMetadata(), computeRangesPivotsFor(), fetchRangesCandles() (+1 more)

### Community 26 - "tradeIntake.js"
Cohesion: 0.13
Nodes (29): direction, emit, entryPrice, errorMsg, levels, precision, props, reasoning (+21 more)

### Community 27 - "trades.js"
Cohesion: 0.14
Nodes (17): onRemoveConfirmation(), removeConfirmationFromTrade(), fetchActiveTscRangeId(), fetchDealingRangeCockpit(), toLiquidityLevel(), fetchTrades(), toConfirmation(), groupBy() (+9 more)

### Community 28 - "backfillTradeSetupOutcomes.ts"
Cohesion: 0.15
Nodes (24): classifyInducementAge(), classifyOutcome(), computeSlTp(), computeSweepAgeHours(), deriveEntryInvalidation(), MAX_SL_PIPS, OutcomeCandle, OutcomeResult (+16 more)

### Community 29 - "priceChartObZones.js"
Cohesion: 0.13
Nodes (26): emit, obZoneCtx(), onAntiConfluencePickerHover(), onAntiConfluencePickerSelect(), onTargetPickerHover(), onTargetPickerSelect(), openAntiConfluencePicker(), openTargetPicker() (+18 more)

### Community 30 - "chartLineWidths.js"
Cohesion: 0.13
Nodes (10): chartLineWidths, DEFAULT_CHART_LINE_WIDTHS, allSourceFiles, EXCLUDED_FROM_USAGE_SCAN, fieldsBlocks, SOURCE_EXTENSIONS, SRC_DIR, styleModalFieldKeys (+2 more)

### Community 31 - "sessions.js"
Cohesion: 0.13
Nodes (18): emit, instrumentSessions, props, WEEKDAY_DISPLAY_ORDER, refreshSessions(), addSession(), currentSessionDanger(), DANGER_LEVELS (+10 more)

### Community 32 - "gbp_h1_uptrend_protected_low_gebrochen.ts"
Cohesion: 0.08
Nodes (25): ClosedRange, MarketStructureState, PivotBase, PivotHigh, PivotLow, PivotTouched, PivotTypeAll, PivotUntouched (+17 more)

### Community 33 - "tradingAccounts.js"
Cohesion: 0.14
Nodes (16): currentLabel, open, selectedAccount, wrapperRef, accounts, accountsLoaded, createAccount(), deleteAccount() (+8 more)

### Community 34 - "machineState.ts"
Cohesion: 0.20
Nodes (19): deriveStepAndCase(), LoadedMachine, loadMachineForDayOrNull(), loadOrCreateMachineForDay(), persistTransition(), rehydrateActor(), safeTransitionChain(), transitionIfPossible() (+11 more)

### Community 35 - "dataExport.js"
Cohesion: 0.18
Nodes (19): berlinDayRangeUtcMs(), berlinOffsetMinutes(), buildDataExport(), computeExportTimeframeData(), computeLiquidityLevelsForExport(), computeObZonesForExport(), DATE_FORMATTER, fetchExportCandles() (+11 more)

### Community 36 - "tdd_mit_claude.ts"
Cohesion: 0.08
Nodes (24): nextPivot1, nextPivot10, nextPivot11, nextPivot2, nextPivot3, nextPivot4, nextPivot5, nextPivot6 (+16 more)

### Community 37 - "tradeSetup.ts"
Cohesion: 0.18
Nodes (16): LiquidityLevel, closesBeyondLevel(), DEFAULT_TRADE_SETUP_PARAMS, DetectedTradeSetup, detectTradeSetup(), findBestLsMatch(), findFirstSetupObAfter(), findImmediateLsSetup() (+8 more)

### Community 38 - "orderBlocks.js"
Cohesion: 0.07
Nodes (25): findClickedDivergence(), findClickedLiquidityLevel(), findClickedOBZone(), findClickedSetup(), findClickedTarget(), OB_ZONE_KEYS, OrderBlockPrimitive, renderPersistedZones() (+17 more)

### Community 39 - "TradeSetupCockpit.vue"
Cohesion: 0.09
Nodes (21): emit, accentStyle, antiConfluences, canTransfer, confirmations, confluences, dateLabel, direction (+13 more)

### Community 40 - "applyMarketStructurePivot"
Cohesion: 0.13
Nodes (21): applyMarketStructurePivot(), initMarketStructureState(), chochConfirmedState(), confirmBreak, confirmedUptrendState(), originHigh, originLow, pullback (+13 more)

### Community 41 - "biasCheck.ts"
Cohesion: 0.16
Nodes (20): buildPendingDecisions(), determineTrendForce(), findIntermediateLevel(), FindIntermediateLevelArgs, IntermediateLevelCandidate, isSpreadHourPivot(), PendingDecision, TrendForceConfidence (+12 more)

### Community 42 - "liquidity.ts"
Cohesion: 0.70
Nodes (4): buildLevel(), detectLiquidityLevels(), isDownFractal(), isUpFractal()

### Community 43 - "useClaudeAnnotations.js"
Cohesion: 0.09
Nodes (31): parseAnnotations(), validateAnnotationList(), addClaudeAnnotationDrawing(), fetchClaudeAnnotations(), removeClaudeAnnotationDrawing(), setClaudeAnnotationDrawingVisible(), applyText(), emit (+23 more)

### Community 44 - "trading-monitor-mcp/marketStructureAnalysis.ts"
Cohesion: 0.21
Nodes (23): advanceNestedTrend(), advanceNestedTrendInner(), applyInnerMarketStructurePivot(), applyInnerMarketStructurePivotCore(), applyMarketStructurePivot(), applyMarketStructurePivotCore(), buildMarketStructureState(), Candle (+15 more)

### Community 45 - "priceChartConstants.js"
Cohesion: 0.07
Nodes (33): usePriceChartTradeSetups(), fetchM5Candles(), fetchTrendAnalysisM5History(), getTrendAnalysisM5Candles(), CALLOUT_STACK_GAP_PX, CLOSE_POLL_BUFFER_MS, COPIED_FEEDBACK_MS, DEBUG_AUTOSAVE_INTERVAL_MS (+25 more)

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

### Community 50 - "MetadataPanel.vue"
Cohesion: 0.24
Nodes (10): emit, height, left, onDrag(), panelEl, props, startDrag(), stopDrag() (+2 more)

### Community 51 - "_shared/ageTier.ts"
Cohesion: 0.19
Nodes (14): MAJOR_MIN_SECONDS, MINOR_MAX_SECONDS, businessSecondsBetween(), classifyAge(), inducementAgeRange(), InducementClass, MAJOR_MIN_HOURS, MAJOR_MIN_SECONDS (+6 more)

### Community 52 - "trading-monitor-mcp/index.ts"
Cohesion: 0.10
Nodes (27): postChartAnnotations(), buildServer(), MCP_TOKEN, getLoopStateForDay(), NEXT_ACTION_FALLBACK, NEXT_ACTION_MAP, NextActionEntry, toPips() (+19 more)

### Community 53 - "gbp_h1_uptrend.ts"
Cohesion: 0.10
Nodes (20): pivot1, pivot10, pivot11, pivot12, pivot13, pivot2, pivot3, pivot4 (+12 more)

### Community 54 - "tradeSetupCockpit.ts"
Cohesion: 0.14
Nodes (14): Plan: find_targets Algorithmus, TSC-Neuaufbau Precondition, RangeTrend, ANTI_CONFLUENCE_COLOR, AntiConfluence, computeAntiConfluences(), computeCockpitState(), LOCKED_ACCENT (+6 more)

### Community 55 - "dailyPivotMarkers.js"
Cohesion: 0.14
Nodes (7): usePriceChartDailyPivots(), refresh(), DailyPivotMarkerPaneView, DailyPivotMarkerPrimitive, DailyPivotMarkerRenderer, drawTriangle(), renderDailyPivotMarkers()

### Community 56 - "src/marketStructureAnalysis.ts"
Cohesion: 0.34
Nodes (15): advanceNestedTrend(), applyInnerMarketStructurePivotCore(), applyMarketStructurePivotCore(), closesAboveOldHigh(), closesBelowLevel(), evaluateConfirmingBreak(), invalidateDowntrend(), invalidateUptrend() (+7 more)

### Community 57 - "dataExport.ts"
Cohesion: 0.09
Nodes (47): berlinOffsetMinutes(), fetchAllRows(), getLatestDailyStructureStartTime(), getLiquidityLevels(), getObZones(), getSessions(), computeRangesPivots(), PIP_SIZE (+39 more)

### Community 58 - "pinEntryVisible"
Cohesion: 0.14
Nodes (18): liquidityLevelEntryNaturalKey(), m5LiquidityEntryNaturalKey(), obZoneEntryNaturalKey(), hoveredPinLiquidityLevelKey, hoveredPinObZoneKey, onSelectPin(), pinEntryVisible(), pinJumpHint (+10 more)

### Community 59 - "orderBlocks.ts"
Cohesion: 0.18
Nodes (9): Candle, detectOrderBlocks(), HTF_FOREX_LABELS, HTF_FOREX_MIN_GAP_PIPS, LOWER_TF_LABELS, LOWER_TF_MIN_GAP_PIPS, Zone, DailyPivotLike (+1 more)

### Community 60 - "fallClassifier.ts"
Cohesion: 0.14
Nodes (15): AgeTier, checkFallFour(), CheckFallFourInput, FallFourResult, hasReaction(), HasReactionInput, hitCounterLevel(), hitTarget() (+7 more)

### Community 61 - "tradeSetup.js"
Cohesion: 0.18
Nodes (17): Two Runtimes, One Algorithm Set (Deliberate Duplication), computeTradeSetups(), collectH1LqLevels(), toLqLevel(), closesBeyondLevel(), detectSetupObs(), detectTradeSetups(), findAllProtectedFractals() (+9 more)

### Community 62 - "pivotMarkers.ts"
Cohesion: 0.05
Nodes (18): MIN_PIXELS_PER_HOUR_FOR_LABELS Constants, drawIconLabel(), canShowLabels(), MIN_PIXELS_PER_HOUR_FOR_LABELS, MIN_PIXELS_PER_HOUR_FOR_LABELS_INTRADAY, LiquidityLineRenderer, positionsBox(), Candle (+10 more)

### Community 63 - "poi-watcher/index.ts"
Cohesion: 0.12
Nodes (14): fetchForexBatch(), fmt(), InstrumentConfig, INSTRUMENTS, isInWindows(), LiquidityLevelRow, localMinutesAndWeekday(), ObZoneRow (+6 more)

### Community 64 - "State Machine for Lana's Trading Flow"
Cohesion: 0.14
Nodes (18): Trading-Steps-Ablauf Diagram, Fall 4 -> Zurück zu Schritt 3, Two Permanent LLM-Only Steps (3 and 6), News-Pause Doesn't Replace the Cron, State Machine for Lana's Trading Flow, get_tsc_range Deliberately Not a Graph Node, Problem: GBPUSD 28.08.2026 Fall-4 Deviation Incident, trading-runs/*.md Loses Purpose (+10 more)

### Community 65 - "compilerOptions"
Cohesion: 0.12
Nodes (16): src/marketStructureAnalysis.ts, src/marketStructureRendering.ts, src/pivotMarkers.ts, test/tdd_mit_claude/ranges/tdd_mit_claude.ts, compilerOptions, allowJs, checkJs, esModuleInterop (+8 more)

### Community 66 - "candleCache.js"
Cohesion: 0.13
Nodes (23): cachedCandlesUpTo(), cacheKey(), fetchCandlesCached(), getCachedCandles(), mergeCandles(), openDb(), safeCompleteUpTo(), setCachedCandles() (+15 more)

### Community 67 - "snapToBarTime"
Cohesion: 0.07
Nodes (15): snapToBarTime(), ANNOTATION_COLOR, annotationAnchorPoint(), AnnotationsPaneView, AnnotationsPrimitive, AnnotationsRenderer, renderClaudeAnnotations(), resolveLabelPlacements() (+7 more)

### Community 68 - "format.js"
Cohesion: 0.15
Nodes (12): emit, lessonBadges(), OUTCOME_LABEL, props, rangeLabel(), rowStyle(), showCommission, fmtDate() (+4 more)

### Community 69 - "AGENTS.md"
Cohesion: 0.14
Nodes (12): Architecture, Commands, Conventions, Forex candle data: cTrader Open API, not Twelve Data, Frontend data flow (`PriceChart.vue`), Gotchas, graphify, "Laniakea" persona (`/l`) (+4 more)

### Community 70 - "Trading-Monitor Project Overview (CLAUDE.md)"
Cohesion: 0.15
Nodes (12): cTrader ACCESS_DENIED Lockout (No Auto-Recovery), DRY Within a Single Runtime Convention, CLAUDE.md Pointer to /l Persona, npm run build Command, Trading-Monitor Project Overview (CLAUDE.md), Rename Consistency Convention, REPLAY_LOOKAHEAD_SEC M1 Scaling Gotcha, ctrader_oauth_tokens Table (+4 more)

### Community 71 - "replayAsOf.ts"
Cohesion: 0.09
Nodes (32): asOfProbeCandles(), firstObFormationTimeAfter(), TriggerCandle, detectOrderBlocks(), HTF_FOREX_LABELS, HTF_FOREX_MIN_GAP_PIPS, LOWER_TF_LABELS, LOWER_TF_MIN_GAP_PIPS (+24 more)

### Community 72 - "tradingSchedules.js"
Cohesion: 0.21
Nodes (11): minutesToTimeInput(), addWindow(), cloneWindows(), DEFAULT_SCHEDULES, EMPTY_WINDOWS, loadInitial(), removeWindow(), syncFromRemote() (+3 more)

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

### Community 78 - "marketStructureAnalysis Rules Overview"
Cohesion: 0.22
Nodes (15): Arbitrary Nesting Depth (2026-08-09), Rendering Rules (renderMarketStructureAnalysis), marketStructureAnalysis Rules Overview, Docht-vs-Bruch (Wick vs Close-Break) Unification, Standalone Downtrend Detection/Invalidation, Fibonacci Level (computeFibLevels/collectFibLevels), Inner-Pivots (Period 2) Fast Pre-Detection, LQ-Sweep Classification (markLqSweeps) (+7 more)

### Community 79 - "Fachdoku-Router Skill"
Cohesion: 0.15
Nodes (13): poi-watcher UTC Refresh-Tick Exception, Trading-Hours/Timezone Handling (Europe/Berlin), sessions Table, trading_schedules Table, docs/debug-metadata-panel.md, Fachdoku-Router Skill, src/marketStructureAnalysis.notes.md, docs/mcp-server.md (+5 more)

### Community 80 - "supabaseClient.js"
Cohesion: 0.23
Nodes (7): fetchDailyStructurePivots(), fetchLiquidityLevelsHtf(), fetchObZones(), supabase, { data: dbDailyPivots }, { data: dbLiquidityLevelsHtf }, { data: dbObZones }

### Community 81 - "Dealing-Range-Loop Diagram"
Cohesion: 0.17
Nodes (12): Dealing-Range-Loop Diagram, News-Blackout Mid-Loop Pause, Pin-Aufräumen after TSC-Link, Target Selection Remains Lana's Judgment, Pin Tools (tools/pins.ts), poi-watcher Alert-Cron Notes, poi-watcher 3-Tier Fetch Throttling, UTC-Hours Exception for Refresh Ticks (+4 more)

### Community 82 - "marketStructureAnalysisLqSweep.test.js"
Cohesion: 0.25
Nodes (7): baseState(), candles, levelRealBreak, levelSweep, levelUntouched, origin, triggerPivot

### Community 83 - "useHttpActivity.js"
Cohesion: 0.22
Nodes (10): copiedId, { errors }, counts, dismissHttpError(), errors, extractErrorMessage(), installHttpActivityTracking(), labelFor() (+2 more)

### Community 84 - "AI Capabilities and Limitations Notes"
Cohesion: 0.17
Nodes (12): Delegation (4D Framework), Description (4D Framework), Diligence (4D Framework), Discernment (4D Framework), AI Fluency: 4D Framework Notes, calc_rr Tool Idea (Deterministic RR Calc), AI Capabilities and Limitations Notes, Letter-over-Spirit Failure Mode (+4 more)

### Community 85 - "Vegapunk Slimming Results (-86%)"
Cohesion: 0.17
Nodes (13): get_data_export Tool, Tool 2: run_bias_check, Lana Test Data README, Chronological MCP Tool Call Sequence, Output-too-large Problem, Vegapunk Slimming Results (-86%), marketStructureAnalysis Developer Notes, File Separation: Algorithm vs Rendering (+5 more)

### Community 86 - "TargetPickerModal.vue"
Cohesion: 0.19
Nodes (12): MAX_TARGET_DISTANCE_PIPS Constant, find_targets Target-Candidate Algorithm Design, candidateLabel(), emit, mergedCandidates, precision, props, DEFAULT_LIQUIDITY_TARGET_LIMIT (+4 more)

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
Nodes (7): Ablaufbeispiel, Anleitung: State-Machine lesen & bedienen, Grundprinzip, Maschine bedienen, Menschlicher Gegencheck, `replayUntilSec` (beide Tools), State lesen, ohne die Maschine zu bewegen

### Community 91 - "src/pipConfig.js"
Cohesion: 0.17
Nodes (13): HTF_FOREX_MIN_GAP_PIPS Constant, LOWER_TF_MIN_GAP_PIPS Constant, Pip-/Pixel-Schwellwerte Übersicht, PIP_SIZE Constant, RANGE_FIB_MIN_PP_DISTANCE_PIPS Constant, TRADE_SETUP_LS_MAX_DISTANCE_M5 Constant, poi-watcher 4H+1H OB-Zonen-Wächter Edge Function, HTF_FOREX_LABELS (+5 more)

### Community 92 - "tsc.ts"
Cohesion: 0.19
Nodes (19): createDealingRange(), deleteDealingRange(), fetchActiveTscRangeId(), fetchDealingRangeCockpit(), toLiquidityLevel(), byDistance(), findAntiConfluenceCandidates(), findAntiConfluenceDivergenceCandidates() (+11 more)

### Community 93 - "marketStructureAnalysisNestedNestedChoch.test.js"
Cohesion: 0.18
Nodes (10): confirmBreak, originHigh, originLow, pivotB, pivotC, pivotD, pivotE, pivotF (+2 more)

### Community 94 - "MCP-Server: Tiefere Referenz"
Cohesion: 0.20
Nodes (10): MCP Auth & Table Permissions, Backfill Scripts, Candle Archive (forex_candles), MCP Server Deployment (Supabase Edge Function), MCP-Server: Tiefere Referenz, get_forex_rsi / get_forex_ema Tools, Single Deno Copy (Dual-Copy Removed), Trade-Journal Write Tools (tools/trades.ts) (+2 more)

### Community 95 - "chartColors.js"
Cohesion: 0.17
Nodes (8): chartColors, DEFAULT_CHART_COLORS, resetChartColors(), resetChartLineWidths(), collapsed, emit, GROUPS, resetAll()

### Community 96 - "NewsModal.vue"
Cohesion: 0.18
Nodes (11): CURRENCIES, emit, LIST_FORMATTER, newCurrency, newDateTime, newTitle, saving, submit() (+3 more)

### Community 97 - "cssColor"
Cohesion: 0.12
Nodes (25): cssColor(), cssColorScaled(), hexToRgba(), lineWidth(), tradesVisibleForCandles(), candidateLabel(), candidatePrice(), emit (+17 more)

### Community 98 - "reads.ts"
Cohesion: 0.08
Nodes (47): isBoxInvalidated(), detectSetupObs(), findRecentTradeSetupIdsByKey(), getForexCandlesArchive(), getForexCandlesArchiveUpTo(), getJournal(), getTradeSetups(), getTradeSetupWinrate() (+39 more)

### Community 99 - "trade_evidence Table (Dual-Level, Confirmation/Confluence)"
Cohesion: 0.28
Nodes (9): dealing_ranges Table, trade_evidence Table (Dual-Level, Confirmation/Confluence), trade_partial_exits Table, trade_positions Table, trade_targets Table, Confirmation/Confluence/Anti-Confluence Categories, trading repo trade-from-poi.md (Confirmation/Confluence/Anti-Confluence Definition), Bestätigungen (Sweeps & OBs) Feature (+1 more)

### Community 100 - "tradeMarkers.js"
Cohesion: 0.26
Nodes (8): drawEntryPoint(), drawExitPoint(), drawHaloRing(), drawLabel(), drawTick(), renderTradeMarkers(), TradeMarkerRenderer, tradeOptions()

### Community 101 - "RangeLinePrimitive"
Cohesion: 0.18
Nodes (3): RangeLinePaneView, RangeLinePrimitive, RangeLineRenderer

### Community 102 - "/task do Mode"
Cohesion: 0.38
Nodes (7): Laniakea milk-city Task-Status Rule, /task Default Data-Maintenance Mode, /task do Mode, /task new Mode, /task refine Mode, /task Command Router, milk-city Task Status Convention

### Community 104 - "marketStructureAnalysisInnerPivots.test.js"
Cohesion: 0.25
Nodes (7): h1Candles, p2Pivot3, p2Pivot4, p2Pivot5, pivot1, pivot2, pivot3

### Community 105 - "trendChainLevelDisplay"
Cohesion: 0.22
Nodes (9): trendChain, trendChainDisplay, computeTrendChainAges(), ANTI_CONFLUENCE_THRESHOLD, computeTrendChain(), formatTrendAge(), trendChainDepthHint(), trendChainLevelDisplay() (+1 more)

### Community 106 - "Lana-Fehlerdiagnose"
Cohesion: 0.33
Nodes (5): Ablauf, Ergebnis, Lana-Fehlerdiagnose, Routing: Diagnose → typischer Fix-Ort, Wann aufrufen

### Community 107 - "Agent Skills Pro Notes"
Cohesion: 0.29
Nodes (7): allowed-tools Skill Config, Context-free Scripts in Skills, Agent Skills Pro Notes, Progressive Disclosure in Skills, Skill Sharing & Troubleshooting, Skills Embedded in Subagents, Skills vs CLAUDE.md vs Hooks vs Subagents

### Community 108 - "newsEvents.js"
Cohesion: 0.36
Nodes (7): usePriceChartCockpit(), refreshCockpit(), currentNewsNoGo(), INSTRUMENT_CURRENCIES, NEWS_NOGO_WINDOW_MINUTES, newsEvents, newsEventsForInstrument()

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

### Community 119 - "debugMetadata.js"
Cohesion: 0.39
Nodes (7): buildActiveMetadataSnapshot(), earliestRelevantTime(), hasActiveMetadata(), selectActiveMetadataSections(), ALL_OFF, BASE_CTX, SECTIONS

### Community 121 - "FibTickPrimitive"
Cohesion: 0.15
Nodes (3): FibTickPaneView, FibTickPrimitive, FibTickRenderer

### Community 122 - "marketStructureAnalysis.test.js"
Cohesion: 0.22
Nodes (8): pivot1, pivot2, pivot3, pivot4, pivot5, pivot6, pivot7, pivot8

### Community 124 - "JsonTree.vue"
Cohesion: 0.25
Nodes (5): entries, expanded, isArray, isObject, props

### Community 125 - "Handbuch-Check"
Cohesion: 0.40
Nodes (4): Ergebnis, Handbuch-Check, Prüfpunkte, Wann aufrufen

### Community 131 - "chartTimeUtils.js"
Cohesion: 0.36
Nodes (5): computeNextReplayTime(), mergeRecent(), nextCandleAfter(), replayFetchToMs(), timeInputToMinutes()

### Community 132 - "RsiDivergenceStatsPanel.vue"
Cohesion: 0.25
Nodes (6): emit, OUTCOME_LABEL, precision, props, sortedDivergences, stats

### Community 133 - "tradeEvidence.ts"
Cohesion: 0.12
Nodes (26): AgeTier, classifyAge(), ageReferenceTime(), businessSecondsBetween(), formatAge(), confirmationLabel(), targetLabel(), confirmationLabel() (+18 more)

### Community 134 - "alarmLog.js"
Cohesion: 0.33
Nodes (7): fetchAlarmLog(), fetchTouchedLiquidityLevels(), fetchTradeSetups(), fetchTouchedZones(), currentSymbol, { data: rows, refresh }, SYMBOLS

### Community 135 - "Dealing Range anlegen"
Cohesion: 0.50
Nodes (3): Ablauf, Dealing Range anlegen, Warum ein eigener Skill (nicht nur eine Doku-Zeile)

### Community 136 - ".codex/hooks/lana-git-pull.cjs"
Cohesion: 0.50
Nodes (3): { execFileSync }, path, TRADING_REPO

### Community 138 - "applyInnerMarketStructurePivot"
Cohesion: 0.25
Nodes (6): advanceNestedTrendInner(), applyInnerMarketStructurePivot(), confirmBreak, originHigh, originLow, pullback

### Community 139 - "Pivot"
Cohesion: 0.32
Nodes (5): Candle, ArrowPrimitive, FibLevel, Pivot, CockpitState

### Community 141 - "Plan: Forex-Chart-Objekte Datengrundlage"
Cohesion: 0.24
Nodes (10): ob_zones Table, BTC Scope Removal from Chart-Objects Plan, OB-Zones Canonical FK Consolidation Approach, Four Independent OB Render Passes Problem, "Historische OBs"-Toggle Semantics, LQ-Sweep Relevance Criterion (Recent OR Pip-Range), Plan: Forex-Chart-Objekte Datengrundlage, Persistierungs-Umfang: Nur Referenzierte Teilmenge (+2 more)

### Community 143 - "TradeStats.vue"
Cohesion: 0.33
Nodes (6): pnlClass, props, stats, winrateClass, fmtR(), computeTradeStats()

### Community 144 - "PinPanel.vue"
Cohesion: 0.32
Nodes (7): emit, noteSaveTimers, onEntryClick(), onNoteInput(), OUTCOME_LABEL, props, rows

### Community 145 - "detectLiquidityLevels"
Cohesion: 0.53
Nodes (5): buildLevel(), detectLiquidityLevels(), isDownFractal(), isUpFractal(), LIQUIDITY_MAX_RELEVANT

### Community 146 - "Plan: Trade-Journal Konfluenzen & Kontext"
Cohesion: 0.50
Nodes (4): Anti-Confluences Snapshot Feature (Planned), Plan: Trade-Journal Konfluenzen & Kontext, Session-Kontext Feature (Planned), Trend-Kontext Feature (Planned)

### Community 147 - "App.vue"
Cohesion: 0.15
Nodes (13): { activeLabels, isActive }, isFresh, { lastSuccessAt }, lastUpdateText, now, showClaudeAnnotationsModal, showDataExport, statusDotClass (+5 more)

### Community 150 - "cTrader Open API as Forex Candle Source"
Cohesion: 0.40
Nodes (5): cTrader Open API as Forex Candle Source, cTrader Wire Protocol Implementation (Manual Protobuf), supabase/functions/_shared/ctrader/client.ts, supabase/functions/_shared/twelvedata/client.ts (Unwired), supabase/functions/forex-candles

## Ambiguous Edges - Review These
- `Trading-Steps-Ablauf Diagram` → `calc_rr Tool Idea (Deterministic RR Calc)`  [AMBIGUOUS]
  docs/steerabilty-vs-wrong-ai-outputs.md · relation: references

## Knowledge Gaps
- **1102 isolated node(s):** `BiasCheckArgs`, `M5_BAR_SECONDS`, `BATCH_CANDLES`, `TickResult`, `DealingRangeLoopArgs` (+1097 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1318 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **11 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Trading-Steps-Ablauf Diagram` and `calc_rr Tool Idea (Deterministic RR Calc)`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **Why does `businessSecondsBetween()` connect `_shared/ageTier.ts` to `dataExport.ts`, `backfillTradeSetupOutcomes.ts`, `fallClassifier.ts`?**
  _High betweenness centrality (0.094) - this node is a cross-community bridge._
- **Why does `marketStructureAnalysis Developer Notes` connect `Vegapunk Slimming Results (-86%)` to `fachdoku-router/SKILL.md`, `marketStructureAnalysis Rules Overview`?**
  _High betweenness centrality (0.094) - this node is a cross-community bridge._
- **Why does `renderMarketStructureAnalysis()` connect `marketStructureRendering.ts` to `cssColor`, `tradeEvidence.ts`, `RangeLinePrimitive`, `usePriceChartMarketStructure.js`, `Pivot`, `Vegapunk Slimming Results (-86%)`, `FibTickPrimitive`?**
  _High betweenness centrality (0.084) - this node is a cross-community bridge._
- **What connects `BiasCheckArgs`, `M5_BAR_SECONDS`, `BATCH_CANDLES` to the rest of the system?**
  _1102 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Dashboard.vue` be split into smaller, more focused modules?**
  _Cohesion score 0.016013071895424835 - nodes in this community are weakly interconnected._
- **Should `gbp_h1_uptrend_uptrend_break_of_structure_und_trendumkehr.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0196078431372549 - nodes in this community are weakly interconnected._