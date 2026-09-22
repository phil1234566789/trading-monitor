# Graph Report - trading-monitor  (2026-09-22)

## Corpus Check
- 539 files · ~552,872 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 3221 nodes · 6521 edges · 169 communities (147 shown, 15 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 115 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `b152fc8f`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Dashboard.vue
- gbp_h1_uptrend_uptrend_break_of_structure_und_trendumkehr.ts
- chartTimeUtils.js
- clipReplay
- PriceChart.vue
- gbp_h1_uptrend_mit_LQ_sweep_LONG_SETUP.ts
- gbp_h1_uptrend_mit_inner_structure.ts
- berlinDateTimeStrFor
- src/rsi.js
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
- orderBlocks.ts
- newsMarkers.js
- forexCandles.ts
- ctrader/client.ts
- format.js
- tradeIntake.js
- trades.js
- tsc.ts
- Plan: POI-Strategie-Findung, Backtesting & Trade-Notifications
- biasCheck.ts
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
- orderBlocks.js
- supabaseClient.js
- useClaudeAnnotations.js
- trading-monitor-mcp/marketStructureAnalysis.ts
- priceChartConstants.js
- src/pipConfig.js
- Laniakea Persona Command (/l)
- Plan: Sehr Große Dateien Refactoren (PriceChart.vue)
- fachdoku-router/SKILL.md
- pinContext.js
- LiquidityLineRenderer
- berlinDateStrFor
- gbp_h1_uptrend.ts
- usePriceChartRsi.js
- PLAN: DR-Statistik in der UI anzeigen
- src/marketStructureAnalysis.ts
- cssColor
- pinEntryVisible
- rsiRendering.js
- tools/pretradeGates.ts
- usePriceChartLiquidity.js
- liquidityDetection.ts
- poi-watcher/index.ts
- State Machine for Lana's Trading Flow
- compilerOptions
- dailyPivotMarkers.js
- claudeAnnotations.js
- pivotMarkers.ts
- AGENTS.md
- Trading-Monitor Project Overview (CLAUDE.md)
- machineState.ts
- tradeSetup.ts
- closed_rows
- Journal GBPUSD — Sicherung vor dem Quellenwechsel
- FibTickPrimitive
- SessionBandPaneView
- TradingFlow.vue
- applyMarketStructurePivot
- debugMetadata.js
- _shared/ageTier.ts
- poi-watcher Alert-Cron Notes
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
- newsEvents.js
- trade_evidence Table (Dual-Level, Confirmation/Confluence)
- messeFxcmKontext.ts
- useM5CandleClock
- /task do Mode
- hole_alle
- findTargetCandidates.js
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
- clearArmStatesExcept
- vite.config.js
- lana-git-pull.cjs
- forexCandles.js
- .mcp.json
- Fachdoku-Router Skill
- marketStructureAnalysis.test.js
- trading-monitor index.html Entry
- router.js
- Handbuch-Check
- trendIndicator.gbpusd-downtrend.test.js
- Claude Code Hooks Documentation Pointers
- mcp-server/src/scripts/backfillObZones.ts
- liquidity.js
- alarmLog.js
- marketStructureAnalysisInnerPivots.test.js
- tradeSetup.test.js
- Dealing Range anlegen
- .codex/hooks/lana-git-pull.cjs
- source-command-l
- tradingSchedules.js
- tradeEvidence.ts
- liveTouch.ts
- annotations.ts
- fxcmCandles.ts
- AntiConfluencePickerModal.vue
- M5CandleClock.vue
- supabaseRowCapGuard.test.js
- marketStructureAnalysisLqSweep.test.js
- JsonTree.vue
- RangeLinePaneView
- ZoneRenderer
- cTrader Open API as Forex Candle Source
- validate.js
- PinPanel.vue
- LiquidityLinePrimitive
- liquidity.ts
- RsiDivergenceStatsPanel.vue
- _shared/sessionOccurrences.js
- forbiddenSession.ts
- Plan: Trade-Journal Konfluenzen & Kontext
- usePolledFetch.js
- detectLiquidityLevels
- CrudListSection.vue
- test_saisonalitaet.py
- computeTrendAlignment

## God Nodes (most connected - your core abstractions)
1. `berlinDateStrFor()` - 45 edges
2. `cssColor()` - 36 edges
3. `berlinDateTimeStrFor()` - 33 edges
4. `fetchForexCandles()` - 31 edges
5. `pricePrecisionForInstrument()` - 30 edges
6. `json()` - 30 edges
7. `fmtPrice()` - 28 edges
8. `clipReplay()` - 27 edges
9. `lineWidth()` - 26 edges
10. `logDecision()` - 25 edges

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

## Communities (169 total, 15 thin omitted)

### Community 0 - "Dashboard.vue"
Cohesion: 0.02
Nodes (123): useSessionStorageRef(), useTabScopedRef(), TIMEFRAMES, addPositionToDealingRange(), antiConfluenceAddTrade, anyArmStateActive, ARM_STATES, closeTradeEditModal() (+115 more)

### Community 1 - "gbp_h1_uptrend_uptrend_break_of_structure_und_trendumkehr.ts"
Cohesion: 0.02
Nodes (101): candlesAroundBOS, candlesAroundBreak, p2Pivot1, p2Pivot10, p2Pivot11, p2Pivot12, p2Pivot13, p2Pivot14 (+93 more)

### Community 2 - "chartTimeUtils.js"
Cohesion: 0.10
Nodes (30): cachedCandlesUpTo(), cacheKey(), fetchCandlesCached(), getCachedCandles(), mergeCandles(), openDb(), safeCompleteUpTo(), setCachedCandles() (+22 more)

### Community 3 - "clipReplay"
Cohesion: 0.14
Nodes (27): buildActiveMetadataSnapshotInternal(), clearTradeSetupFocus(), clipReplay(), computeTradeSetupsInternal(), focusTradeSetup(), loadTradeSetupM5(), openAntiConfluencePicker(), openTargetPicker() (+19 more)

### Community 4 - "PriceChart.vue"
Cohesion: 0.03
Nodes (80): PIP_SIZE Constant, TRADE_SETUP_LS_MAX_DISTANCE_M5 Constant, nextCandlePollDelay(), activeMetadataSnapshot, allCandles, antiConfluencePickerCurrentPrice, antiConfluencePickerDivergenceCandidates, antiConfluencePickerHoveredLiquidityKey (+72 more)

### Community 5 - "gbp_h1_uptrend_mit_LQ_sweep_LONG_SETUP.ts"
Cohesion: 0.03
Nodes (60): p2Pivot1, p2Pivot10, p2Pivot11, p2Pivot12, p2Pivot13, p2Pivot14, p2Pivot15, p2Pivot16 (+52 more)

### Community 6 - "gbp_h1_uptrend_mit_inner_structure.ts"
Cohesion: 0.04
Nodes (55): p2Pivot1, p2Pivot10, p2Pivot11, p2Pivot12, p2Pivot13, p2Pivot14, p2Pivot15, p2Pivot16 (+47 more)

### Community 7 - "berlinDateTimeStrFor"
Cohesion: 0.09
Nodes (38): berlinDateTimeStrFor(), berlinOffsetMinutes(), DATE_FORMATTER, OFFSET_FORMATTER, TIME_FORMATTER, toPips(), buildServer(), MCP_TOKEN (+30 more)

### Community 8 - "src/rsi.js"
Cohesion: 0.18
Nodes (17): refreshDivergence(), buildDivergenceEntry(), collectDivergenceHistory(), computeRsi(), DEFAULT_DIVERGENCE_FRACTAL_PERIOD, DEFAULT_DIVERGENCE_HISTORY_COUNT, detectRsiDivergence(), detectRsiDivergenceHistory() (+9 more)

### Community 9 - "tradeSetup.js"
Cohesion: 0.17
Nodes (19): Two Runtimes, One Algorithm Set (Deliberate Duplication), computeTradeSetups(), collectH1LqLevels(), toLqLevel(), closesBeyondLevel(), collectObSweeps(), detectSetupObs(), detectTradeSetups() (+11 more)

### Community 10 - "rsiDivergenceStats.ts"
Cohesion: 0.09
Nodes (38): buildDivergenceEntry(), collectDivergenceHistory(), computeRsi(), DEFAULT_DIVERGENCE_FRACTAL_PERIOD, DEFAULT_DIVERGENCE_HISTORY_COUNT, DEFAULT_DIVERGENCE_LOOKBACK_BARS, DEFAULT_RSI_PERIOD, detectRsiDivergence() (+30 more)

### Community 11 - "DataExportModal.vue"
Cohesion: 0.09
Nodes (21): asset, copied, copyResult(), currentSymbol, dateStr, error, generate(), loading (+13 more)

### Community 12 - "backfillTradeSetups.ts"
Cohesion: 0.14
Nodes (13): readForexCandlesArchiveFrom(), LiquidityLevel, DEFAULT_TRADE_SETUP_PARAMS, TRADE_SETUP_H1_FRACTAL_PERIOD, TRADE_SETUP_M5_FRACTAL_PERIOD, persistTradeSetupSweeps(), alarmFenster, Candle (+5 more)

### Community 13 - "DR-Reichweite — was taugen die erkannten Setups?"
Cohesion: 0.10
Nodes (20): Aktueller FXCM-Stand: 2025 und 2026, Definitionen, Die Filter, DR-Reichweite — was taugen die erkannten Setups?, Enge der DR — warum beide Einheiten nötig sind, find_targets, Gegenkraft — teilweise gekippt, Grenzen (+12 more)

### Community 14 - "dealingRangeLoop.ts"
Cohesion: 0.07
Nodes (52): AgeTier, updateTradePosition(), assessInducement(), checkFallFour(), CheckFallFourInput, computeHtfWatchLevels(), computeWatchLevels(), FallFourResult (+44 more)

### Community 15 - "TradeEditModal.vue"
Cohesion: 0.05
Nodes (44): commission, emit, entryPrice, entryTimeInput, exitPrice, exitTimeInput, flashInvalidationSaved(), instrumentMismatch (+36 more)

### Community 16 - "package.json"
Cohesion: 0.06
Nodes (33): lightweight-charts, mermaid, dependencies, lightweight-charts, mermaid, @supabase/supabase-js, vue, vue-router (+25 more)

### Community 17 - "src/sessionOccurrences.js"
Cohesion: 0.25
Nodes (11): ALL_DAYS, attachRangeExtremes(), bonusLabelForPivot(), buildSessionContextLookup(), contextForPivot(), daysOrAll(), localMidnightUtc(), localWeekday() (+3 more)

### Community 18 - "LoopStatus.vue"
Cohesion: 0.07
Nodes (24): fetchLoopStateHistory(), fetchLoopStatesForDate(), LOOP_INSTRUMENTS, rowToLoopState(), fetchStateMachineLog(), rowToDecision(), activeByInstrument, { data, refresh } (+16 more)

### Community 19 - "db.ts"
Cohesion: 0.06
Nodes (55): addPinEntry(), addPinM5LiquidityEntry(), addPinM5ObEntry(), addPinRsiDivergenceEntry(), addTradeConfirmation(), AddTradeConfirmationArgs, addTradePosition(), addTradeTarget() (+47 more)

### Community 20 - "Dealing-Range-Anlegen Skill"
Cohesion: 0.14
Nodes (15): kind=pivot = Liquidity-Sweep-Only Semantics, Dealing-Range-Anlegen Skill, milk-city Task: Confluence-Tracking bei Dealing Ranges, trading/liquidität.md (Liquiditäts-Sweep-Mechanismus), AI Capabilities Framework (Next Token Prediction/Knowledge/Working Memory/Steerability), Diagnose-to-Fix Routing Table, Lana-Fehlerdiagnose Skill, docs/steerabilty-vs-wrong-ai-outputs.md (+7 more)

### Community 21 - "orderBlocks.ts"
Cohesion: 0.14
Nodes (12): CORS_HEADERS, ExistingPivotRow, INSTRUMENTS, Candle, detectOrderBlocks(), HTF_FOREX_LABELS, HTF_FOREX_MIN_GAP_PIPS, LOWER_TF_LABELS (+4 more)

### Community 22 - "newsMarkers.js"
Cohesion: 0.13
Nodes (12): usePriceChartSessionsAndNews(), refreshNewsMarkers(), DAY_KEY_FORMATTER, extrapolatedX(), formatEventLabel(), isSameBerlinDay(), NewsMarkerPaneView, NewsMarkerPrimitive (+4 more)

### Community 23 - "forexCandles.ts"
Cohesion: 0.18
Nodes (14): getForexCandlesArchiveUpTo(), fetchLiveForexCandles(), fetchLiveForexCandlesOnce(), isRetryable(), ALL_BARS, backfillOne(), Bar, BARS (+6 more)

### Community 24 - "ctrader/client.ts"
Cohesion: 0.11
Nodes (26): CORS_HEADERS, authAccount(), authenticate(), cachedSymbolIds, Candle, concat(), connectWithTimeout(), CTraderConnection (+18 more)

### Community 25 - "format.js"
Cohesion: 0.14
Nodes (13): emit, lessonBadges(), OUTCOME_LABEL, props, rangeLabel(), rowStyle(), showCommission, cache (+5 more)

### Community 26 - "tradeIntake.js"
Cohesion: 0.14
Nodes (27): direction, emit, entryPrice, errorMsg, levels, precision, props, reasoning (+19 more)

### Community 27 - "trades.js"
Cohesion: 0.11
Nodes (22): onRemoveConfirmation(), pnlClass, props, stats, winrateClass, fmtR(), removeConfirmationFromTrade(), computeTradeStats() (+14 more)

### Community 28 - "tsc.ts"
Cohesion: 0.24
Nodes (15): fromPips(), createDealingRange(), deleteDealingRange(), byDistance(), findAntiConfluenceCandidates(), findAntiConfluenceDivergenceCandidates(), findAntiConfluenceObCandidates(), findAntiConfluenceSweepCandidates() (+7 more)

### Community 29 - "Plan: POI-Strategie-Findung, Backtesting & Trade-Notifications"
Cohesion: 0.16
Nodes (16): Supabase/PostgREST ~1000 Row Cap Gotcha, daily_structure_pivots Table, forex_candles Table, get_forex_candles_archive MCP Tool, Archive-First Auto-Reload Pattern (Tried, Then Reverted), 1H/4H DB-Read vs Live-Recompute Decision, BTC-USDT/OKX Complete Removal (2026-08-21), 1D-Periode-4-Pivot Market-Structure Startpoint (2026-08-30) (+8 more)

### Community 30 - "biasCheck.ts"
Cohesion: 0.16
Nodes (20): berlinDayRangeUtcMs(), buildPendingDecisions(), findIntermediateLevel(), FindIntermediateLevelArgs, IntermediateLevelCandidate, isSpreadHourPivot(), PendingDecision, assessForce() (+12 more)

### Community 31 - "sessions.js"
Cohesion: 0.13
Nodes (18): emit, instrumentSessions, props, WEEKDAY_DISPLAY_ORDER, refreshSessions(), addSession(), currentSessionDanger(), DANGER_LEVELS (+10 more)

### Community 32 - "gbp_h1_uptrend_protected_low_gebrochen.ts"
Cohesion: 0.08
Nodes (25): ClosedRange, MarketStructureState, PivotBase, PivotHigh, PivotLow, PivotTouched, PivotTypeAll, PivotUntouched (+17 more)

### Community 33 - "tradingAccounts.js"
Cohesion: 0.13
Nodes (17): currentLabel, open, selectedAccount, wrapperRef, accounts, accountsLoaded, ALL_ACCOUNTS_ID, createAccount() (+9 more)

### Community 34 - "tradeSetups.js"
Cohesion: 0.24
Nodes (11): fetchTradeSetupForCockpit(), fetchTradeSetups(), mergeDbTradeSetups(), sweepLevel(), toSec(), tradeSetupFromRow(), { data: dbTradeSetups, refresh: refreshDbTradeSetups }, onIsolateTrade() (+3 more)

### Community 35 - "dataExport.js"
Cohesion: 0.15
Nodes (22): marketStructureTree, berlinOffsetMinutes(), buildDataExport(), compute1hStructureState(), computeExportTimeframeData(), computeLiquidityLevelsForExport(), computeObZonesForExport(), computeTrendChainAges() (+14 more)

### Community 36 - "tdd_mit_claude.ts"
Cohesion: 0.08
Nodes (24): nextPivot1, nextPivot10, nextPivot11, nextPivot2, nextPivot3, nextPivot4, nextPivot5, nextPivot6 (+16 more)

### Community 37 - "tradeSetupCockpit.ts"
Cohesion: 0.12
Nodes (21): trendChain, trendChainDisplay, RangeTrend, ANTI_CONFLUENCE_COLOR, ANTI_CONFLUENCE_THRESHOLD, AntiConfluence, CockpitState, computeAntiConfluences() (+13 more)

### Community 38 - "priceChartHitTest.test.js"
Cohesion: 0.08
Nodes (20): findClickedDivergence(), findClickedLiquidityLevel(), findClickedOBZone(), findClickedSetup(), findClickedTarget(), OrderBlockPrimitive, ZonePaneView, DIVERGENCE_CLICK_TOLERANCE_PX (+12 more)

### Community 39 - "TradeSetupCockpit.vue"
Cohesion: 0.09
Nodes (21): emit, accentStyle, antiConfluences, canTransfer, confirmations, confluences, dateLabel, direction (+13 more)

### Community 40 - "MetadataPanel.vue"
Cohesion: 0.24
Nodes (10): emit, height, left, onDrag(), panelEl, props, startDrag(), stopDrag() (+2 more)

### Community 41 - "orderBlocks.js"
Cohesion: 0.12
Nodes (30): emit, obZoneCtx(), onAntiConfluencePickerHover(), onAntiConfluencePickerSelect(), onTargetPickerHover(), onTargetPickerSelect(), refreshLiquidityInternal(), refreshPoiZonesInternal() (+22 more)

### Community 42 - "supabaseClient.js"
Cohesion: 0.20
Nodes (11): fetchDailyStructurePivots(), DB_READ_PAGE_SIZE, fetchAllRows(), fetchLiquidityLevelsHtf(), fetchObZones(), fetchUntouchedZones(), supabase, { data: dbDailyPivots } (+3 more)

### Community 43 - "useClaudeAnnotations.js"
Cohesion: 0.09
Nodes (29): addClaudeAnnotationDrawing(), fetchClaudeAnnotations(), removeClaudeAnnotationDrawing(), setClaudeAnnotationDrawingVisible(), applyText(), emit, error, { instrument, dateStr, drawings, loading, add, remove, setDrawingVisible } (+21 more)

### Community 44 - "trading-monitor-mcp/marketStructureAnalysis.ts"
Cohesion: 0.21
Nodes (23): advanceNestedTrend(), advanceNestedTrendInner(), applyInnerMarketStructurePivot(), applyInnerMarketStructurePivotCore(), applyMarketStructurePivot(), applyMarketStructurePivotCore(), buildMarketStructureState(), Candle (+15 more)

### Community 45 - "priceChartConstants.js"
Cohesion: 0.08
Nodes (31): usePriceChartTradeSetups(), fetchM5Candles(), fetchTrendAnalysisM5History(), getTrendAnalysisM5Candles(), CALLOUT_STACK_GAP_PX, COPIED_FEEDBACK_MS, DEBUG_AUTOSAVE_INTERVAL_MS, FOREX_HISTORY_PAGE_SIZE (+23 more)

### Community 46 - "src/pipConfig.js"
Cohesion: 0.05
Nodes (58): HTF_FOREX_MIN_GAP_PIPS Constant, LOWER_TF_MIN_GAP_PIPS Constant, Pip-/Pixel-Schwellwerte Übersicht, MAX_TARGET_DISTANCE_PIPS Constant, MIN_PIXELS_PER_HOUR_FOR_LABELS Constants, RANGE_FIB_MIN_PP_DISTANCE_PIPS Constant, find_targets Target-Candidate Algorithm Design, Plan: find_targets Algorithmus (+50 more)

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

### Community 52 - "berlinDateStrFor"
Cohesion: 0.18
Nodes (21): berlinDateStrFor(), getOpenOppositeDealingRanges(), computeEvidenceScore(), EvidenceScoreBreakdownEntry, EvidenceScoreInput, EvidenceScoreResult, loadMachineForDay(), persistTransition() (+13 more)

### Community 53 - "gbp_h1_uptrend.ts"
Cohesion: 0.10
Nodes (20): pivot1, pivot10, pivot11, pivot12, pivot13, pivot2, pivot3, pivot4 (+12 more)

### Community 54 - "usePriceChartRsi.js"
Cohesion: 0.20
Nodes (11): nativeLineWidth(), usePriceChartRsi(), applyColorOptions(), applyLineWidthOptions(), create(), refreshEma(), refreshRsi(), computeEma() (+3 more)

### Community 55 - "PLAN: DR-Statistik in der UI anzeigen"
Cohesion: 0.09
Nodes (23): Beide Leitern nach festem Risiko-Band, Das Kriterium ist das Sweep-ALTER, nicht die Herkunft — korrigiert 20.09.2026, Definitionen (nicht neu herleiten), Der gedeckelte Stopp — durchgängige Konvention seit 20.09.2026, Die 50er-Schwelle ist erfüllt — kein Blocker mehr, Die Falle: Path B hat kein echtes Invalidierungslevel — ERLEDIGT 20.09.2026, Die Zahlen (Stand 21.09.2026, n=1314), Ein zweiter Schnitt wäre möglich — aber zurückgestellt (siehe oben) (+15 more)

### Community 56 - "src/marketStructureAnalysis.ts"
Cohesion: 0.23
Nodes (19): advanceNestedTrend(), advanceNestedTrendInner(), applyInnerMarketStructurePivot(), applyInnerMarketStructurePivotCore(), applyMarketStructurePivotCore(), buildMarketStructureState(), closesAboveOldHigh(), closesBelowLevel() (+11 more)

### Community 57 - "cssColor"
Cohesion: 0.05
Nodes (37): chartColors, cssColor(), cssColorScaled(), DEFAULT_CHART_COLORS, hexToRgba(), resetChartColors(), chartLineWidths, DEFAULT_CHART_LINE_WIDTHS (+29 more)

### Community 58 - "pinEntryVisible"
Cohesion: 0.14
Nodes (18): liquidityLevelEntryNaturalKey(), m5LiquidityEntryNaturalKey(), obZoneEntryNaturalKey(), hoveredPinLiquidityLevelKey, hoveredPinObZoneKey, onSelectPin(), pinEntryVisible(), pinJumpHint (+10 more)

### Community 59 - "rsiRendering.js"
Cohesion: 0.14
Nodes (5): drawIconLabel(), DivergenceLinePaneView, DivergenceLinePrimitive, DivergenceLineRenderer, mergePinnedDivergences()

### Community 60 - "tools/pretradeGates.ts"
Cohesion: 0.16
Nodes (19): BERLIN_HM_FORMATTER, BERLIN_WEEKDAY_FORMATTER, berlinWeekdayAndMinutes(), isWithinTradingWindows(), TradingWindows, WeekdayGroup, ClassifiedNewsEvent, evaluateNewsGate() (+11 more)

### Community 61 - "usePriceChartLiquidity.js"
Cohesion: 0.15
Nodes (18): usePriceChartLiquidity(), attachBonus(), refresh(), liquidityLevelNaturalKey(), filterRelevantLevels(), LIQUIDITY_FRACTAL_PERIOD, selectRelevantHtfLevels(), LQ_RELEVANCE (+10 more)

### Community 62 - "liquidityDetection.ts"
Cohesion: 0.13
Nodes (18): DB_READ_PAGE_SIZE, fetchAllRows(), ArchivableCandle, buildLevel(), detectLiquidityLevels(), isDownFractal(), isUpFractal(), LIQUIDITY_FRACTAL_PERIOD (+10 more)

### Community 63 - "poi-watcher/index.ts"
Cohesion: 0.13
Nodes (15): unprocessedTimeframes(), fmt(), InstrumentConfig, INSTRUMENTS, isInWindows(), LiquidityLevelRow, localMinutesAndWeekday(), ObZoneRow (+7 more)

### Community 64 - "State Machine for Lana's Trading Flow"
Cohesion: 0.12
Nodes (22): Dealing-Range-Loop Diagram, News-Blackout Mid-Loop Pause, Pin-Aufräumen after TSC-Link, Target Selection Remains Lana's Judgment, Trading-Steps-Ablauf Diagram, Fall 4 -> Zurück zu Schritt 3, Two Permanent LLM-Only Steps (3 and 6), News-Pause Doesn't Replace the Cron (+14 more)

### Community 65 - "compilerOptions"
Cohesion: 0.12
Nodes (16): src/marketStructureAnalysis.ts, src/marketStructureRendering.ts, src/pivotMarkers.ts, test/tdd_mit_claude/ranges/tdd_mit_claude.ts, compilerOptions, allowJs, checkJs, esModuleInterop (+8 more)

### Community 66 - "dailyPivotMarkers.js"
Cohesion: 0.14
Nodes (7): usePriceChartDailyPivots(), refresh(), DailyPivotMarkerPaneView, DailyPivotMarkerPrimitive, DailyPivotMarkerRenderer, drawTriangle(), renderDailyPivotMarkers()

### Community 67 - "claudeAnnotations.js"
Cohesion: 0.09
Nodes (16): ANNOTATION_COLOR, annotationAnchorPoint(), AnnotationsPaneView, AnnotationsPrimitive, AnnotationsRenderer, parseAnnotations(), renderClaudeAnnotations(), resolveLabelPlacements() (+8 more)

### Community 68 - "pivotMarkers.ts"
Cohesion: 0.12
Nodes (9): canShowLabels(), MIN_PIXELS_PER_HOUR_FOR_LABELS, MIN_PIXELS_PER_HOUR_FOR_LABELS_INTRADAY, Candle, PivotMarkerGroup, PivotMarkerPaneView, PivotMarkerPrimitive, PivotMarkerRenderer (+1 more)

### Community 69 - "AGENTS.md"
Cohesion: 0.14
Nodes (12): Architecture, Commands, Conventions, Forex candle data: FXCM ForexConnect, Frontend data flow (`PriceChart.vue`), Gotchas, graphify, "Laniakea" persona (`/l`) (+4 more)

### Community 70 - "Trading-Monitor Project Overview (CLAUDE.md)"
Cohesion: 0.15
Nodes (12): cTrader ACCESS_DENIED Lockout (No Auto-Recovery), DRY Within a Single Runtime Convention, CLAUDE.md Pointer to /l Persona, npm run build Command, Trading-Monitor Project Overview (CLAUDE.md), Rename Consistency Convention, REPLAY_LOOKAHEAD_SEC M1 Scaling Gotcha, ctrader_oauth_tokens Table (+4 more)

### Community 71 - "machineState.ts"
Cohesion: 0.21
Nodes (18): deriveStepAndCase(), LoadedMachine, loadMachineForDayOrNull(), loadOrCreateMachineForDay(), rehydrateActor(), safeTransitionChain(), transitionIfPossible(), createTradingActor() (+10 more)

### Community 72 - "tradeSetup.ts"
Cohesion: 0.20
Nodes (17): LiquidityLevel, closesBeyondLevel(), collectObSweeps(), DetectedTradeSetup, detectTradeSetup(), findBestLsMatch(), findFirstSetupObAfter(), findImmediateLsSetup() (+9 more)

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
Cohesion: 0.11
Nodes (20): buildMermaidSource(), EDGES, getNextActionHint(), mermaidEscape(), NODES, activeByInstrument, berlinTimeFormatter, currentLoop (+12 more)

### Community 78 - "applyMarketStructurePivot"
Cohesion: 0.10
Nodes (25): applyMarketStructurePivot(), initMarketStructureState(), RANGE_FIB_MIN_PP_DISTANCE_PIPS, chochConfirmedState(), confirmBreak, confirmedUptrendState(), originHigh, originLow (+17 more)

### Community 79 - "debugMetadata.js"
Cohesion: 0.39
Nodes (7): buildActiveMetadataSnapshot(), earliestRelevantTime(), hasActiveMetadata(), selectActiveMetadataSections(), ALL_OFF, BASE_CTX, SECTIONS

### Community 80 - "_shared/ageTier.ts"
Cohesion: 0.32
Nodes (8): businessSecondsBetween(), classifyAge(), computeSweepAgeHours(), MAJOR_MIN_HOURS, MINOR_MAX_HOURS, ageReferenceTime(), formatAgeShort(), formatKontext()

### Community 81 - "poi-watcher Alert-Cron Notes"
Cohesion: 0.25
Nodes (8): Pin Tools (tools/pins.ts), poi-watcher Alert-Cron Notes, poi-watcher 3-Tier Fetch Throttling, UTC-Hours Exception for Refresh Ticks, Cost Optimization: Prompt Caching + Prefiltering, Modellwahl: Kein Automatisches Routing, Serverseitige Variante: Kein Reasoning-Agent, Technische Verbesserungsideen Lana/Automatisierung

### Community 82 - "FXCM-Kerzenfeed"
Cohesion: 0.17
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
Cohesion: 0.13
Nodes (17): firstObFormationTimeAfter(), TriggerCandle, detectOrderBlocks(), HTF_FOREX_LABELS, HTF_FOREX_MIN_GAP_PIPS, LOWER_TF_LABELS, LOWER_TF_MIN_GAP_PIPS, backfillOne() (+9 more)

### Community 87 - "reads.ts"
Cohesion: 0.12
Nodes (30): isBoxInvalidated(), detectSetupObs(), fetchActiveTscRangeId(), fetchDealingRangeCockpit(), findRecentTradeSetupIdsByKey(), getForexCandlesArchive(), getJournal(), getNewsEvents() (+22 more)

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
Cohesion: 0.24
Nodes (10): ob_zones Table, BTC Scope Removal from Chart-Objects Plan, OB-Zones Canonical FK Consolidation Approach, Four Independent OB Render Passes Problem, "Historische OBs"-Toggle Semantics, LQ-Sweep Relevance Criterion (Recent OR Pip-Range), Plan: Forex-Chart-Objekte Datengrundlage, Persistierungs-Umfang: Nur Referenzierte Teilmenge (+2 more)

### Community 92 - "marketStructureAnalysisNestedNestedChoch.test.js"
Cohesion: 0.17
Nodes (11): confirmBreak, originHigh, originLow, pivotB, pivotC, pivotD, pivotE, pivotF (+3 more)

### Community 93 - "dataExport.ts"
Cohesion: 0.09
Nodes (44): filterRelevantLevels(), bonusLabelForPivot(), contextForPivot(), sessionExtremeSuffix(), dropLowerTfDuplicates(), filterRelevantRows(), getLatestDailyStructureStartTime(), getLiquidityLevels() (+36 more)

### Community 94 - "MCP-Server: Tiefere Referenz"
Cohesion: 0.20
Nodes (10): MCP Auth & Table Permissions, Backfill Scripts, Candle Archive (forex_candles), MCP Server Deployment (Supabase Edge Function), MCP-Server: Tiefere Referenz, get_forex_rsi / get_forex_ema Tools, Single Deno Copy (Dual-Copy Removed), Trade-Journal Write Tools (tools/trades.ts) (+2 more)

### Community 95 - "usePriceChartTradeSetupDrawing.js"
Cohesion: 0.07
Nodes (25): findClickedFibLevel(), usePriceChartMarketStructure(), computeRangesPivotsAndMetadata(), computeRangesPivotsFor(), fetchRangesCandles(), getCurrentFibLevels(), refreshMarketStructure(), refreshRangesMarkers() (+17 more)

### Community 96 - "barSecondsFor"
Cohesion: 0.24
Nodes (15): asOfProbeCandles(), applyAsOf(), applyAsOfZones(), earliestAmbiguousEventSec(), existsAsOf(), M5_SECONDS, ProbeCandle, resolveEventSec() (+7 more)

### Community 97 - "drMerkmale.py"
Cohesion: 0.05
Nodes (51): ev(), mess_gedeckelt(), -> (Quote, Treffer, unentschieden). Unentschieden = weder Ziel noch Stopp…, Erwartungswert in R ueber die ENTSCHIEDENEN DRs (Treffer oder Stopp, nicht…, dr_schluessel(), gruppiere_drs(), handelsstunden(), lade_bekannte_level() (+43 more)

### Community 98 - "newsEvents.js"
Cohesion: 0.14
Nodes (18): CURRENCIES, emit, LIST_FORMATTER, newCurrency, newDateTime, newTitle, saving, submit() (+10 more)

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

### Community 104 - "findTargetCandidates.js"
Cohesion: 0.18
Nodes (12): PIP_SIZE, DEFAULT_LIQUIDITY_TARGET_LIMIT, DEFAULT_OB_TARGET_LIMIT, findNearestLiquidityTargets(), findNearestObTargets(), findTargetCandidates(), isTooFarFromPrice(), MAX_TARGET_DISTANCE_PIPS (+4 more)

### Community 105 - "marketStructureRendering.ts"
Cohesion: 0.13
Nodes (16): Candle, ArrowPaneView, ArrowPrimitive, ArrowRenderer, collectFibLevels(), collectNestedChain(), computeFibLevels(), fibBetween() (+8 more)

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

### Community 116 - "clearArmStatesExcept"
Cohesion: 0.15
Nodes (14): clearArmStatesExcept(), onAddAntiConfluenceRequest(), onAddConfirmationRequest(), onAddConfluenceRequest(), onAddRangeAntiConfluenceRequest(), onAddRangeConfirmationRequest(), onAddRangeConfluenceRequest(), onAddTargetRequest() (+6 more)

### Community 117 - "vite.config.js"
Cohesion: 0.40
Nodes (3): DEBUG_DIR, DEBUG_FILE, __dirname

### Community 118 - "lana-git-pull.cjs"
Cohesion: 0.50
Nodes (3): { execFileSync }, path, TRADING_REPO

### Community 119 - "forexCandles.js"
Cohesion: 0.27
Nodes (13): DB_ARCHIVED_BARS, fetchArchivedPage(), fetchArchivedUpTo(), fetchCandles(), fetchCandlesBatchOnce(), fetchCandlesOnce(), fetchOlderCandles(), fetchOlderCandlesFromDb() (+5 more)

### Community 121 - "Fachdoku-Router Skill"
Cohesion: 0.15
Nodes (13): poi-watcher UTC Refresh-Tick Exception, Trading-Hours/Timezone Handling (Europe/Berlin), sessions Table, trading_schedules Table, docs/debug-metadata-panel.md, Fachdoku-Router Skill, src/marketStructureAnalysis.notes.md, docs/mcp-server.md (+5 more)

### Community 122 - "marketStructureAnalysis.test.js"
Cohesion: 0.22
Nodes (8): pivot1, pivot2, pivot3, pivot4, pivot5, pivot6, pivot7, pivot8

### Community 124 - "router.js"
Cohesion: 0.24
Nodes (8): ALARM_TYPES, fetchAlarmSettings(), setAlarmEnabled(), router, alarms, errorText, loading, toggle()

### Community 125 - "Handbuch-Check"
Cohesion: 0.40
Nodes (4): Ergebnis, Handbuch-Check, Prüfpunkte, Wann aufrufen

### Community 131 - "liquidity.js"
Cohesion: 0.36
Nodes (11): ageReferenceTime(), businessSecondsBetween(), formatAge(), ageSuffix(), bullBearLabelSide(), formatLiquidityLevelLabel(), formatLsLabel(), levelOptions() (+3 more)

### Community 132 - "alarmLog.js"
Cohesion: 0.27
Nodes (8): fetchAlarmLog(), fetchTouchedLiquidityLevels(), fetchTradeSetups(), fetchTouchedZones(), MAX_PROTOKOLL_ZEILEN, currentSymbol, { data: rows, refresh }, SYMBOLS

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
Cohesion: 0.19
Nodes (12): minutesToTimeInput(), timeInputToMinutes(), addWindow(), cloneWindows(), DEFAULT_SCHEDULES, EMPTY_WINDOWS, loadInitial(), removeWindow() (+4 more)

### Community 139 - "tradeEvidence.ts"
Cohesion: 0.11
Nodes (23): AgeTier, classifyAge(), MAJOR_MIN_SECONDS, MINOR_MAX_SECONDS, confirmationLabel(), targetLabel(), confirmationLabel(), targetLabel() (+15 more)

### Community 141 - "liveTouch.ts"
Cohesion: 0.39
Nodes (6): findLevelTouch(), findZoneTouch(), levelTouchPrice(), LIVE_TOUCH_WINDOW_SEC, recentCandles(), zoneTouchPrice()

### Community 143 - "annotations.ts"
Cohesion: 0.38
Nodes (6): postChartAnnotations(), ANNOTATION_SCHEMA, DRAWING_GROUP_SCHEMA, registerAnnotationTools(), VALID_TYPES, validateAnnotations()

### Community 144 - "fxcmCandles.ts"
Cohesion: 0.22
Nodes (5): headers, fetchForexBatch(), FxcmCandle, PERIODS, readFxcmCandles()

### Community 145 - "AntiConfluencePickerModal.vue"
Cohesion: 0.29
Nodes (6): candidateLabel(), candidatePrice(), emit, mergedCandidates, precision, props

### Community 146 - "M5CandleClock.vue"
Cohesion: 0.50
Nodes (3): countdown, latest, props

### Community 147 - "supabaseRowCapGuard.test.js"
Cohesion: 0.33
Nodes (8): ALLOWLIST, blankComments(), findUnbounded(), overCap(), readChain(), ROOT, SCAN_DIRS, walk()

### Community 148 - "marketStructureAnalysisLqSweep.test.js"
Cohesion: 0.25
Nodes (7): baseState(), candles, levelRealBreak, levelSweep, levelUntouched, origin, triggerPivot

### Community 149 - "JsonTree.vue"
Cohesion: 0.25
Nodes (5): entries, expanded, isArray, isObject, props

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

### Community 160 - "RsiDivergenceStatsPanel.vue"
Cohesion: 0.25
Nodes (6): emit, OUTCOME_LABEL, precision, props, sortedDivergences, stats

### Community 161 - "_shared/sessionOccurrences.js"
Cohesion: 0.43
Nodes (7): ALL_DAYS, attachRangeExtremes(), buildSessionContextLookup(), daysOrAll(), localMidnightUtc(), localWeekday(), sessionOccurrences()

### Community 162 - "forbiddenSession.ts"
Cohesion: 0.28
Nodes (5): berlinOffsetFromSec(), forbiddenSessionAt(), SessionDangerConfig, EURUSD, GBPUSD

### Community 163 - "Plan: Trade-Journal Konfluenzen & Kontext"
Cohesion: 0.50
Nodes (4): Anti-Confluences Snapshot Feature (Planned), Plan: Trade-Journal Konfluenzen & Kontext, Session-Kontext Feature (Planned), Trend-Kontext Feature (Planned)

### Community 164 - "usePolledFetch.js"
Cohesion: 0.43
Nodes (5): usePolledFetch(), load(), lastSuccessAt, useStatusBar(), markSuccess()

### Community 165 - "detectLiquidityLevels"
Cohesion: 0.53
Nodes (5): buildLevel(), detectLiquidityLevels(), isDownFractal(), isUpFractal(), LIQUIDITY_MAX_RELEVANT

## Ambiguous Edges - Review These
- `Trading-Steps-Ablauf Diagram` → `calc_rr Tool Idea (Deterministic RR Calc)`  [AMBIGUOUS]
  docs/steerabilty-vs-wrong-ai-outputs.md · relation: references

## Knowledge Gaps
- **1179 isolated node(s):** `{ execFileSync }`, `path`, `TRADING_REPO`, `{ execFileSync }`, `path` (+1174 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1450 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **15 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Trading-Steps-Ablauf Diagram` and `calc_rr Tool Idea (Deterministic RR Calc)`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **Why does `businessSecondsBetween()` connect `_shared/ageTier.ts` to `tradeSetup.ts`, `tradeEvidence.ts`, `dealingRangeLoop.ts`, `dataExport.ts`, `biasCheck.ts`?**
  _High betweenness centrality (0.085) - this node is a cross-community bridge._
- **Why does `marketStructureAnalysis Developer Notes` connect `Vegapunk Slimming Results (-86%)` to `fachdoku-router/SKILL.md`, `src/pipConfig.js`?**
  _High betweenness centrality (0.075) - this node is a cross-community bridge._
- **Why does `renderMarketStructureAnalysis()` connect `marketStructureRendering.ts` to `liquidity.js`, `FibTickPrimitive`, `Vegapunk Slimming Results (-86%)`, `cssColor`, `LiquidityLinePrimitive`, `usePriceChartTradeSetupDrawing.js`?**
  _High betweenness centrality (0.069) - this node is a cross-community bridge._
- **What connects `{ execFileSync }`, `path`, `TRADING_REPO` to the rest of the system?**
  _1179 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Dashboard.vue` be split into smaller, more focused modules?**
  _Cohesion score 0.015550618851158363 - nodes in this community are weakly interconnected._
- **Should `gbp_h1_uptrend_uptrend_break_of_structure_und_trendumkehr.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0196078431372549 - nodes in this community are weakly interconnected._