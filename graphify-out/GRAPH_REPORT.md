# Graph Report - trading-monitor  (2026-09-20)

## Corpus Check
- 485 files · ~496,311 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 3013 nodes · 6124 edges · 146 communities (131 shown, 9 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 109 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `7eedeb7e`
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
- usePriceChartRsi.js
- marketStructureRendering.ts
- rsiDivergenceStats.ts
- DataExportModal.vue
- berlinDateStrFor
- trading-monitor-mcp/pretradeGates.ts
- Plan: POI-Strategie-Findung, Backtesting & Trade-Notifications
- TradeEditModal.vue
- package.json
- src/sessionOccurrences.js
- LoopStatus.vue
- applyMarketStructurePivot
- Dealing-Range-Anlegen Skill
- backfillObZones.ts
- newsMarkers.js
- biasCheck.ts
- ctrader/client.ts
- marketStructureAnalysis Rules Overview
- tradeIntake.js
- trades.js
- Plan: Forex-Chart-Objekte Datengrundlage
- priceChartObZones.js
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
- initMarketStructureState
- supabaseClient.js
- orderBlocks.js
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
- cssColor
- format.js
- tradeSetup.js
- pivotMarkers.ts
- poi-watcher/index.ts
- State Machine for Lana's Trading Flow
- compilerOptions
- chartTimeUtils.js
- claudeAnnotations.js
- backfillTradeSetups.ts
- AGENTS.md
- Trading-Monitor Project Overview (CLAUDE.md)
- biasEngine.ts
- daily-structure-pivots/index.ts
- applyInnerMarketStructurePivot
- clearArmStatesExcept
- forexCandles.js
- SessionBandPaneView
- TradingFlow.vue
- marketStructureAnalysisFib.test.js
- Fachdoku-Router Skill
- clipReplay
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
- tradeSetup.ts
- annotations.ts
- evidenceScoring.ts
- MCP-Server: Tiefere Referenz
- usePriceChartLiquidity
- Plan: Trade-Journal Konfluenzen & Kontext
- drMerkmale.py
- NewsModal.vue
- trade_evidence Table (Dual-Level, Confirmation/Confluence)
- MetadataPanel.vue
- findAntiConfluenceCandidates.js
- /task do Mode
- hole_alle
- newsEvents.js
- LiquidityLinePrimitive
- Lana-Fehlerdiagnose
- Agent Skills Pro Notes
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
- alarmLog.js
- JsonTree.vue
- PinPanel.vue
- usePolledFetch.js
- computeTrendChain

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

## Communities (146 total, 9 thin omitted)

### Community 0 - "Dashboard.vue"
Cohesion: 0.02
Nodes (123): useSessionStorageRef(), useTabScopedRef(), addPositionToDealingRange(), fetchTradeSetupForCockpit(), antiConfluenceAddTrade, anyArmStateActive, ARM_STATES, closeTradeEditModal() (+115 more)

### Community 1 - "gbp_h1_uptrend_uptrend_break_of_structure_und_trendumkehr.ts"
Cohesion: 0.02
Nodes (101): candlesAroundBOS, candlesAroundBreak, p2Pivot1, p2Pivot10, p2Pivot11, p2Pivot12, p2Pivot13, p2Pivot14 (+93 more)

### Community 2 - "reads.ts"
Cohesion: 0.14
Nodes (28): isBoxInvalidated(), fetchDealingRangeCockpit(), findRecentTradeSetupIdsByKey(), getForexCandlesArchive(), getJournal(), getTradeSetups(), getTradeSetupWinrate(), getTradingAccounts() (+20 more)

### Community 3 - "lineWidth"
Cohesion: 0.13
Nodes (11): lineWidth(), drawEntryPoint(), drawExitPoint(), drawHaloRing(), drawLabel(), drawTick(), renderTradeMarkers(), TradeMarkerPaneView (+3 more)

### Community 4 - "PriceChart.vue"
Cohesion: 0.03
Nodes (72): activeMetadataSnapshot, allCandles, antiConfluencePickerCurrentPrice, antiConfluencePickerDivergenceCandidates, antiConfluencePickerHoveredLiquidityKey, antiConfluencePickerHoveredObKey, antiConfluencePickerInvalidationObCandidates, antiConfluencePickerObCandidates (+64 more)

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
Cohesion: 0.07
Nodes (41): nativeLineWidth(), usePriceChartRsi(), applyColorOptions(), applyLineWidthOptions(), create(), refreshDivergence(), refreshEma(), refreshRsi() (+33 more)

### Community 9 - "marketStructureRendering.ts"
Cohesion: 0.06
Nodes (25): refreshMarketStructure(), bullBearLabelSide(), Candle, ArrowPaneView, ArrowPrimitive, ArrowRenderer, collectFibLevels(), collectH1LqLevels() (+17 more)

### Community 10 - "rsiDivergenceStats.ts"
Cohesion: 0.09
Nodes (38): buildDivergenceEntry(), collectDivergenceHistory(), computeRsi(), DEFAULT_DIVERGENCE_FRACTAL_PERIOD, DEFAULT_DIVERGENCE_HISTORY_COUNT, DEFAULT_DIVERGENCE_LOOKBACK_BARS, DEFAULT_RSI_PERIOD, detectRsiDivergence() (+30 more)

### Community 11 - "DataExportModal.vue"
Cohesion: 0.09
Nodes (22): asset, copied, copyResult(), currentSymbol, dateStr, error, generate(), loading (+14 more)

### Community 12 - "berlinDateStrFor"
Cohesion: 0.08
Nodes (50): berlinDateStrFor(), berlinDateTimeStrFor(), DATE_FORMATTER, OFFSET_FORMATTER, TIME_FORMATTER, createDealingRange(), deleteDealingRange(), fetchActiveTscRangeId() (+42 more)

### Community 13 - "trading-monitor-mcp/pretradeGates.ts"
Cohesion: 0.17
Nodes (16): BERLIN_HM_FORMATTER, BERLIN_WEEKDAY_FORMATTER, berlinWeekdayAndMinutes(), isWithinTradingWindows(), TradingWindows, WeekdayGroup, ClassifiedNewsEvent, evaluateTradingHoursGate() (+8 more)

### Community 14 - "Plan: POI-Strategie-Findung, Backtesting & Trade-Notifications"
Cohesion: 0.16
Nodes (16): Supabase/PostgREST ~1000 Row Cap Gotcha, daily_structure_pivots Table, forex_candles Table, get_forex_candles_archive MCP Tool, Archive-First Auto-Reload Pattern (Tried, Then Reverted), 1H/4H DB-Read vs Live-Recompute Decision, BTC-USDT/OKX Complete Removal (2026-08-21), 1D-Periode-4-Pivot Market-Structure Startpoint (2026-08-30) (+8 more)

### Community 15 - "TradeEditModal.vue"
Cohesion: 0.05
Nodes (46): commission, confirmationLabel(), emit, entryPrice, entryTimeInput, exitPrice, exitTimeInput, flashInvalidationSaved() (+38 more)

### Community 16 - "package.json"
Cohesion: 0.06
Nodes (33): lightweight-charts, mermaid, dependencies, lightweight-charts, mermaid, @supabase/supabase-js, vue, vue-router (+25 more)

### Community 17 - "src/sessionOccurrences.js"
Cohesion: 0.26
Nodes (11): attachBonus(), attachRangeExtremes(), bonusLabelForPivot(), buildSessionContextLookup(), contextForPivot(), daysOrAll(), localMidnightUtc(), localWeekday() (+3 more)

### Community 18 - "LoopStatus.vue"
Cohesion: 0.07
Nodes (24): fetchLoopStateHistory(), fetchLoopStatesForDate(), LOOP_INSTRUMENTS, rowToLoopState(), fetchStateMachineLog(), rowToDecision(), activeByInstrument, { data, refresh } (+16 more)

### Community 19 - "applyMarketStructurePivot"
Cohesion: 0.19
Nodes (13): applyMarketStructurePivot(), chochConfirmedState(), confirmBreak, confirmedUptrendState(), originHigh, originLow, pullback, chochConfirmedState() (+5 more)

### Community 20 - "Dealing-Range-Anlegen Skill"
Cohesion: 0.14
Nodes (15): kind=pivot = Liquidity-Sweep-Only Semantics, Dealing-Range-Anlegen Skill, milk-city Task: Confluence-Tracking bei Dealing Ranges, trading/liquidität.md (Liquiditäts-Sweep-Mechanismus), AI Capabilities Framework (Next Token Prediction/Knowledge/Working Memory/Steerability), Diagnose-to-Fix Routing Table, Lana-Fehlerdiagnose Skill, docs/steerabilty-vs-wrong-ai-outputs.md (+7 more)

### Community 21 - "backfillObZones.ts"
Cohesion: 0.29
Nodes (9): backfillOne(), BAR_CONFIG, BARS, CandleRow, correctStaleZones(), fetchAllCandles(), fetchCorrectionCandidates(), INSTRUMENTS (+1 more)

### Community 22 - "newsMarkers.js"
Cohesion: 0.13
Nodes (10): DAY_KEY_FORMATTER, extrapolatedX(), formatEventLabel(), isSameBerlinDay(), NewsMarkerPaneView, NewsMarkerPrimitive, NewsMarkerRenderer, renderNewsMarkers() (+2 more)

### Community 23 - "biasCheck.ts"
Cohesion: 0.12
Nodes (25): AgeTier, businessSecondsBetween(), classifyAge(), classifyInducementAge(), inducementAgeRange(), MAJOR_MIN_HOURS, MAJOR_MIN_SECONDS, MINOR_MAX_HOURS (+17 more)

### Community 24 - "ctrader/client.ts"
Cohesion: 0.12
Nodes (25): CORS_HEADERS, fetchForexBatch(), authAccount(), authenticate(), cachedSymbolIds, Candle, concat(), connectWithTimeout() (+17 more)

### Community 25 - "marketStructureAnalysis Rules Overview"
Cohesion: 0.22
Nodes (15): Arbitrary Nesting Depth (2026-08-09), Rendering Rules (renderMarketStructureAnalysis), marketStructureAnalysis Rules Overview, Docht-vs-Bruch (Wick vs Close-Break) Unification, Standalone Downtrend Detection/Invalidation, Fibonacci Level (computeFibLevels/collectFibLevels), Inner-Pivots (Period 2) Fast Pre-Detection, LQ-Sweep Classification (markLqSweeps) (+7 more)

### Community 26 - "tradeIntake.js"
Cohesion: 0.13
Nodes (27): direction, emit, entryPrice, errorMsg, levels, precision, props, reasoning (+19 more)

### Community 27 - "trades.js"
Cohesion: 0.11
Nodes (22): onRemoveConfirmation(), pnlClass, props, stats, winrateClass, fmtR(), removeConfirmationFromTrade(), computeTradeStats() (+14 more)

### Community 28 - "Plan: Forex-Chart-Objekte Datengrundlage"
Cohesion: 0.24
Nodes (10): ob_zones Table, BTC Scope Removal from Chart-Objects Plan, OB-Zones Canonical FK Consolidation Approach, Four Independent OB Render Passes Problem, "Historische OBs"-Toggle Semantics, LQ-Sweep Relevance Criterion (Recent OR Pip-Range), Plan: Forex-Chart-Objekte Datengrundlage, Persistierungs-Umfang: Nur Referenzierte Teilmenge (+2 more)

### Community 29 - "priceChartObZones.js"
Cohesion: 0.17
Nodes (20): emit, onAntiConfluencePickerHover(), onAntiConfluencePickerSelect(), onTargetPickerHover(), onTargetPickerSelect(), refreshLiquidityInternal(), refreshPoiZonesInternal(), detectOrderBlocks() (+12 more)

### Community 30 - "chartLineWidths.js"
Cohesion: 0.09
Nodes (18): chartColors, DEFAULT_CHART_COLORS, resetChartColors(), chartLineWidths, DEFAULT_CHART_LINE_WIDTHS, resetChartLineWidths(), collapsed, emit (+10 more)

### Community 31 - "sessions.js"
Cohesion: 0.13
Nodes (17): emit, instrumentSessions, props, WEEKDAY_DISPLAY_ORDER, ALL_DAYS, addSession(), currentSessionDanger(), DANGER_LEVELS (+9 more)

### Community 32 - "gbp_h1_uptrend_protected_low_gebrochen.ts"
Cohesion: 0.08
Nodes (25): ClosedRange, MarketStructureState, PivotBase, PivotHigh, PivotLow, PivotTouched, PivotTypeAll, PivotUntouched (+17 more)

### Community 33 - "tradingAccounts.js"
Cohesion: 0.12
Nodes (19): currentLabel, open, selectedAccount, wrapperRef, cache, useLocalStorageRef(), accounts, accountsLoaded (+11 more)

### Community 34 - "dealingRangeLoop.ts"
Cohesion: 0.06
Nodes (55): assessInducement(), checkFallFour(), CheckFallFourInput, computeHtfWatchLevels(), computeWatchLevels(), FallFourResult, hasReaction(), HasReactionInput (+47 more)

### Community 35 - "dataExport.js"
Cohesion: 0.15
Nodes (25): marketStructureTree, berlinDayRangeUtcMs(), berlinOffsetMinutes(), buildDataExport(), compute1hStructureState(), computeExportTimeframeData(), computeLiquidityLevelsForExport(), computeObZonesForExport() (+17 more)

### Community 36 - "tdd_mit_claude.ts"
Cohesion: 0.08
Nodes (24): nextPivot1, nextPivot10, nextPivot11, nextPivot2, nextPivot3, nextPivot4, nextPivot5, nextPivot6 (+16 more)

### Community 37 - "orderBlocks.ts"
Cohesion: 0.14
Nodes (14): buildLevel(), detectLiquidityLevels(), isDownFractal(), isUpFractal(), Candle, detectOrderBlocks(), HTF_FOREX_LABELS, HTF_FOREX_MIN_GAP_PIPS (+6 more)

### Community 38 - "priceChartHitTest.test.js"
Cohesion: 0.12
Nodes (19): findClickedDivergence(), findClickedFibLevel(), findClickedLiquidityLevel(), findClickedOBZone(), findClickedSetup(), findClickedTarget(), getCurrentFibLevels(), DIVERGENCE_CLICK_TOLERANCE_PX (+11 more)

### Community 39 - "TradeSetupCockpit.vue"
Cohesion: 0.09
Nodes (23): emit, accentStyle, antiConfluences, canTransfer, confirmationLabel(), confirmations, confluences, dateLabel (+15 more)

### Community 40 - "initMarketStructureState"
Cohesion: 0.14
Nodes (13): initMarketStructureState(), baseState(), candles, levelRealBreak, levelSweep, levelUntouched, origin, triggerPivot (+5 more)

### Community 41 - "supabaseClient.js"
Cohesion: 0.23
Nodes (7): fetchDailyStructurePivots(), fetchLiquidityLevelsHtf(), fetchObZones(), supabase, { data: dbDailyPivots }, { data: dbLiquidityLevelsHtf }, { data: dbObZones }

### Community 42 - "orderBlocks.js"
Cohesion: 0.08
Nodes (13): drawIconLabel(), canShowLabels(), MIN_PIXELS_PER_HOUR_FOR_LABELS, MIN_PIXELS_PER_HOUR_FOR_LABELS_INTRADAY, LiquidityLineRenderer, OB_ZONE_KEYS, OrderBlockPrimitive, positionsBox() (+5 more)

### Community 43 - "useClaudeAnnotations.js"
Cohesion: 0.09
Nodes (29): addClaudeAnnotationDrawing(), fetchClaudeAnnotations(), removeClaudeAnnotationDrawing(), setClaudeAnnotationDrawingVisible(), applyText(), emit, error, { instrument, dateStr, drawings, loading, add, remove, setDrawingVisible } (+21 more)

### Community 44 - "trading-monitor-mcp/marketStructureAnalysis.ts"
Cohesion: 0.07
Nodes (54): buildLevel(), detectLiquidityLevels(), isDownFractal(), isUpFractal(), LIQUIDITY_FRACTAL_PERIOD, LiquidityLevel, advanceNestedTrend(), advanceNestedTrendInner() (+46 more)

### Community 45 - "priceChartConstants.js"
Cohesion: 0.07
Nodes (34): usePriceChartTradeSetups(), fetchM5Candles(), fetchTrendAnalysisM5History(), getTrendAnalysisM5Candles(), CALLOUT_STACK_GAP_PX, CLOSE_POLL_BUFFER_MS, COPIED_FEEDBACK_MS, DEBUG_AUTOSAVE_INTERVAL_MS (+26 more)

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
Cohesion: 0.16
Nodes (15): Candle, fetchLiveForexCandles(), fetchLiveForexCandlesOnce(), isRetryable(), ALL_BARS, backfillOne(), Bar, BARS (+7 more)

### Community 52 - "liquidity.js"
Cohesion: 0.11
Nodes (31): candidateLabel(), emit, precision, props, refresh(), formatLiquidityLevelLabel(), levelOptions(), LIQUIDITY_STYLE_KEYS (+23 more)

### Community 53 - "gbp_h1_uptrend.ts"
Cohesion: 0.10
Nodes (20): pivot1, pivot10, pivot11, pivot12, pivot13, pivot2, pivot3, pivot4 (+12 more)

### Community 54 - "tradeSetupCockpit.ts"
Cohesion: 0.11
Nodes (19): Plan: find_targets Algorithmus, TSC-Neuaufbau Precondition, trendChainDisplay, RangeTrend, ANTI_CONFLUENCE_COLOR, AntiConfluence, CockpitState, computeAntiConfluences() (+11 more)

### Community 55 - "DR-Reichweite — Grundmessung + Filter-Auswertungen"
Cohesion: 0.09
Nodes (22): 1. Handelszeit — größter Effekt, größte Stichprobe, 2. Gegenkraft — Paarvergleich nach Sweep-Stärke, 3. HTF-Sweep, 4. Sweep-Alter — höchster Median, kleinste Stichprobe, Basis, Das Angebot stimmt, Datenquellen (vor dem Lauf ziehen), Definitionen (+14 more)

### Community 56 - "src/marketStructureAnalysis.ts"
Cohesion: 0.29
Nodes (16): advanceNestedTrend(), applyInnerMarketStructurePivotCore(), applyMarketStructurePivotCore(), buildMarketStructureState(), closesAboveOldHigh(), closesBelowLevel(), evaluateConfirmingBreak(), invalidateDowntrend() (+8 more)

### Community 57 - "machineState.ts"
Cohesion: 0.14
Nodes (34): berlinDayRangeUtcMs(), getNewsEvents(), getTradingSchedule(), deriveStepAndCase(), LoadedMachine, loadMachineForDay(), loadMachineForDayOrNull(), loadOrCreateMachineForDay() (+26 more)

### Community 58 - "pinEntryVisible"
Cohesion: 0.14
Nodes (18): liquidityLevelEntryNaturalKey(), m5LiquidityEntryNaturalKey(), obZoneEntryNaturalKey(), hoveredPinLiquidityLevelKey, hoveredPinObZoneKey, onSelectPin(), pinEntryVisible(), pinJumpHint (+10 more)

### Community 59 - "cssColor"
Cohesion: 0.09
Nodes (38): AgeTier, classifyAge(), MAJOR_MIN_SECONDS, MINOR_MAX_SECONDS, cssColor(), cssColorScaled(), hexToRgba(), tradesVisibleForCandles() (+30 more)

### Community 60 - "format.js"
Cohesion: 0.08
Nodes (23): candidateLabel(), candidatePrice(), emit, mergedCandidates, precision, props, emit, OUTCOME_LABEL (+15 more)

### Community 61 - "tradeSetup.js"
Cohesion: 0.14
Nodes (16): Two Runtimes, One Algorithm Set (Deliberate Duplication), computeTradeSetups(), closesBeyondLevel(), detectSetupObs(), detectTradeSetups(), findAllProtectedFractals(), findBestLsMatch(), findFirstSetupObAfter() (+8 more)

### Community 62 - "pivotMarkers.ts"
Cohesion: 0.14
Nodes (6): Candle, PivotMarkerGroup, PivotMarkerPaneView, PivotMarkerPrimitive, PivotMarkerRenderer, RenderOptions

### Community 63 - "poi-watcher/index.ts"
Cohesion: 0.13
Nodes (13): fmt(), InstrumentConfig, INSTRUMENTS, isInWindows(), LiquidityLevelRow, localMinutesAndWeekday(), ObZoneRow, PinAlarmRow (+5 more)

### Community 64 - "State Machine for Lana's Trading Flow"
Cohesion: 0.14
Nodes (18): Trading-Steps-Ablauf Diagram, Fall 4 -> Zurück zu Schritt 3, Two Permanent LLM-Only Steps (3 and 6), News-Pause Doesn't Replace the Cron, State Machine for Lana's Trading Flow, get_tsc_range Deliberately Not a Graph Node, Problem: GBPUSD 28.08.2026 Fall-4 Deviation Incident, trading-runs/*.md Loses Purpose (+10 more)

### Community 65 - "compilerOptions"
Cohesion: 0.12
Nodes (16): src/marketStructureAnalysis.ts, src/marketStructureRendering.ts, src/pivotMarkers.ts, test/tdd_mit_claude/ranges/tdd_mit_claude.ts, compilerOptions, allowJs, checkJs, esModuleInterop (+8 more)

### Community 66 - "chartTimeUtils.js"
Cohesion: 0.10
Nodes (17): ageReferenceTime(), businessSecondsBetween(), computeNextReplayTime(), formatAge(), mergeRecent(), nextCandleAfter(), replayFetchToMs(), snapToBarTime() (+9 more)

### Community 67 - "claudeAnnotations.js"
Cohesion: 0.09
Nodes (15): ANNOTATION_COLOR, annotationAnchorPoint(), AnnotationsPaneView, AnnotationsPrimitive, AnnotationsRenderer, parseAnnotations(), renderClaudeAnnotations(), resolveLabelPlacements() (+7 more)

### Community 68 - "backfillTradeSetups.ts"
Cohesion: 0.21
Nodes (8): ArchivableCandle, readForexCandlesArchiveFrom(), alarmFenster, Candle, [fensterVon, fensterBis], instrumente, iso(), ladeKerzen()

### Community 69 - "AGENTS.md"
Cohesion: 0.14
Nodes (12): Architecture, Commands, Conventions, Forex candle data: cTrader Open API, not Twelve Data, Frontend data flow (`PriceChart.vue`), Gotchas, graphify, "Laniakea" persona (`/l`) (+4 more)

### Community 70 - "Trading-Monitor Project Overview (CLAUDE.md)"
Cohesion: 0.15
Nodes (12): cTrader ACCESS_DENIED Lockout (No Auto-Recovery), DRY Within a Single Runtime Convention, CLAUDE.md Pointer to /l Persona, npm run build Command, Trading-Monitor Project Overview (CLAUDE.md), Rename Consistency Convention, REPLAY_LOOKAHEAD_SEC M1 Scaling Gotcha, ctrader_oauth_tokens Table (+4 more)

### Community 71 - "biasEngine.ts"
Cohesion: 0.33
Nodes (6): buildPendingDecisions(), findIntermediateLevel(), FindIntermediateLevelArgs, IntermediateLevelCandidate, isSpreadHourPivot(), PendingDecision

### Community 72 - "daily-structure-pivots/index.ts"
Cohesion: 0.18
Nodes (11): CORS_HEADERS, ExistingPivotRow, INSTRUMENTS, CORS_HEADERS, PERIOD_MAP, PERSISTABLE_BARS, persistIfArchivable(), RefreshedTokens (+3 more)

### Community 73 - "applyInnerMarketStructurePivot"
Cohesion: 0.25
Nodes (6): advanceNestedTrendInner(), applyInnerMarketStructurePivot(), confirmBreak, originHigh, originLow, pullback

### Community 74 - "clearArmStatesExcept"
Cohesion: 0.18
Nodes (12): clearArmStatesExcept(), onAddAntiConfluenceRequest(), onAddConfirmationRequest(), onAddConfluenceRequest(), onAddRangeAntiConfluenceRequest(), onAddRangeConfirmationRequest(), onAddRangeConfluenceRequest(), onSetInvalidationRequest() (+4 more)

### Community 75 - "forexCandles.js"
Cohesion: 0.27
Nodes (13): DB_ARCHIVED_BARS, fetchArchivedPage(), fetchArchivedUpTo(), fetchCandles(), fetchCandlesBatchOnce(), fetchCandlesOnce(), fetchOlderCandles(), fetchOlderCandlesFromDb() (+5 more)

### Community 76 - "SessionBandPaneView"
Cohesion: 0.14
Nodes (3): SessionBandPaneView, SessionBandPrimitive, SessionBandRenderer

### Community 77 - "TradingFlow.vue"
Cohesion: 0.11
Nodes (20): buildMermaidSource(), EDGES, getNextActionHint(), mermaidEscape(), NODES, activeByInstrument, berlinTimeFormatter, currentLoop (+12 more)

### Community 78 - "marketStructureAnalysisFib.test.js"
Cohesion: 0.29
Nodes (6): RANGE_FIB_MIN_PP_DISTANCE_PIPS, confirmBreak, confirmedUptrendState(), originHigh, originLow, pullback

### Community 79 - "Fachdoku-Router Skill"
Cohesion: 0.15
Nodes (13): poi-watcher UTC Refresh-Tick Exception, Trading-Hours/Timezone Handling (Europe/Berlin), sessions Table, trading_schedules Table, docs/debug-metadata-panel.md, Fachdoku-Router Skill, src/marketStructureAnalysis.notes.md, docs/mcp-server.md (+5 more)

### Community 80 - "clipReplay"
Cohesion: 0.18
Nodes (23): buildActiveMetadataSnapshotInternal(), clearTradeSetupFocus(), clipReplay(), computeTradeSetupsInternal(), focusTradeSetup(), loadInitial(), loadTradeSetupM5(), refreshChart() (+15 more)

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
Cohesion: 0.18
Nodes (16): LiquidityLevel, closesBeyondLevel(), DEFAULT_TRADE_SETUP_PARAMS, DetectedTradeSetup, detectTradeSetup(), findBestLsMatch(), findFirstSetupObAfter(), findImmediateLsSetup() (+8 more)

### Community 92 - "annotations.ts"
Cohesion: 0.38
Nodes (6): postChartAnnotations(), ANNOTATION_SCHEMA, DRAWING_GROUP_SCHEMA, registerAnnotationTools(), VALID_TYPES, validateAnnotations()

### Community 93 - "evidenceScoring.ts"
Cohesion: 0.40
Nodes (4): computeEvidenceScore(), EvidenceScoreBreakdownEntry, EvidenceScoreInput, EvidenceScoreResult

### Community 94 - "MCP-Server: Tiefere Referenz"
Cohesion: 0.20
Nodes (10): MCP Auth & Table Permissions, Backfill Scripts, Candle Archive (forex_candles), MCP Server Deployment (Supabase Edge Function), MCP-Server: Tiefere Referenz, get_forex_rsi / get_forex_ema Tools, Single Deno Copy (Dual-Copy Removed), Trade-Journal Write Tools (tools/trades.ts) (+2 more)

### Community 95 - "usePriceChartLiquidity"
Cohesion: 0.40
Nodes (3): openAntiConfluencePicker(), usePriceChartLiquidity(), getCurrentLiquidityLevels()

### Community 96 - "Plan: Trade-Journal Konfluenzen & Kontext"
Cohesion: 0.50
Nodes (4): Anti-Confluences Snapshot Feature (Planned), Plan: Trade-Journal Konfluenzen & Kontext, Session-Kontext Feature (Planned), Trend-Kontext Feature (Planned)

### Community 97 - "drMerkmale.py"
Cohesion: 0.07
Nodes (38): lauf(), -> 'win' | 'loss' | 'offen', beides gemessen ab der nahen OB-Kante., handelsstunden(), lade_bekannte_level(), lade_kerzen(), lade_setups(), lade_trend(), merkmale() (+30 more)

### Community 98 - "NewsModal.vue"
Cohesion: 0.18
Nodes (11): CURRENCIES, emit, LIST_FORMATTER, newCurrency, newDateTime, newTitle, saving, submit() (+3 more)

### Community 99 - "trade_evidence Table (Dual-Level, Confirmation/Confluence)"
Cohesion: 0.28
Nodes (9): dealing_ranges Table, trade_evidence Table (Dual-Level, Confirmation/Confluence), trade_partial_exits Table, trade_positions Table, trade_targets Table, Confirmation/Confluence/Anti-Confluence Categories, trading repo trade-from-poi.md (Confirmation/Confluence/Anti-Confluence Definition), Bestätigungen (Sweeps & OBs) Feature (+1 more)

### Community 100 - "MetadataPanel.vue"
Cohesion: 0.24
Nodes (10): emit, height, left, onDrag(), panelEl, props, startDrag(), stopDrag() (+2 more)

### Community 101 - "findAntiConfluenceCandidates.js"
Cohesion: 0.40
Nodes (10): byDistance(), findAntiConfluenceCandidates(), findAntiConfluenceDivergenceCandidates(), findAntiConfluenceObCandidates(), findAntiConfluenceSweepCandidates(), findInvalidationObCandidates(), inBand(), MAX_HELD_OB_AGE_DAYS (+2 more)

### Community 102 - "/task do Mode"
Cohesion: 0.38
Nodes (7): Laniakea milk-city Task-Status Rule, /task Default Data-Maintenance Mode, /task do Mode, /task new Mode, /task refine Mode, /task Command Router, milk-city Task Status Convention

### Community 104 - "newsEvents.js"
Cohesion: 0.24
Nodes (11): usePriceChartCockpit(), refreshCockpit(), usePriceChartSessionsAndNews(), refreshNewsMarkers(), refreshSessions(), currentNewsNoGo(), INSTRUMENT_CURRENCIES, NEWS_NOGO_WINDOW_MINUTES (+3 more)

### Community 106 - "Lana-Fehlerdiagnose"
Cohesion: 0.33
Nodes (5): Ablauf, Ergebnis, Lana-Fehlerdiagnose, Routing: Diagnose → typischer Fix-Ort, Wann aufrufen

### Community 107 - "Agent Skills Pro Notes"
Cohesion: 0.29
Nodes (7): allowed-tools Skill Config, Context-free Scripts in Skills, Agent Skills Pro Notes, Progressive Disclosure in Skills, Skill Sharing & Troubleshooting, Skills Embedded in Subagents, Skills vs CLAUDE.md vs Hooks vs Subagents

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
Cohesion: 0.13
Nodes (23): cachedCandlesUpTo(), cacheKey(), fetchCandlesCached(), getCachedCandles(), mergeCandles(), openDb(), safeCompleteUpTo(), setCachedCandles() (+15 more)

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
Cohesion: 0.06
Nodes (64): filterRelevantLevels(), LIQUIDITY_MAX_RELEVANT, berlinOffsetMinutes(), dropLowerTfDuplicates(), fetchAllRows(), filterRelevantRows(), getLatestDailyStructureStartTime(), getLiquidityLevels() (+56 more)

### Community 132 - "src/pipConfig.js"
Cohesion: 0.10
Nodes (24): HTF_FOREX_MIN_GAP_PIPS Constant, LOWER_TF_MIN_GAP_PIPS Constant, Pip-/Pixel-Schwellwerte Übersicht, MAX_TARGET_DISTANCE_PIPS Constant, MIN_PIXELS_PER_HOUR_FOR_LABELS Constants, PIP_SIZE Constant, RANGE_FIB_MIN_PP_DISTANCE_PIPS Constant, TRADE_SETUP_LS_MAX_DISTANCE_M5 Constant (+16 more)

### Community 133 - "marketStructureAnalysisInnerPivots.test.js"
Cohesion: 0.25
Nodes (7): h1Candles, p2Pivot3, p2Pivot4, p2Pivot5, pivot1, pivot2, pivot3

### Community 134 - "usePriceChartMarketStructure"
Cohesion: 0.29
Nodes (5): usePriceChartMarketStructure(), computeRangesPivotsAndMetadata(), computeRangesPivotsFor(), fetchRangesCandles(), BASE_CTX

### Community 135 - "Dealing Range anlegen"
Cohesion: 0.50
Nodes (3): Ablauf, Dealing Range anlegen, Warum ein eigener Skill (nicht nur eine Doku-Zeile)

### Community 136 - ".codex/hooks/lana-git-pull.cjs"
Cohesion: 0.50
Nodes (3): { execFileSync }, path, TRADING_REPO

### Community 138 - "tradingSchedules.js"
Cohesion: 0.19
Nodes (12): minutesToTimeInput(), timeInputToMinutes(), addWindow(), cloneWindows(), DEFAULT_SCHEDULES, EMPTY_WINDOWS, loadInitial(), removeWindow() (+4 more)

### Community 139 - "alarmLog.js"
Cohesion: 0.29
Nodes (7): fetchAlarmLog(), fetchTouchedLiquidityLevels(), fetchTradeSetups(), fetchTouchedZones(), currentSymbol, { data: rows, refresh }, SYMBOLS

### Community 143 - "JsonTree.vue"
Cohesion: 0.25
Nodes (5): entries, expanded, isArray, isObject, props

### Community 144 - "PinPanel.vue"
Cohesion: 0.32
Nodes (7): emit, noteSaveTimers, onEntryClick(), onNoteInput(), OUTCOME_LABEL, props, rows

### Community 146 - "usePolledFetch.js"
Cohesion: 0.43
Nodes (5): usePolledFetch(), load(), lastSuccessAt, useStatusBar(), markSuccess()

### Community 147 - "computeTrendChain"
Cohesion: 0.29
Nodes (6): trendChain, trendAlignment, ANTI_CONFLUENCE_THRESHOLD, computeTrendAlignment(), computeTrendChain(), trendOriginPivotTime()

## Ambiguous Edges - Review These
- `Trading-Steps-Ablauf Diagram` → `calc_rr Tool Idea (Deterministic RR Calc)`  [AMBIGUOUS]
  docs/steerabilty-vs-wrong-ai-outputs.md · relation: references

## Knowledge Gaps
- **1124 isolated node(s):** `Datenquellen (vor dem Lauf ziehen)`, `Definitionen`, `Skripte`, `Basis`, `1. Handelszeit — größter Effekt, größte Stichprobe` (+1119 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1369 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Trading-Steps-Ablauf Diagram` and `calc_rr Tool Idea (Deterministic RR Calc)`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **Why does `businessSecondsBetween()` connect `biasCheck.ts` to `cssColor`, `dealingRangeLoop.ts`, `dataExport.ts`?**
  _High betweenness centrality (0.087) - this node is a cross-community bridge._
- **Why does `businessSecondsBetween()` connect `chartTimeUtils.js` to `PriceChart.vue`, `computeTrendChain`, `liquidity.js`, `tradeSetupCockpit.ts`, `cssColor`?**
  _High betweenness centrality (0.073) - this node is a cross-community bridge._
- **Why does `classifyAge()` connect `cssColor` to `chartTimeUtils.js`, `PriceChart.vue`, `liquidity.js`?**
  _High betweenness centrality (0.055) - this node is a cross-community bridge._
- **What connects `Datenquellen (vor dem Lauf ziehen)`, `Definitionen`, `Skripte` to the rest of the system?**
  _1124 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Dashboard.vue` be split into smaller, more focused modules?**
  _Cohesion score 0.015867978419549348 - nodes in this community are weakly interconnected._
- **Should `gbp_h1_uptrend_uptrend_break_of_structure_und_trendumkehr.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0196078431372549 - nodes in this community are weakly interconnected._