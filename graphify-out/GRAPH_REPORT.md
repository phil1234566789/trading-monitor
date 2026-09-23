# Graph Report - trading-monitor  (2026-09-23)

## Corpus Check
- 543 files · ~557,149 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 3225 nodes · 6537 edges · 163 communities (142 shown, 13 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 114 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `4b6d615f`
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
- berlinDateStrFor
- usePriceChartRsi.js
- tradeSetup.js
- rsiDivergenceStats.ts
- tradeSetupCockpit.ts
- biasCheck.ts
- DR-Reichweite — was taugen die erkannten Setups?
- dealingRangeLoop.ts
- TradeEditModal.vue
- package.json
- usePriceChartMarketStructure.js
- LoopStatus.vue
- db.ts
- Dealing-Range-Anlegen Skill
- orderBlocks.ts
- newsMarkers.js
- TradeMarkerPrimitive
- ctrader/client.ts
- dailyPivotMarkers.js
- tradeIntake.js
- trades.js
- canShowLabels
- Plan: Forex-Chart-Objekte Datengrundlage
- forexCandles.ts
- sessions.js
- gbp_h1_uptrend_protected_low_gebrochen.ts
- tradingAccounts.js
- tradeSetups.js
- pivotMarkers.ts
- tdd_mit_claude.ts
- FibTickPrimitive
- priceChartHitTest.test.js
- TradeSetupCockpit.vue
- MetadataPanel.vue
- orderBlocks.js
- supabaseClient.js
- useClaudeAnnotations.js
- trading-monitor-mcp/marketStructureAnalysis.ts
- usePriceChartTradeSetups
- marketStructureAnalysis Rules Overview
- Laniakea Persona Command (/l)
- Plan: Sehr Große Dateien Refactoren (PriceChart.vue)
- fachdoku-router/SKILL.md
- pinContext.js
- pricePrecisionForInstrument
- findAntiConfluenceCandidates.js
- gbp_h1_uptrend.ts
- barSecondsFor
- PLAN: DR-Statistik in der UI anzeigen
- src/marketStructureAnalysis.ts
- chartColors.js
- pinEntryVisible
- clearArmStatesExcept
- trading-monitor-mcp/pretradeGates.ts
- usePriceChartLiquidity.js
- liquidityDetection.ts
- poi-watcher/index.ts
- State Machine for Lana's Trading Flow
- compilerOptions
- liquidity.js
- claudeAnnotations.js
- trade_evidence Table (Dual-Level, Confirmation/Confluence)
- AGENTS.md
- Trading-Monitor Project Overview (CLAUDE.md)
- TargetPickerModal.vue
- tradeSetup.ts
- closed_rows
- Journal GBPUSD — Sicherung vor dem Quellenwechsel
- findAntiConfluences.js
- SessionBandPaneView
- TradingFlow.vue
- applyMarketStructurePivot
- alarmLog.js
- drQuoten.js
- Dealing-Range-Loop Diagram
- FXCM-Kerzenfeed
- App.vue
- AI Capabilities and Limitations Notes
- Vegapunk Slimming Results (-86%)
- backfillObZones.ts
- reads.ts
- PinAddPopup.vue
- twelvedata/client.ts
- Anleitung: State-Machine lesen & bedienen
- usePriceChartMarketStructure
- marketStructureAnalysisNestedNestedChoch.test.js
- dataExport.ts
- MCP-Server: Tiefere Referenz
- refresh
- trades.ts
- drMerkmale.py
- newsEvents.js
- format.js
- messeFxcmKontext.ts
- useM5CandleClock
- /task do Mode
- hole_alle
- chartColors.test.js
- marketStructureRendering.ts
- Lana-Fehlerdiagnose
- Agent Skills Pro Notes
- usePriceChartTradeSetupDrawing.js
- fetch-trend-fixture.mjs
- ContextMenu.vue
- ctraderCandles.js
- Aufmerksamkeits-Level (Watch-Level-Strategie Schritt 5+)
- Debug-Metadata-Panel Notes
- AI Failure as Property Collision
- MCP Advanced Topics Notes
- loadRangesCandles
- vite.config.js
- lana-git-pull.cjs
- forexCandles.js
- .mcp.json
- usePolledFetch.js
- marketStructureAnalysis.test.js
- trading-monitor index.html Entry
- lineWidth
- Handbuch-Check
- trendIndicator.gbpusd-downtrend.test.js
- Claude Code Hooks Documentation Pointers
- mcp-server/src/scripts/backfillObZones.ts
- RangeLinePaneView
- JsonTree.vue
- applyInnerMarketStructurePivot
- fetchAllRows.ts
- Dealing Range anlegen
- .codex/hooks/lana-git-pull.cjs
- source-command-l
- tradingSchedules.js
- tradeEvidence.ts
- cssColor
- evidenceScoring.ts
- fxcmCandles.ts
- tradeSetup.test.js
- M5CandleClock.vue
- supabaseRowCapGuard.test.js
- marketStructureAnalysisLqSweep.test.js
- Entschiedene Design-Fragen
- cTrader ACCESS_DENIED Lockout (No Auto-Recovery)
- chartMeasure.js
- validate.js
- PinPanel.vue
- LiquidityLinePrimitive
- refreshTscRange
- Die Filter
- test_saisonalitaet.py
- Woher die 1314 kommen

## God Nodes (most connected - your core abstractions)
1. `berlinDateStrFor()` - 46 edges
2. `cssColor()` - 36 edges
3. `pricePrecisionForInstrument()` - 34 edges
4. `fmtPrice()` - 33 edges
5. `berlinDateTimeStrFor()` - 33 edges
6. `fetchForexCandles()` - 31 edges
7. `json()` - 30 edges
8. `clipReplay()` - 27 edges
9. `lineWidth()` - 26 edges
10. `logDecision()` - 25 edges

## Surprising Connections (you probably didn't know these)
- `/task do Mode` --semantically_similar_to--> `milk-city Task Status Convention`  [INFERRED] [semantically similar]
  .claude/commands/task.md → CLAUDE.md
- `Laniakea milk-city Task-Status Rule` --semantically_similar_to--> `milk-city Task Status Convention`  [INFERRED] [semantically similar]
  .claude/commands/l.md → CLAUDE.md
- `Trading-Monitor Project Overview (CLAUDE.md)` --conceptually_related_to--> `BTC Scope Removal from Chart-Objects Plan`  [INFERRED]
  CLAUDE.md → PLAN-chart-objekte-forex.md
- `Bestätigungen (Sweeps & OBs) Feature` --semantically_similar_to--> `Confirmation/Confluence/Anti-Confluence Categories`  [INFERRED] [semantically similar]
  PLAN-trade-confluences.md → .claude/skills/dealing-range-anlegen/SKILL.md
- `Archive-First Auto-Reload Pattern (Tried, Then Reverted)` --semantically_similar_to--> `Persisted Forex Candle Archive (forex_candles Pilot)`  [INFERRED] [semantically similar]
  PLAN-chart-objekte-forex.md → PLAN-notifications.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **State-Machine Doc + Diagram Pair** — docs_state_machine_doc, docs_diagrams_dealing_range_loop_doc, docs_diagrams_trading_steps_ablauf_doc [EXTRACTED 1.00]
- **OB-Zone Canonical FK Consolidation Initiative** — plan_chart_objekte_forex_consolidation_approach, db_ob_zones, src_tradesetup, db_trade_evidence [INFERRED 0.80]
- **AI Fluency Diagnostic Toolkit Applied to Lana** — docs_ai_fluency_4d_doc, docs_steerabilty_doc, docs_steerabilty_working_memory_steerability_collision [INFERRED 0.85]
- **CHoCH-to-Promotion-to-Rendering Pipeline** — src_marketstructureanalysis_rules_nested_trend_choch, src_marketstructureanalysis_rules_promotion, src_marketstructureanalysis_rules_darstellung [INFERRED 0.85]
- **cTrader Forex Data Pipeline (Chart, MCP, Archive)** — supabase_functions__shared_ctrader_client, supabase_functions_forex_candles, src_forexcandles, db_forex_candles, plan_notifications_forex_candle_archive [INFERRED 0.85]
- **Root-Cause-Fix Skill Pattern (Structural Fix Over Output Patch)** — dra_skill_main, handbuch_check_main, lana_fehlerdiagnose_main [INFERRED 0.85]

## Communities (163 total, 13 thin omitted)

### Community 0 - "Dashboard.vue"
Cohesion: 0.02
Nodes (124): useSessionStorageRef(), useTabScopedRef(), addPositionToDealingRange(), antiConfluenceAddTrade, anyArmStateActive, ARM_STATES, closeTradeEditModal(), confirmationAddTrade (+116 more)

### Community 1 - "gbp_h1_uptrend_uptrend_break_of_structure_und_trendumkehr.ts"
Cohesion: 0.02
Nodes (101): candlesAroundBOS, candlesAroundBreak, p2Pivot1, p2Pivot10, p2Pivot11, p2Pivot12, p2Pivot13, p2Pivot14 (+93 more)

### Community 2 - "candleCache.js"
Cohesion: 0.12
Nodes (22): REPLAY_LOOKAHEAD_SEC M1 Scaling Gotcha, REPLAY_LOOKAHEAD_SEC M1 Scaling Bug (Origin), cachedCandlesUpTo(), cacheKey(), fetchCandlesCached(), getCachedCandles(), mergeCandles(), openDb() (+14 more)

### Community 3 - "clipReplay"
Cohesion: 0.09
Nodes (44): tradesVisibleForCandles(), buildActiveMetadataSnapshotInternal(), clearTradeSetupFocus(), clipReplay(), computeTradeSetupsInternal(), emit, jumpToDivergence(), jumpToPin() (+36 more)

### Community 4 - "PriceChart.vue"
Cohesion: 0.03
Nodes (95): activeMetadataSnapshot, allCandles, antiConfluencePickerCurrentPrice, antiConfluencePickerDivergenceCandidates, antiConfluencePickerHoveredLiquidityKey, antiConfluencePickerHoveredObKey, antiConfluencePickerInvalidationObCandidates, antiConfluencePickerObCandidates (+87 more)

### Community 5 - "gbp_h1_uptrend_mit_LQ_sweep_LONG_SETUP.ts"
Cohesion: 0.03
Nodes (60): p2Pivot1, p2Pivot10, p2Pivot11, p2Pivot12, p2Pivot13, p2Pivot14, p2Pivot15, p2Pivot16 (+52 more)

### Community 6 - "gbp_h1_uptrend_mit_inner_structure.ts"
Cohesion: 0.04
Nodes (55): p2Pivot1, p2Pivot10, p2Pivot11, p2Pivot12, p2Pivot13, p2Pivot14, p2Pivot15, p2Pivot16 (+47 more)

### Community 7 - "berlinDateStrFor"
Cohesion: 0.08
Nodes (48): berlinDateStrFor(), berlinDateTimeStrFor(), DATE_FORMATTER, OFFSET_FORMATTER, TIME_FORMATTER, toPips(), deleteDealingRange(), getOpenOppositeDealingRanges() (+40 more)

### Community 8 - "usePriceChartRsi.js"
Cohesion: 0.16
Nodes (21): refreshDivergence(), buildDivergenceEntry(), collectDivergenceHistory(), computeRsi(), DEFAULT_DIVERGENCE_FRACTAL_PERIOD, DEFAULT_DIVERGENCE_HISTORY_COUNT, DEFAULT_DIVERGENCE_LOOKBACK_BARS, DEFAULT_RSI_PERIOD (+13 more)

### Community 9 - "tradeSetup.js"
Cohesion: 0.18
Nodes (18): Two Runtimes, One Algorithm Set (Deliberate Duplication), computeTradeSetups(), closesBeyondLevel(), collectObSweeps(), detectSetupObs(), detectTradeSetups(), findAllProtectedFractals(), findBestLsMatch() (+10 more)

### Community 10 - "rsiDivergenceStats.ts"
Cohesion: 0.09
Nodes (38): buildDivergenceEntry(), collectDivergenceHistory(), computeRsi(), DEFAULT_DIVERGENCE_FRACTAL_PERIOD, DEFAULT_DIVERGENCE_HISTORY_COUNT, DEFAULT_DIVERGENCE_LOOKBACK_BARS, DEFAULT_RSI_PERIOD, detectRsiDivergence() (+30 more)

### Community 11 - "tradeSetupCockpit.ts"
Cohesion: 0.12
Nodes (21): trendChain, trendChainDisplay, RangeTrend, ANTI_CONFLUENCE_COLOR, ANTI_CONFLUENCE_THRESHOLD, AntiConfluence, CockpitState, computeAntiConfluences() (+13 more)

### Community 12 - "biasCheck.ts"
Cohesion: 0.15
Nodes (29): getNewsEvents(), getTradingSchedule(), buildCandidatePool(), findNearestLiquidityTargets(), findNearestObTargets(), findTargetCandidates(), upsertBiasFields(), LoadedMachine (+21 more)

### Community 13 - "DR-Reichweite — was taugen die erkannten Setups?"
Cohesion: 0.17
Nodes (12): Aktueller FXCM-Stand: 2025 und 2026, Definitionen, DR-Reichweite — was taugen die erkannten Setups?, Enge der DR — warum beide Einheiten nötig sind, find_targets, Grenzen, Historische Befunde vor dem FXCM-Wechsel, Leitkennzahl: Trefferquote, nicht Median (+4 more)

### Community 14 - "dealingRangeLoop.ts"
Cohesion: 0.06
Nodes (70): AgeTier, updateTradePosition(), assessInducement(), checkFallFour(), CheckFallFourInput, computeHtfWatchLevels(), computeWatchLevels(), FallFourResult (+62 more)

### Community 15 - "TradeEditModal.vue"
Cohesion: 0.05
Nodes (43): emit, commission, emit, entryPrice, entryTimeInput, exitPrice, exitTimeInput, instrumentMismatch (+35 more)

### Community 16 - "package.json"
Cohesion: 0.06
Nodes (33): lightweight-charts, mermaid, dependencies, lightweight-charts, mermaid, @supabase/supabase-js, vue, vue-router (+25 more)

### Community 17 - "usePriceChartMarketStructure.js"
Cohesion: 0.18
Nodes (14): RANGES_CANDLE_BUFFER, createSessionBonusResolver(), ALL_DAYS, attachRangeExtremes(), bonusLabelForPivot(), buildSessionContextLookup(), contextForPivot(), daysOrAll() (+6 more)

### Community 18 - "LoopStatus.vue"
Cohesion: 0.07
Nodes (24): fetchLoopStateHistory(), fetchLoopStatesForDate(), LOOP_INSTRUMENTS, rowToLoopState(), fetchStateMachineLog(), rowToDecision(), activeByInstrument, { data, refresh } (+16 more)

### Community 19 - "db.ts"
Cohesion: 0.07
Nodes (46): fetchAllRows(), addPinEntry(), addPinM5LiquidityEntry(), addPinM5ObEntry(), addPinRsiDivergenceEntry(), addTradeConfirmation(), AddTradeConfirmationArgs, addTradeTarget() (+38 more)

### Community 20 - "Dealing-Range-Anlegen Skill"
Cohesion: 0.18
Nodes (12): kind=pivot = Liquidity-Sweep-Only Semantics, Dealing-Range-Anlegen Skill, milk-city Task: Confluence-Tracking bei Dealing Ranges, trading/liquidität.md (Liquiditäts-Sweep-Mechanismus), Diagnose-to-Fix Routing Table, Lana-Fehlerdiagnose Skill, docs/steerabilty-vs-wrong-ai-outputs.md, add_trade_confirmation MCP Tool (+4 more)

### Community 21 - "orderBlocks.ts"
Cohesion: 0.12
Nodes (16): CORS_HEADERS, ExistingPivotRow, INSTRUMENTS, buildLevel(), detectLiquidityLevels(), isDownFractal(), isUpFractal(), Candle (+8 more)

### Community 22 - "newsMarkers.js"
Cohesion: 0.12
Nodes (11): refreshNewsMarkers(), DAY_KEY_FORMATTER, extrapolatedX(), formatEventLabel(), isSameBerlinDay(), NewsMarkerPaneView, NewsMarkerPrimitive, NewsMarkerRenderer (+3 more)

### Community 24 - "ctrader/client.ts"
Cohesion: 0.11
Nodes (26): CORS_HEADERS, authAccount(), authenticate(), cachedSymbolIds, Candle, concat(), connectWithTimeout(), CTraderConnection (+18 more)

### Community 25 - "dailyPivotMarkers.js"
Cohesion: 0.14
Nodes (7): usePriceChartDailyPivots(), refresh(), DailyPivotMarkerPaneView, DailyPivotMarkerPrimitive, DailyPivotMarkerRenderer, drawTriangle(), renderDailyPivotMarkers()

### Community 26 - "tradeIntake.js"
Cohesion: 0.12
Nodes (29): direction, emit, entryPrice, errorMsg, levels, precision, props, reasoning (+21 more)

### Community 27 - "trades.js"
Cohesion: 0.18
Nodes (15): pnlClass, props, stats, winrateClass, fmtR(), computeTradeStats(), fetchDealingRangeCockpit(), fetchTrades() (+7 more)

### Community 28 - "canShowLabels"
Cohesion: 0.10
Nodes (7): drawIconLabel(), canShowLabels(), LiquidityLineRenderer, positionsBox(), DivergenceLinePaneView, DivergenceLinePrimitive, DivergenceLineRenderer

### Community 29 - "Plan: Forex-Chart-Objekte Datengrundlage"
Cohesion: 0.12
Nodes (19): daily_structure_pivots Table, forex_candles Table, ob_zones Table, AI Capabilities Framework (Next Token Prediction/Knowledge/Working Memory/Steerability), get_data_export MCP Tool, get_forex_candles_archive MCP Tool, Archive-First Auto-Reload Pattern (Tried, Then Reverted), BTC Scope Removal from Chart-Objects Plan (+11 more)

### Community 30 - "forexCandles.ts"
Cohesion: 0.15
Nodes (17): berlinDayRangeUtcMs(), Candle, fetchLiveForexCandles(), fetchLiveForexCandlesOnce(), isRetryable(), ALL_BARS, backfillOne(), Bar (+9 more)

### Community 31 - "sessions.js"
Cohesion: 0.11
Nodes (18): emit, instrumentSessions, props, WEEKDAY_DISPLAY_ORDER, addSession(), currentSessionDanger(), DANGER_LEVELS, DANGER_SEVERITY (+10 more)

### Community 32 - "gbp_h1_uptrend_protected_low_gebrochen.ts"
Cohesion: 0.08
Nodes (25): ClosedRange, MarketStructureState, PivotBase, PivotHigh, PivotLow, PivotTouched, PivotTypeAll, PivotUntouched (+17 more)

### Community 33 - "tradingAccounts.js"
Cohesion: 0.13
Nodes (18): currentLabel, open, selectedAccount, wrapperRef, accounts, accountsLoaded, ALL_ACCOUNTS_ID, createAccount() (+10 more)

### Community 34 - "tradeSetups.js"
Cohesion: 0.26
Nodes (10): fetchTradeSetupForCockpit(), fetchTradeSetups(), sweepLevel(), toSec(), tradeSetupFromRow(), { data: dbTradeSetups, refresh: refreshDbTradeSetups }, onIsolateTrade(), onSelectTrade() (+2 more)

### Community 35 - "pivotMarkers.ts"
Cohesion: 0.13
Nodes (8): refreshRangesMarkers(), Candle, PivotMarkerGroup, PivotMarkerPaneView, PivotMarkerPrimitive, PivotMarkerRenderer, RenderOptions, renderPivotMarkers()

### Community 36 - "tdd_mit_claude.ts"
Cohesion: 0.08
Nodes (24): nextPivot1, nextPivot10, nextPivot11, nextPivot2, nextPivot3, nextPivot4, nextPivot5, nextPivot6 (+16 more)

### Community 37 - "FibTickPrimitive"
Cohesion: 0.15
Nodes (3): FibTickPaneView, FibTickPrimitive, FibTickRenderer

### Community 38 - "priceChartHitTest.test.js"
Cohesion: 0.07
Nodes (21): findClickedDivergence(), findClickedLiquidityLevel(), findClickedOBZone(), findClickedSetup(), findClickedTarget(), OrderBlockPrimitive, ZonePaneView, ZoneRenderer (+13 more)

### Community 39 - "TradeSetupCockpit.vue"
Cohesion: 0.10
Nodes (20): accentStyle, antiConfluences, canTransfer, confirmations, confluences, dateLabel, direction, emit (+12 more)

### Community 40 - "MetadataPanel.vue"
Cohesion: 0.24
Nodes (10): emit, height, left, onDrag(), panelEl, props, startDrag(), stopDrag() (+2 more)

### Community 41 - "orderBlocks.js"
Cohesion: 0.09
Nodes (32): HTF_FOREX_MIN_GAP_PIPS Constant, LOWER_TF_MIN_GAP_PIPS Constant, Pip-/Pixel-Schwellwerte Übersicht, MIN_PIXELS_PER_HOUR_FOR_LABELS Constants, PIP_SIZE Constant, RANGE_FIB_MIN_PP_DISTANCE_PIPS Constant, TRADE_SETUP_LS_MAX_DISTANCE_M5 Constant, poi-watcher 4H+1H OB-Zonen-Wächter Edge Function (+24 more)

### Community 42 - "supabaseClient.js"
Cohesion: 0.13
Nodes (18): ALARM_TYPES, fetchAlarmSettings(), setAlarmEnabled(), fetchDailyStructurePivots(), DB_READ_PAGE_SIZE, fetchAllRows(), fetchLiquidityLevelsHtf(), fetchObZones() (+10 more)

### Community 43 - "useClaudeAnnotations.js"
Cohesion: 0.10
Nodes (28): berlinDateStrFor(), addClaudeAnnotationDrawing(), fetchClaudeAnnotations(), removeClaudeAnnotationDrawing(), setClaudeAnnotationDrawingVisible(), emit, error, { instrument, dateStr, drawings, loading, add, remove, setDrawingVisible } (+20 more)

### Community 44 - "trading-monitor-mcp/marketStructureAnalysis.ts"
Cohesion: 0.21
Nodes (23): advanceNestedTrend(), advanceNestedTrendInner(), applyInnerMarketStructurePivot(), applyInnerMarketStructurePivotCore(), applyMarketStructurePivot(), applyMarketStructurePivotCore(), buildMarketStructureState(), Candle (+15 more)

### Community 45 - "usePriceChartTradeSetups"
Cohesion: 0.33
Nodes (5): usePriceChartTradeSetups(), fetchM5Candles(), fetchTrendAnalysisM5History(), getTrendAnalysisM5Candles(), BASE_CTX

### Community 46 - "marketStructureAnalysis Rules Overview"
Cohesion: 0.22
Nodes (15): Arbitrary Nesting Depth (2026-08-09), Rendering Rules (renderMarketStructureAnalysis), marketStructureAnalysis Rules Overview, Docht-vs-Bruch (Wick vs Close-Break) Unification, Standalone Downtrend Detection/Invalidation, Fibonacci Level (computeFibLevels/collectFibLevels), Inner-Pivots (Period 2) Fast Pre-Detection, LQ-Sweep Classification (markLqSweeps) (+7 more)

### Community 47 - "Laniakea Persona Command (/l)"
Cohesion: 0.13
Nodes (18): 00-trading-steps.md Entry Point, Laniakea Persona Command (/l), trading/claude-project-instructions.md, trading-runs Relative Link Path Convention, 00-trading-steps.md#visuelle-antworten-chart-annotationen, 06-anti-confluence.md, glossar.md Consistency Check, kontext-ausführung.md (+10 more)

### Community 48 - "Plan: Sehr Große Dateien Refactoren (PriceChart.vue)"
Cohesion: 0.18
Nodes (11): Keep Codebase Clean / ~1000 Line Backstop Convention, liquidity_levels Table, Pip-Distance Server-Side Query Filter, Plan: Sehr Große Dateien Refactoren (PriceChart.vue), Phase 1: Candle-/Zeit-Helfer -> priceChartCandles.js, Phase 3: Liquidity-Merge -> priceChartLiquidity.js, Phase 4: RSI-Divergenz-Pin-Merge, Phase 5: Klick-Hittest-Funktionen (priceChartHitTest.js) (+3 more)

### Community 49 - "fachdoku-router/SKILL.md"
Cohesion: 0.18
Nodes (10): Fachdoku-Router, News Events Seed Workflow (ForexFactory Screenshot), News Events Seeding Notes, news_events Consumption (No-Go + Chart Markers), Settings-Sync Notes, localStorage-first / Supabase-Source-of-Truth Pattern, trading_loop_state Table Design, TSC No-Gos and Anti-Confluences Notes (+2 more)

### Community 50 - "pinContext.js"
Cohesion: 0.16
Nodes (21): addPinEntry(), addPinM5LiquidityEntry(), addPinM5ObEntry(), addPinRsiDivergenceEntry(), addPinTscSetupEntry(), fetchPinContext(), REF_COLUMN, removePinEntry() (+13 more)

### Community 51 - "pricePrecisionForInstrument"
Cohesion: 0.10
Nodes (23): candidateLabel(), candidatePrice(), emit, mergedCandidates, precision, props, emit, OUTCOME_LABEL (+15 more)

### Community 52 - "findAntiConfluenceCandidates.js"
Cohesion: 0.15
Nodes (22): businessSecondsBetween(), classifyAge(), computeSweepAgeHours(), MAJOR_MIN_HOURS, MAJOR_MIN_SECONDS, MINOR_MAX_HOURS, MINOR_MAX_SECONDS, fromPips() (+14 more)

### Community 53 - "gbp_h1_uptrend.ts"
Cohesion: 0.10
Nodes (20): pivot1, pivot10, pivot11, pivot12, pivot13, pivot2, pivot3, pivot4 (+12 more)

### Community 54 - "barSecondsFor"
Cohesion: 0.13
Nodes (21): firstObFormationTimeAfter(), TriggerCandle, applyAsOf(), applyAsOfZones(), earliestAmbiguousEventSec(), existsAsOf(), M5_SECONDS, ProbeCandle (+13 more)

### Community 55 - "PLAN: DR-Statistik in der UI anzeigen"
Cohesion: 0.13
Nodes (15): Beide Leitern nach festem Risiko-Band, Definitionen (nicht neu herleiten), Die Falle: Path B hat kein echtes Invalidierungslevel — ERLEDIGT 20.09.2026, Die Zahlen (Stand 22.09.2026, n=3282), Grenzen, die in die Anzeige gehören, Idee: wie wir den Trend doch noch dazubekommen, PLAN: DR-Statistik in der UI anzeigen, Reihenfolge (+7 more)

### Community 56 - "src/marketStructureAnalysis.ts"
Cohesion: 0.27
Nodes (17): advanceNestedTrend(), applyInnerMarketStructurePivotCore(), applyMarketStructurePivotCore(), buildMarketStructureState(), closesAboveOldHigh(), closesBelowLevel(), computeRangesPivots(), evaluateConfirmingBreak() (+9 more)

### Community 57 - "chartColors.js"
Cohesion: 0.13
Nodes (9): chartColors, DEFAULT_CHART_COLORS, resetChartColors(), chartLineWidths, resetChartLineWidths(), collapsed, emit, GROUPS (+1 more)

### Community 58 - "pinEntryVisible"
Cohesion: 0.14
Nodes (18): liquidityLevelEntryNaturalKey(), m5LiquidityEntryNaturalKey(), obZoneEntryNaturalKey(), hoveredPinLiquidityLevelKey, hoveredPinObZoneKey, onSelectPin(), pinEntryVisible(), pinJumpHint (+10 more)

### Community 59 - "clearArmStatesExcept"
Cohesion: 0.15
Nodes (14): clearArmStatesExcept(), onAddAntiConfluenceRequest(), onAddConfirmationRequest(), onAddConfluenceRequest(), onAddRangeAntiConfluenceRequest(), onAddRangeConfirmationRequest(), onAddRangeConfluenceRequest(), onAddTargetRequest() (+6 more)

### Community 60 - "trading-monitor-mcp/pretradeGates.ts"
Cohesion: 0.07
Nodes (37): poi-watcher UTC Refresh-Tick Exception, Trading-Hours/Timezone Handling (Europe/Berlin), sessions Table, trading_schedules Table, docs/debug-metadata-panel.md, Fachdoku-Router Skill, src/marketStructureAnalysis.notes.md, docs/mcp-server.md (+29 more)

### Community 61 - "usePriceChartLiquidity.js"
Cohesion: 0.12
Nodes (25): usePriceChartLiquidity(), attachBonus(), refresh(), liquidityLevelNaturalKey(), buildLevel(), detectLiquidityLevels(), filterRelevantLevels(), isDownFractal() (+17 more)

### Community 62 - "liquidityDetection.ts"
Cohesion: 0.19
Nodes (14): buildLevel(), detectLiquidityLevels(), isDownFractal(), isUpFractal(), LiquidityLevel, backfillOne(), BAR_CONFIG, BARS (+6 more)

### Community 63 - "poi-watcher/index.ts"
Cohesion: 0.11
Nodes (22): unprocessedTimeframes(), fmt(), InstrumentConfig, INSTRUMENTS, isInWindows(), LiquidityLevelRow, localMinutesAndWeekday(), ObZoneRow (+14 more)

### Community 64 - "State Machine for Lana's Trading Flow"
Cohesion: 0.14
Nodes (18): Trading-Steps-Ablauf Diagram, Fall 4 -> Zurück zu Schritt 3, Two Permanent LLM-Only Steps (3 and 6), News-Pause Doesn't Replace the Cron, State Machine for Lana's Trading Flow, get_tsc_range Deliberately Not a Graph Node, Problem: GBPUSD 28.08.2026 Fall-4 Deviation Incident, trading-runs/*.md Loses Purpose (+10 more)

### Community 65 - "compilerOptions"
Cohesion: 0.12
Nodes (16): src/marketStructureAnalysis.ts, src/marketStructureRendering.ts, src/pivotMarkers.ts, test/tdd_mit_claude/ranges/tdd_mit_claude.ts, compilerOptions, allowJs, checkJs, esModuleInterop (+8 more)

### Community 66 - "liquidity.js"
Cohesion: 0.22
Nodes (15): ageReferenceTime(), businessSecondsBetween(), computeNextReplayTime(), formatAge(), mergeRecent(), nextCandleAfter(), replayFetchToMs(), snapToBarTime() (+7 more)

### Community 67 - "claudeAnnotations.js"
Cohesion: 0.08
Nodes (21): berlinDayRangeUtcMs(), berlinOffsetMinutes(), DATE_FORMATTER, OFFSET_FORMATTER, TIME_FORMATTER, ANNOTATION_COLOR, annotationAnchorPoint(), AnnotationsPaneView (+13 more)

### Community 68 - "trade_evidence Table (Dual-Level, Confirmation/Confluence)"
Cohesion: 0.16
Nodes (14): dealing_ranges Table, trade_evidence Table (Dual-Level, Confirmation/Confluence), trade_partial_exits Table, trade_positions Table, trade_targets Table, Confirmation/Confluence/Anti-Confluence Categories, trading repo trade-from-poi.md (Confirmation/Confluence/Anti-Confluence Definition), OB-Zones Canonical FK Consolidation Approach (+6 more)

### Community 69 - "AGENTS.md"
Cohesion: 0.14
Nodes (12): Architecture, Commands, Conventions, Forex candle data: FXCM ForexConnect, Frontend data flow (`PriceChart.vue`), Gotchas, graphify, "Laniakea" persona (`/l`) (+4 more)

### Community 70 - "Trading-Monitor Project Overview (CLAUDE.md)"
Cohesion: 0.11
Nodes (21): cTrader Open API as Forex Candle Source, DRY Within a Single Runtime Convention, CLAUDE.md Pointer to /l Persona, npm run build Command, Trading-Monitor Project Overview (CLAUDE.md), Supabase/PostgREST ~1000 Row Cap Gotcha, Rename Consistency Convention, Deploy to GitHub Pages Workflow (+13 more)

### Community 71 - "TargetPickerModal.vue"
Cohesion: 0.15
Nodes (16): MAX_TARGET_DISTANCE_PIPS Constant, find_targets Target-Candidate Algorithm Design, Plan: find_targets Algorithmus, TSC-Neuaufbau Precondition, openAntiConfluencePicker(), openTargetPicker(), emit, mergedCandidates (+8 more)

### Community 72 - "tradeSetup.ts"
Cohesion: 0.10
Nodes (29): readForexCandlesArchiveFrom(), LiquidityLevel, closesBeyondLevel(), collectObSweeps(), DEFAULT_TRADE_SETUP_PARAMS, DetectedTradeSetup, detectTradeSetup(), findBestLsMatch() (+21 more)

### Community 73 - "closed_rows"
Cohesion: 0.26
Nodes (7): closed_rows(), Normalisierung der nativen FXCM-Bid-Kerzen, unabhängig vom SDK testbar., main(), Geschlossene Bid-Kerzen: FXCM -> lokaler Puffer -> Supabase-Ingest., read_config(), upload(), ClosedCandlesTest

### Community 74 - "Journal GBPUSD — Sicherung vor dem Quellenwechsel"
Cohesion: 0.10
Nodes (19): 03.06.2026 · Short · DR#40, 03.08.2026 · Short · DR#27, 07.08.2026 · Long · DR#29, 07.08.2026 · Short · DR#28, 07.08.2026 · Short · DR#30, 10.08.2026 · Short · DR#41, 14.07.2026 · Short · DR#44, 25.08.2026 · Long · DR#46 (+11 more)

### Community 75 - "findAntiConfluences.js"
Cohesion: 0.38
Nodes (11): byDistance(), findAntiConfluenceCandidates(), findAntiConfluenceDivergenceCandidates(), findAntiConfluenceObCandidates(), findAntiConfluenceSweepCandidates(), findInvalidationObCandidates(), inBand(), INDUCEMENT_TIMEFRAMES (+3 more)

### Community 76 - "SessionBandPaneView"
Cohesion: 0.14
Nodes (3): SessionBandPaneView, SessionBandPrimitive, SessionBandRenderer

### Community 77 - "TradingFlow.vue"
Cohesion: 0.10
Nodes (22): cache, useLocalStorageRef(), buildMermaidSource(), EDGES, getNextActionHint(), mermaidEscape(), NODES, activeByInstrument (+14 more)

### Community 78 - "applyMarketStructurePivot"
Cohesion: 0.10
Nodes (25): applyMarketStructurePivot(), initMarketStructureState(), RANGE_FIB_MIN_PP_DISTANCE_PIPS, chochConfirmedState(), confirmBreak, confirmedUptrendState(), originHigh, originLow (+17 more)

### Community 79 - "alarmLog.js"
Cohesion: 0.27
Nodes (8): fetchAlarmLog(), fetchTouchedLiquidityLevels(), fetchTradeSetups(), fetchTouchedZones(), MAX_PROTOKOLL_ZEILEN, currentSymbol, { data: rows, refresh }, SYMBOLS

### Community 80 - "drQuoten.js"
Cohesion: 0.21
Nodes (13): drQuoten, drQuotenBlock(), leiter(), PIP_BAENDER, PIP_ZIELE, pipQuote(), quoteAusBaendern(), QUOTEN_HERKUNFT (+5 more)

### Community 81 - "Dealing-Range-Loop Diagram"
Cohesion: 0.17
Nodes (12): Dealing-Range-Loop Diagram, News-Blackout Mid-Loop Pause, Pin-Aufräumen after TSC-Link, Target Selection Remains Lana's Judgment, Pin Tools (tools/pins.ts), poi-watcher Alert-Cron Notes, poi-watcher 3-Tier Fetch Throttling, UTC-Hours Exception for Refresh Ticks (+4 more)

### Community 82 - "FXCM-Kerzenfeed"
Cohesion: 0.22
Nodes (9): Betrieb, Datenfluss, Demokonto abgelaufen oder gesperrt, FXCM-Kerzenfeed, Historie nachholen und Sicherungen, Neuaufbau und Wartung, Umstellung und Sicherung, Wenn keine neuen Kerzen kommen (+1 more)

### Community 83 - "App.vue"
Cohesion: 0.10
Nodes (21): { activeLabels, isActive }, isFresh, { lastSuccessAt }, lastUpdateText, now, showClaudeAnnotationsModal, statusDotClass, statusText (+13 more)

### Community 84 - "AI Capabilities and Limitations Notes"
Cohesion: 0.17
Nodes (12): Delegation (4D Framework), Description (4D Framework), Diligence (4D Framework), Discernment (4D Framework), AI Fluency: 4D Framework Notes, calc_rr Tool Idea (Deterministic RR Calc), AI Capabilities and Limitations Notes, Letter-over-Spirit Failure Mode (+4 more)

### Community 85 - "Vegapunk Slimming Results (-86%)"
Cohesion: 0.17
Nodes (13): get_data_export Tool, Tool 2: run_bias_check, Lana Test Data README, Chronological MCP Tool Call Sequence, Output-too-large Problem, Vegapunk Slimming Results (-86%), marketStructureAnalysis Developer Notes, File Separation: Algorithm vs Rendering (+5 more)

### Community 86 - "backfillObZones.ts"
Cohesion: 0.29
Nodes (9): backfillOne(), BAR_CONFIG, BARS, CandleRow, correctStaleZones(), fetchAllCandles(), fetchCorrectionCandidates(), INSTRUMENTS (+1 more)

### Community 87 - "reads.ts"
Cohesion: 0.10
Nodes (41): isBoxInvalidated(), detectSetupObs(), fetchActiveTscRangeId(), fetchDealingRangeCockpit(), findRecentTradeSetupIdsByKey(), getForexCandlesArchive(), getJournal(), getObZones() (+33 more)

### Community 88 - "PinAddPopup.vue"
Cohesion: 0.23
Nodes (11): clampedX, clampedY, confirm(), emit, note, onKeydown(), onWindowMousedown(), props (+3 more)

### Community 89 - "twelvedata/client.ts"
Cohesion: 0.21
Nodes (11): Candle, fetchCandles(), FetchCandlesOptions, INTERVAL_MAP, requestTimeSeries(), resample(), RESAMPLE_BUCKET_SEC, SUPPORTED_PERIODS (+3 more)

### Community 90 - "Anleitung: State-Machine lesen & bedienen"
Cohesion: 0.25
Nodes (7): Ablaufbeispiel, Anleitung: State-Machine lesen & bedienen, Grundprinzip, Maschine bedienen, Menschlicher Gegencheck, `replayUntilSec` — der EINE Zeit-Parameter (alle Tools), State lesen, ohne die Maschine zu bewegen

### Community 91 - "usePriceChartMarketStructure"
Cohesion: 0.16
Nodes (14): findClickedFibLevel(), usePriceChartMarketStructure(), computeRangesPivotsAndMetadata(), computeRangesPivotsFor(), fetchRangesCandles(), getCurrentFibLevels(), buildActiveMetadataSnapshot(), earliestRelevantTime() (+6 more)

### Community 92 - "marketStructureAnalysisNestedNestedChoch.test.js"
Cohesion: 0.17
Nodes (11): confirmBreak, originHigh, originLow, pivotB, pivotC, pivotD, pivotE, pivotF (+3 more)

### Community 93 - "dataExport.ts"
Cohesion: 0.07
Nodes (47): berlinOffsetMinutes(), berlinOffsetFromSec(), forbiddenSessionAt(), filterRelevantLevels(), LIQUIDITY_FRACTAL_PERIOD, LIQUIDITY_MAX_RELEVANT, PIP_SIZE, ALL_DAYS (+39 more)

### Community 94 - "MCP-Server: Tiefere Referenz"
Cohesion: 0.20
Nodes (10): MCP Auth & Table Permissions, Backfill Scripts, Candle Archive (forex_candles), MCP Server Deployment (Supabase Edge Function), MCP-Server: Tiefere Referenz, get_forex_rsi / get_forex_ema Tools, Single Deno Copy (Dual-Copy Removed), Trade-Journal Write Tools (tools/trades.ts) (+2 more)

### Community 95 - "refresh"
Cohesion: 0.13
Nodes (8): usePriceChartTradeSetupDrawing(), refresh(), R_SCALE_MINIMUM, labelText(), RScalePaneView, RScalePrimitive, RScaleRenderer, styleKey()

### Community 96 - "trades.ts"
Cohesion: 0.11
Nodes (28): addTradePosition(), createTrade(), deleteTradeTarget(), getDealingRangeById(), insertTradePosition(), updateDealingRange(), updateTradeTarget(), berlinOffsetSuffix() (+20 more)

### Community 97 - "drMerkmale.py"
Cohesion: 0.05
Nodes (53): ev(), mess_gedeckelt(), mess_pips_gedeckelt(), -> (Quote, Treffer, unentschieden). Unentschieden = weder Ziel noch Stopp…, -> (Quote, Treffer, unentschieden) fuer ein festes Pip-Ziel gegen den…, Erwartungswert in R ueber die ENTSCHIEDENEN DRs (Treffer oder Stopp, nicht…, dr_schluessel(), gruppiere_drs() (+45 more)

### Community 98 - "newsEvents.js"
Cohesion: 0.13
Nodes (19): CURRENCIES, emit, LIST_FORMATTER, newCurrency, newDateTime, newTitle, saving, submit() (+11 more)

### Community 99 - "format.js"
Cohesion: 0.14
Nodes (14): cssColorScaled(), hexToRgba(), emit, lessonBadges(), OUTCOME_LABEL, props, rangeLabel(), rowStyle() (+6 more)

### Community 100 - "messeFxcmKontext.ts"
Cohesion: 0.32
Nodes (4): createAnalysisSnapshotFetch(), compressed, root, rows

### Community 101 - "useM5CandleClock"
Cohesion: 0.46
Nodes (5): m5ClockState(), useM5CandleClock(), refresh(), retry(), tick()

### Community 102 - "/task do Mode"
Cohesion: 0.38
Nodes (7): Laniakea milk-city Task-Status Rule, /task Default Data-Maintenance Mode, /task do Mode, /task new Mode, /task refine Mode, /task Command Router, milk-city Task Status Convention

### Community 104 - "chartColors.test.js"
Cohesion: 0.18
Nodes (9): DEFAULT_CHART_LINE_WIDTHS, allSourceFiles, EXCLUDED_FROM_USAGE_SCAN, fieldsBlocks, SOURCE_EXTENSIONS, SRC_DIR, styleModalFieldKeys, styleModalSource (+1 more)

### Community 105 - "marketStructureRendering.ts"
Cohesion: 0.12
Nodes (20): refreshMarketStructure(), bullBearLabelSide(), Candle, ArrowPaneView, ArrowPrimitive, ArrowRenderer, collectFibLevels(), collectH1LqLevels() (+12 more)

### Community 106 - "Lana-Fehlerdiagnose"
Cohesion: 0.33
Nodes (5): Ablauf, Ergebnis, Lana-Fehlerdiagnose, Routing: Diagnose → typischer Fix-Ort, Wann aufrufen

### Community 107 - "Agent Skills Pro Notes"
Cohesion: 0.29
Nodes (7): allowed-tools Skill Config, Context-free Scripts in Skills, Agent Skills Pro Notes, Progressive Disclosure in Skills, Skill Sharing & Troubleshooting, Skills Embedded in Subagents, Skills vs CLAUDE.md vs Hooks vs Subagents

### Community 108 - "usePriceChartTradeSetupDrawing.js"
Cohesion: 0.30
Nodes (8): fromPips(), KEINE_SKALA, R_SCALE_STEPS, rScaleLevels(), STOPP_DECKEL_PIPS, longSetup, shortSetup, weitesSetup

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

### Community 116 - "loadRangesCandles"
Cohesion: 0.14
Nodes (15): loadInitial(), loadRangesCandles(), m5ClockEnabled(), pollRecent(), rangesNeedsData(), refreshRangesPollingState(), replayToMs(), scheduleNextPoll() (+7 more)

### Community 117 - "vite.config.js"
Cohesion: 0.40
Nodes (3): DEBUG_DIR, DEBUG_FILE, __dirname

### Community 118 - "lana-git-pull.cjs"
Cohesion: 0.50
Nodes (3): { execFileSync }, path, TRADING_REPO

### Community 119 - "forexCandles.js"
Cohesion: 0.27
Nodes (14): DB_ARCHIVED_BARS, fetchArchivedPage(), fetchArchivedUpTo(), fetchCandles(), fetchCandlesBatchOnce(), fetchCandlesOnce(), fetchInitialCandles(), fetchOlderCandles() (+6 more)

### Community 121 - "usePolledFetch.js"
Cohesion: 0.43
Nodes (5): usePolledFetch(), load(), lastSuccessAt, useStatusBar(), markSuccess()

### Community 122 - "marketStructureAnalysis.test.js"
Cohesion: 0.22
Nodes (8): pivot1, pivot2, pivot3, pivot4, pivot5, pivot6, pivot7, pivot8

### Community 124 - "lineWidth"
Cohesion: 0.26
Nodes (9): lineWidth(), drawEntryPoint(), drawExitPoint(), drawHaloRing(), drawLabel(), drawTick(), renderTradeMarkers(), TradeMarkerRenderer (+1 more)

### Community 125 - "Handbuch-Check"
Cohesion: 0.40
Nodes (4): Ergebnis, Handbuch-Check, Prüfpunkte, Wann aufrufen

### Community 132 - "JsonTree.vue"
Cohesion: 0.25
Nodes (5): entries, expanded, isArray, isObject, props

### Community 133 - "applyInnerMarketStructurePivot"
Cohesion: 0.12
Nodes (13): advanceNestedTrendInner(), applyInnerMarketStructurePivot(), confirmBreak, originHigh, originLow, pullback, h1Candles, p2Pivot3 (+5 more)

### Community 135 - "Dealing Range anlegen"
Cohesion: 0.50
Nodes (3): Ablauf, Dealing Range anlegen, Warum ein eigener Skill (nicht nur eine Doku-Zeile)

### Community 136 - ".codex/hooks/lana-git-pull.cjs"
Cohesion: 0.50
Nodes (3): { execFileSync }, path, TRADING_REPO

### Community 138 - "tradingSchedules.js"
Cohesion: 0.19
Nodes (12): minutesToTimeInput(), timeInputToMinutes(), addWindow(), cloneWindows(), DEFAULT_SCHEDULES, EMPTY_WINDOWS, loadInitial(), removeWindow() (+4 more)

### Community 139 - "tradeEvidence.ts"
Cohesion: 0.13
Nodes (19): AgeTier, classifyAge(), MAJOR_MIN_SECONDS, MINOR_MAX_SECONDS, targetLabel(), sweepTier, evidenceAgeSeconds(), evidenceAgeTier() (+11 more)

### Community 141 - "cssColor"
Cohesion: 0.25
Nodes (9): cssColor(), nativeLineWidth(), usePriceChartRsi(), applyColorOptions(), applyLineWidthOptions(), create(), refreshEma(), refreshRsi() (+1 more)

### Community 143 - "evidenceScoring.ts"
Cohesion: 0.40
Nodes (4): computeEvidenceScore(), EvidenceScoreBreakdownEntry, EvidenceScoreInput, EvidenceScoreResult

### Community 144 - "fxcmCandles.ts"
Cohesion: 0.22
Nodes (5): headers, fetchForexBatch(), FxcmCandle, PERIODS, readFxcmCandles()

### Community 146 - "M5CandleClock.vue"
Cohesion: 0.50
Nodes (3): countdown, latest, props

### Community 147 - "supabaseRowCapGuard.test.js"
Cohesion: 0.33
Nodes (8): ALLOWLIST, blankComments(), findUnbounded(), overCap(), readChain(), ROOT, SCAN_DIRS, walk()

### Community 148 - "marketStructureAnalysisLqSweep.test.js"
Cohesion: 0.25
Nodes (7): baseState(), candles, levelRealBreak, levelSweep, levelUntouched, origin, triggerPivot

### Community 149 - "Entschiedene Design-Fragen"
Cohesion: 0.22
Nodes (9): Das Kriterium ist das Sweep-ALTER, nicht die Herkunft — korrigiert 20.09.2026, Der gedeckelte Stopp — durchgängige Konvention seit 20.09.2026, Die 50er-Schwelle ist erfüllt — kein Blocker mehr, Die Pip-Leiter — gegen denselben gedeckelten Stopp, Ein zweiter Schnitt wäre möglich — aber zurückgestellt (siehe oben), Entschiedene Design-Fragen, Erwartungswert je Ziel — und warum die Anzeige nicht empfehlen soll, Feste Bänder, keine Terzile — entschieden (+1 more)

### Community 153 - "cTrader ACCESS_DENIED Lockout (No Auto-Recovery)"
Cohesion: 0.50
Nodes (3): cTrader ACCESS_DENIED Lockout (No Auto-Recovery), ctrader_oauth_tokens Table, tokenUrl

### Community 154 - "chartMeasure.js"
Cohesion: 0.39
Nodes (7): formatDatedTime(), formatPips(), MEASURE_COLOR, measureDrawing(), riskPips, toPips(), onMeasureDone()

### Community 156 - "validate.js"
Cohesion: 0.38
Nodes (4): SECONDS, validateCandles(), candle, closedAt

### Community 157 - "PinPanel.vue"
Cohesion: 0.32
Nodes (7): emit, noteSaveTimers, onEntryClick(), onNoteInput(), OUTCOME_LABEL, props, rows

### Community 159 - "refreshTscRange"
Cohesion: 0.28
Nodes (9): removeConfirmationFromTrade(), fetchActiveTscRangeId(), loadActiveTscRange(), onAddAntiConfluenceFromPicker(), onAddTargetFromPicker(), onTscRemoveAntiConfluence(), onTscRemoveConfirmation(), onTscRemoveConfluence() (+1 more)

### Community 166 - "Die Filter"
Cohesion: 0.40
Nodes (5): Die Filter, Gegenkraft — teilweise gekippt, Handelszeit — als Fenster tot, als Stunde lebendig, Sweep-Alter — der größte Effekt, Sweep-Herkunft — der stärkste, und er hält

### Community 172 - "Woher die 1314 kommen"
Cohesion: 0.67
Nodes (3): Warum die Auswertung NICHT auf der DB-Tabelle läuft, Warum es 1314 statt 915 sind (21.09.2026), Woher die 1314 kommen

## Ambiguous Edges - Review These
- `Trading-Steps-Ablauf Diagram` → `calc_rr Tool Idea (Deterministic RR Calc)`  [AMBIGUOUS]
  docs/steerabilty-vs-wrong-ai-outputs.md · relation: references

## Knowledge Gaps
- **1169 isolated node(s):** `{ execFileSync }`, `path`, `TRADING_REPO`, `{ execFileSync }`, `path` (+1164 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1439 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **13 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Trading-Steps-Ablauf Diagram` and `calc_rr Tool Idea (Deterministic RR Calc)`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **Why does `businessSecondsBetween()` connect `findAntiConfluenceCandidates.js` to `tradeSetup.ts`, `tradeEvidence.ts`, `dataExport.ts`, `dealingRangeLoop.ts`?**
  _High betweenness centrality (0.092) - this node is a cross-community bridge._
- **Why does `marketStructureAnalysis Developer Notes` connect `Vegapunk Slimming Results (-86%)` to `fachdoku-router/SKILL.md`, `marketStructureAnalysis Rules Overview`?**
  _High betweenness centrality (0.076) - this node is a cross-community bridge._
- **Why does `renderMarketStructureAnalysis()` connect `marketStructureRendering.ts` to `liquidity.js`, `FibTickPrimitive`, `cssColor`, `usePriceChartMarketStructure.js`, `Vegapunk Slimming Results (-86%)`, `lineWidth`, `LiquidityLinePrimitive`?**
  _High betweenness centrality (0.068) - this node is a cross-community bridge._
- **What connects `{ execFileSync }`, `path`, `TRADING_REPO` to the rest of the system?**
  _1169 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Dashboard.vue` be split into smaller, more focused modules?**
  _Cohesion score 0.015535397768741528 - nodes in this community are weakly interconnected._
- **Should `gbp_h1_uptrend_uptrend_break_of_structure_und_trendumkehr.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0196078431372549 - nodes in this community are weakly interconnected._