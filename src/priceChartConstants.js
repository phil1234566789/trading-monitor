// Tuning-Konstanten aus PriceChart.vue, per Refactoring-Task "Sehr große Dateien refactoren"
// (2026-08-26) hierher ausgelagert — reine Werte + ihre WHY-Kommentare, keine Logik. Import in
// PriceChart.vue statt lokaler Deklaration.
import { PIP_SIZE } from "./pipConfig.js";

// pollRecent() braucht pro Tick nur die 1-2 Kerzen, die sich seit dem letzten Poll geändert haben
// können, mergeRecent() ersetzt ohnehin nur den Schwanz von allCandles. 10 als Puffer für einen
// verpassten Poll (z.B. Tab im Hintergrund gedrosselt) — pro cTrader-Connect trotzdem deutlich
// weniger Daten als ein voller Seiten-Fetch (siehe Chat 2026-07-20: "unnötige cTrader Aufrufe").
export const RECENT_PAGE_SIZE = 10;
// Puffer nach der erwarteten Schlusszeit, bis die frisch geschlossene Kerze beim Broker/Backend
// ankommt — lieber knapp nach dem Schluss pollen als knapp davor (siehe scheduleNextPoll in
// PriceChart.vue für die volle Kerzenschluss-Ausrichtungs-Begründung).
export const CLOSE_POLL_BUFFER_MS = 2_000;
// Scroll-Back: ein größerer count fürs DB-Archiv (forexCandles.js: fetchOlderCandles versucht das
// zuerst) ist praktisch kostenlos und deckt mehrere Handelstage pro Schritt ab statt 100er-Häppchen.
// Für den Live-cTrader-Fallback ohne Bedeutung — die Edge Function kappt dort ohnehin serverseitig
// auf MAX_COUNT (aktuell 1000).
export const FOREX_HISTORY_PAGE_SIZE = 2000;
// Für jumpToTimeRange (priceChartJumpToTime.js, siehe dort für die volle Bug-Historie): Puffer NACH
// dem Trade-Exit für den ersten Anker-Fetch, genug für einen noch offenen Trade plus etwas Kontext.
export const JUMP_TARGET_BUFFER_BARS = 20;
// Für jumpToTimeRange (priceChartJumpToTime.js): harte Obergrenze an Nachlade-Seiten für einen
// einzelnen Sprung, nur eine Notbremse für ungewöhnlich lange Trades, kein Regelfall.
export const MAX_JUMP_FETCH_PAGES = 5;
export const INITIAL_CANDLE_COUNT = 1000; // depth loaded on startup / timeframe switch
export const LAZY_LOAD_LOGICAL_THRESHOLD = 20; // fetch older data once this close to the left edge
export const TRADE_MARKER_BARS = new Set(["1m", "5m", "15m", "1h"]); // 4h/1D würden zu unübersichtlich

// Trade-Setup (Liquidity Sweep + Protected M5-Fraktal + M5-OB, siehe tv-indikator/src/
// tradesetup.pine) — nur für Forex (braucht M5-Kerzen zusätzlich zum aktuell angezeigten
// Chart-Timeframe). Werte 1:1 aus den getunten Defaults in tv-indikator/src/inputs.pine
// übernommen (TRADE-SETUP-Gruppen), nicht neu geraten — siehe auch poi-watcher/index.ts,
// das dieselben Werte serverseitig für die Telegram-Alarme nutzt.
export const TRADE_SETUP_M5_FRACTAL_PERIOD = 5; // liqM5Period
// H1-Level kamen bis Chat 2026-07-28 aus einer eigenen, nur 300 Kerzen kurzen H1-Fraktal-Erkennung
// (Bug: ein 32 Tage altes, aber gerade erst geswepptes Level war dadurch unsichtbar) — kommen jetzt
// aus den längst gefilterten structurePivots des "1h-Range"-Algorithmus (collectH1LqLevels in
// marketStructureAnalysis.ts, aufgerufen in computeTradeSetups), kein eigenes H1-Fenster mehr nötig.
export const TRADE_SETUP_M5_CANDLE_COUNT = 2500;
export const TRADE_SETUP_GRACE_SEC = 5 * 60; // eine M5-Kerzenlänge
export const TRADE_SETUP_LS_MAX_LEAD_SEC_H1 = 120 * 60; // lsMaxLeadMinutesH1 — eigenes, größeres Fenster
// als M5 (H1-Sweep liegt typischerweise deutlich länger vor dem Fraktal), siehe poi-watcher/index.ts
export const TRADE_SETUP_LS_MAX_LEAD_SEC_M5 = 45 * 60; // lsMaxLeadMinutesM5
export const TRADE_SETUP_LS_MAX_DISTANCE_M5 = 5.0 * PIP_SIZE; // lsMaxDistancePipsM5=5, nur für M5-LS
export const TRADE_SETUP_OB_MAX_DELAY_SEC = 60 * 60; // obMaxDelayMinutes
export const TRADE_SETUP_LOOKBACK_SEC = 6 * 60 * 60; // protectedHighLookbackHours
export const TRADE_SETUP_OB_WIDTH_SEC = 10 * TRADE_SETUP_GRACE_SEC; // obBoxWidthM5Candles=10, rein optisch
// Linienstärke konfigurierbar seit Chat 2026-07-25 (Style-Modal) — siehe chartLineWidths.js, EIN
// Wert pro Farb-Key (tradeSetupProtected/tradeSetupShort/tradeSetupLong). Kein Modul-Konstante
// mehr, damit ein Style-Modal-Wechsel live greift statt nur beim nächsten Seiten-Reload
// (lineWidth() liest den reaktiven Store live bei jedem Aufruf).
// tradeSetupShort/-Long dienen sowohl der LS-Linie (chartColors[key].alpha, Default 0.9 = "Haupt"-
// Transparenz) als auch der OB-Box, deren Fill/Border proportional dazu skalieren (Original-
// Design-Verhältnis 0.22/0.9 bzw. 0.7/0.9), siehe cssColorScaled in chartColors.js.
export const TRADE_SETUP_OB_FILL_RATIO = 0.22 / 0.9;
export const TRADE_SETUP_OB_BORDER_RATIO = 0.7 / 0.9;

