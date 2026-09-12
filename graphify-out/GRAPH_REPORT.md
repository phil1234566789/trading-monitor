# Graph Report - trading-monitor  (2026-09-12)

## Corpus Check
- 441 files · ~444,515 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2903 nodes · 5859 edges · 143 communities (128 shown, 11 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 109 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `f8f23a63`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Dashboard.vue
- gbp_h1_uptrend_uptrend_break_of_structure_und_trendumkehr.ts
- dealingRangeLoop.ts
- NewsModal.vue
- PriceChart.vue
- gbp_h1_uptrend_mit_LQ_sweep_LONG_SETUP.ts
- gbp_h1_uptrend_mit_inner_structure.ts
- db.ts
- usePriceChartRsi.js
- marketStructureRendering.ts
- rsiDivergenceStats.ts
- DataExportModal.vue
- daily-structure-pivots/index.ts
- biasCheck.ts
- Trading-Monitor Project Overview (CLAUDE.md)
- TradeEditModal.vue
- package.json
- src/sessionOccurrences.js
- LoopStatus.vue
- berlinDateStrFor
- Dealing-Range-Anlegen Skill
- reads.ts
- newsMarkers.js
- usePriceChartLiquidity.js
- ctrader/client.ts
- MetadataPanel.vue
- tradeIntake.js
- trades.js
- backfillTradeSetupOutcomes.ts
- orderBlocks.js
- lineWidth
- sessions.js
- gbp_h1_uptrend_protected_low_gebrochen.ts
- tradingAccounts.js
- trading-monitor-mcp/pretradeGates.ts
- dataExport.js
- tdd_mit_claude.ts
- tradeSetup.ts
- priceChartHitTest.test.js
- TradeSetupCockpit.vue
- applyMarketStructurePivot
- fallClassifier.ts
- liquidity.ts
- useClaudeAnnotations.js
- trading-monitor-mcp/marketStructureAnalysis.ts
- priceChartConstants.js
- pinContext.js
- Laniakea Persona Command (/l)
- Plan: Sehr Große Dateien Refactoren (PriceChart.vue)
- machineState.ts
- FibTickPrimitive
- nearRelevantLiquidityLevels.ts
- trading-monitor-mcp/index.ts
- gbp_h1_uptrend.ts
- tradeSetupCockpit.ts
- dailyPivotMarkers.js
- src/marketStructureAnalysis.ts
- dataExport.ts
- pinEntryVisible
- orderBlocks.ts
- fetchForexCandles
- tradeSetup.js
- rsiRendering.js
- poi-watcher/index.ts
- State Machine for Lana's Trading Flow
- compilerOptions
- usePriceChartMarketStructure.js
- claudeAnnotations.js
- recentReactions.ts
- AGENTS.md
- cTrader ACCESS_DENIED Lockout (No Auto-Recovery)
- findTargetCandidates.js
- tradingSchedules.js
- dataSnapshot.ts
- forexCandles.js
- findAntiConfluences.js
- SessionBandPaneView
- TradingFlow.vue
- marketStructureAnalysis Rules Overview
- Fachdoku-Router Skill
- supabaseClient.js
- Dealing-Range-Loop Diagram
- marketStructureAnalysisLqSweep.test.js
- App.vue
- AI Capabilities and Limitations Notes
- Vegapunk Slimming Results (-86%)
- replayAsOf.ts
- Protokoll.vue
- PinAddPopup.vue
- twelvedata/client.ts
- Anleitung: State-Machine lesen & bedienen
- pins.ts
- findAntiConfluenceCandidates.js
- marketStructureAnalysisNestedNestedChoch.test.js
- MCP-Server: Tiefere Referenz
- pivotMarkers.ts
- DivergenceLinePrimitive
- loopState.js
- usePriceChartRsi
- trade_evidence Table (Dual-Level, Confirmation/Confluence)
- pricePrecisionForInstrument
- Plan: Forex-Chart-Objekte Datengrundlage
- /task do Mode
- ArrowPaneView
- marketStructureAnalysisInnerPivots.test.js
- annotations.ts
- Lana-Fehlerdiagnose
- Agent Skills Pro Notes
- fachdoku-router/SKILL.md
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
- ZoneRenderer
- marketStructureAnalysis.test.js
- trading-monitor index.html Entry
- JsonTree.vue
- Handbuch-Check
- trendIndicator.gbpusd-downtrend.test.js
- Claude Code Hooks Documentation Pointers
- mcp-server/src/scripts/backfillObZones.ts
- backfillObZones.ts
- usePriceChartLiquidity
- liquidity.js
- usePolledFetch.js
- Dealing Range anlegen
- .codex/hooks/lana-git-pull.cjs
- source-command-l
- CrudListSection.vue
- InvalidationField.vue
- trendChainLevelDisplay

## God Nodes (most connected - your core abstractions)
1. `berlinDateStrFor()` - 45 edges
2. `cssColor()` - 34 edges
3. `fetchForexCandles()` - 31 edges
4. `pricePrecisionForInstrument()` - 30 edges
5. `berlinDateTimeStrFor()` - 30 edges
6. `fmtPrice()` - 28 edges
7. `clipReplay()` - 27 edges
8. `logDecision()` - 25 edges
9. `lineWidth()` - 24 edges
10. `refreshChart()` - 24 edges

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

## Communities (143 total, 11 thin omitted)

### Community 0 - "Dashboard.vue"
Cohesion: 0.02
Nodes (134): useSessionStorageRef(), addPositionToDealingRange(), fetchTradeSetupForCockpit(), antiConfluenceAddTrade, anyArmStateActive, ARM_STATES, clearArmStatesExcept(), closeTradeEditModal() (+126 more)

### Community 1 - "gbp_h1_uptrend_uptrend_break_of_structure_und_trendumkehr.ts"
Cohesion: 0.02
Nodes (101): candlesAroundBOS, candlesAroundBreak, p2Pivot1, p2Pivot10, p2Pivot11, p2Pivot12, p2Pivot13, p2Pivot14 (+93 more)

### Community 2 - "dealingRangeLoop.ts"
Cohesion: 0.10
Nodes (36): FallFourResult, WatchLevel, appendHeartbeat(), closeLoopState(), HeartbeatEntry, LoopLevel, LoopStatus, rowToState() (+28 more)

### Community 3 - "NewsModal.vue"
Cohesion: 0.13
Nodes (19): CURRENCIES, emit, LIST_FORMATTER, newCurrency, newDateTime, newTitle, saving, submit() (+11 more)

### Community 4 - "PriceChart.vue"
Cohesion: 0.03
Nodes (99): mergeRecent(), replayFetchToMs(), activeMetadataSnapshot, allCandles, antiConfluencePickerCurrentPrice, antiConfluencePickerDivergenceCandidates, antiConfluencePickerHoveredLiquidityKey, antiConfluencePickerHoveredObKey (+91 more)

### Community 5 - "gbp_h1_uptrend_mit_LQ_sweep_LONG_SETUP.ts"
Cohesion: 0.03
Nodes (60): p2Pivot1, p2Pivot10, p2Pivot11, p2Pivot12, p2Pivot13, p2Pivot14, p2Pivot15, p2Pivot16 (+52 more)

### Community 6 - "gbp_h1_uptrend_mit_inner_structure.ts"
Cohesion: 0.04
Nodes (55): p2Pivot1, p2Pivot10, p2Pivot11, p2Pivot12, p2Pivot13, p2Pivot14, p2Pivot15, p2Pivot16 (+47 more)

### Community 7 - "db.ts"
Cohesion: 0.08
Nodes (39): InducementClass, AddTradeConfirmationArgs, addTradePosition(), addTradeTarget(), AddTradeTargetArgs, createTrade(), CreateTradeArgs, DEALING_RANGE_FIELD_MAP (+31 more)

### Community 8 - "usePriceChartRsi.js"
Cohesion: 0.15
Nodes (20): computeEma(), buildDivergenceEntry(), collectDivergenceHistory(), computeRsi(), DEFAULT_DIVERGENCE_FRACTAL_PERIOD, DEFAULT_DIVERGENCE_HISTORY_COUNT, DEFAULT_DIVERGENCE_LOOKBACK_BARS, DEFAULT_RSI_PERIOD (+12 more)

### Community 9 - "marketStructureRendering.ts"
Cohesion: 0.12
Nodes (18): Candle, ArrowPrimitive, collectFibLevels(), collectH1LqLevels(), collectNestedChain(), computeFibLevels(), fibBetween(), FibLevel (+10 more)

### Community 10 - "rsiDivergenceStats.ts"
Cohesion: 0.09
Nodes (38): buildDivergenceEntry(), collectDivergenceHistory(), computeRsi(), DEFAULT_DIVERGENCE_FRACTAL_PERIOD, DEFAULT_DIVERGENCE_HISTORY_COUNT, DEFAULT_DIVERGENCE_LOOKBACK_BARS, DEFAULT_RSI_PERIOD, detectRsiDivergence() (+30 more)

### Community 11 - "DataExportModal.vue"
Cohesion: 0.09
Nodes (21): asset, copied, copyResult(), currentSymbol, dateStr, error, generate(), loading (+13 more)

### Community 12 - "daily-structure-pivots/index.ts"
Cohesion: 0.16
Nodes (13): CORS_HEADERS, ExistingPivotRow, INSTRUMENTS, CORS_HEADERS, PERIOD_MAP, PERSISTABLE_BARS, persistIfArchivable(), RefreshedTokens (+5 more)

### Community 13 - "biasCheck.ts"
Cohesion: 0.14
Nodes (27): berlinDayRangeUtcMs(), buildPendingDecisions(), determineTrendForce(), findIntermediateLevel(), FindIntermediateLevelArgs, IntermediateLevelCandidate, isSpreadHourPivot(), PendingDecision (+19 more)

### Community 14 - "Trading-Monitor Project Overview (CLAUDE.md)"
Cohesion: 0.09
Nodes (26): cTrader Open API as Forex Candle Source, DRY Within a Single Runtime Convention, CLAUDE.md Pointer to /l Persona, npm run build Command, Trading-Monitor Project Overview (CLAUDE.md), Supabase/PostgREST ~1000 Row Cap Gotcha, Rename Consistency Convention, daily_structure_pivots Table (+18 more)

### Community 15 - "TradeEditModal.vue"
Cohesion: 0.05
Nodes (44): commission, emit, entryPrice, entryTimeInput, exitPrice, exitTimeInput, flashInvalidationSaved(), instrumentMismatch (+36 more)

### Community 16 - "package.json"
Cohesion: 0.06
Nodes (33): lightweight-charts, mermaid, dependencies, lightweight-charts, mermaid, @supabase/supabase-js, vue, vue-router (+25 more)

### Community 17 - "src/sessionOccurrences.js"
Cohesion: 0.24
Nodes (12): attachBonus(), ALL_DAYS, attachRangeExtremes(), bonusLabelForPivot(), buildSessionContextLookup(), contextForPivot(), daysOrAll(), localMidnightUtc() (+4 more)

### Community 18 - "LoopStatus.vue"
Cohesion: 0.07
Nodes (18): fetchStateMachineLog(), rowToDecision(), activeByInstrument, { data, refresh }, DEBUG_DECISION_TAGS, decisionLogByInstrument, decisionTagFilter, errorText (+10 more)

### Community 19 - "berlinDateStrFor"
Cohesion: 0.12
Nodes (29): berlinDateStrFor(), berlinDateTimeStrFor(), DATE_FORMATTER, OFFSET_FORMATTER, TIME_FORMATTER, getLoopStateForDay(), loadMachineForDayOrNull(), NEXT_ACTION_FALLBACK (+21 more)

### Community 20 - "Dealing-Range-Anlegen Skill"
Cohesion: 0.14
Nodes (15): kind=pivot = Liquidity-Sweep-Only Semantics, Dealing-Range-Anlegen Skill, milk-city Task: Confluence-Tracking bei Dealing Ranges, trading/liquidität.md (Liquiditäts-Sweep-Mechanismus), AI Capabilities Framework (Next Token Prediction/Knowledge/Working Memory/Steerability), Diagnose-to-Fix Routing Table, Lana-Fehlerdiagnose Skill, docs/steerabilty-vs-wrong-ai-outputs.md (+7 more)

### Community 21 - "reads.ts"
Cohesion: 0.18
Nodes (20): getForexCandlesArchive(), getJournal(), getNewsEvents(), getTradeSetups(), getTradeSetupWinrate(), getTradingAccounts(), getTradingSchedule(), computeEma() (+12 more)

### Community 22 - "newsMarkers.js"
Cohesion: 0.13
Nodes (12): usePriceChartSessionsAndNews(), refreshNewsMarkers(), DAY_KEY_FORMATTER, extrapolatedX(), formatEventLabel(), isSameBerlinDay(), NewsMarkerPaneView, NewsMarkerPrimitive (+4 more)

### Community 23 - "usePriceChartLiquidity.js"
Cohesion: 0.15
Nodes (22): refresh(), liquidityLevelNaturalKey(), renderLiquidityLevels(), buildLevel(), detectLiquidityLevels(), filterRelevantLevels(), isDownFractal(), isUpFractal() (+14 more)

### Community 24 - "ctrader/client.ts"
Cohesion: 0.12
Nodes (25): CORS_HEADERS, fetchForexBatch(), authAccount(), authenticate(), cachedSymbolIds, Candle, concat(), connectWithTimeout() (+17 more)

### Community 25 - "MetadataPanel.vue"
Cohesion: 0.06
Nodes (28): chartColors, DEFAULT_CHART_COLORS, resetChartColors(), chartLineWidths, DEFAULT_CHART_LINE_WIDTHS, resetChartLineWidths(), emit, height (+20 more)

### Community 26 - "tradeIntake.js"
Cohesion: 0.13
Nodes (29): direction, emit, entryPrice, errorMsg, levels, precision, props, reasoning (+21 more)

### Community 27 - "trades.js"
Cohesion: 0.11
Nodes (22): onRemoveConfirmation(), pnlClass, props, stats, winrateClass, fmtR(), removeConfirmationFromTrade(), computeTradeStats() (+14 more)

### Community 28 - "backfillTradeSetupOutcomes.ts"
Cohesion: 0.10
Nodes (34): MAJOR_MIN_SECONDS, MINOR_MAX_SECONDS, AgeTier, businessSecondsBetween(), classifyAge(), classifyInducementAge(), inducementAgeRange(), MAJOR_MIN_HOURS (+26 more)

### Community 29 - "orderBlocks.js"
Cohesion: 0.16
Nodes (22): emit, onAntiConfluencePickerHover(), onAntiConfluencePickerSelect(), onTargetPickerHover(), onTargetPickerSelect(), refreshLiquidityInternal(), refreshPoiZonesInternal(), detectOrderBlocks() (+14 more)

### Community 30 - "lineWidth"
Cohesion: 0.12
Nodes (11): lineWidth(), drawEntryPoint(), drawExitPoint(), drawHaloRing(), drawLabel(), drawTick(), renderTradeMarkers(), TradeMarkerPaneView (+3 more)

### Community 31 - "sessions.js"
Cohesion: 0.13
Nodes (18): emit, instrumentSessions, props, WEEKDAY_DISPLAY_ORDER, refreshSessions(), addSession(), currentSessionDanger(), DANGER_LEVELS (+10 more)

### Community 32 - "gbp_h1_uptrend_protected_low_gebrochen.ts"
Cohesion: 0.08
Nodes (25): ClosedRange, MarketStructureState, PivotBase, PivotHigh, PivotLow, PivotTouched, PivotTypeAll, PivotUntouched (+17 more)

### Community 33 - "tradingAccounts.js"
Cohesion: 0.12
Nodes (19): currentLabel, open, selectedAccount, wrapperRef, cache, useLocalStorageRef(), accounts, accountsLoaded (+11 more)

### Community 34 - "trading-monitor-mcp/pretradeGates.ts"
Cohesion: 0.16
Nodes (18): BERLIN_HM_FORMATTER, BERLIN_WEEKDAY_FORMATTER, berlinWeekdayAndMinutes(), isWithinTradingWindows(), TradingWindows, WeekdayGroup, ClassifiedNewsEvent, evaluateNewsGate() (+10 more)

### Community 35 - "dataExport.js"
Cohesion: 0.15
Nodes (23): marketStructureTree, berlinOffsetMinutes(), buildDataExport(), compute1hStructureState(), computeExportTimeframeData(), computeLiquidityLevelsForExport(), computeObZonesForExport(), computeTrendChainAges() (+15 more)

### Community 36 - "tdd_mit_claude.ts"
Cohesion: 0.08
Nodes (24): nextPivot1, nextPivot10, nextPivot11, nextPivot2, nextPivot3, nextPivot4, nextPivot5, nextPivot6 (+16 more)

### Community 37 - "tradeSetup.ts"
Cohesion: 0.24
Nodes (13): LiquidityLevel, closesBeyondLevel(), DetectedTradeSetup, detectTradeSetup(), findBestLsMatch(), findFirstSetupObAfter(), findImmediateLsSetup(), findLsInArray() (+5 more)

### Community 38 - "priceChartHitTest.test.js"
Cohesion: 0.09
Nodes (22): findClickedDivergence(), findClickedFibLevel(), findClickedLiquidityLevel(), findClickedOBZone(), findClickedSetup(), findClickedTarget(), getCurrentFibLevels(), OrderBlockPrimitive (+14 more)

### Community 39 - "TradeSetupCockpit.vue"
Cohesion: 0.09
Nodes (23): accentStyle, antiConfluences, canTransfer, confirmationLabel(), confirmations, confluences, dateLabel, direction (+15 more)

### Community 40 - "applyMarketStructurePivot"
Cohesion: 0.10
Nodes (25): applyMarketStructurePivot(), initMarketStructureState(), RANGE_FIB_MIN_PP_DISTANCE_PIPS, chochConfirmedState(), confirmBreak, confirmedUptrendState(), originHigh, originLow (+17 more)

### Community 41 - "fallClassifier.ts"
Cohesion: 0.22
Nodes (11): checkFallFour(), CheckFallFourInput, computeWatchLevels(), hasReaction(), HasReactionInput, hitCounterLevel(), hitTarget(), TargetHit (+3 more)

### Community 42 - "liquidity.ts"
Cohesion: 0.70
Nodes (4): buildLevel(), detectLiquidityLevels(), isDownFractal(), isUpFractal()

### Community 43 - "useClaudeAnnotations.js"
Cohesion: 0.10
Nodes (27): addClaudeAnnotationDrawing(), fetchClaudeAnnotations(), removeClaudeAnnotationDrawing(), setClaudeAnnotationDrawingVisible(), applyText(), emit, error, { instrument, dateStr, drawings, loading, add, remove, setDrawingVisible } (+19 more)

### Community 44 - "trading-monitor-mcp/marketStructureAnalysis.ts"
Cohesion: 0.21
Nodes (23): advanceNestedTrend(), advanceNestedTrendInner(), applyInnerMarketStructurePivot(), applyInnerMarketStructurePivotCore(), applyMarketStructurePivot(), applyMarketStructurePivotCore(), buildMarketStructureState(), Candle (+15 more)

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

### Community 49 - "machineState.ts"
Cohesion: 0.17
Nodes (16): deriveStepAndCase(), LoadedMachine, persistTransition(), rehydrateActor(), LogDecisionArgs, supabase, createTradingActor(), flattenStateValue() (+8 more)

### Community 50 - "FibTickPrimitive"
Cohesion: 0.15
Nodes (3): FibTickPaneView, FibTickPrimitive, FibTickRenderer

### Community 51 - "nearRelevantLiquidityLevels.ts"
Cohesion: 0.22
Nodes (16): berlinOffsetMinutes(), PIP_SIZE, ALL_DAYS, attachRangeExtremes(), bonusLabelForPivot(), buildSessionContextLookup(), contextForPivot(), daysOrAll() (+8 more)

### Community 52 - "trading-monitor-mcp/index.ts"
Cohesion: 0.09
Nodes (30): addTradeConfirmation(), createDealingRange(), deleteDealingRange(), deriveBootstrapDirection(), deriveConfirmationFromPin(), fetchActiveTscRangeId(), fetchDealingRangeCockpit(), getOpenOppositeDealingRanges() (+22 more)

### Community 53 - "gbp_h1_uptrend.ts"
Cohesion: 0.10
Nodes (20): pivot1, pivot10, pivot11, pivot12, pivot13, pivot2, pivot3, pivot4 (+12 more)

### Community 54 - "tradeSetupCockpit.ts"
Cohesion: 0.13
Nodes (17): trendChain, RangeTrend, ANTI_CONFLUENCE_COLOR, ANTI_CONFLUENCE_THRESHOLD, AntiConfluence, CockpitState, computeAntiConfluences(), computeCockpitState() (+9 more)

### Community 55 - "dailyPivotMarkers.js"
Cohesion: 0.14
Nodes (7): usePriceChartDailyPivots(), refresh(), DailyPivotMarkerPaneView, DailyPivotMarkerPrimitive, DailyPivotMarkerRenderer, drawTriangle(), renderDailyPivotMarkers()

### Community 56 - "src/marketStructureAnalysis.ts"
Cohesion: 0.25
Nodes (18): refreshMarketStructure(), advanceNestedTrend(), applyInnerMarketStructurePivotCore(), applyMarketStructurePivotCore(), buildMarketStructureState(), closesAboveOldHigh(), closesBelowLevel(), computeRangesPivots() (+10 more)

### Community 57 - "dataExport.ts"
Cohesion: 0.15
Nodes (20): getLatestDailyStructureStartTime(), Candle, computeRangesPivots(), ageReferenceTime(), buildDataExport(), businessSecondsBetween(), capStructurePivots(), classifyAgeTier() (+12 more)

### Community 58 - "pinEntryVisible"
Cohesion: 0.14
Nodes (18): liquidityLevelEntryNaturalKey(), m5LiquidityEntryNaturalKey(), obZoneEntryNaturalKey(), hoveredPinLiquidityLevelKey, hoveredPinObZoneKey, onSelectPin(), pinEntryVisible(), pinJumpHint (+10 more)

### Community 59 - "orderBlocks.ts"
Cohesion: 0.16
Nodes (10): Candle, detectOrderBlocks(), HTF_FOREX_LABELS, HTF_FOREX_MIN_GAP_PIPS, LOWER_TF_LABELS, LOWER_TF_MIN_GAP_PIPS, Zone, DailyPivotLike (+2 more)

### Community 60 - "fetchForexCandles"
Cohesion: 0.18
Nodes (14): getForexCandlesArchiveUpTo(), fetchForexCandles(), fetchLiveForexCandles(), fetchLiveForexCandlesOnce(), isRetryable(), ALL_BARS, backfillOne(), Bar (+6 more)

### Community 61 - "tradeSetup.js"
Cohesion: 0.21
Nodes (15): Two Runtimes, One Algorithm Set (Deliberate Duplication), computeTradeSetups(), closesBeyondLevel(), detectSetupObs(), detectTradeSetups(), findAllProtectedFractals(), findBestLsMatch(), findFirstSetupObAfter() (+7 more)

### Community 62 - "rsiRendering.js"
Cohesion: 0.16
Nodes (4): drawIconLabel(), LiquidityLineRenderer, DivergenceLineRenderer, mergePinnedDivergences()

### Community 63 - "poi-watcher/index.ts"
Cohesion: 0.13
Nodes (13): fmt(), InstrumentConfig, INSTRUMENTS, isInWindows(), LiquidityLevelRow, localMinutesAndWeekday(), ObZoneRow, PinAlarmRow (+5 more)

### Community 64 - "State Machine for Lana's Trading Flow"
Cohesion: 0.14
Nodes (18): Trading-Steps-Ablauf Diagram, Fall 4 -> Zurück zu Schritt 3, Two Permanent LLM-Only Steps (3 and 6), News-Pause Doesn't Replace the Cron, State Machine for Lana's Trading Flow, get_tsc_range Deliberately Not a Graph Node, Problem: GBPUSD 28.08.2026 Fall-4 Deviation Incident, trading-runs/*.md Loses Purpose (+10 more)

### Community 65 - "compilerOptions"
Cohesion: 0.12
Nodes (16): src/marketStructureAnalysis.ts, src/marketStructureRendering.ts, src/pivotMarkers.ts, test/tdd_mit_claude/ranges/tdd_mit_claude.ts, compilerOptions, allowJs, checkJs, esModuleInterop (+8 more)

### Community 66 - "usePriceChartMarketStructure.js"
Cohesion: 0.09
Nodes (29): REPLAY_LOOKAHEAD_SEC M1 Scaling Gotcha, REPLAY_LOOKAHEAD_SEC M1 Scaling Bug (Origin), cachedCandlesUpTo(), cacheKey(), fetchCandlesCached(), getCachedCandles(), mergeCandles(), openDb() (+21 more)

### Community 67 - "claudeAnnotations.js"
Cohesion: 0.09
Nodes (16): ANNOTATION_COLOR, annotationAnchorPoint(), AnnotationsPaneView, AnnotationsPrimitive, AnnotationsRenderer, parseAnnotations(), renderClaudeAnnotations(), resolveLabelPlacements() (+8 more)

### Community 68 - "recentReactions.ts"
Cohesion: 0.20
Nodes (15): getObZones(), getSessions(), coincidesWithHtf(), computeM5LiquidityAndObZones(), M5_OB_RANGE_PIPS, buildNearRelevantObZones(), dropLowerTfDuplicateZones(), filterConfluenceObZoneRows() (+7 more)

### Community 69 - "AGENTS.md"
Cohesion: 0.14
Nodes (12): Architecture, Commands, Conventions, Forex candle data: cTrader Open API, not Twelve Data, Frontend data flow (`PriceChart.vue`), Gotchas, graphify, "Laniakea" persona (`/l`) (+4 more)

### Community 70 - "cTrader ACCESS_DENIED Lockout (No Auto-Recovery)"
Cohesion: 0.50
Nodes (3): cTrader ACCESS_DENIED Lockout (No Auto-Recovery), ctrader_oauth_tokens Table, tokenUrl

### Community 71 - "findTargetCandidates.js"
Cohesion: 0.11
Nodes (28): buildLevel(), detectLiquidityLevels(), filterRelevantLevels(), isDownFractal(), isUpFractal(), LIQUIDITY_FRACTAL_PERIOD, LIQUIDITY_MAX_RELEVANT, LiquidityLevel (+20 more)

### Community 72 - "tradingSchedules.js"
Cohesion: 0.19
Nodes (12): minutesToTimeInput(), timeInputToMinutes(), addWindow(), cloneWindows(), DEFAULT_SCHEDULES, EMPTY_WINDOWS, loadInitial(), removeWindow() (+4 more)

### Community 73 - "dataSnapshot.ts"
Cohesion: 0.23
Nodes (13): isBoxInvalidated(), DEFAULT_TRADE_SETUP_PARAMS, TRADE_SETUP_H1_FRACTAL_PERIOD, TRADE_SETUP_M5_FRACTAL_PERIOD, findRecentTradeSetupIdsByKey(), buildDataSnapshot(), curateLiveTradeSetup(), DataSnapshotArgs (+5 more)

### Community 74 - "forexCandles.js"
Cohesion: 0.27
Nodes (14): DB_ARCHIVED_BARS, fetchArchivedPage(), fetchArchivedUpTo(), fetchCandles(), fetchCandlesBatchOnce(), fetchCandlesOnce(), fetchInitialCandles(), fetchOlderCandles() (+6 more)

### Community 75 - "findAntiConfluences.js"
Cohesion: 0.42
Nodes (10): byDistance(), findAntiConfluenceCandidates(), findAntiConfluenceDivergenceCandidates(), findAntiConfluenceObCandidates(), findAntiConfluenceSweepCandidates(), findInvalidationObCandidates(), inBand(), MAX_HELD_OB_AGE_DAYS (+2 more)

### Community 76 - "SessionBandPaneView"
Cohesion: 0.14
Nodes (3): SessionBandPaneView, SessionBandPrimitive, SessionBandRenderer

### Community 77 - "TradingFlow.vue"
Cohesion: 0.11
Nodes (20): buildMermaidSource(), EDGES, getNextActionHint(), mermaidEscape(), NODES, activeByInstrument, berlinTimeFormatter, currentLoop (+12 more)

### Community 78 - "marketStructureAnalysis Rules Overview"
Cohesion: 0.07
Nodes (40): HTF_FOREX_MIN_GAP_PIPS Constant, LOWER_TF_MIN_GAP_PIPS Constant, Pip-/Pixel-Schwellwerte Übersicht, MAX_TARGET_DISTANCE_PIPS Constant, MIN_PIXELS_PER_HOUR_FOR_LABELS Constants, PIP_SIZE Constant, RANGE_FIB_MIN_PP_DISTANCE_PIPS Constant, TRADE_SETUP_LS_MAX_DISTANCE_M5 Constant (+32 more)

### Community 79 - "Fachdoku-Router Skill"
Cohesion: 0.15
Nodes (13): poi-watcher UTC Refresh-Tick Exception, Trading-Hours/Timezone Handling (Europe/Berlin), sessions Table, trading_schedules Table, docs/debug-metadata-panel.md, Fachdoku-Router Skill, src/marketStructureAnalysis.notes.md, docs/mcp-server.md (+5 more)

### Community 80 - "supabaseClient.js"
Cohesion: 0.18
Nodes (12): fetchAlarmLog(), fetchTouchedLiquidityLevels(), fetchTradeSetups(), fetchDailyStructurePivots(), fetchLiquidityLevelsHtf(), fetchObZones(), fetchTouchedZones(), supabase (+4 more)

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

### Community 86 - "replayAsOf.ts"
Cohesion: 0.24
Nodes (15): asOfProbeCandles(), applyAsOf(), applyAsOfZones(), earliestAmbiguousEventSec(), existsAsOf(), M5_SECONDS, ProbeCandle, resolveEventSec() (+7 more)

### Community 87 - "Protokoll.vue"
Cohesion: 0.17
Nodes (10): ALARM_TYPES, fetchAlarmSettings(), setAlarmEnabled(), router, alarms, errorText, loading, toggle() (+2 more)

### Community 88 - "PinAddPopup.vue"
Cohesion: 0.23
Nodes (11): clampedX, clampedY, confirm(), emit, note, onKeydown(), onWindowMousedown(), props (+3 more)

### Community 89 - "twelvedata/client.ts"
Cohesion: 0.21
Nodes (11): Candle, fetchCandles(), FetchCandlesOptions, INTERVAL_MAP, requestTimeSeries(), resample(), RESAMPLE_BUCKET_SEC, SUPPORTED_PERIODS (+3 more)

### Community 90 - "Anleitung: State-Machine lesen & bedienen"
Cohesion: 0.25
Nodes (7): Ablaufbeispiel, Anleitung: State-Machine lesen & bedienen, Grundprinzip, Maschine bedienen, Menschlicher Gegencheck, `replayUntilSec` (beide Tools), State lesen, ohne die Maschine zu bewegen

### Community 91 - "pins.ts"
Cohesion: 0.30
Nodes (11): addPinEntry(), addPinM5LiquidityEntry(), addPinM5ObEntry(), addPinRsiDivergenceEntry(), findOrCreateObZoneId(), getPinContext(), getPinInstrumentById(), removePinEntry() (+3 more)

### Community 92 - "findAntiConfluenceCandidates.js"
Cohesion: 0.40
Nodes (10): byDistance(), findAntiConfluenceCandidates(), findAntiConfluenceDivergenceCandidates(), findAntiConfluenceObCandidates(), findAntiConfluenceSweepCandidates(), findInvalidationObCandidates(), inBand(), MAX_HELD_OB_AGE_DAYS (+2 more)

### Community 93 - "marketStructureAnalysisNestedNestedChoch.test.js"
Cohesion: 0.10
Nodes (17): advanceNestedTrendInner(), applyInnerMarketStructurePivot(), confirmBreak, originHigh, originLow, pullback, confirmBreak, originHigh (+9 more)

### Community 94 - "MCP-Server: Tiefere Referenz"
Cohesion: 0.20
Nodes (10): MCP Auth & Table Permissions, Backfill Scripts, Candle Archive (forex_candles), MCP Server Deployment (Supabase Edge Function), MCP-Server: Tiefere Referenz, get_forex_rsi / get_forex_ema Tools, Single Deno Copy (Dual-Copy Removed), Trade-Journal Write Tools (tools/trades.ts) (+2 more)

### Community 95 - "pivotMarkers.ts"
Cohesion: 0.12
Nodes (9): canShowLabels(), MIN_PIXELS_PER_HOUR_FOR_LABELS, MIN_PIXELS_PER_HOUR_FOR_LABELS_INTRADAY, Candle, PivotMarkerGroup, PivotMarkerPaneView, PivotMarkerPrimitive, PivotMarkerRenderer (+1 more)

### Community 97 - "loopState.js"
Cohesion: 0.31
Nodes (8): dateStr, berlinDateStrFor(), fetchLoopStateHistory(), fetchLoopStatesForDate(), LOOP_INSTRUMENTS, rowToLoopState(), loadAll(), { data, refresh }

### Community 98 - "usePriceChartRsi"
Cohesion: 0.32
Nodes (7): nativeLineWidth(), usePriceChartRsi(), applyColorOptions(), applyLineWidthOptions(), create(), refreshEma(), refreshRsi()

### Community 99 - "trade_evidence Table (Dual-Level, Confirmation/Confluence)"
Cohesion: 0.18
Nodes (13): dealing_ranges Table, trade_evidence Table (Dual-Level, Confirmation/Confluence), trade_partial_exits Table, trade_positions Table, trade_targets Table, Confirmation/Confluence/Anti-Confluence Categories, trading repo trade-from-poi.md (Confirmation/Confluence/Anti-Confluence Definition), Anti-Confluences Snapshot Feature (Planned) (+5 more)

### Community 100 - "pricePrecisionForInstrument"
Cohesion: 0.06
Nodes (39): candidateLabel(), candidatePrice(), emit, mergedCandidates, precision, props, emit, noteSaveTimers (+31 more)

### Community 101 - "Plan: Forex-Chart-Objekte Datengrundlage"
Cohesion: 0.21
Nodes (12): ob_zones Table, Archive-First Auto-Reload Pattern (Tried, Then Reverted), BTC Scope Removal from Chart-Objects Plan, OB-Zones Canonical FK Consolidation Approach, 1H/4H DB-Read vs Live-Recompute Decision, Four Independent OB Render Passes Problem, "Historische OBs"-Toggle Semantics, LQ-Sweep Relevance Criterion (Recent OR Pip-Range) (+4 more)

### Community 102 - "/task do Mode"
Cohesion: 0.38
Nodes (7): Laniakea milk-city Task-Status Rule, /task Default Data-Maintenance Mode, /task do Mode, /task new Mode, /task refine Mode, /task Command Router, milk-city Task Status Convention

### Community 104 - "marketStructureAnalysisInnerPivots.test.js"
Cohesion: 0.25
Nodes (7): h1Candles, p2Pivot3, p2Pivot4, p2Pivot5, pivot1, pivot2, pivot3

### Community 105 - "annotations.ts"
Cohesion: 0.38
Nodes (6): postChartAnnotations(), ANNOTATION_SCHEMA, DRAWING_GROUP_SCHEMA, registerAnnotationTools(), VALID_TYPES, validateAnnotations()

### Community 106 - "Lana-Fehlerdiagnose"
Cohesion: 0.33
Nodes (5): Ablauf, Ergebnis, Lana-Fehlerdiagnose, Routing: Diagnose → typischer Fix-Ort, Wann aufrufen

### Community 107 - "Agent Skills Pro Notes"
Cohesion: 0.29
Nodes (7): allowed-tools Skill Config, Context-free Scripts in Skills, Agent Skills Pro Notes, Progressive Disclosure in Skills, Skill Sharing & Troubleshooting, Skills Embedded in Subagents, Skills vs CLAUDE.md vs Hooks vs Subagents

### Community 108 - "fachdoku-router/SKILL.md"
Cohesion: 0.18
Nodes (10): Fachdoku-Router, News Events Seed Workflow (ForexFactory Screenshot), News Events Seeding Notes, news_events Consumption (No-Go + Chart Markers), Settings-Sync Notes, localStorage-first / Supabase-Source-of-Truth Pattern, trading_loop_state Table Design, TSC No-Gos and Anti-Confluences Notes (+2 more)

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
Cohesion: 0.25
Nodes (8): a) Aufmerksamkeitslevel niedrig — kein DR, Markt gibt nichts her (Fall 3), Aufmerksamkeits-Level (Watch-Level-Strategie Schritt 5+), b) Aufmerksamkeitslevel hoch — Dealing Range bildet sich (Fall 2), Bekannter Bug (07.09.2026, behoben), c) Aufmerksamkeitslevel hoch — Dealing Range bestätigt (Fall 1), d) Aufmerksamkeitslevel höchste — Dealing Range validiert (Schritt 7, Find Entry), Offen / TODO, Ping bei neuem M5-OB (10.09.2026, implementiert)

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

### Community 121 - "ZoneRenderer"
Cohesion: 0.17
Nodes (3): positionsBox(), ZonePaneView, ZoneRenderer

### Community 122 - "marketStructureAnalysis.test.js"
Cohesion: 0.22
Nodes (8): pivot1, pivot2, pivot3, pivot4, pivot5, pivot6, pivot7, pivot8

### Community 124 - "JsonTree.vue"
Cohesion: 0.25
Nodes (5): entries, expanded, isArray, isObject, props

### Community 125 - "Handbuch-Check"
Cohesion: 0.40
Nodes (4): Ergebnis, Handbuch-Check, Prüfpunkte, Wann aufrufen

### Community 131 - "backfillObZones.ts"
Cohesion: 0.13
Nodes (17): firstObFormationTimeAfter(), TriggerCandle, detectOrderBlocks(), HTF_FOREX_LABELS, HTF_FOREX_MIN_GAP_PIPS, LOWER_TF_LABELS, LOWER_TF_MIN_GAP_PIPS, backfillOne() (+9 more)

### Community 132 - "usePriceChartLiquidity"
Cohesion: 0.40
Nodes (3): openAntiConfluencePicker(), usePriceChartLiquidity(), getCurrentLiquidityLevels()

### Community 133 - "liquidity.js"
Cohesion: 0.06
Nodes (50): AgeTier, classifyAge(), cssColor(), cssColorScaled(), hexToRgba(), ageReferenceTime(), businessSecondsBetween(), computeNextReplayTime() (+42 more)

### Community 134 - "usePolledFetch.js"
Cohesion: 0.43
Nodes (5): usePolledFetch(), load(), lastSuccessAt, useStatusBar(), markSuccess()

### Community 135 - "Dealing Range anlegen"
Cohesion: 0.50
Nodes (3): Ablauf, Dealing Range anlegen, Warum ein eigener Skill (nicht nur eine Doku-Zeile)

### Community 136 - ".codex/hooks/lana-git-pull.cjs"
Cohesion: 0.50
Nodes (3): { execFileSync }, path, TRADING_REPO

### Community 141 - "trendChainLevelDisplay"
Cohesion: 0.50
Nodes (4): trendChainDisplay, formatTrendAge(), trendChainDepthHint(), trendChainLevelDisplay()

## Ambiguous Edges - Review These
- `Trading-Steps-Ablauf Diagram` → `calc_rr Tool Idea (Deterministic RR Calc)`  [AMBIGUOUS]
  docs/steerabilty-vs-wrong-ai-outputs.md · relation: references

## Knowledge Gaps
- **1096 isolated node(s):** `{ execFileSync }`, `path`, `TRADING_REPO`, `{ execFileSync }`, `path` (+1091 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1310 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **11 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Trading-Steps-Ablauf Diagram` and `calc_rr Tool Idea (Deterministic RR Calc)`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **Why does `businessSecondsBetween()` connect `liquidity.js` to `PriceChart.vue`, `backfillTradeSetupOutcomes.ts`, `tradeSetupCockpit.ts`?**
  _High betweenness centrality (0.072) - this node is a cross-community bridge._
- **Why does `renderMarketStructureAnalysis()` connect `marketStructureRendering.ts` to `usePriceChartMarketStructure.js`, `liquidity.js`, `FibTickPrimitive`, `Vegapunk Slimming Results (-86%)`, `src/marketStructureAnalysis.ts`, `lineWidth`?**
  _High betweenness centrality (0.070) - this node is a cross-community bridge._
- **Why does `marketStructureAnalysis Developer Notes` connect `Vegapunk Slimming Results (-86%)` to `fachdoku-router/SKILL.md`, `marketStructureAnalysis Rules Overview`?**
  _High betweenness centrality (0.068) - this node is a cross-community bridge._
- **What connects `{ execFileSync }`, `path`, `TRADING_REPO` to the rest of the system?**
  _1096 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Dashboard.vue` be split into smaller, more focused modules?**
  _Cohesion score 0.015935141179759575 - nodes in this community are weakly interconnected._
- **Should `gbp_h1_uptrend_uptrend_break_of_structure_und_trendumkehr.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0196078431372549 - nodes in this community are weakly interconnected._