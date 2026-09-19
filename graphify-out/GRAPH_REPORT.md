# Graph Report - trading-monitor  (2026-09-19)

## Corpus Check
- 474 files · ~466,854 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2968 nodes · 6080 edges · 152 communities (135 shown, 12 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 109 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `636cd6c4`
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
- trading-monitor-mcp/index.ts
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
- nearRelevantLiquidityLevels.ts
- ctrader/client.ts
- marketStructureAnalysis Rules Overview
- tradeIntake.js
- supabaseClient.js
- forceAssessment.ts
- priceChartObZones.js
- chartLineWidths.js
- sessions.js
- gbp_h1_uptrend_protected_low_gebrochen.ts
- tradingAccounts.js
- dealingRangeLoop.ts
- dataExport.js
- tdd_mit_claude.ts
- orderBlocks.ts
- orderBlocks.js
- TradeSetupCockpit.vue
- applyMarketStructurePivot
- FibTickPrimitive
- DivergenceLinePrimitive
- useClaudeAnnotations.js
- trading-monitor-mcp/marketStructureAnalysis.ts
- priceChartConstants.js
- pinContext.js
- Laniakea Persona Command (/l)
- Plan: Sehr Große Dateien Refactoren (PriceChart.vue)
- fachdoku-router/SKILL.md
- Plan: Forex-Chart-Objekte Datengrundlage
- berlinDateTimeStrFor
- usePriceChartLiquidity.js
- gbp_h1_uptrend.ts
- tradeSetupCockpit.ts
- DR-Reichweite — Grundmessung + Filter-Auswertungen
- src/marketStructureAnalysis.ts
- berlinDateStrFor
- pinEntryVisible
- liquidity.js
- findTargetCandidates.js
- tradeSetup.js
- pivotMarkers.ts
- poi-watcher/index.ts
- State Machine for Lana's Trading Flow
- compilerOptions
- dailyPivotMarkers.js
- claudeAnnotations.js
- cssColor
- AGENTS.md
- Trading-Monitor Project Overview (CLAUDE.md)
- LiquidityLineRenderer
- daily-structure-pivots/index.ts
- liquidityDetection.ts
- clearArmStatesExcept
- forexCandles.js
- SessionBandPaneView
- TradingFlow.vue
- Pivot
- Fachdoku-Router Skill
- ZoneRenderer
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
- marketStructureAnalysisNestedNestedChoch.test.js
- MCP-Server: Tiefere Referenz
- TradeMarkerPrimitive
- usePriceChartClaudeAnnotations
- messeFindTargets.py
- AnnotationsPrimitive
- trade_evidence Table (Dual-Level, Confirmation/Confluence)
- MetadataPanel.vue
- RangeLinePaneView
- /task do Mode
- src/pipConfig.js
- marketStructureAnalysisInnerPivots.test.js
- targetChoiceGuard.ts
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
- canShowLabels
- .mcp.json
- trendChainLevelDisplay
- marketStructureAnalysis.test.js
- trading-monitor index.html Entry
- debugMetadata.js
- Handbuch-Check
- trendIndicator.gbpusd-downtrend.test.js
- Claude Code Hooks Documentation Pointers
- mcp-server/src/scripts/backfillObZones.ts
- nearRelevantObZones.ts
- Pip-/Pixel-Schwellwerte Übersicht
- ClaudeAnnotationsModal.vue
- applyInnerMarketStructurePivot
- Dealing Range anlegen
- .codex/hooks/lana-git-pull.cjs
- source-command-l
- tradingSchedules.js
- alarmLog.js
- businessSecondsBetween
- JsonTree.vue
- PinPanel.vue
- annotations.ts
- marketStructureAnalysisDowntrendChoch.test.js
- buildMarketStructureState
- chartZoom.js
- Plan: Trade-Journal Konfluenzen & Kontext
- useLastDataExport.js

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
Nodes (121): useSessionStorageRef(), useTabScopedRef(), addPositionToDealingRange(), fetchTradeSetupForCockpit(), antiConfluenceAddTrade, anyArmStateActive, ARM_STATES, closeTradeEditModal() (+113 more)

### Community 1 - "gbp_h1_uptrend_uptrend_break_of_structure_und_trendumkehr.ts"
Cohesion: 0.02
Nodes (101): candlesAroundBOS, candlesAroundBreak, p2Pivot1, p2Pivot10, p2Pivot11, p2Pivot12, p2Pivot13, p2Pivot14 (+93 more)

### Community 2 - "reads.ts"
Cohesion: 0.08
Nodes (46): isBoxInvalidated(), detectSetupObs(), berlinDayRangeUtcMs(), findRecentTradeSetupIdsByKey(), getForexCandlesArchive(), getForexCandlesArchiveUpTo(), getJournal(), getNewsEvents() (+38 more)

### Community 3 - "lineWidth"
Cohesion: 0.36
Nodes (8): lineWidth(), drawEntryPoint(), drawExitPoint(), drawHaloRing(), drawLabel(), drawTick(), renderTradeMarkers(), tradeOptions()

### Community 4 - "PriceChart.vue"
Cohesion: 0.03
Nodes (113): tradesVisibleForCandles(), activeMetadataSnapshot, allCandles, antiConfluencePickerCurrentPrice, antiConfluencePickerDivergenceCandidates, antiConfluencePickerHoveredLiquidityKey, antiConfluencePickerHoveredObKey, antiConfluencePickerInvalidationObCandidates (+105 more)

### Community 5 - "gbp_h1_uptrend_mit_LQ_sweep_LONG_SETUP.ts"
Cohesion: 0.03
Nodes (60): p2Pivot1, p2Pivot10, p2Pivot11, p2Pivot12, p2Pivot13, p2Pivot14, p2Pivot15, p2Pivot16 (+52 more)

### Community 6 - "gbp_h1_uptrend_mit_inner_structure.ts"
Cohesion: 0.04
Nodes (55): p2Pivot1, p2Pivot10, p2Pivot11, p2Pivot12, p2Pivot13, p2Pivot14, p2Pivot15, p2Pivot16 (+47 more)

### Community 7 - "db.ts"
Cohesion: 0.07
Nodes (49): InducementClass, addPinEntry(), addPinM5LiquidityEntry(), addPinM5ObEntry(), addPinRsiDivergenceEntry(), addTradeConfirmation(), AddTradeConfirmationArgs, addTradePosition() (+41 more)

### Community 8 - "usePriceChartRsi.js"
Cohesion: 0.09
Nodes (37): nativeLineWidth(), usePriceChartRsi(), applyColorOptions(), applyLineWidthOptions(), create(), refreshEma(), refreshRsi(), computeEma() (+29 more)

### Community 9 - "marketStructureRendering.ts"
Cohesion: 0.13
Nodes (15): refreshMarketStructure(), LiquidityLinePrimitive, LiquidityPaneView, collectFibLevels(), collectH1LqLevels(), collectNestedChain(), computeFibLevels(), fibBetween() (+7 more)

### Community 10 - "rsiDivergenceStats.ts"
Cohesion: 0.07
Nodes (48): byDistance(), findAntiConfluenceCandidates(), findAntiConfluenceDivergenceCandidates(), findAntiConfluenceObCandidates(), findAntiConfluenceSweepCandidates(), findInvalidationObCandidates(), inBand(), MAX_HELD_OB_AGE_DAYS (+40 more)

### Community 11 - "DataExportModal.vue"
Cohesion: 0.10
Nodes (20): asset, copied, copyResult(), currentSymbol, dateStr, error, generate(), loading (+12 more)

### Community 12 - "trading-monitor-mcp/index.ts"
Cohesion: 0.10
Nodes (36): createDealingRange(), deleteDealingRange(), fetchActiveTscRangeId(), fetchDealingRangeCockpit(), getOpenOppositeDealingRanges(), toLiquidityLevel(), computeEvidenceScore(), EvidenceScoreBreakdownEntry (+28 more)

### Community 13 - "trading-monitor-mcp/pretradeGates.ts"
Cohesion: 0.19
Nodes (14): berlinWeekdayAndMinutes(), WeekdayGroup, ClassifiedNewsEvent, evaluateNewsGate(), evaluateTradingHoursGate(), NEWS_IMMINENT_MINUTES, NEWS_POST_EVENT_PAUSE_MINUTES, NEWS_SOON_MINUTES (+6 more)

### Community 14 - "Plan: POI-Strategie-Findung, Backtesting & Trade-Notifications"
Cohesion: 0.16
Nodes (16): Supabase/PostgREST ~1000 Row Cap Gotcha, daily_structure_pivots Table, forex_candles Table, get_forex_candles_archive MCP Tool, Archive-First Auto-Reload Pattern (Tried, Then Reverted), 1H/4H DB-Read vs Live-Recompute Decision, BTC-USDT/OKX Complete Removal (2026-08-21), 1D-Periode-4-Pivot Market-Structure Startpoint (2026-08-30) (+8 more)

### Community 15 - "TradeEditModal.vue"
Cohesion: 0.05
Nodes (46): emit, emit, commission, emit, entryPrice, entryTimeInput, exitPrice, exitTimeInput (+38 more)

### Community 16 - "package.json"
Cohesion: 0.06
Nodes (33): lightweight-charts, mermaid, dependencies, lightweight-charts, mermaid, @supabase/supabase-js, vue, vue-router (+25 more)

### Community 17 - "src/sessionOccurrences.js"
Cohesion: 0.26
Nodes (10): ALL_DAYS, attachRangeExtremes(), bonusLabelForPivot(), buildSessionContextLookup(), daysOrAll(), localMidnightUtc(), localWeekday(), sessionExtremeSuffix() (+2 more)

### Community 18 - "LoopStatus.vue"
Cohesion: 0.06
Nodes (26): dateStr, berlinDateStrFor(), fetchLoopStateHistory(), fetchLoopStatesForDate(), LOOP_INSTRUMENTS, rowToLoopState(), fetchStateMachineLog(), rowToDecision() (+18 more)

### Community 19 - "backfillTradeSetupOutcomes.ts"
Cohesion: 0.11
Nodes (30): classifyInducementAge(), inducementAgeRange(), MAJOR_MIN_HOURS, MAJOR_MIN_SECONDS, MINOR_MAX_HOURS, MINOR_MAX_SECONDS, classifyOutcome(), computeSlTp() (+22 more)

### Community 20 - "Dealing-Range-Anlegen Skill"
Cohesion: 0.14
Nodes (15): kind=pivot = Liquidity-Sweep-Only Semantics, Dealing-Range-Anlegen Skill, milk-city Task: Confluence-Tracking bei Dealing Ranges, trading/liquidität.md (Liquiditäts-Sweep-Mechanismus), AI Capabilities Framework (Next Token Prediction/Knowledge/Working Memory/Steerability), Diagnose-to-Fix Routing Table, Lana-Fehlerdiagnose Skill, docs/steerabilty-vs-wrong-ai-outputs.md (+7 more)

### Community 21 - "backfillObZones.ts"
Cohesion: 0.13
Nodes (17): firstObFormationTimeAfter(), TriggerCandle, detectOrderBlocks(), HTF_FOREX_LABELS, HTF_FOREX_MIN_GAP_PIPS, LOWER_TF_LABELS, LOWER_TF_MIN_GAP_PIPS, backfillOne() (+9 more)

### Community 22 - "newsMarkers.js"
Cohesion: 0.07
Nodes (30): CURRENCIES, emit, LIST_FORMATTER, newCurrency, newDateTime, newTitle, saving, submit() (+22 more)

### Community 23 - "nearRelevantLiquidityLevels.ts"
Cohesion: 0.19
Nodes (19): berlinOffsetMinutes(), getLiquidityLevels(), getSessions(), buildCandidatePool(), PIP_SIZE, ALL_DAYS, attachRangeExtremes(), bonusLabelForPivot() (+11 more)

### Community 24 - "ctrader/client.ts"
Cohesion: 0.12
Nodes (25): CORS_HEADERS, fetchForexBatch(), authAccount(), authenticate(), cachedSymbolIds, Candle, concat(), connectWithTimeout() (+17 more)

### Community 25 - "marketStructureAnalysis Rules Overview"
Cohesion: 0.22
Nodes (15): Arbitrary Nesting Depth (2026-08-09), Rendering Rules (renderMarketStructureAnalysis), marketStructureAnalysis Rules Overview, Docht-vs-Bruch (Wick vs Close-Break) Unification, Standalone Downtrend Detection/Invalidation, Fibonacci Level (computeFibLevels/collectFibLevels), Inner-Pivots (Period 2) Fast Pre-Detection, LQ-Sweep Classification (markLqSweeps) (+7 more)

### Community 26 - "tradeIntake.js"
Cohesion: 0.10
Nodes (35): direction, emit, entryPrice, errorMsg, levels, precision, props, reasoning (+27 more)

### Community 27 - "supabaseClient.js"
Cohesion: 0.10
Nodes (21): pnlClass, props, stats, winrateClass, fetchDailyStructurePivots(), fmtR(), fetchLiquidityLevelsHtf(), fetchObZones() (+13 more)

### Community 28 - "forceAssessment.ts"
Cohesion: 0.18
Nodes (14): AgeTier, FindIntermediateLevelArgs, IntermediateLevelCandidate, PendingDecision, assessForce(), assessLiquidityForce(), assessObForce(), ForceAssessment (+6 more)

### Community 29 - "priceChartObZones.js"
Cohesion: 0.18
Nodes (16): detectOrderBlocks(), collectObsZones(), currentPriceEstimate(), filterDbObZones(), filterHistorical(), firstCandleTouch(), firstCandleTouchRange(), liveObZonesForTimeframe() (+8 more)

### Community 30 - "chartLineWidths.js"
Cohesion: 0.16
Nodes (9): chartColors, resetChartColors(), chartLineWidths, DEFAULT_CHART_LINE_WIDTHS, resetChartLineWidths(), collapsed, emit, GROUPS (+1 more)

### Community 31 - "sessions.js"
Cohesion: 0.13
Nodes (18): emit, instrumentSessions, props, WEEKDAY_DISPLAY_ORDER, refreshSessions(), addSession(), currentSessionDanger(), DANGER_LEVELS (+10 more)

### Community 32 - "gbp_h1_uptrend_protected_low_gebrochen.ts"
Cohesion: 0.08
Nodes (25): ClosedRange, MarketStructureState, PivotBase, PivotHigh, PivotLow, PivotTouched, PivotTypeAll, PivotUntouched (+17 more)

### Community 33 - "tradingAccounts.js"
Cohesion: 0.13
Nodes (17): currentLabel, open, selectedAccount, wrapperRef, accounts, accountsLoaded, ALL_ACCOUNTS_ID, createAccount() (+9 more)

### Community 34 - "dealingRangeLoop.ts"
Cohesion: 0.07
Nodes (49): updateTradePosition(), assessInducement(), checkFallFour(), CheckFallFourInput, computeHtfWatchLevels(), computeWatchLevels(), FallFourResult, hasReaction() (+41 more)

### Community 35 - "dataExport.js"
Cohesion: 0.14
Nodes (24): berlinDayRangeUtcMs(), berlinOffsetMinutes(), buildDataExport(), computeExportTimeframeData(), computeLiquidityLevelsForExport(), computeObZonesForExport(), DATE_FORMATTER, dropUnknownStructureLevels() (+16 more)

### Community 36 - "tdd_mit_claude.ts"
Cohesion: 0.08
Nodes (24): nextPivot1, nextPivot10, nextPivot11, nextPivot2, nextPivot3, nextPivot4, nextPivot5, nextPivot6 (+16 more)

### Community 37 - "orderBlocks.ts"
Cohesion: 0.15
Nodes (13): buildLevel(), detectLiquidityLevels(), isDownFractal(), isUpFractal(), Candle, detectOrderBlocks(), HTF_FOREX_LABELS, HTF_FOREX_MIN_GAP_PIPS (+5 more)

### Community 38 - "orderBlocks.js"
Cohesion: 0.07
Nodes (27): findClickedDivergence(), findClickedFibLevel(), findClickedLiquidityLevel(), findClickedOBZone(), findClickedSetup(), findClickedTarget(), getCurrentFibLevels(), OB_ZONE_KEYS (+19 more)

### Community 39 - "TradeSetupCockpit.vue"
Cohesion: 0.10
Nodes (22): accentStyle, antiConfluences, canTransfer, confirmations, confluences, dateLabel, direction, emit (+14 more)

### Community 40 - "applyMarketStructurePivot"
Cohesion: 0.13
Nodes (19): applyMarketStructurePivot(), initMarketStructureState(), RANGE_FIB_MIN_PP_DISTANCE_PIPS, chochConfirmedState(), confirmBreak, confirmedUptrendState(), originHigh, originLow (+11 more)

### Community 41 - "FibTickPrimitive"
Cohesion: 0.15
Nodes (3): FibTickPaneView, FibTickPrimitive, FibTickRenderer

### Community 43 - "useClaudeAnnotations.js"
Cohesion: 0.14
Nodes (20): addClaudeAnnotationDrawing(), fetchClaudeAnnotations(), removeClaudeAnnotationDrawing(), setClaudeAnnotationDrawingVisible(), applyText(), removeDrawing(), toggleDrawingVisible(), add() (+12 more)

### Community 44 - "trading-monitor-mcp/marketStructureAnalysis.ts"
Cohesion: 0.21
Nodes (23): advanceNestedTrend(), advanceNestedTrendInner(), applyInnerMarketStructurePivot(), applyInnerMarketStructurePivotCore(), applyMarketStructurePivot(), applyMarketStructurePivotCore(), buildMarketStructureState(), Candle (+15 more)

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

### Community 50 - "Plan: Forex-Chart-Objekte Datengrundlage"
Cohesion: 0.24
Nodes (10): ob_zones Table, BTC Scope Removal from Chart-Objects Plan, OB-Zones Canonical FK Consolidation Approach, Four Independent OB Render Passes Problem, "Historische OBs"-Toggle Semantics, LQ-Sweep Relevance Criterion (Recent OR Pip-Range), Plan: Forex-Chart-Objekte Datengrundlage, Persistierungs-Umfang: Nur Referenzierte Teilmenge (+2 more)

### Community 51 - "berlinDateTimeStrFor"
Cohesion: 0.12
Nodes (22): berlinDateTimeStrFor(), DATE_FORMATTER, OFFSET_FORMATTER, TIME_FORMATTER, berlinTwinKey(), withBerlinTimes(), getLoopStateForDay(), NEXT_ACTION_FALLBACK (+14 more)

### Community 52 - "usePriceChartLiquidity.js"
Cohesion: 0.17
Nodes (17): usePriceChartLiquidity(), attachBonus(), refresh(), liquidityLevelNaturalKey(), renderLiquidityLevels(), LIQUIDITY_FRACTAL_PERIOD, selectRelevantHtfLevels(), LQ_RELEVANCE (+9 more)

### Community 53 - "gbp_h1_uptrend.ts"
Cohesion: 0.10
Nodes (20): pivot1, pivot10, pivot11, pivot12, pivot13, pivot2, pivot3, pivot4 (+12 more)

### Community 54 - "tradeSetupCockpit.ts"
Cohesion: 0.14
Nodes (14): Plan: find_targets Algorithmus, TSC-Neuaufbau Precondition, RangeTrend, ANTI_CONFLUENCE_COLOR, AntiConfluence, computeAntiConfluences(), computeCockpitState(), LOCKED_ACCENT (+6 more)

### Community 55 - "DR-Reichweite — Grundmessung + Filter-Auswertungen"
Cohesion: 0.11
Nodes (18): 1. Handelszeit — größter Effekt, größte Stichprobe, 2. Gegenkraft — Paarvergleich nach Sweep-Stärke, 3. HTF-Sweep, 4. Sweep-Alter — höchster Median, kleinste Stichprobe, Basis, Das Angebot stimmt, Datenquellen (vor dem Lauf ziehen), Definitionen (+10 more)

### Community 56 - "src/marketStructureAnalysis.ts"
Cohesion: 0.34
Nodes (15): advanceNestedTrend(), applyInnerMarketStructurePivotCore(), applyMarketStructurePivotCore(), closesAboveOldHigh(), closesBelowLevel(), evaluateConfirmingBreak(), invalidateDowntrend(), invalidateUptrend() (+7 more)

### Community 57 - "berlinDateStrFor"
Cohesion: 0.13
Nodes (37): berlinDateStrFor(), buildPendingDecisions(), findIntermediateLevel(), isSpreadHourPivot(), upsertBiasFields(), deriveStepAndCase(), LoadedMachine, loadMachineForDay() (+29 more)

### Community 58 - "pinEntryVisible"
Cohesion: 0.14
Nodes (18): liquidityLevelEntryNaturalKey(), m5LiquidityEntryNaturalKey(), obZoneEntryNaturalKey(), hoveredPinLiquidityLevelKey, hoveredPinObZoneKey, onSelectPin(), pinEntryVisible(), pinJumpHint (+10 more)

### Community 59 - "liquidity.js"
Cohesion: 0.09
Nodes (38): AgeTier, classifyAge(), MAJOR_MIN_SECONDS, MINOR_MAX_SECONDS, ageReferenceTime(), businessSecondsBetween(), computeNextReplayTime(), formatAge() (+30 more)

### Community 60 - "findTargetCandidates.js"
Cohesion: 0.16
Nodes (14): DEFAULT_LIQUIDITY_TARGET_LIMIT, DEFAULT_OB_TARGET_LIMIT, findNearestLiquidityTargets(), findNearestObTargets(), findTargetCandidates(), isTooFarFromPrice(), MAX_TARGET_DISTANCE_PIPS, M5_BAR_SECONDS (+6 more)

### Community 61 - "tradeSetup.js"
Cohesion: 0.14
Nodes (16): Two Runtimes, One Algorithm Set (Deliberate Duplication), computeTradeSetups(), closesBeyondLevel(), detectSetupObs(), detectTradeSetups(), findAllProtectedFractals(), findBestLsMatch(), findFirstSetupObAfter() (+8 more)

### Community 62 - "pivotMarkers.ts"
Cohesion: 0.14
Nodes (6): Candle, PivotMarkerGroup, PivotMarkerPaneView, PivotMarkerPrimitive, PivotMarkerRenderer, RenderOptions

### Community 63 - "poi-watcher/index.ts"
Cohesion: 0.11
Nodes (16): fmt(), InstrumentConfig, INSTRUMENTS, isInWindows(), LiquidityLevelRow, localMinutesAndWeekday(), ObZoneRow, PinAlarmRow (+8 more)

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
Cohesion: 0.16
Nodes (10): ANNOTATION_COLOR, annotationAnchorPoint(), AnnotationsRenderer, parseAnnotations(), resolveLabelPlacements(), resolveTime(), VALID_TYPES, validateAnnotationList() (+2 more)

### Community 68 - "cssColor"
Cohesion: 0.06
Nodes (42): cssColor(), cssColorScaled(), hexToRgba(), candidateLabel(), candidatePrice(), emit, mergedCandidates, precision (+34 more)

### Community 69 - "AGENTS.md"
Cohesion: 0.14
Nodes (12): Architecture, Commands, Conventions, Forex candle data: cTrader Open API, not Twelve Data, Frontend data flow (`PriceChart.vue`), Gotchas, graphify, "Laniakea" persona (`/l`) (+4 more)

### Community 70 - "Trading-Monitor Project Overview (CLAUDE.md)"
Cohesion: 0.12
Nodes (15): cTrader ACCESS_DENIED Lockout (No Auto-Recovery), cTrader Open API as Forex Candle Source, DRY Within a Single Runtime Convention, CLAUDE.md Pointer to /l Persona, npm run build Command, Trading-Monitor Project Overview (CLAUDE.md), Rename Consistency Convention, ctrader_oauth_tokens Table (+7 more)

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

### Community 78 - "Pivot"
Cohesion: 0.15
Nodes (7): Candle, ArrowPaneView, ArrowPrimitive, ArrowRenderer, FibLevel, Pivot, CockpitState

### Community 79 - "Fachdoku-Router Skill"
Cohesion: 0.15
Nodes (13): poi-watcher UTC Refresh-Tick Exception, Trading-Hours/Timezone Handling (Europe/Berlin), sessions Table, trading_schedules Table, docs/debug-metadata-panel.md, Fachdoku-Router Skill, src/marketStructureAnalysis.notes.md, docs/mcp-server.md (+5 more)

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
Nodes (18): filterRelevantLevels(), getLatestDailyStructureStartTime(), computeRangesPivots(), buildDataExport(), capStructurePivots(), coincidesWithHtf(), compute1hStructureState(), computeM5LiquidityAndObZones() (+10 more)

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

### Community 92 - "barSecondsFor"
Cohesion: 0.24
Nodes (15): asOfProbeCandles(), applyAsOf(), applyAsOfZones(), earliestAmbiguousEventSec(), existsAsOf(), M5_SECONDS, ProbeCandle, resolveEventSec() (+7 more)

### Community 93 - "marketStructureAnalysisNestedNestedChoch.test.js"
Cohesion: 0.17
Nodes (11): confirmBreak, originHigh, originLow, pivotB, pivotC, pivotD, pivotE, pivotF (+3 more)

### Community 94 - "MCP-Server: Tiefere Referenz"
Cohesion: 0.20
Nodes (10): MCP Auth & Table Permissions, Backfill Scripts, Candle Archive (forex_candles), MCP Server Deployment (Supabase Edge Function), MCP-Server: Tiefere Referenz, get_forex_rsi / get_forex_ema Tools, Single Deno Copy (Dual-Copy Removed), Trade-Journal Write Tools (tools/trades.ts) (+2 more)

### Community 95 - "TradeMarkerPrimitive"
Cohesion: 0.14
Nodes (3): TradeMarkerPaneView, TradeMarkerPrimitive, TradeMarkerRenderer

### Community 96 - "usePriceChartClaudeAnnotations"
Cohesion: 0.40
Nodes (3): renderClaudeAnnotations(), usePriceChartClaudeAnnotations(), refresh()

### Community 97 - "messeFindTargets.py"
Cohesion: 0.29
Nodes (11): drs_laden(), ergebnis(), ev(), kandidaten(), main(), mcp(), R-Ergebnis der IDEE: Treffer -> +RR (bei 10 gedeckelt), Invalidierung -> -1,…, Je gemessener DR: Startzeitpunkt, nahe OB-Kante, Reichweite (normal + strikt),… (+3 more)

### Community 99 - "trade_evidence Table (Dual-Level, Confirmation/Confluence)"
Cohesion: 0.28
Nodes (9): dealing_ranges Table, trade_evidence Table (Dual-Level, Confirmation/Confluence), trade_partial_exits Table, trade_positions Table, trade_targets Table, Confirmation/Confluence/Anti-Confluence Categories, trading repo trade-from-poi.md (Confirmation/Confluence/Anti-Confluence Definition), Bestätigungen (Sweeps & OBs) Feature (+1 more)

### Community 100 - "MetadataPanel.vue"
Cohesion: 0.24
Nodes (10): emit, height, left, onDrag(), panelEl, props, startDrag(), stopDrag() (+2 more)

### Community 102 - "/task do Mode"
Cohesion: 0.38
Nodes (7): Laniakea milk-city Task-Status Rule, /task Default Data-Maintenance Mode, /task do Mode, /task new Mode, /task refine Mode, /task Command Router, milk-city Task Status Convention

### Community 103 - "src/pipConfig.js"
Cohesion: 0.12
Nodes (17): MAX_TARGET_DISTANCE_PIPS Constant, find_targets Target-Candidate Algorithm Design, openAntiConfluencePicker(), openTargetPicker(), mergedCandidates, getCurrentLiquidityLevels(), DEFAULT_LIQUIDITY_TARGET_LIMIT, DEFAULT_OB_TARGET_LIMIT (+9 more)

### Community 104 - "marketStructureAnalysisInnerPivots.test.js"
Cohesion: 0.25
Nodes (7): h1Candles, p2Pivot3, p2Pivot4, p2Pivot5, pivot1, pivot2, pivot3

### Community 105 - "targetChoiceGuard.ts"
Cohesion: 0.29
Nodes (10): getDealingRangeById(), findUnexplainedNearerTargets(), flattenTargetCandidates(), formatPrice(), mentionedPrices(), TargetCandidatePrice, unexplainedNearerTargetsError(), assertTargetChoiceFromCandidates() (+2 more)

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

### Community 116 - "candleCache.js"
Cohesion: 0.13
Nodes (23): REPLAY_LOOKAHEAD_SEC M1 Scaling Gotcha, REPLAY_LOOKAHEAD_SEC M1 Scaling Bug (Origin), cachedCandlesUpTo(), cacheKey(), fetchCandlesCached(), getCachedCandles(), mergeCandles(), openDb() (+15 more)

### Community 117 - "vite.config.js"
Cohesion: 0.40
Nodes (3): DEBUG_DIR, DEBUG_FILE, __dirname

### Community 118 - "lana-git-pull.cjs"
Cohesion: 0.50
Nodes (3): { execFileSync }, path, TRADING_REPO

### Community 119 - "canShowLabels"
Cohesion: 0.27
Nodes (4): drawIconLabel(), canShowLabels(), DivergenceLineRenderer, mergePinnedDivergences()

### Community 121 - "trendChainLevelDisplay"
Cohesion: 0.22
Nodes (9): trendChain, trendChainDisplay, computeTrendChainAges(), ANTI_CONFLUENCE_THRESHOLD, computeTrendChain(), formatTrendAge(), trendChainDepthHint(), trendChainLevelDisplay() (+1 more)

### Community 122 - "marketStructureAnalysis.test.js"
Cohesion: 0.22
Nodes (8): pivot1, pivot2, pivot3, pivot4, pivot5, pivot6, pivot7, pivot8

### Community 124 - "debugMetadata.js"
Cohesion: 0.39
Nodes (7): buildActiveMetadataSnapshot(), earliestRelevantTime(), hasActiveMetadata(), selectActiveMetadataSections(), ALL_OFF, BASE_CTX, SECTIONS

### Community 125 - "Handbuch-Check"
Cohesion: 0.40
Nodes (4): Ergebnis, Handbuch-Check, Prüfpunkte, Wann aufrufen

### Community 131 - "nearRelevantObZones.ts"
Cohesion: 0.36
Nodes (8): fetchAllRows(), getObZones(), buildNearRelevantObZones(), dropLowerTfDuplicateZones(), filterConfluenceObZoneRows(), filterRelevantObZoneRows(), NearRelevantObZonesArgs, ObZoneRow

### Community 132 - "Pip-/Pixel-Schwellwerte Übersicht"
Cohesion: 0.32
Nodes (8): HTF_FOREX_MIN_GAP_PIPS Constant, LOWER_TF_MIN_GAP_PIPS Constant, Pip-/Pixel-Schwellwerte Übersicht, PIP_SIZE Constant, RANGE_FIB_MIN_PP_DISTANCE_PIPS Constant, TRADE_SETUP_LS_MAX_DISTANCE_M5 Constant, poi-watcher 4H+1H OB-Zonen-Wächter Edge Function, supabase/functions/_shared/orderBlocks.ts

### Community 133 - "ClaudeAnnotationsModal.vue"
Cohesion: 0.25
Nodes (7): emit, error, { instrument, dateStr, drawings, loading, add, remove, setDrawingVisible }, removingId, saving, text, togglingId

### Community 134 - "applyInnerMarketStructurePivot"
Cohesion: 0.25
Nodes (6): advanceNestedTrendInner(), applyInnerMarketStructurePivot(), confirmBreak, originHigh, originLow, pullback

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
Cohesion: 0.20
Nodes (10): fetchAlarmLog(), fetchTouchedLiquidityLevels(), fetchTradeSetups(), usePolledFetch(), lastSuccessAt, useStatusBar(), fetchTouchedZones(), currentSymbol (+2 more)

### Community 141 - "businessSecondsBetween"
Cohesion: 0.52
Nodes (5): businessSecondsBetween(), classifyAge(), ageReferenceTime(), formatAgeShort(), formatKontext()

### Community 143 - "JsonTree.vue"
Cohesion: 0.25
Nodes (5): entries, expanded, isArray, isObject, props

### Community 144 - "PinPanel.vue"
Cohesion: 0.32
Nodes (7): emit, noteSaveTimers, onEntryClick(), onNoteInput(), OUTCOME_LABEL, props, rows

### Community 145 - "annotations.ts"
Cohesion: 0.38
Nodes (6): postChartAnnotations(), ANNOTATION_SCHEMA, DRAWING_GROUP_SCHEMA, registerAnnotationTools(), VALID_TYPES, validateAnnotations()

### Community 146 - "marketStructureAnalysisDowntrendChoch.test.js"
Cohesion: 0.33
Nodes (6): chochConfirmedState(), confirmBreak, confirmedDowntrendState(), originHigh, originLow, pullback

### Community 147 - "buildMarketStructureState"
Cohesion: 0.40
Nodes (5): marketStructureTree, compute1hStructureState(), buildMarketStructureState(), computeRangesPivots(), summarizeMarketStructureState()

### Community 148 - "chartZoom.js"
Cohesion: 0.50
Nodes (3): MIN_PIXELS_PER_HOUR_FOR_LABELS Constants, MIN_PIXELS_PER_HOUR_FOR_LABELS, MIN_PIXELS_PER_HOUR_FOR_LABELS_INTRADAY

### Community 149 - "Plan: Trade-Journal Konfluenzen & Kontext"
Cohesion: 0.50
Nodes (4): Anti-Confluences Snapshot Feature (Planned), Plan: Trade-Journal Konfluenzen & Kontext, Session-Kontext Feature (Planned), Trend-Kontext Feature (Planned)

## Ambiguous Edges - Review These
- `Trading-Steps-Ablauf Diagram` → `calc_rr Tool Idea (Deterministic RR Calc)`  [AMBIGUOUS]
  docs/steerabilty-vs-wrong-ai-outputs.md · relation: references

## Knowledge Gaps
- **1114 isolated node(s):** `Datenquellen (vor dem Lauf ziehen)`, `Definitionen`, `Skripte`, `Basis`, `1. Handelszeit — größter Effekt, größte Stichprobe` (+1109 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1336 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Trading-Steps-Ablauf Diagram` and `calc_rr Tool Idea (Deterministic RR Calc)`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **Why does `businessSecondsBetween()` connect `businessSecondsBetween` to `dealingRangeLoop.ts`, `backfillTradeSetupOutcomes.ts`, `dataExport.ts`, `liquidity.js`, `forceAssessment.ts`?**
  _High betweenness centrality (0.085) - this node is a cross-community bridge._
- **Why does `businessSecondsBetween()` connect `liquidity.js` to `trendChainLevelDisplay`, `PriceChart.vue`, `tradeSetupCockpit.ts`?**
  _High betweenness centrality (0.073) - this node is a cross-community bridge._
- **Why does `marketStructureAnalysis Developer Notes` connect `Vegapunk Slimming Results (-86%)` to `fachdoku-router/SKILL.md`, `marketStructureAnalysis Rules Overview`?**
  _High betweenness centrality (0.058) - this node is a cross-community bridge._
- **What connects `Datenquellen (vor dem Lauf ziehen)`, `Definitionen`, `Skripte` to the rest of the system?**
  _1114 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Dashboard.vue` be split into smaller, more focused modules?**
  _Cohesion score 0.016013071895424835 - nodes in this community are weakly interconnected._
- **Should `gbp_h1_uptrend_uptrend_break_of_structure_und_trendumkehr.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0196078431372549 - nodes in this community are weakly interconnected._