// EMA braucht mehr M5-Historie als tradeSetupM5Candles (300 = ~25h) — eigener Fetch, nur solange
// der EMA-Toggle an ist (jeder Fetch ist ein frischer cTrader-TLS-Connect, siehe loadTradeSetupM5
// in PriceChart.vue). fetchTrendAnalysisM5History paginiert automatisch nach, falls dieser Wert
// über dem Edge-Function-Limit pro Request (1000) liegt.
export const TREND_ANALYSIS_CANDLE_COUNT = 1000;

// "Ranges" — H1-Fraktale im Lookback-Fenster (props.rangesPeriod/-2), Basis für
// computeRangesPivotsFor/rangesNeedsData/computeTradeSetups (collectH1LqLevels liest dieselben
// Pivots, siehe dort). Puffer vor/nach dem Lookback-Fenster: ein Fraktal braucht period+4 Kerzen
// davor und period danach, um überhaupt erkannt zu werden (siehe isUpFractal/isDownFractal in
// liquidity.js) — 20 ist für BEIDE Perioden (5 und 2) großzügig genug.
export const RANGES_CANDLE_BUFFER = 20;

// Copy-Button-Feedback-Dauer ("✓ kopiert") — siehe copyJson in PriceChart.vue für den vollen
// Feature-Kontext.
export const COPIED_FEEDBACK_MS = 1200;

// Intervall für den Dev-Server-Autosave von .debug/metadata.json — siehe der onMounted-Block in
// PriceChart.vue für den vollen Feature-Kontext (DEV-only, warum 30s).
export const DEBUG_AUTOSAVE_INTERVAL_MS = 30_000;

// TSC-Callouts ("Zeiger-Linien") — Abstand zwischen der TSC-Karten-Oberkante und der Unterkante
// des Label-Stacks darüber (siehe claudeCalloutTick in PriceChart.vue).
export const CALLOUT_STACK_GAP_PX = 10;

// Linienstärke-Multiplikator je Alters-Tier (siehe classifyAge in ageTier.ts) — verwendet in
// refreshTradeTargetLinksInternal/-TradeConfirmationLinksInternal (PriceChart.vue).
export const TARGET_TIER_WIDTH_RATIO = { minor: 1, medium: 1.6, major: 2.2 };

export const POLL_RETRY_DELAY_MS = 15_000;
export const POLL_MAX_RETRIES = 8; // ~2min zusätzlicher Puffer, bevor der reguläre Kerzenschluss-Poll übernimmt

export const REPLAY_FETCH_DEBOUNCE_MS = 400; // siehe Chat 2026-07-20: "im Replay-Modus hängt der Algo"

// Sanity-Check-Grenze für computeNextReplayTime (chartTimeUtils.js) — siehe dort für die volle
// Bug-Historie (Bug-Report Philip 2026-07-29).
export const MAX_PLAUSIBLE_GAP_SEC = 7 * 24 * 3600;
