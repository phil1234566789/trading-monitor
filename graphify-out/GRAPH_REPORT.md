# Graph Report - trading-monitor  (2026-09-22)

## Corpus Check
- 540 files · ~555,710 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 3228 nodes · 6567 edges · 173 communities (148 shown, 17 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 115 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e0d8da34`
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
- trading-monitor-mcp/index.ts
- usePriceChartRsi.js
- tradeSetup.js
- rsiDivergenceStats.ts
- DataExportModal.vue
- backfillTradeSetups.ts
- DR-Reichweite — was taugen die erkannten Setups?
- dealingRangeLoop.ts
- TradeEditModal.vue
- package.json
- src/sessionOccurrences.js
- LoopStatus.vue
- db.ts
- Dealing-Range-Anlegen Skill
- daily-structure-pivots/index.ts
- newsMarkers.js
- lineWidth
- ctrader/client.ts
- pricePrecisionForInstrument
- tradeIntake.js
- trades.js
- orderBlocks.js
- Plan: POI-Strategie-Findung, Backtesting & Trade-Notifications
- src/orderBlockDetection.js
- sessions.js
- gbp_h1_uptrend_protected_low_gebrochen.ts
- tradingAccounts.js
- tradeSetups.js
- dataExport.js
- tdd_mit_claude.ts
- tradeSetupCockpit.ts
- priceChartHitTest.test.js
- TradeSetupCockpit.vue
- MetadataPanel.vue
- priceChartObZones.js
- supabaseClient.js
- useClaudeAnnotations.js
- trading-monitor-mcp/marketStructureAnalysis.ts
- priceChartConstants.js
- marketStructureAnalysis Rules Overview
- Laniakea Persona Command (/l)
- Plan: Sehr Große Dateien Refactoren (PriceChart.vue)
- fachdoku-router/SKILL.md
- pinContext.js
- LiquidityLineRenderer
- dataSnapshot.ts
- gbp_h1_uptrend.ts
- usePriceChartRsi
- PLAN: DR-Statistik in der UI anzeigen
- src/marketStructureAnalysis.ts
- chartColors.js
- pinEntryVisible
- DivergenceLinePrimitive
- trading-monitor-mcp/pretradeGates.ts
- usePriceChartLiquidity.js
- backfillLiquidityLevels.ts
- poi-watcher/index.ts
- State Machine for Lana's Trading Flow
- compilerOptions
- dailyPivotMarkers.js
- claudeAnnotations.js
- cssColor
- AGENTS.md
- Trading-Monitor Project Overview (CLAUDE.md)
- rScaleRendering.js
- tradeSetup.ts
- closed_rows
- Journal GBPUSD — Sicherung vor dem Quellenwechsel
- FibTickPrimitive
- SessionBandPaneView
- TradingFlow.vue
- applyMarketStructurePivot
- debugMetadata.js
- findAntiConfluenceCandidates.js
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
- Plan: Forex-Chart-Objekte Datengrundlage
- marketStructureAnalysisNestedNestedChoch.test.js
- dataExport.ts
- MCP-Server: Tiefere Referenz
- usePriceChartTradeSetupDrawing.js
- barSecondsFor
- drMerkmale.py
- NewsModal.vue
- trade_evidence Table (Dual-Level, Confirmation/Confluence)
- messeFxcmKontext.ts
- useM5CandleClock
- /task do Mode
- hole_alle
- findAntiConfluences.js
- marketStructureRendering.ts
- Lana-Fehlerdiagnose
- Agent Skills Pro Notes
- marketStructureAnalysisDowntrend.test.js
- fetch-trend-fixture.mjs
- ContextMenu.vue
- ctraderCandles.js
- Aufmerksamkeits-Level (Watch-Level-Strategie Schritt 5+)
- Debug-Metadata-Panel Notes
- AI Failure as Property Collision
- MCP Advanced Topics Notes
- newsEvents.js
- vite.config.js
- lana-git-pull.cjs
- forexCandles.js
- .mcp.json
- jumpToTimeRange
- marketStructureAnalysis.test.js
- trading-monitor index.html Entry
- Protokoll.vue
- Handbuch-Check
- trendIndicator.gbpusd-downtrend.test.js
- Claude Code Hooks Documentation Pointers
- mcp-server/src/scripts/backfillObZones.ts
- liquidity.js
- findTargets.js
- marketStructureAnalysisInnerPivots.test.js
- tradeSetup.test.js
- Dealing Range anlegen
- .codex/hooks/lana-git-pull.cjs
- source-command-l
- tradingSchedules.js
- tradeEvidence.ts
- refreshTscRange
- usePriceChartMarketStructure
- fxcmCandles.ts
- orderBlocks.ts
- M5CandleClock.vue
- supabaseRowCapGuard.test.js
- marketStructureAnalysisLqSweep.test.js
- Entschiedene Design-Fragen
- RangeLinePaneView
- ZoneRenderer
- cTrader Open API as Forex Candle Source
- validate.js
- PinPanel.vue
- LiquidityLinePrimitive
- liquidity.ts
- ArrowPaneView
- marketStructureAnalysisDowntrendChoch.test.js
- forbiddenSession.test.js
- Plan: Trade-Journal Konfluenzen & Kontext
- applyInnerMarketStructurePivot
- fetchAllRows.ts
- Die Filter
- test_saisonalitaet.py
- computeTrendChain
- trendChainLevelDisplay
- fxcmRefresh.js
- Woher die 1314 kommen

## God Nodes (most connected - your core abstractions)
1. `berlinDateStrFor()` - 46 edges
2. `cssColor()` - 36 edges
3. `pricePrecisionForInstrument()` - 34 edges
4. `berlinDateTimeStrFor()` - 33 edges
5. `fmtPrice()` - 32 edges
6. `fetchForexCandles()` - 31 edges
7. `json()` - 30 edges
8. `clipReplay()` - 27 edges
9. `lineWidth()` - 26 edges
10. `logDecision()` - 25 edges

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

## Communities (173 total, 17 thin omitted)

### Community 0 - "Dashboard.vue"
Cohesion: 0.02
Nodes (141): useSessionStorageRef(), useTabScopedRef(), rsiDivergenceEntryNaturalKey(), addPositionToDealingRange(), antiConfluenceAddTrade, anyArmStateActive, ARM_STATES, clearArmStatesExcept() (+133 more)

### Community 1 - "gbp_h1_uptrend_uptrend_break_of_structure_und_trendumkehr.ts"
Cohesion: 0.02
Nodes (101): candlesAroundBOS, candlesAroundBreak, p2Pivot1, p2Pivot10, p2Pivot11, p2Pivot12, p2Pivot13, p2Pivot14 (+93 more)

### Community 2 - "candleCache.js"
Cohesion: 0.19
Nodes (14): cachedCandlesUpTo(), cacheKey(), fetchCandlesCached(), getCachedCandles(), mergeCandles(), openDb(), safeCompleteUpTo(), setCachedCandles() (+6 more)

### Community 3 - "clipReplay"
Cohesion: 0.12
Nodes (34): cssColorScaled(), hexToRgba(), tradesVisibleForCandles(), buildActiveMetadataSnapshotInternal(), clearTradeSetupFocus(), clipReplay(), computeTradeSetupsInternal(), focusTradeSetup() (+26 more)

### Community 4 - "PriceChart.vue"
Cohesion: 0.03
Nodes (81): mergeRecent(), replayFetchToMs(), activeMetadataSnapshot, allCandles, antiConfluencePickerCurrentPrice, antiConfluencePickerDivergenceCandidates, antiConfluencePickerHoveredLiquidityKey, antiConfluencePickerHoveredObKey (+73 more)

### Community 5 - "gbp_h1_uptrend_mit_LQ_sweep_LONG_SETUP.ts"
Cohesion: 0.03
Nodes (60): p2Pivot1, p2Pivot10, p2Pivot11, p2Pivot12, p2Pivot13, p2Pivot14, p2Pivot15, p2Pivot16 (+52 more)

### Community 6 - "gbp_h1_uptrend_mit_inner_structure.ts"
Cohesion: 0.04
Nodes (55): p2Pivot1, p2Pivot10, p2Pivot11, p2Pivot12, p2Pivot13, p2Pivot14, p2Pivot15, p2Pivot16 (+47 more)

### Community 7 - "trading-monitor-mcp/index.ts"
Cohesion: 0.07
Nodes (43): berlinOffsetMinutes(), DATE_FORMATTER, OFFSET_FORMATTER, TIME_FORMATTER, toPips(), deleteDealingRange(), postChartAnnotations(), buildServer() (+35 more)

### Community 8 - "usePriceChartRsi.js"
Cohesion: 0.17
Nodes (20): refreshDivergence(), buildDivergenceEntry(), collectDivergenceHistory(), computeRsi(), DEFAULT_DIVERGENCE_FRACTAL_PERIOD, DEFAULT_DIVERGENCE_HISTORY_COUNT, DEFAULT_DIVERGENCE_LOOKBACK_BARS, DEFAULT_RSI_PERIOD (+12 more)

### Community 9 - "tradeSetup.js"
Cohesion: 0.18
Nodes (18): Two Runtimes, One Algorithm Set (Deliberate Duplication), computeTradeSetups(), closesBeyondLevel(), collectObSweeps(), detectSetupObs(), detectTradeSetups(), findAllProtectedFractals(), findBestLsMatch() (+10 more)

### Community 10 - "rsiDivergenceStats.ts"
Cohesion: 0.09
Nodes (38): buildDivergenceEntry(), collectDivergenceHistory(), computeRsi(), DEFAULT_DIVERGENCE_FRACTAL_PERIOD, DEFAULT_DIVERGENCE_HISTORY_COUNT, DEFAULT_DIVERGENCE_LOOKBACK_BARS, DEFAULT_RSI_PERIOD, detectRsiDivergence() (+30 more)

### Community 11 - "DataExportModal.vue"
Cohesion: 0.07
Nodes (27): asset, copied, copyResult(), currentSymbol, dateStr, error, generate(), loading (+19 more)

### Community 12 - "backfillTradeSetups.ts"
Cohesion: 0.15
Nodes (12): readForexCandlesArchiveFrom(), LiquidityLevel, DEFAULT_TRADE_SETUP_PARAMS, TRADE_SETUP_H1_FRACTAL_PERIOD, persistTradeSetupSweeps(), alarmFenster, Candle, [fensterVon, fensterBis] (+4 more)

### Community 13 - "DR-Reichweite — was taugen die erkannten Setups?"
Cohesion: 0.17
Nodes (12): Aktueller FXCM-Stand: 2025 und 2026, Definitionen, DR-Reichweite — was taugen die erkannten Setups?, Enge der DR — warum beide Einheiten nötig sind, find_targets, Grenzen, Historische Befunde vor dem FXCM-Wechsel, Leitkennzahl: Trefferquote, nicht Median (+4 more)

### Community 14 - "dealingRangeLoop.ts"
Cohesion: 0.07
Nodes (79): berlinDateStrFor(), berlinDateTimeStrFor(), computeHtfWatchLevels(), computeWatchLevels(), hasReaction(), isDrTrackingBusy(), ForceLiquidityInput, ForceObInput (+71 more)

### Community 15 - "TradeEditModal.vue"
Cohesion: 0.06
Nodes (43): commission, confirmationLabel(), emit, entryPrice, entryTimeInput, exitPrice, exitTimeInput, instrumentMismatch (+35 more)

### Community 16 - "package.json"
Cohesion: 0.06
Nodes (33): lightweight-charts, mermaid, dependencies, lightweight-charts, mermaid, @supabase/supabase-js, vue, vue-router (+25 more)

### Community 17 - "src/sessionOccurrences.js"
Cohesion: 0.24
Nodes (12): createSessionBonusResolver(), ALL_DAYS, attachRangeExtremes(), bonusLabelForPivot(), buildSessionContextLookup(), contextForPivot(), daysOrAll(), localMidnightUtc() (+4 more)

### Community 18 - "LoopStatus.vue"
Cohesion: 0.07
Nodes (24): fetchLoopStateHistory(), fetchLoopStatesForDate(), LOOP_INSTRUMENTS, rowToLoopState(), fetchStateMachineLog(), rowToDecision(), activeByInstrument, { data, refresh } (+16 more)

### Community 19 - "db.ts"
Cohesion: 0.06
Nodes (59): addPinEntry(), addPinM5LiquidityEntry(), addPinM5ObEntry(), addPinRsiDivergenceEntry(), addTradeConfirmation(), AddTradeConfirmationArgs, addTradePosition(), addTradeTarget() (+51 more)

### Community 20 - "Dealing-Range-Anlegen Skill"
Cohesion: 0.14
Nodes (15): kind=pivot = Liquidity-Sweep-Only Semantics, Dealing-Range-Anlegen Skill, milk-city Task: Confluence-Tracking bei Dealing Ranges, trading/liquidität.md (Liquiditäts-Sweep-Mechanismus), AI Capabilities Framework (Next Token Prediction/Knowledge/Working Memory/Steerability), Diagnose-to-Fix Routing Table, Lana-Fehlerdiagnose Skill, docs/steerabilty-vs-wrong-ai-outputs.md (+7 more)

### Community 21 - "daily-structure-pivots/index.ts"
Cohesion: 0.24
Nodes (6): CORS_HEADERS, ExistingPivotRow, INSTRUMENTS, Candle, DailyPivotLike, resolveStructureStartTime()

### Community 22 - "newsMarkers.js"
Cohesion: 0.11
Nodes (13): usePriceChartSessionsAndNews(), refreshNewsMarkers(), refreshSessions(), DAY_KEY_FORMATTER, extrapolatedX(), formatEventLabel(), isSameBerlinDay(), NewsMarkerPaneView (+5 more)

### Community 23 - "lineWidth"
Cohesion: 0.13
Nodes (11): lineWidth(), drawEntryPoint(), drawExitPoint(), drawHaloRing(), drawLabel(), drawTick(), renderTradeMarkers(), TradeMarkerPaneView (+3 more)

### Community 24 - "ctrader/client.ts"
Cohesion: 0.11
Nodes (26): CORS_HEADERS, authAccount(), authenticate(), cachedSymbolIds, Candle, concat(), connectWithTimeout(), CTraderConnection (+18 more)

### Community 25 - "pricePrecisionForInstrument"
Cohesion: 0.08
Nodes (28): candidateLabel(), candidatePrice(), emit, mergedCandidates, precision, props, emit, OUTCOME_LABEL (+20 more)

### Community 26 - "tradeIntake.js"
Cohesion: 0.13
Nodes (30): direction, emit, entryPrice, errorMsg, levels, precision, props, reasoning (+22 more)

### Community 27 - "trades.js"
Cohesion: 0.16
Nodes (16): pnlClass, props, stats, winrateClass, fmtR(), computeTradeStats(), fetchActiveTscRangeId(), fetchDealingRangeCockpit() (+8 more)

### Community 28 - "orderBlocks.js"
Cohesion: 0.18
Nodes (7): drawIconLabel(), canShowLabels(), MIN_PIXELS_PER_HOUR_FOR_LABELS, MIN_PIXELS_PER_HOUR_FOR_LABELS_INTRADAY, OB_ZONE_KEYS, positionsBox(), mergePinnedDivergences()

### Community 29 - "Plan: POI-Strategie-Findung, Backtesting & Trade-Notifications"
Cohesion: 0.19
Nodes (13): daily_structure_pivots Table, forex_candles Table, get_forex_candles_archive MCP Tool, BTC-USDT/OKX Complete Removal (2026-08-21), 1D-Periode-4-Pivot Market-Structure Startpoint (2026-08-30), Persisted Forex Candle Archive (forex_candles Pilot), Kronos LLM Forecast Entry-Filter Experiment (Shelved), Plan: POI-Strategie-Findung, Backtesting & Trade-Notifications (+5 more)

### Community 30 - "src/orderBlockDetection.js"
Cohesion: 0.16
Nodes (14): HTF_FOREX_MIN_GAP_PIPS Constant, LOWER_TF_MIN_GAP_PIPS Constant, Pip-/Pixel-Schwellwerte Übersicht, MIN_PIXELS_PER_HOUR_FOR_LABELS Constants, PIP_SIZE Constant, RANGE_FIB_MIN_PP_DISTANCE_PIPS Constant, TRADE_SETUP_LS_MAX_DISTANCE_M5 Constant, poi-watcher 4H+1H OB-Zonen-Wächter Edge Function (+6 more)

### Community 31 - "sessions.js"
Cohesion: 0.12
Nodes (18): minutesToTimeInput(), timeInputToMinutes(), emit, instrumentSessions, props, WEEKDAY_DISPLAY_ORDER, addSession(), currentSessionDanger() (+10 more)

### Community 32 - "gbp_h1_uptrend_protected_low_gebrochen.ts"
Cohesion: 0.08
Nodes (25): ClosedRange, MarketStructureState, PivotBase, PivotHigh, PivotLow, PivotTouched, PivotTypeAll, PivotUntouched (+17 more)

### Community 33 - "tradingAccounts.js"
Cohesion: 0.13
Nodes (17): currentLabel, open, selectedAccount, wrapperRef, accounts, accountsLoaded, ALL_ACCOUNTS_ID, createAccount() (+9 more)

### Community 34 - "tradeSetups.js"
Cohesion: 0.26
Nodes (10): fetchTradeSetupForCockpit(), fetchTradeSetups(), sweepLevel(), toSec(), tradeSetupFromRow(), { data: dbTradeSetups, refresh: refreshDbTradeSetups }, onIsolateTrade(), onSelectTrade() (+2 more)

### Community 35 - "dataExport.js"
Cohesion: 0.16
Nodes (23): marketStructureTree, berlinDayRangeUtcMs(), berlinOffsetMinutes(), buildDataExport(), compute1hStructureState(), computeExportTimeframeData(), computeLiquidityLevelsForExport(), computeObZonesForExport() (+15 more)

### Community 36 - "tdd_mit_claude.ts"
Cohesion: 0.08
Nodes (24): nextPivot1, nextPivot10, nextPivot11, nextPivot2, nextPivot3, nextPivot4, nextPivot5, nextPivot6 (+16 more)

### Community 37 - "tradeSetupCockpit.ts"
Cohesion: 0.13
Nodes (15): Plan: find_targets Algorithmus, TSC-Neuaufbau Precondition, RangeTrend, ANTI_CONFLUENCE_COLOR, AntiConfluence, CockpitState, computeAntiConfluences(), computeCockpitState() (+7 more)

### Community 38 - "priceChartHitTest.test.js"
Cohesion: 0.10
Nodes (19): findClickedDivergence(), findClickedLiquidityLevel(), findClickedOBZone(), findClickedSetup(), findClickedTarget(), OrderBlockPrimitive, DIVERGENCE_CLICK_TOLERANCE_PX, FIB_TICK_CLICK_TOLERANCE_PX (+11 more)

### Community 39 - "TradeSetupCockpit.vue"
Cohesion: 0.10
Nodes (19): emit, accentStyle, antiConfluences, canTransfer, confirmationLabel(), confirmations, confluences, dateLabel (+11 more)

### Community 40 - "MetadataPanel.vue"
Cohesion: 0.24
Nodes (10): emit, height, left, onDrag(), panelEl, props, startDrag(), stopDrag() (+2 more)

### Community 41 - "priceChartObZones.js"
Cohesion: 0.15
Nodes (26): emit, onAntiConfluencePickerHover(), onAntiConfluencePickerSelect(), onTargetPickerHover(), onTargetPickerSelect(), openAntiConfluencePicker(), openTargetPicker(), refreshLiquidityInternal() (+18 more)

### Community 42 - "supabaseClient.js"
Cohesion: 0.14
Nodes (17): fetchAlarmLog(), fetchTouchedLiquidityLevels(), fetchTradeSetups(), fetchDailyStructurePivots(), DB_READ_PAGE_SIZE, fetchAllRows(), fetchLiquidityLevelsHtf(), fetchObZones() (+9 more)

### Community 43 - "useClaudeAnnotations.js"
Cohesion: 0.09
Nodes (29): addClaudeAnnotationDrawing(), fetchClaudeAnnotations(), removeClaudeAnnotationDrawing(), setClaudeAnnotationDrawingVisible(), applyText(), emit, error, { instrument, dateStr, drawings, loading, add, remove, setDrawingVisible } (+21 more)

### Community 44 - "trading-monitor-mcp/marketStructureAnalysis.ts"
Cohesion: 0.21
Nodes (23): advanceNestedTrend(), advanceNestedTrendInner(), applyInnerMarketStructurePivot(), applyInnerMarketStructurePivotCore(), applyMarketStructurePivot(), applyMarketStructurePivotCore(), buildMarketStructureState(), Candle (+15 more)

### Community 45 - "priceChartConstants.js"
Cohesion: 0.07
Nodes (34): usePriceChartTradeSetups(), fetchM5Candles(), fetchTrendAnalysisM5History(), getTrendAnalysisM5Candles(), CALLOUT_STACK_GAP_PX, CATEGORY_COLOR_KEY, CATEGORY_ICON, COPIED_FEEDBACK_MS (+26 more)

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
Cohesion: 0.21
Nodes (16): addPinEntry(), addPinM5LiquidityEntry(), addPinM5ObEntry(), addPinRsiDivergenceEntry(), addPinTscSetupEntry(), fetchPinContext(), REF_COLUMN, removePinEntry() (+8 more)

### Community 52 - "dataSnapshot.ts"
Cohesion: 0.17
Nodes (16): isBoxInvalidated(), fetchActiveTscRangeId(), fetchDealingRangeCockpit(), findRecentTradeSetupIdsByKey(), getOpenOppositeDealingRanges(), toLiquidityLevel(), computeEvidenceScore(), EvidenceScoreBreakdownEntry (+8 more)

### Community 53 - "gbp_h1_uptrend.ts"
Cohesion: 0.10
Nodes (20): pivot1, pivot10, pivot11, pivot12, pivot13, pivot2, pivot3, pivot4 (+12 more)

### Community 54 - "usePriceChartRsi"
Cohesion: 0.24
Nodes (8): nativeLineWidth(), usePriceChartRsi(), applyColorOptions(), applyLineWidthOptions(), create(), refreshEma(), refreshRsi(), computeEma()

### Community 55 - "PLAN: DR-Statistik in der UI anzeigen"
Cohesion: 0.13
Nodes (15): Beide Leitern nach festem Risiko-Band, Definitionen (nicht neu herleiten), Die Falle: Path B hat kein echtes Invalidierungslevel — ERLEDIGT 20.09.2026, Die Zahlen (Stand 22.09.2026, n=3282), Grenzen, die in die Anzeige gehören, Idee: wie wir den Trend doch noch dazubekommen, PLAN: DR-Statistik in der UI anzeigen, Reihenfolge (+7 more)

### Community 56 - "src/marketStructureAnalysis.ts"
Cohesion: 0.34
Nodes (15): advanceNestedTrend(), applyInnerMarketStructurePivotCore(), applyMarketStructurePivotCore(), closesAboveOldHigh(), closesBelowLevel(), evaluateConfirmingBreak(), invalidateDowntrend(), invalidateUptrend() (+7 more)

### Community 57 - "chartColors.js"
Cohesion: 0.08
Nodes (18): chartColors, DEFAULT_CHART_COLORS, resetChartColors(), chartLineWidths, DEFAULT_CHART_LINE_WIDTHS, resetChartLineWidths(), collapsed, emit (+10 more)

### Community 58 - "pinEntryVisible"
Cohesion: 0.14
Nodes (18): liquidityLevelEntryNaturalKey(), m5LiquidityEntryNaturalKey(), obZoneEntryNaturalKey(), hoveredPinLiquidityLevelKey, hoveredPinObZoneKey, onSelectPin(), pinEntryVisible(), pinJumpHint (+10 more)

### Community 59 - "DivergenceLinePrimitive"
Cohesion: 0.18
Nodes (3): DivergenceLinePaneView, DivergenceLinePrimitive, DivergenceLineRenderer

### Community 60 - "trading-monitor-mcp/pretradeGates.ts"
Cohesion: 0.07
Nodes (34): poi-watcher UTC Refresh-Tick Exception, Trading-Hours/Timezone Handling (Europe/Berlin), sessions Table, trading_schedules Table, docs/debug-metadata-panel.md, Fachdoku-Router Skill, src/marketStructureAnalysis.notes.md, docs/mcp-server.md (+26 more)

### Community 61 - "usePriceChartLiquidity.js"
Cohesion: 0.14
Nodes (22): usePriceChartLiquidity(), attachBonus(), refresh(), buildLevel(), detectLiquidityLevels(), filterRelevantLevels(), isDownFractal(), isUpFractal() (+14 more)

### Community 62 - "backfillLiquidityLevels.ts"
Cohesion: 0.27
Nodes (9): backfillOne(), BAR_CONFIG, BARS, CandleRow, correctMissedTouches(), fetchAllCandles(), INSTRUMENTS, Level (+1 more)

### Community 63 - "poi-watcher/index.ts"
Cohesion: 0.12
Nodes (22): fmt(), InstrumentConfig, INSTRUMENTS, isInWindows(), LiquidityLevelRow, localMinutesAndWeekday(), ObZoneRow, PinAlarmRow (+14 more)

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
Nodes (15): ANNOTATION_COLOR, annotationAnchorPoint(), AnnotationsPaneView, AnnotationsPrimitive, AnnotationsRenderer, parseAnnotations(), renderClaudeAnnotations(), resolveLabelPlacements() (+7 more)

### Community 68 - "cssColor"
Cohesion: 0.11
Nodes (11): cssColor(), refreshRangesMarkers(), FibLevel, Candle, PivotMarkerGroup, PivotMarkerPaneView, PivotMarkerPrimitive, PivotMarkerRenderer (+3 more)

### Community 69 - "AGENTS.md"
Cohesion: 0.14
Nodes (12): Architecture, Commands, Conventions, Forex candle data: FXCM ForexConnect, Frontend data flow (`PriceChart.vue`), Gotchas, graphify, "Laniakea" persona (`/l`) (+4 more)

### Community 70 - "Trading-Monitor Project Overview (CLAUDE.md)"
Cohesion: 0.14
Nodes (13): cTrader ACCESS_DENIED Lockout (No Auto-Recovery), DRY Within a Single Runtime Convention, CLAUDE.md Pointer to /l Persona, npm run build Command, Trading-Monitor Project Overview (CLAUDE.md), Supabase/PostgREST ~1000 Row Cap Gotcha, Rename Consistency Convention, REPLAY_LOOKAHEAD_SEC M1 Scaling Gotcha (+5 more)

### Community 71 - "rScaleRendering.js"
Cohesion: 0.18
Nodes (5): labelText(), RScalePaneView, RScalePrimitive, RScaleRenderer, styleKey()

### Community 72 - "tradeSetup.ts"
Cohesion: 0.19
Nodes (18): LiquidityLevel, closesBeyondLevel(), collectObSweeps(), DetectedTradeSetup, detectTradeSetup(), findBestLsMatch(), findFirstSetupObAfter(), findImmediateLsSetup() (+10 more)

### Community 73 - "closed_rows"
Cohesion: 0.26
Nodes (7): closed_rows(), Normalisierung der nativen FXCM-Bid-Kerzen, unabhängig vom SDK testbar., main(), Geschlossene Bid-Kerzen: FXCM -> lokaler Puffer -> Supabase-Ingest., read_config(), upload(), ClosedCandlesTest

### Community 74 - "Journal GBPUSD — Sicherung vor dem Quellenwechsel"
Cohesion: 0.10
Nodes (19): 03.06.2026 · Short · DR#40, 03.08.2026 · Short · DR#27, 07.08.2026 · Long · DR#29, 07.08.2026 · Short · DR#28, 07.08.2026 · Short · DR#30, 10.08.2026 · Short · DR#41, 14.07.2026 · Short · DR#44, 25.08.2026 · Long · DR#46 (+11 more)

### Community 75 - "FibTickPrimitive"
Cohesion: 0.15
Nodes (3): FibTickPaneView, FibTickPrimitive, FibTickRenderer

### Community 76 - "SessionBandPaneView"
Cohesion: 0.14
Nodes (3): SessionBandPaneView, SessionBandPrimitive, SessionBandRenderer

### Community 77 - "TradingFlow.vue"
Cohesion: 0.10
Nodes (22): cache, useLocalStorageRef(), buildMermaidSource(), EDGES, getNextActionHint(), mermaidEscape(), NODES, activeByInstrument (+14 more)

### Community 78 - "applyMarketStructurePivot"
Cohesion: 0.18
Nodes (15): applyMarketStructurePivot(), initMarketStructureState(), chochConfirmedState(), confirmBreak, confirmedUptrendState(), originHigh, originLow, pullback (+7 more)

### Community 79 - "debugMetadata.js"
Cohesion: 0.39
Nodes (7): buildActiveMetadataSnapshot(), earliestRelevantTime(), hasActiveMetadata(), selectActiveMetadataSections(), ALL_OFF, BASE_CTX, SECTIONS

### Community 80 - "findAntiConfluenceCandidates.js"
Cohesion: 0.07
Nodes (45): AgeTier, businessSecondsBetween(), classifyAge(), computeSweepAgeHours(), MAJOR_MIN_HOURS, MINOR_MAX_HOURS, fromPips(), assessInducement() (+37 more)

### Community 81 - "Dealing-Range-Loop Diagram"
Cohesion: 0.17
Nodes (12): Dealing-Range-Loop Diagram, News-Blackout Mid-Loop Pause, Pin-Aufräumen after TSC-Link, Target Selection Remains Lana's Judgment, Pin Tools (tools/pins.ts), poi-watcher Alert-Cron Notes, poi-watcher 3-Tier Fetch Throttling, UTC-Hours Exception for Refresh Ticks (+4 more)

### Community 82 - "FXCM-Kerzenfeed"
Cohesion: 0.22
Nodes (9): Betrieb, Datenfluss, Demokonto abgelaufen oder gesperrt, FXCM-Kerzenfeed, Historie nachholen und Sicherungen, Neuaufbau und Wartung, Umstellung und Sicherung, Wenn keine neuen Kerzen kommen (+1 more)

### Community 83 - "App.vue"
Cohesion: 0.11
Nodes (20): { activeLabels, isActive }, isFresh, { lastSuccessAt }, lastUpdateText, now, showClaudeAnnotationsModal, showDataExport, statusDotClass (+12 more)

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
Cohesion: 0.09
Nodes (38): berlinDayRangeUtcMs(), getForexCandlesArchive(), getJournal(), getNewsEvents(), getTradeSetups(), getTradingAccounts(), getTradingSchedule(), computeEma() (+30 more)

### Community 88 - "PinAddPopup.vue"
Cohesion: 0.23
Nodes (11): clampedX, clampedY, confirm(), emit, note, onKeydown(), onWindowMousedown(), props (+3 more)

### Community 89 - "twelvedata/client.ts"
Cohesion: 0.21
Nodes (11): Candle, fetchCandles(), FetchCandlesOptions, INTERVAL_MAP, requestTimeSeries(), resample(), RESAMPLE_BUCKET_SEC, SUPPORTED_PERIODS (+3 more)

### Community 90 - "Anleitung: State-Machine lesen & bedienen"
Cohesion: 0.25
Nodes (7): Ablaufbeispiel, Anleitung: State-Machine lesen & bedienen, Grundprinzip, Maschine bedienen, Menschlicher Gegencheck, `replayUntilSec` — der EINE Zeit-Parameter (alle Tools), State lesen, ohne die Maschine zu bewegen

### Community 91 - "Plan: Forex-Chart-Objekte Datengrundlage"
Cohesion: 0.21
Nodes (12): ob_zones Table, Archive-First Auto-Reload Pattern (Tried, Then Reverted), BTC Scope Removal from Chart-Objects Plan, OB-Zones Canonical FK Consolidation Approach, 1H/4H DB-Read vs Live-Recompute Decision, Four Independent OB Render Passes Problem, "Historische OBs"-Toggle Semantics, LQ-Sweep Relevance Criterion (Recent OR Pip-Range) (+4 more)

### Community 92 - "marketStructureAnalysisNestedNestedChoch.test.js"
Cohesion: 0.18
Nodes (10): confirmBreak, originHigh, originLow, pivotB, pivotC, pivotD, pivotE, pivotF (+2 more)

### Community 93 - "dataExport.ts"
Cohesion: 0.07
Nodes (67): fetchAllRows(), buildLevel(), detectLiquidityLevels(), filterRelevantLevels(), isDownFractal(), isUpFractal(), LIQUIDITY_MAX_RELEVANT, PIP_SIZE (+59 more)

### Community 94 - "MCP-Server: Tiefere Referenz"
Cohesion: 0.20
Nodes (10): MCP Auth & Table Permissions, Backfill Scripts, Candle Archive (forex_candles), MCP Server Deployment (Supabase Edge Function), MCP-Server: Tiefere Referenz, get_forex_rsi / get_forex_ema Tools, Single Deno Copy (Dual-Copy Removed), Trade-Journal Write Tools (tools/trades.ts) (+2 more)

### Community 95 - "usePriceChartTradeSetupDrawing.js"
Cohesion: 0.12
Nodes (18): usePriceChartTradeSetupDrawing(), refresh(), fromPips(), toPips(), TRADE_SETUP_OB_BORDER_RATIO, TRADE_SETUP_OB_FILL_RATIO, TRADE_SETUP_OB_WIDTH_SEC, KEINE_SKALA (+10 more)

### Community 96 - "barSecondsFor"
Cohesion: 0.13
Nodes (22): LIQUIDITY_FRACTAL_PERIOD, firstObFormationTimeAfter(), TriggerCandle, applyAsOf(), applyAsOfZones(), earliestAmbiguousEventSec(), existsAsOf(), M5_SECONDS (+14 more)

### Community 97 - "drMerkmale.py"
Cohesion: 0.05
Nodes (51): ev(), mess_gedeckelt(), -> (Quote, Treffer, unentschieden). Unentschieden = weder Ziel noch Stopp…, Erwartungswert in R ueber die ENTSCHIEDENEN DRs (Treffer oder Stopp, nicht…, dr_schluessel(), gruppiere_drs(), handelsstunden(), lade_bekannte_level() (+43 more)

### Community 98 - "NewsModal.vue"
Cohesion: 0.18
Nodes (11): CURRENCIES, emit, LIST_FORMATTER, newCurrency, newDateTime, newTitle, saving, submit() (+3 more)

### Community 99 - "trade_evidence Table (Dual-Level, Confirmation/Confluence)"
Cohesion: 0.28
Nodes (9): dealing_ranges Table, trade_evidence Table (Dual-Level, Confirmation/Confluence), trade_partial_exits Table, trade_positions Table, trade_targets Table, Confirmation/Confluence/Anti-Confluence Categories, trading repo trade-from-poi.md (Confirmation/Confluence/Anti-Confluence Definition), Bestätigungen (Sweeps & OBs) Feature (+1 more)

### Community 100 - "messeFxcmKontext.ts"
Cohesion: 0.32
Nodes (4): createAnalysisSnapshotFetch(), compressed, root, rows

### Community 101 - "useM5CandleClock"
Cohesion: 0.46
Nodes (5): m5ClockState(), useM5CandleClock(), refresh(), retry(), tick()

### Community 102 - "/task do Mode"
Cohesion: 0.38
Nodes (7): Laniakea milk-city Task-Status Rule, /task Default Data-Maintenance Mode, /task do Mode, /task new Mode, /task refine Mode, /task Command Router, milk-city Task Status Convention

### Community 104 - "findAntiConfluences.js"
Cohesion: 0.38
Nodes (11): byDistance(), findAntiConfluenceCandidates(), findAntiConfluenceDivergenceCandidates(), findAntiConfluenceObCandidates(), findAntiConfluenceSweepCandidates(), findInvalidationObCandidates(), inBand(), INDUCEMENT_TIMEFRAMES (+3 more)

### Community 105 - "marketStructureRendering.ts"
Cohesion: 0.13
Nodes (20): refreshMarketStructure(), Candle, ArrowPrimitive, collectFibLevels(), collectH1LqLevels(), collectNestedChain(), computeFibLevels(), fibBetween() (+12 more)

### Community 106 - "Lana-Fehlerdiagnose"
Cohesion: 0.33
Nodes (5): Ablauf, Ergebnis, Lana-Fehlerdiagnose, Routing: Diagnose → typischer Fix-Ort, Wann aufrufen

### Community 107 - "Agent Skills Pro Notes"
Cohesion: 0.29
Nodes (7): allowed-tools Skill Config, Context-free Scripts in Skills, Agent Skills Pro Notes, Progressive Disclosure in Skills, Skill Sharing & Troubleshooting, Skills Embedded in Subagents, Skills vs CLAUDE.md vs Hooks vs Subagents

### Community 108 - "marketStructureAnalysisDowntrend.test.js"
Cohesion: 0.40
Nodes (4): confirmBreak, originHigh, originLow, pullback

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

### Community 116 - "newsEvents.js"
Cohesion: 0.32
Nodes (8): usePriceChartCockpit(), refreshCockpit(), currentNewsNoGo(), INSTRUMENT_CURRENCIES, NEWS_NOGO_WINDOW_MINUTES, newsEvents, newsEventsForInstrument(), sessions

### Community 117 - "vite.config.js"
Cohesion: 0.40
Nodes (3): DEBUG_DIR, DEBUG_FILE, __dirname

### Community 118 - "lana-git-pull.cjs"
Cohesion: 0.50
Nodes (3): { execFileSync }, path, TRADING_REPO

### Community 119 - "forexCandles.js"
Cohesion: 0.27
Nodes (14): DB_ARCHIVED_BARS, fetchArchivedPage(), fetchArchivedUpTo(), fetchCandles(), fetchCandlesBatchOnce(), fetchCandlesOnce(), fetchInitialCandles(), fetchOlderCandles() (+6 more)

### Community 121 - "jumpToTimeRange"
Cohesion: 0.29
Nodes (9): isTimeCovered(), jumpToDivergence(), jumpToPin(), jumpToTimeRange(), jumpToTrade(), computeJumpViewport(), loadCandlesAroundTrade(), candle() (+1 more)

### Community 122 - "marketStructureAnalysis.test.js"
Cohesion: 0.22
Nodes (8): pivot1, pivot2, pivot3, pivot4, pivot5, pivot6, pivot7, pivot8

### Community 124 - "Protokoll.vue"
Cohesion: 0.14
Nodes (13): ALARM_TYPES, fetchAlarmSettings(), setAlarmEnabled(), usePolledFetch(), lastSuccessAt, useStatusBar(), router, alarms (+5 more)

### Community 125 - "Handbuch-Check"
Cohesion: 0.40
Nodes (4): Ergebnis, Handbuch-Check, Prüfpunkte, Wann aufrufen

### Community 131 - "liquidity.js"
Cohesion: 0.18
Nodes (18): ageReferenceTime(), businessSecondsBetween(), computeNextReplayTime(), formatAge(), nextCandleAfter(), snapToBarTime(), nextReplayTime(), ageSuffix() (+10 more)

### Community 132 - "findTargets.js"
Cohesion: 0.27
Nodes (8): MAX_TARGET_DISTANCE_PIPS Constant, find_targets Target-Candidate Algorithm Design, mergedCandidates, DEFAULT_LIQUIDITY_TARGET_LIMIT, DEFAULT_OB_TARGET_LIMIT, findNearestLiquidityTargets(), isTooFarFromPrice(), MAX_TARGET_DISTANCE_PIPS

### Community 133 - "marketStructureAnalysisInnerPivots.test.js"
Cohesion: 0.25
Nodes (7): h1Candles, p2Pivot3, p2Pivot4, p2Pivot5, pivot1, pivot2, pivot3

### Community 135 - "Dealing Range anlegen"
Cohesion: 0.50
Nodes (3): Ablauf, Dealing Range anlegen, Warum ein eigener Skill (nicht nur eine Doku-Zeile)

### Community 136 - ".codex/hooks/lana-git-pull.cjs"
Cohesion: 0.50
Nodes (3): { execFileSync }, path, TRADING_REPO

### Community 138 - "tradingSchedules.js"
Cohesion: 0.23
Nodes (10): addWindow(), cloneWindows(), DEFAULT_SCHEDULES, EMPTY_WINDOWS, loadInitial(), removeWindow(), syncFromRemote(), tradingSchedules (+2 more)

### Community 139 - "tradeEvidence.ts"
Cohesion: 0.12
Nodes (23): AgeTier, classifyAge(), MAJOR_MIN_SECONDS, MINOR_MAX_SECONDS, targetLabel(), targetLabel(), evidenceAgeSeconds(), evidenceAgeTier() (+15 more)

### Community 141 - "refreshTscRange"
Cohesion: 0.24
Nodes (10): removeConfirmationFromTrade(), loadActiveTscRange(), onAddAntiConfluenceFromPicker(), onAddTargetFromPicker(), onTscRemoveAntiConfluence(), onTscRemoveConfirmation(), onTscRemoveConfluence(), onTscRemoveTarget() (+2 more)

### Community 143 - "usePriceChartMarketStructure"
Cohesion: 0.25
Nodes (6): findClickedFibLevel(), usePriceChartMarketStructure(), computeRangesPivotsAndMetadata(), computeRangesPivotsFor(), getCurrentFibLevels(), BASE_CTX

### Community 144 - "fxcmCandles.ts"
Cohesion: 0.22
Nodes (5): headers, fetchForexBatch(), FxcmCandle, PERIODS, readFxcmCandles()

### Community 145 - "orderBlocks.ts"
Cohesion: 0.25
Nodes (7): detectOrderBlocks(), HTF_FOREX_LABELS, HTF_FOREX_MIN_GAP_PIPS, LOWER_TF_LABELS, LOWER_TF_MIN_GAP_PIPS, Zone, detectSetupObs()

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
Cohesion: 0.25
Nodes (8): Das Kriterium ist das Sweep-ALTER, nicht die Herkunft — korrigiert 20.09.2026, Der gedeckelte Stopp — durchgängige Konvention seit 20.09.2026, Die 50er-Schwelle ist erfüllt — kein Blocker mehr, Ein zweiter Schnitt wäre möglich — aber zurückgestellt (siehe oben), Entschiedene Design-Fragen, Erwartungswert je Ziel — und warum die Anzeige nicht empfehlen soll, Feste Bänder, keine Terzile — entschieden, Saisonalität bewusst NICHT einbauen

### Community 155 - "cTrader Open API as Forex Candle Source"
Cohesion: 0.40
Nodes (5): cTrader Open API as Forex Candle Source, cTrader Wire Protocol Implementation (Manual Protobuf), supabase/functions/_shared/ctrader/client.ts, supabase/functions/_shared/twelvedata/client.ts (Unwired), supabase/functions/forex-candles

### Community 156 - "validate.js"
Cohesion: 0.38
Nodes (4): SECONDS, validateCandles(), candle, closedAt

### Community 157 - "PinPanel.vue"
Cohesion: 0.32
Nodes (7): emit, noteSaveTimers, onEntryClick(), onNoteInput(), OUTCOME_LABEL, props, rows

### Community 159 - "liquidity.ts"
Cohesion: 0.70
Nodes (4): buildLevel(), detectLiquidityLevels(), isDownFractal(), isUpFractal()

### Community 161 - "marketStructureAnalysisDowntrendChoch.test.js"
Cohesion: 0.33
Nodes (6): chochConfirmedState(), confirmBreak, confirmedDowntrendState(), originHigh, originLow, pullback

### Community 163 - "Plan: Trade-Journal Konfluenzen & Kontext"
Cohesion: 0.50
Nodes (4): Anti-Confluences Snapshot Feature (Planned), Plan: Trade-Journal Konfluenzen & Kontext, Session-Kontext Feature (Planned), Trend-Kontext Feature (Planned)

### Community 164 - "applyInnerMarketStructurePivot"
Cohesion: 0.33
Nodes (4): advanceNestedTrendInner(), applyInnerMarketStructurePivot(), buildMarketStructureState(), computeRangesPivots()

### Community 166 - "Die Filter"
Cohesion: 0.40
Nodes (5): Die Filter, Gegenkraft — teilweise gekippt, Handelszeit — als Fenster tot, als Stunde lebendig, Sweep-Alter — der größte Effekt, Sweep-Herkunft — der stärkste, und er hält

### Community 168 - "computeTrendChain"
Cohesion: 0.29
Nodes (6): trendChain, trendAlignment, ANTI_CONFLUENCE_THRESHOLD, computeTrendAlignment(), computeTrendChain(), trendOriginPivotTime()

### Community 169 - "trendChainLevelDisplay"
Cohesion: 0.50
Nodes (4): trendChainDisplay, formatTrendAge(), trendChainDepthHint(), trendChainLevelDisplay()

### Community 172 - "Woher die 1314 kommen"
Cohesion: 0.67
Nodes (3): Warum die Auswertung NICHT auf der DB-Tabelle läuft, Warum es 1314 statt 915 sind (21.09.2026), Woher die 1314 kommen

## Ambiguous Edges - Review These
- `Trading-Steps-Ablauf Diagram` → `calc_rr Tool Idea (Deterministic RR Calc)`  [AMBIGUOUS]
  docs/steerabilty-vs-wrong-ai-outputs.md · relation: references

## Knowledge Gaps
- **1180 isolated node(s):** `{ execFileSync }`, `path`, `TRADING_REPO`, `{ execFileSync }`, `path` (+1175 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1449 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **17 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Trading-Steps-Ablauf Diagram` and `calc_rr Tool Idea (Deterministic RR Calc)`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **Why does `businessSecondsBetween()` connect `findAntiConfluenceCandidates.js` to `tradeSetup.ts`, `tradeEvidence.ts`, `dataExport.ts`?**
  _High betweenness centrality (0.089) - this node is a cross-community bridge._
- **Why does `marketStructureAnalysis Developer Notes` connect `Vegapunk Slimming Results (-86%)` to `fachdoku-router/SKILL.md`, `marketStructureAnalysis Rules Overview`?**
  _High betweenness centrality (0.066) - this node is a cross-community bridge._
- **Why does `renderMarketStructureAnalysis()` connect `marketStructureRendering.ts` to `liquidity.js`, `cssColor`, `FibTickPrimitive`, `Vegapunk Slimming Results (-86%)`, `lineWidth`, `LiquidityLinePrimitive`?**
  _High betweenness centrality (0.061) - this node is a cross-community bridge._
- **What connects `{ execFileSync }`, `path`, `TRADING_REPO` to the rest of the system?**
  _1180 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Dashboard.vue` be split into smaller, more focused modules?**
  _Cohesion score 0.015053763440860216 - nodes in this community are weakly interconnected._
- **Should `gbp_h1_uptrend_uptrend_break_of_structure_und_trendumkehr.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0196078431372549 - nodes in this community are weakly interconnected._