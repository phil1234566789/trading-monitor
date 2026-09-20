# Graph Report - trading-monitor  (2026-09-20)

## Corpus Check
- 481 files · ~475,109 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2998 nodes · 6090 edges · 155 communities (135 shown, 14 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 109 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ada9a7d1`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Dashboard.vue
- gbp_h1_uptrend_uptrend_break_of_structure_und_trendumkehr.ts
- reads.ts
- lineWidth
- PriceChart.vue
- gbp_h1_uptrend_mit_LQ_sweep_LONG_SETUP.ts
- gbp_h1_uptrend_mit_inner_structure.ts
- db.ts
- src/rsi.js
- marketStructureRendering.ts
- rsiDivergenceStats.ts
- DataExportModal.vue
- trading-monitor-mcp/index.ts
- trading-monitor-mcp/pretradeGates.ts
- Plan: POI-Strategie-Findung, Backtesting & Trade-Notifications
- TradeEditModal.vue
- package.json
- src/sessionOccurrences.js
- LoopStatus.vue
- trades.ts
- Dealing-Range-Anlegen Skill
- backfillObZones.ts
- NewsMarkerPaneView
- forceAssessment.ts
- ctrader/client.ts
- marketStructureAnalysis Rules Overview
- tradeIntake.js
- refreshTscRange
- Plan: Forex-Chart-Objekte Datengrundlage
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
- OrderBlockPrimitive
- useClaudeAnnotations.js
- trading-monitor-mcp/marketStructureAnalysis.ts
- priceChartConstants.js
- pinContext.js
- Laniakea Persona Command (/l)
- Plan: Sehr Große Dateien Refactoren (PriceChart.vue)
- fachdoku-router/SKILL.md
- marketStructureAnalysisNestedNestedChoch.test.js
- forexCandles.ts
- liquidity.js
- gbp_h1_uptrend.ts
- tradeSetupCockpit.ts
- DR-Reichweite — Grundmessung + Filter-Auswertungen
- src/marketStructureAnalysis.ts
- machineState.ts
- pinEntryVisible
- tradeEvidence.ts
- format.js
- tradeSetup.js
- Pivot
- poi-watcher/index.ts
- State Machine for Lana's Trading Flow
- compilerOptions
- dailyPivotMarkers.js
- claudeAnnotations.js
- pricePrecisionForInstrument
- AGENTS.md
- Trading-Monitor Project Overview (CLAUDE.md)
- canShowLabels
- daily-structure-pivots/index.ts
- usePriceChartRsi.js
- clearArmStatesExcept
- forexCandles.js
- SessionBandPaneView
- TradingFlow.vue
- ArrowPrimitive
- Fachdoku-Router Skill
- fmtPrice
- Dealing-Range-Loop Diagram
- PLAN: DR-Statistik in der UI anzeigen
- App.vue
- AI Capabilities and Limitations Notes
- Vegapunk Slimming Results (-86%)
- cTrader Open API as Forex Candle Source
- router.js
- PinAddPopup.vue
- twelvedata/client.ts
- Anleitung: State-Machine lesen & bedienen
- dataSnapshot.ts
- businessSecondsBetween
- chartTimeUtils.js
- MCP-Server: Tiefere Referenz
- TradeMarkerPrimitive
- findAntiConfluences.js
- drMerkmale.py
- NewsModal.vue
- trade_evidence Table (Dual-Level, Confirmation/Confluence)
- MetadataPanel.vue
- biasCheck.ts
- /task do Mode
- tradeTargets.ts
- newsMarkers.js
- LiquidityLinePrimitive
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
- candleCache.js
- vite.config.js
- lana-git-pull.cjs
- DivergenceLinePrimitive
- .mcp.json
- CrudListSection.vue
- marketStructureAnalysis.test.js
- trading-monitor index.html Entry
- debugMetadata.js
- Handbuch-Check
- trendIndicator.gbpusd-downtrend.test.js
- Claude Code Hooks Documentation Pointers
- mcp-server/src/scripts/backfillObZones.ts
- dataExport.ts
- src/pipConfig.js
- marketStructureAnalysisInnerPivots.test.js
- usePriceChartMarketStructure
- Dealing Range anlegen
- .codex/hooks/lana-git-pull.cjs
- source-command-l
- tradingSchedules.js
- supabaseClient.js
- trades.js
- JsonTree.vue
- PinPanel.vue
- RangeLinePaneView
- usePolledFetch.js
- computeTrendChain
- usePriceChartClaudeAnnotations
- usePriceChartCockpit.js
- LiquidityLineRenderer
- useTabScopedRef
- InvalidationField.vue

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

## Communities (155 total, 14 thin omitted)

### Community 0 - "Dashboard.vue"
Cohesion: 0.02
Nodes (123): useSessionStorageRef(), fetchDailyStructurePivots(), fetchLiquidityLevelsHtf(), fetchObZones(), addPositionToDealingRange(), antiConfluenceAddTrade, anyArmStateActive, ARM_STATES (+115 more)

### Community 1 - "gbp_h1_uptrend_uptrend_break_of_structure_und_trendumkehr.ts"
Cohesion: 0.02
Nodes (101): candlesAroundBOS, candlesAroundBreak, p2Pivot1, p2Pivot10, p2Pivot11, p2Pivot12, p2Pivot13, p2Pivot14 (+93 more)

### Community 2 - "reads.ts"
Cohesion: 0.18
Nodes (22): berlinDayRangeUtcMs(), getForexCandlesArchive(), getJournal(), getNewsEvents(), getTradeSetups(), getTradeSetupWinrate(), getTradingAccounts(), getTradingSchedule() (+14 more)

### Community 3 - "lineWidth"
Cohesion: 0.26
Nodes (9): lineWidth(), drawEntryPoint(), drawExitPoint(), drawHaloRing(), drawLabel(), drawTick(), renderTradeMarkers(), TradeMarkerRenderer (+1 more)

### Community 4 - "PriceChart.vue"
Cohesion: 0.03
Nodes (68): activeMetadataSnapshot, allCandles, antiConfluencePickerCurrentPrice, antiConfluencePickerDivergenceCandidates, antiConfluencePickerHoveredLiquidityKey, antiConfluencePickerHoveredObKey, antiConfluencePickerInvalidationObCandidates, antiConfluencePickerObCandidates (+60 more)

### Community 5 - "gbp_h1_uptrend_mit_LQ_sweep_LONG_SETUP.ts"
Cohesion: 0.03
Nodes (60): p2Pivot1, p2Pivot10, p2Pivot11, p2Pivot12, p2Pivot13, p2Pivot14, p2Pivot15, p2Pivot16 (+52 more)

### Community 6 - "gbp_h1_uptrend_mit_inner_structure.ts"
Cohesion: 0.04
Nodes (55): p2Pivot1, p2Pivot10, p2Pivot11, p2Pivot12, p2Pivot13, p2Pivot14, p2Pivot15, p2Pivot16 (+47 more)

### Community 7 - "db.ts"
Cohesion: 0.06
Nodes (55): InducementClass, addPinEntry(), addPinM5LiquidityEntry(), addPinM5ObEntry(), addPinRsiDivergenceEntry(), addTradeConfirmation(), AddTradeConfirmationArgs, addTradeTarget() (+47 more)

### Community 8 - "src/rsi.js"
Cohesion: 0.18
Nodes (17): refreshDivergence(), buildDivergenceEntry(), collectDivergenceHistory(), computeRsi(), DEFAULT_DIVERGENCE_FRACTAL_PERIOD, DEFAULT_DIVERGENCE_HISTORY_COUNT, detectRsiDivergence(), detectRsiDivergenceHistory() (+9 more)

### Community 9 - "marketStructureRendering.ts"
Cohesion: 0.14
Nodes (22): cssColor(), refreshMarketStructure(), refresh(), bullBearLabelSide(), collectFibLevels(), collectH1LqLevels(), collectNestedChain(), computeFibLevels() (+14 more)

### Community 10 - "rsiDivergenceStats.ts"
Cohesion: 0.09
Nodes (39): buildDivergenceEntry(), collectDivergenceHistory(), computeRsi(), DEFAULT_DIVERGENCE_FRACTAL_PERIOD, DEFAULT_DIVERGENCE_HISTORY_COUNT, DEFAULT_DIVERGENCE_LOOKBACK_BARS, DEFAULT_RSI_PERIOD, detectRsiDivergence() (+31 more)

### Community 11 - "DataExportModal.vue"
Cohesion: 0.09
Nodes (22): asset, copied, copyResult(), currentSymbol, dateStr, error, generate(), loading (+14 more)

### Community 12 - "trading-monitor-mcp/index.ts"
Cohesion: 0.09
Nodes (32): postChartAnnotations(), buildServer(), MCP_TOKEN, berlinTwinKey(), json(), withBerlinTimes(), NEXT_ACTION_FALLBACK, NEXT_ACTION_MAP (+24 more)

### Community 13 - "trading-monitor-mcp/pretradeGates.ts"
Cohesion: 0.11
Nodes (21): BERLIN_HM_FORMATTER, BERLIN_WEEKDAY_FORMATTER, berlinWeekdayAndMinutes(), isWithinTradingWindows(), TradingWindows, WeekdayGroup, buildPendingDecisions(), findIntermediateLevel() (+13 more)

### Community 14 - "Plan: POI-Strategie-Findung, Backtesting & Trade-Notifications"
Cohesion: 0.17
Nodes (15): Supabase/PostgREST ~1000 Row Cap Gotcha, daily_structure_pivots Table, forex_candles Table, get_forex_candles_archive MCP Tool, Archive-First Auto-Reload Pattern (Tried, Then Reverted), BTC-USDT/OKX Complete Removal (2026-08-21), 1D-Periode-4-Pivot Market-Structure Startpoint (2026-08-30), Persisted Forex Candle Archive (forex_candles Pilot) (+7 more)

### Community 15 - "TradeEditModal.vue"
Cohesion: 0.05
Nodes (44): commission, emit, entryPrice, entryTimeInput, exitPrice, exitTimeInput, flashInvalidationSaved(), instrumentMismatch (+36 more)

### Community 16 - "package.json"
Cohesion: 0.06
Nodes (33): lightweight-charts, mermaid, dependencies, lightweight-charts, mermaid, @supabase/supabase-js, vue, vue-router (+25 more)

### Community 17 - "src/sessionOccurrences.js"
Cohesion: 0.26
Nodes (11): attachBonus(), attachRangeExtremes(), bonusLabelForPivot(), buildSessionContextLookup(), contextForPivot(), daysOrAll(), localMidnightUtc(), localWeekday() (+3 more)

### Community 18 - "LoopStatus.vue"
Cohesion: 0.07
Nodes (18): fetchStateMachineLog(), rowToDecision(), activeByInstrument, { data, refresh }, DEBUG_DECISION_TAGS, decisionLogByInstrument, decisionTagFilter, errorText (+10 more)

### Community 19 - "trades.ts"
Cohesion: 0.14
Nodes (23): addTradePosition(), createTrade(), deleteTradeTarget(), getDealingRangeById(), insertTradePosition(), updateDealingRange(), updateTradePosition(), updateTradeTarget() (+15 more)

### Community 20 - "Dealing-Range-Anlegen Skill"
Cohesion: 0.14
Nodes (15): kind=pivot = Liquidity-Sweep-Only Semantics, Dealing-Range-Anlegen Skill, milk-city Task: Confluence-Tracking bei Dealing Ranges, trading/liquidität.md (Liquiditäts-Sweep-Mechanismus), AI Capabilities Framework (Next Token Prediction/Knowledge/Working Memory/Steerability), Diagnose-to-Fix Routing Table, Lana-Fehlerdiagnose Skill, docs/steerabilty-vs-wrong-ai-outputs.md (+7 more)

### Community 21 - "backfillObZones.ts"
Cohesion: 0.29
Nodes (9): backfillOne(), BAR_CONFIG, BARS, CandleRow, correctStaleZones(), fetchAllCandles(), fetchCorrectionCandidates(), INSTRUMENTS (+1 more)

### Community 22 - "NewsMarkerPaneView"
Cohesion: 0.15
Nodes (4): extrapolatedX(), NewsMarkerPaneView, NewsMarkerPrimitive, NewsMarkerRenderer

### Community 23 - "forceAssessment.ts"
Cohesion: 0.15
Nodes (20): AgeTier, businessSecondsBetween(), classifyAge(), classifyInducementAge(), inducementAgeRange(), MAJOR_MIN_HOURS, MINOR_MAX_HOURS, assessForce() (+12 more)

### Community 24 - "ctrader/client.ts"
Cohesion: 0.12
Nodes (25): CORS_HEADERS, fetchForexBatch(), authAccount(), authenticate(), cachedSymbolIds, Candle, concat(), connectWithTimeout() (+17 more)

### Community 25 - "marketStructureAnalysis Rules Overview"
Cohesion: 0.22
Nodes (15): Arbitrary Nesting Depth (2026-08-09), Rendering Rules (renderMarketStructureAnalysis), marketStructureAnalysis Rules Overview, Docht-vs-Bruch (Wick vs Close-Break) Unification, Standalone Downtrend Detection/Invalidation, Fibonacci Level (computeFibLevels/collectFibLevels), Inner-Pivots (Period 2) Fast Pre-Detection, LQ-Sweep Classification (markLqSweeps) (+7 more)

### Community 26 - "tradeIntake.js"
Cohesion: 0.13
Nodes (28): direction, emit, entryPrice, errorMsg, levels, props, reasoning, saving (+20 more)

### Community 27 - "refreshTscRange"
Cohesion: 0.15
Nodes (15): onRemoveConfirmation(), removeConfirmationFromTrade(), fetchActiveTscRangeId(), fetchDealingRangeCockpit(), toLiquidityLevel(), fetchTrades(), toConfirmation(), { data: trades, refresh: refreshTrades } (+7 more)

### Community 28 - "Plan: Forex-Chart-Objekte Datengrundlage"
Cohesion: 0.24
Nodes (10): ob_zones Table, BTC Scope Removal from Chart-Objects Plan, 1H/4H DB-Read vs Live-Recompute Decision, Four Independent OB Render Passes Problem, "Historische OBs"-Toggle Semantics, LQ-Sweep Relevance Criterion (Recent OR Pip-Range), Plan: Forex-Chart-Objekte Datengrundlage, Persistierungs-Umfang: Nur Referenzierte Teilmenge (+2 more)

### Community 29 - "orderBlocks.js"
Cohesion: 0.15
Nodes (24): emit, onAntiConfluencePickerHover(), onAntiConfluencePickerSelect(), onTargetPickerHover(), onTargetPickerSelect(), refreshLiquidityInternal(), refreshPoiZonesInternal(), detectOrderBlocks() (+16 more)

### Community 30 - "chartLineWidths.js"
Cohesion: 0.17
Nodes (8): chartColors, resetChartColors(), chartLineWidths, resetChartLineWidths(), collapsed, emit, GROUPS, resetAll()

### Community 31 - "sessions.js"
Cohesion: 0.13
Nodes (17): emit, instrumentSessions, props, WEEKDAY_DISPLAY_ORDER, ALL_DAYS, addSession(), currentSessionDanger(), DANGER_LEVELS (+9 more)

### Community 32 - "gbp_h1_uptrend_protected_low_gebrochen.ts"
Cohesion: 0.08
Nodes (25): ClosedRange, MarketStructureState, PivotBase, PivotHigh, PivotLow, PivotTouched, PivotTypeAll, PivotUntouched (+17 more)

### Community 33 - "tradingAccounts.js"
Cohesion: 0.11
Nodes (20): currentLabel, open, selectedAccount, wrapperRef, cache, useLocalStorageRef(), accounts, accountsLoaded (+12 more)

### Community 34 - "dealingRangeLoop.ts"
Cohesion: 0.06
Nodes (66): berlinDateStrFor(), berlinDateTimeStrFor(), assessInducement(), checkFallFour(), CheckFallFourInput, computeHtfWatchLevels(), computeWatchLevels(), FallFourResult (+58 more)

### Community 35 - "dataExport.js"
Cohesion: 0.16
Nodes (23): marketStructureTree, berlinOffsetMinutes(), buildDataExport(), compute1hStructureState(), computeExportTimeframeData(), computeLiquidityLevelsForExport(), computeObZonesForExport(), computeTrendChainAges() (+15 more)

### Community 36 - "tdd_mit_claude.ts"
Cohesion: 0.08
Nodes (24): nextPivot1, nextPivot10, nextPivot11, nextPivot2, nextPivot3, nextPivot4, nextPivot5, nextPivot6 (+16 more)

### Community 37 - "orderBlocks.ts"
Cohesion: 0.25
Nodes (7): detectOrderBlocks(), HTF_FOREX_LABELS, HTF_FOREX_MIN_GAP_PIPS, LOWER_TF_LABELS, LOWER_TF_MIN_GAP_PIPS, Zone, detectSetupObs()

### Community 38 - "priceChartHitTest.test.js"
Cohesion: 0.12
Nodes (20): findClickedDivergence(), findClickedLiquidityLevel(), findClickedOBZone(), findClickedSetup(), findClickedTarget(), openAntiConfluencePicker(), getCurrentLiquidityLevels(), DIVERGENCE_CLICK_TOLERANCE_PX (+12 more)

### Community 39 - "TradeSetupCockpit.vue"
Cohesion: 0.10
Nodes (20): accentStyle, antiConfluences, canTransfer, confirmations, confluences, dateLabel, direction, emit (+12 more)

### Community 40 - "applyMarketStructurePivot"
Cohesion: 0.08
Nodes (32): advanceNestedTrendInner(), applyInnerMarketStructurePivot(), applyMarketStructurePivot(), initMarketStructureState(), chochConfirmedState(), confirmBreak, confirmedUptrendState(), originHigh (+24 more)

### Community 41 - "FibTickPrimitive"
Cohesion: 0.15
Nodes (3): FibTickPaneView, FibTickPrimitive, FibTickRenderer

### Community 42 - "OrderBlockPrimitive"
Cohesion: 0.13
Nodes (4): OrderBlockPrimitive, ZonePaneView, ZoneRenderer, obPrimitiveAt()

### Community 43 - "useClaudeAnnotations.js"
Cohesion: 0.10
Nodes (27): addClaudeAnnotationDrawing(), fetchClaudeAnnotations(), removeClaudeAnnotationDrawing(), setClaudeAnnotationDrawingVisible(), applyText(), emit, error, { instrument, dateStr, drawings, loading, add, remove, setDrawingVisible } (+19 more)

### Community 44 - "trading-monitor-mcp/marketStructureAnalysis.ts"
Cohesion: 0.11
Nodes (37): buildLevel(), detectLiquidityLevels(), isDownFractal(), isUpFractal(), LIQUIDITY_FRACTAL_PERIOD, LIQUIDITY_MAX_RELEVANT, LiquidityLevel, advanceNestedTrend() (+29 more)

### Community 45 - "priceChartConstants.js"
Cohesion: 0.06
Nodes (35): usePriceChartTradeSetupDrawing(), usePriceChartTradeSetups(), fetchM5Candles(), fetchTrendAnalysisM5History(), getTrendAnalysisM5Candles(), CALLOUT_STACK_GAP_PX, CLOSE_POLL_BUFFER_MS, COPIED_FEEDBACK_MS (+27 more)

### Community 46 - "pinContext.js"
Cohesion: 0.16
Nodes (21): addPinEntry(), addPinM5LiquidityEntry(), addPinM5ObEntry(), addPinRsiDivergenceEntry(), addPinTscSetupEntry(), fetchPinContext(), REF_COLUMN, removePinEntry() (+13 more)

### Community 47 - "Laniakea Persona Command (/l)"
Cohesion: 0.13
Nodes (18): 00-trading-steps.md Entry Point, Laniakea Persona Command (/l), trading/claude-project-instructions.md, trading-runs Relative Link Path Convention, 00-trading-steps.md#visuelle-antworten-chart-annotationen, 06-anti-confluence.md, glossar.md Consistency Check, kontext-ausführung.md (+10 more)

### Community 48 - "Plan: Sehr Große Dateien Refactoren (PriceChart.vue)"
Cohesion: 0.18
Nodes (11): Keep Codebase Clean / ~1000 Line Backstop Convention, liquidity_levels Table, Pip-Distance Server-Side Query Filter, Plan: Sehr Große Dateien Refactoren (PriceChart.vue), Phase 1: Candle-/Zeit-Helfer -> priceChartCandles.js, Phase 3: Liquidity-Merge -> priceChartLiquidity.js, Phase 4: RSI-Divergenz-Pin-Merge, Phase 5: Klick-Hittest-Funktionen (priceChartHitTest.js) (+3 more)

### Community 49 - "fachdoku-router/SKILL.md"
Cohesion: 0.18
Nodes (10): Fachdoku-Router, News Events Seed Workflow (ForexFactory Screenshot), News Events Seeding Notes, news_events Consumption (No-Go + Chart Markers), Settings-Sync Notes, localStorage-first / Supabase-Source-of-Truth Pattern, trading_loop_state Table Design, TSC No-Gos and Anti-Confluences Notes (+2 more)

### Community 50 - "marketStructureAnalysisNestedNestedChoch.test.js"
Cohesion: 0.17
Nodes (11): confirmBreak, originHigh, originLow, pivotB, pivotC, pivotD, pivotE, pivotF (+3 more)

### Community 51 - "forexCandles.ts"
Cohesion: 0.15
Nodes (16): getForexCandlesArchiveUpTo(), Candle, fetchLiveForexCandles(), fetchLiveForexCandlesOnce(), isRetryable(), ALL_BARS, backfillOne(), Bar (+8 more)

### Community 52 - "liquidity.js"
Cohesion: 0.14
Nodes (24): usePriceChartLiquidity(), refresh(), levelOptions(), LIQUIDITY_STYLE_KEYS, liquidityLevelNaturalKey(), liquidityStyleTimeframe(), renderLiquidityLevels(), buildLevel() (+16 more)

### Community 53 - "gbp_h1_uptrend.ts"
Cohesion: 0.10
Nodes (20): pivot1, pivot10, pivot11, pivot12, pivot13, pivot2, pivot3, pivot4 (+12 more)

### Community 54 - "tradeSetupCockpit.ts"
Cohesion: 0.13
Nodes (16): trendChainDisplay, RangeTrend, ANTI_CONFLUENCE_COLOR, AntiConfluence, cardAccentColors(), CockpitState, formatTrendAge(), LOCKED_ACCENT (+8 more)

### Community 55 - "DR-Reichweite — Grundmessung + Filter-Auswertungen"
Cohesion: 0.09
Nodes (22): 1. Handelszeit — größter Effekt, größte Stichprobe, 2. Gegenkraft — Paarvergleich nach Sweep-Stärke, 3. HTF-Sweep, 4. Sweep-Alter — höchster Median, kleinste Stichprobe, Basis, Das Angebot stimmt, Datenquellen (vor dem Lauf ziehen), Definitionen (+14 more)

### Community 56 - "src/marketStructureAnalysis.ts"
Cohesion: 0.27
Nodes (17): advanceNestedTrend(), applyInnerMarketStructurePivotCore(), applyMarketStructurePivotCore(), buildMarketStructureState(), closesAboveOldHigh(), closesBelowLevel(), computeRangesPivots(), evaluateConfirmingBreak() (+9 more)

### Community 57 - "machineState.ts"
Cohesion: 0.17
Nodes (24): deriveStepAndCase(), LoadedMachine, loadMachineForDayOrNull(), loadOrCreateMachineForDay(), persistTransition(), rehydrateActor(), safeTransitionChain(), transitionIfPossible() (+16 more)

### Community 58 - "pinEntryVisible"
Cohesion: 0.14
Nodes (18): liquidityLevelEntryNaturalKey(), m5LiquidityEntryNaturalKey(), obZoneEntryNaturalKey(), hoveredPinLiquidityLevelKey, hoveredPinObZoneKey, onSelectPin(), pinEntryVisible(), pinJumpHint (+10 more)

### Community 59 - "tradeEvidence.ts"
Cohesion: 0.16
Nodes (16): AgeTier, classifyAge(), MAJOR_MIN_SECONDS, MINOR_MAX_SECONDS, confirmationLabel(), confirmationLabel(), evidenceAgeSeconds(), evidenceAgeTier() (+8 more)

### Community 60 - "format.js"
Cohesion: 0.17
Nodes (11): emit, lessonBadges(), OUTCOME_LABEL, props, rangeLabel(), rowStyle(), showCommission, fmtDate() (+3 more)

### Community 61 - "tradeSetup.js"
Cohesion: 0.14
Nodes (16): Two Runtimes, One Algorithm Set (Deliberate Duplication), computeTradeSetups(), closesBeyondLevel(), detectSetupObs(), detectTradeSetups(), findAllProtectedFractals(), findBestLsMatch(), findFirstSetupObAfter() (+8 more)

### Community 62 - "Pivot"
Cohesion: 0.12
Nodes (10): refreshRangesMarkers(), FibLevel, Candle, PivotMarkerGroup, PivotMarkerPaneView, PivotMarkerPrimitive, PivotMarkerRenderer, RenderOptions (+2 more)

### Community 63 - "poi-watcher/index.ts"
Cohesion: 0.13
Nodes (13): fmt(), InstrumentConfig, INSTRUMENTS, isInWindows(), LiquidityLevelRow, localMinutesAndWeekday(), ObZoneRow, PinAlarmRow (+5 more)

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

### Community 68 - "pricePrecisionForInstrument"
Cohesion: 0.14
Nodes (13): candidatePrice(), emit, mergedCandidates, precision, props, emit, OUTCOME_LABEL, precision (+5 more)

### Community 69 - "AGENTS.md"
Cohesion: 0.14
Nodes (12): Architecture, Commands, Conventions, Forex candle data: cTrader Open API, not Twelve Data, Frontend data flow (`PriceChart.vue`), Gotchas, graphify, "Laniakea" persona (`/l`) (+4 more)

### Community 70 - "Trading-Monitor Project Overview (CLAUDE.md)"
Cohesion: 0.15
Nodes (12): cTrader ACCESS_DENIED Lockout (No Auto-Recovery), DRY Within a Single Runtime Convention, CLAUDE.md Pointer to /l Persona, npm run build Command, Trading-Monitor Project Overview (CLAUDE.md), Rename Consistency Convention, REPLAY_LOOKAHEAD_SEC M1 Scaling Gotcha, ctrader_oauth_tokens Table (+4 more)

### Community 71 - "canShowLabels"
Cohesion: 0.18
Nodes (7): drawIconLabel(), canShowLabels(), MIN_PIXELS_PER_HOUR_FOR_LABELS, MIN_PIXELS_PER_HOUR_FOR_LABELS_INTRADAY, positionsBox(), DivergenceLineRenderer, mergePinnedDivergences()

### Community 72 - "daily-structure-pivots/index.ts"
Cohesion: 0.12
Nodes (16): CORS_HEADERS, ExistingPivotRow, INSTRUMENTS, CORS_HEADERS, PERIOD_MAP, PERSISTABLE_BARS, persistIfArchivable(), RefreshedTokens (+8 more)

### Community 73 - "usePriceChartRsi.js"
Cohesion: 0.20
Nodes (11): nativeLineWidth(), usePriceChartRsi(), applyColorOptions(), applyLineWidthOptions(), create(), refreshEma(), refreshRsi(), computeEma() (+3 more)

### Community 74 - "clearArmStatesExcept"
Cohesion: 0.15
Nodes (14): clearArmStatesExcept(), onAddAntiConfluenceRequest(), onAddConfirmationRequest(), onAddConfluenceRequest(), onAddRangeAntiConfluenceRequest(), onAddRangeConfirmationRequest(), onAddRangeConfluenceRequest(), onAddTargetRequest() (+6 more)

### Community 75 - "forexCandles.js"
Cohesion: 0.27
Nodes (13): DB_ARCHIVED_BARS, fetchArchivedPage(), fetchArchivedUpTo(), fetchCandles(), fetchCandlesBatchOnce(), fetchCandlesOnce(), fetchOlderCandles(), fetchOlderCandlesFromDb() (+5 more)

### Community 76 - "SessionBandPaneView"
Cohesion: 0.14
Nodes (3): SessionBandPaneView, SessionBandPrimitive, SessionBandRenderer

### Community 77 - "TradingFlow.vue"
Cohesion: 0.09
Nodes (28): dateStr, berlinDateStrFor(), fetchLoopStateHistory(), fetchLoopStatesForDate(), LOOP_INSTRUMENTS, rowToLoopState(), buildMermaidSource(), EDGES (+20 more)

### Community 78 - "ArrowPrimitive"
Cohesion: 0.18
Nodes (4): Candle, ArrowPaneView, ArrowPrimitive, ArrowRenderer

### Community 79 - "Fachdoku-Router Skill"
Cohesion: 0.15
Nodes (13): poi-watcher UTC Refresh-Tick Exception, Trading-Hours/Timezone Handling (Europe/Berlin), sessions Table, trading_schedules Table, docs/debug-metadata-panel.md, Fachdoku-Router Skill, src/marketStructureAnalysis.notes.md, docs/mcp-server.md (+5 more)

### Community 80 - "fmtPrice"
Cohesion: 0.11
Nodes (32): cssColorScaled(), hexToRgba(), tradesVisibleForCandles(), buildActiveMetadataSnapshotInternal(), clearTradeSetupFocus(), clipReplay(), computeTradeSetupsInternal(), focusTradeSetup() (+24 more)

### Community 81 - "Dealing-Range-Loop Diagram"
Cohesion: 0.17
Nodes (12): Dealing-Range-Loop Diagram, News-Blackout Mid-Loop Pause, Pin-Aufräumen after TSC-Link, Target Selection Remains Lana's Judgment, Pin Tools (tools/pins.ts), poi-watcher Alert-Cron Notes, poi-watcher 3-Tier Fetch Throttling, UTC-Hours Exception for Refresh Ticks (+4 more)

### Community 82 - "PLAN: DR-Statistik in der UI anzeigen"
Cohesion: 0.15
Nodes (12): 1. Terzile oder feste Risiko-Bänder?, 2. Das n-Problem — blockiert die Pip-Leiter vorerst, 3. Weitere Schnitte, Definitionen (nicht neu herleiten), Die Zahlen (Stand 19.09.2026, GBPUSD, n=255), Grenzen, die in die Anzeige gehören, Offene Design-Entscheidungen, PLAN: DR-Statistik in der UI anzeigen (+4 more)

### Community 83 - "App.vue"
Cohesion: 0.11
Nodes (20): { activeLabels, isActive }, isFresh, { lastSuccessAt }, lastUpdateText, now, showClaudeAnnotationsModal, showDataExport, statusDotClass (+12 more)

### Community 84 - "AI Capabilities and Limitations Notes"
Cohesion: 0.17
Nodes (12): Delegation (4D Framework), Description (4D Framework), Diligence (4D Framework), Discernment (4D Framework), AI Fluency: 4D Framework Notes, calc_rr Tool Idea (Deterministic RR Calc), AI Capabilities and Limitations Notes, Letter-over-Spirit Failure Mode (+4 more)

### Community 85 - "Vegapunk Slimming Results (-86%)"
Cohesion: 0.17
Nodes (13): get_data_export Tool, Tool 2: run_bias_check, Lana Test Data README, Chronological MCP Tool Call Sequence, Output-too-large Problem, Vegapunk Slimming Results (-86%), marketStructureAnalysis Developer Notes, File Separation: Algorithm vs Rendering (+5 more)

### Community 86 - "cTrader Open API as Forex Candle Source"
Cohesion: 0.40
Nodes (5): cTrader Open API as Forex Candle Source, cTrader Wire Protocol Implementation (Manual Protobuf), supabase/functions/_shared/ctrader/client.ts, supabase/functions/_shared/twelvedata/client.ts (Unwired), supabase/functions/forex-candles

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

### Community 91 - "dataSnapshot.ts"
Cohesion: 0.14
Nodes (26): buildLevel(), detectLiquidityLevels(), isDownFractal(), isUpFractal(), LiquidityLevel, isBoxInvalidated(), closesBeyondLevel(), DEFAULT_TRADE_SETUP_PARAMS (+18 more)

### Community 92 - "businessSecondsBetween"
Cohesion: 0.24
Nodes (10): ageReferenceTime(), businessSecondsBetween(), candidateLabel(), candidateLabel(), emit, precision, props, ageSuffix() (+2 more)

### Community 93 - "chartTimeUtils.js"
Cohesion: 0.23
Nodes (11): computeNextReplayTime(), formatAge(), isTimeCovered(), mergeRecent(), nextCandleAfter(), replayFetchToMs(), snapToBarTime(), computeJumpViewport() (+3 more)

### Community 94 - "MCP-Server: Tiefere Referenz"
Cohesion: 0.20
Nodes (10): MCP Auth & Table Permissions, Backfill Scripts, Candle Archive (forex_candles), MCP Server Deployment (Supabase Edge Function), MCP-Server: Tiefere Referenz, get_forex_rsi / get_forex_ema Tools, Single Deno Copy (Dual-Copy Removed), Trade-Journal Write Tools (tools/trades.ts) (+2 more)

### Community 96 - "findAntiConfluences.js"
Cohesion: 0.42
Nodes (10): byDistance(), findAntiConfluenceCandidates(), findAntiConfluenceDivergenceCandidates(), findAntiConfluenceObCandidates(), findAntiConfluenceSweepCandidates(), findInvalidationObCandidates(), inBand(), MAX_HELD_OB_AGE_DAYS (+2 more)

### Community 97 - "drMerkmale.py"
Cohesion: 0.07
Nodes (37): lauf(), -> 'win' | 'loss' | 'offen', beides gemessen ab der nahen OB-Kante., handelsstunden(), lade_bekannte_level(), lade_kerzen(), lade_setups(), lade_trend(), merkmale() (+29 more)

### Community 98 - "NewsModal.vue"
Cohesion: 0.16
Nodes (15): CURRENCIES, emit, LIST_FORMATTER, newCurrency, newDateTime, newTitle, saving, submit() (+7 more)

### Community 99 - "trade_evidence Table (Dual-Level, Confirmation/Confluence)"
Cohesion: 0.16
Nodes (14): dealing_ranges Table, trade_evidence Table (Dual-Level, Confirmation/Confluence), trade_partial_exits Table, trade_positions Table, trade_targets Table, Confirmation/Confluence/Anti-Confluence Categories, trading repo trade-from-poi.md (Confirmation/Confluence/Anti-Confluence Definition), OB-Zones Canonical FK Consolidation Approach (+6 more)

### Community 100 - "MetadataPanel.vue"
Cohesion: 0.24
Nodes (10): emit, height, left, onDrag(), panelEl, props, startDrag(), stopDrag() (+2 more)

### Community 101 - "biasCheck.ts"
Cohesion: 0.09
Nodes (40): DATE_FORMATTER, OFFSET_FORMATTER, TIME_FORMATTER, deleteDealingRange(), fetchActiveTscRangeId(), fetchDealingRangeCockpit(), getOpenOppositeDealingRanges(), toLiquidityLevel() (+32 more)

### Community 102 - "/task do Mode"
Cohesion: 0.38
Nodes (7): Laniakea milk-city Task-Status Rule, /task Default Data-Maintenance Mode, /task do Mode, /task new Mode, /task refine Mode, /task Command Router, milk-city Task Status Convention

### Community 103 - "tradeTargets.ts"
Cohesion: 0.24
Nodes (9): targetLabel(), targetLabel(), formatTargetLabel(), KIND_LABEL, kindLabel(), targetAgeSeconds(), targetAgeTier(), TradeTarget (+1 more)

### Community 104 - "newsMarkers.js"
Cohesion: 0.22
Nodes (11): usePriceChartSessionsAndNews(), refreshNewsMarkers(), refreshSessions(), newsEvents, DAY_KEY_FORMATTER, formatEventLabel(), isSameBerlinDay(), renderNewsMarkers() (+3 more)

### Community 106 - "Lana-Fehlerdiagnose"
Cohesion: 0.33
Nodes (5): Ablauf, Ergebnis, Lana-Fehlerdiagnose, Routing: Diagnose → typischer Fix-Ort, Wann aufrufen

### Community 107 - "Agent Skills Pro Notes"
Cohesion: 0.29
Nodes (7): allowed-tools Skill Config, Context-free Scripts in Skills, Agent Skills Pro Notes, Progressive Disclosure in Skills, Skill Sharing & Troubleshooting, Skills Embedded in Subagents, Skills vs CLAUDE.md vs Hooks vs Subagents

### Community 108 - "chartColors.test.js"
Cohesion: 0.17
Nodes (10): DEFAULT_CHART_COLORS, DEFAULT_CHART_LINE_WIDTHS, allSourceFiles, EXCLUDED_FROM_USAGE_SCAN, fieldsBlocks, SOURCE_EXTENSIONS, SRC_DIR, styleModalFieldKeys (+2 more)

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
Cohesion: 0.11
Nodes (27): cachedCandlesUpTo(), cacheKey(), fetchCandlesCached(), getCachedCandles(), mergeCandles(), openDb(), safeCompleteUpTo(), setCachedCandles() (+19 more)

### Community 117 - "vite.config.js"
Cohesion: 0.40
Nodes (3): DEBUG_DIR, DEBUG_FILE, __dirname

### Community 118 - "lana-git-pull.cjs"
Cohesion: 0.50
Nodes (3): { execFileSync }, path, TRADING_REPO

### Community 122 - "marketStructureAnalysis.test.js"
Cohesion: 0.22
Nodes (8): pivot1, pivot2, pivot3, pivot4, pivot5, pivot6, pivot7, pivot8

### Community 124 - "debugMetadata.js"
Cohesion: 0.39
Nodes (7): buildActiveMetadataSnapshot(), earliestRelevantTime(), hasActiveMetadata(), selectActiveMetadataSections(), ALL_OFF, BASE_CTX, SECTIONS

### Community 125 - "Handbuch-Check"
Cohesion: 0.40
Nodes (4): Ergebnis, Handbuch-Check, Prüfpunkte, Wann aufrufen

### Community 131 - "dataExport.ts"
Cohesion: 0.07
Nodes (63): filterRelevantLevels(), berlinOffsetMinutes(), dropLowerTfDuplicates(), fetchAllRows(), filterRelevantRows(), getLatestDailyStructureStartTime(), getLiquidityLevels(), getObZones() (+55 more)

### Community 132 - "src/pipConfig.js"
Cohesion: 0.09
Nodes (26): HTF_FOREX_MIN_GAP_PIPS Constant, LOWER_TF_MIN_GAP_PIPS Constant, Pip-/Pixel-Schwellwerte Übersicht, MAX_TARGET_DISTANCE_PIPS Constant, MIN_PIXELS_PER_HOUR_FOR_LABELS Constants, PIP_SIZE Constant, RANGE_FIB_MIN_PP_DISTANCE_PIPS Constant, TRADE_SETUP_LS_MAX_DISTANCE_M5 Constant (+18 more)

### Community 133 - "marketStructureAnalysisInnerPivots.test.js"
Cohesion: 0.25
Nodes (7): h1Candles, p2Pivot3, p2Pivot4, p2Pivot5, pivot1, pivot2, pivot3

### Community 134 - "usePriceChartMarketStructure"
Cohesion: 0.25
Nodes (6): findClickedFibLevel(), usePriceChartMarketStructure(), computeRangesPivotsAndMetadata(), computeRangesPivotsFor(), getCurrentFibLevels(), BASE_CTX

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

### Community 141 - "trades.js"
Cohesion: 0.28
Nodes (7): pnlClass, props, stats, winrateClass, fmtR(), computeTradeStats(), groupBy()

### Community 143 - "JsonTree.vue"
Cohesion: 0.25
Nodes (5): entries, expanded, isArray, isObject, props

### Community 144 - "PinPanel.vue"
Cohesion: 0.32
Nodes (7): emit, noteSaveTimers, onEntryClick(), onNoteInput(), OUTCOME_LABEL, props, rows

### Community 146 - "usePolledFetch.js"
Cohesion: 0.60
Nodes (3): usePolledFetch(), lastSuccessAt, useStatusBar()

### Community 147 - "computeTrendChain"
Cohesion: 0.29
Nodes (6): trendChain, trendAlignment, ANTI_CONFLUENCE_THRESHOLD, computeTrendAlignment(), computeTrendChain(), trendOriginPivotTime()

### Community 148 - "usePriceChartClaudeAnnotations"
Cohesion: 0.40
Nodes (3): renderClaudeAnnotations(), usePriceChartClaudeAnnotations(), refresh()

### Community 149 - "usePriceChartCockpit.js"
Cohesion: 0.47
Nodes (5): usePriceChartCockpit(), refreshCockpit(), pivotForDisplay(), computeAntiConfluences(), computeCockpitState()

## Ambiguous Edges - Review These
- `Trading-Steps-Ablauf Diagram` → `calc_rr Tool Idea (Deterministic RR Calc)`  [AMBIGUOUS]
  docs/steerabilty-vs-wrong-ai-outputs.md · relation: references

## Knowledge Gaps
- **1121 isolated node(s):** `Was angezeigt werden soll`, `Die Zahlen (Stand 19.09.2026, GBPUSD, n=255)`, `1. Terzile oder feste Risiko-Bänder?`, `2. Das n-Problem — blockiert die Pip-Leiter vorerst`, `3. Weitere Schnitte` (+1116 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1361 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **14 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Trading-Steps-Ablauf Diagram` and `calc_rr Tool Idea (Deterministic RR Calc)`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **Why does `businessSecondsBetween()` connect `forceAssessment.ts` to `tradeEvidence.ts`, `dealingRangeLoop.ts`, `dataExport.ts`?**
  _High betweenness centrality (0.070) - this node is a cross-community bridge._
- **Why does `businessSecondsBetween()` connect `businessSecondsBetween` to `PriceChart.vue`, `tradeTargets.ts`, `fmtPrice`, `computeTrendChain`, `liquidity.js`, `tradeSetupCockpit.ts`, `tradeEvidence.ts`, `chartTimeUtils.js`?**
  _High betweenness centrality (0.061) - this node is a cross-community bridge._
- **Why does `Trading-Monitor Project Overview (CLAUDE.md)` connect `Trading-Monitor Project Overview (CLAUDE.md)` to `/task do Mode`, `Plan: POI-Strategie-Findung, Backtesting & Trade-Notifications`, `Fachdoku-Router Skill`, `Plan: Sehr Große Dateien Refactoren (PriceChart.vue)`, `cTrader Open API as Forex Candle Source`, `Plan: Forex-Chart-Objekte Datengrundlage`, `tradeSetup.js`?**
  _High betweenness centrality (0.054) - this node is a cross-community bridge._
- **What connects `Was angezeigt werden soll`, `Die Zahlen (Stand 19.09.2026, GBPUSD, n=255)`, `1. Terzile oder feste Risiko-Bänder?` to the rest of the system?**
  _1121 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Dashboard.vue` be split into smaller, more focused modules?**
  _Cohesion score 0.016013071895424835 - nodes in this community are weakly interconnected._
- **Should `gbp_h1_uptrend_uptrend_break_of_structure_und_trendumkehr.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0196078431372549 - nodes in this community are weakly interconnected._