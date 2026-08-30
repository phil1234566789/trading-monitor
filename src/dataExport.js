// Rohdaten-Export fürs Forex-Backtesting (siehe trading/chart-daten.md) — liefert M5-
// Kerzen für einen kompletten Berlin-Kalendertag, aufbereitet für Copy/Paste in den Claude-
// Project-Chat. Bewusst NUR Rohdaten, keine vorberechnete Trade-Setup-Erkennung — die soll laut
// Plan im Claude Project anhand der Strategie-Dokumente passieren, nicht hier dupliziert werden.
// LQ-Levels UND Order-Blocks (liquidityLevels/orderBlocks unten) sind die Ausnahme (Chat
// 2026-07-30, Philip: "ich meinte wirklich dasselbe was ich unter dem Indikator > Liquidität sehe:
// dort sind bereits relevante Sweeps oder ungetouchte Pivots drinne. Genau das braucht der claude"
// bzw. später "1h und 4h OBs sind jetzt bereits ganz gut gefiltert ... die kannst du bitte direkt
// zu den exportierten Backtest-Daten mit dazupacken. M5 OBs braucht claude erst mal nicht") — exakt
// dieselbe Live-Chart-Filterung (filterRelevantLevels bzw. !invalidated && !touched), NICHT an den
// gerade im Dashboard gewählten Chart-Timeframe gekoppelt. Nicht redundant zu structure1h: dort
// stecken nur BEREITS gesweepte H1-Struktur-Pivots (touched-Seite, siehe collectH1LqLevels in
// marketStructureAnalysis.ts) — eine andere Erkennung (Range-Pivots, nicht Williams-Fractal/FVG)
// mit anderem Zweck (LS-Kandidaten für Trade-Setups).
import { fetchInitialCandles } from "./forexCandles.js";
import { fmtDateTime } from "./format.js";
import { computeRangesPivots, buildMarketStructureState, summarizeMarketStructureState } from "./marketStructureAnalysis";
import { detectLiquidityLevels, filterRelevantLevels, LIQUIDITY_FRACTAL_PERIOD, LIQUIDITY_MAX_RELEVANT } from "./liquidity.js";
import { detectOrderBlocks } from "./orderBlocks.js";
import { sessions } from "./sessions.js";
import { buildSessionContextLookup, contextForPivot } from "./sessionOccurrences.js";
import { barSecondsFor } from "./timeframes.js";
import { PIP_SIZE } from "./pipConfig.js";

// EURUSD seit Chat 2026-07-28 freigeschaltet (Philip: "ich weiß wir haben noch keinen DXY da,
// aber schalte mir mal EUR frei") — DXY-Kontext fehlt weiterhin (siehe chart-daten.md),
// bewusst akzeptierte Lücke, kein Blocker mehr. Liste bleibt die einzige Quelle der Wahrheit fürs
// Modal-Dropdown.
export const EXPORT_ASSETS = ["GBPUSD", "EURUSD"];

// Asia-Session laut Philip: 00:00-07:00 Europe/Berlin, separat ausgewertet (Range/Pips fürs
// Volatilitätsgefühl) statt nur als Teil der normalen M5-Kerzenliste. Alles ab 07:00 (nach Asia)
// ist der eigentliche Handelsbereich.
const ASIA_SESSION_END_HOUR = 7;
// Puffer über die reine Tageslänge (288 M5-Kerzen/Tag) hinaus, damit Rundungen an der Tagesgrenze
// (siehe berlinDayRangeUtcMs) nie eine fehlende Randkerze verursachen — der Tages-Filter unten
// schneidet ohnehin exakt auf [start, end) zurecht.
const M5_FETCH_COUNT = 300;

// "1h-Range"-Marktstruktur-Trendalgorithmus (marketStructureAnalysis.ts) — Defaults hier nur der
// Fallback, wenn buildDataExport OHNE structureConfig aufgerufen wird. DataExportModal.vue
// übergibt normalerweise die TATSÄCHLICH im Dashboard eingestellten Werte (siehe dort), damit der
// Daten-Export exakt den Trend-State zeigt, den Philip auch im Chart sieht ("Structure"-Toggle) —
// Bug-Report Philip 2026-07-27: mit aktivem "fixer Start" erkennt der Chart einen übergeordneten
// Trend + nestedTrend, der Export (der bis dahin hart die rollierenden Defaults nutzte) nicht.
// Philip 2026-07-27: "so viel es geht übernehmen, später wieder rausschmeißen, wenns zu viel wird"
// — appliedPivots ist die eine schon jetzt als irrelevant markierte Ausnahme (siehe
// summarizeMarketStructureState-Aufruf unten).
const STRUCTURE_PERIOD_OUTER = 5;
const STRUCTURE_PERIOD_INNER = 2;
const STRUCTURE_LOOKBACK_HOURS = 7 * 24;
// Puffer VOR dem Lookback-/Fixed-Start-Fenster, damit ein Fraktal am Fensterrand nicht unerkannt
// bleibt (braucht period+4 Kerzen davor, period danach, siehe isUpFractal/isDownFractal in
// liquidity.js) — analog zu RANGES_CANDLE_BUFFER in PriceChart.vue (dort 20 für beide Perioden
// gemeinsam), hier etwas großzügiger, da EIN Fetch beide Perioden bedient.
const STRUCTURE_CANDLE_BUFFER_HOURS = 40;

// LQ-Levels (liquidity.js) UND Order-Blocks (orderBlocks.js) — gleicher Lookback wie die
// Structure-Analyse oben (7 Tage), aus demselben Grund: ein Level/eine Zone, die schon Wochen
// unberührt ist, ist oft gerade DESHALB relevant (starke, alte Liquidität/FVG), ein zu kurzes
// Fenster würde genau die interessanten Fälle abschneiden. Immer feste Timeframes (siehe
// LIQUIDITY_EXPORT_TIMEFRAMES/OB_EXPORT_TIMEFRAMES), nicht an den gerade im Dashboard gewählten
// Chart-Timeframe gekoppelt — count wird aus Lookback-Stunden + Puffer in Kerzen UMGERECHNET
// (barSecondsFor), weil "7 Tage" bei M5 eine ganz andere Kerzenzahl ergibt als bei 1H/4H.
const EXPORT_LOOKBACK_HOURS = 7 * 24;
const EXPORT_CANDLE_BUFFER = 20; // Bestätigungspuffer, wie RANGES_CANDLE_BUFFER in PriceChart.vue
const LIQUIDITY_EXPORT_TIMEFRAMES = ["1h", "5m"];
// Nur 1H+4H (Chat 2026-07-30, Philip: "1h und 4h OBs sind jetzt bereits ganz gut gefiltert ...
// M5 OBs braucht claude erst mal nicht") — M5 erzeugt bei Forex "ganz viele" Zonen (siehe
// Bug-Report zum "Indikatoren > OBs"-Feature am selben Tag), für den Claude-Project-Chat aktuell
// nicht gewünscht.
const OB_EXPORT_TIMEFRAMES = ["1h", "4h"];

const TIME_FORMATTER = new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Europe/Berlin" });
// "longOffset" liefert z.B. "GMT+2" — DST-aware statt fixem Offset, siehe CLAUDE.md
// "Trading-hours/timezone handling".
const OFFSET_FORMATTER = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Berlin", timeZoneName: "longOffset" });

function berlinOffsetMinutes(utcMs) {
  const part = OFFSET_FORMATTER.formatToParts(new Date(utcMs)).find((p) => p.type === "timeZoneName")?.value ?? "GMT+0";
  const match = part.match(/GMT([+-]\d+)/);
  return match ? Number(match[1]) * 60 : 0;
}

// Wandelt "YYYY-MM-DD" (als Berlin-Kalendertag gemeint) in UTC-ms-Grenzen [start, end) um. Offset
// wird an der Mitternachts-Guess-Zeit bestimmt — für den theoretischen Fall einer DST-Umstellung
// exakt um Mitternacht wäre das ungenau, kommt in Europe/Berlin aber nicht vor (Umstellung ist
// immer um 02:00/03:00).
export function berlinDayRangeUtcMs(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const utcGuess = Date.UTC(y, m - 1, d, 0, 0, 0);
  const offsetMin = berlinOffsetMinutes(utcGuess);
  const startUtcMs = utcGuess - offsetMin * 60_000;
  return { startUtcMs, endUtcMs: startUtcMs + 86_400_000 };
}

// Berlin-Kalendertag ("YYYY-MM-DD") eines Unix-Sekunden-Zeitpunkts — fürs Vorbelegen des
// Datumsfelds im Modal, wenn Replay aktiv ist (siehe DataExportModal.vue). "en-CA" liefert
// direkt das ISO-Format, ohne Teile manuell zusammenzusetzen.
const DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" });
export function berlinDateStrFor(unixSec) {
  return DATE_FORMATTER.format(new Date(unixSec * 1000));
}

function formatCandle(c) {
  return {
    time: TIME_FORMATTER.format(new Date(c.time * 1000)),
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    volume: c.volume,
  };
}

// Bug-Report Philip 2026-08-30: "unknown" heißt nicht Konsolidierung, sondern nur, dass der
// Algorithmus noch mehr Strukturpunkte braucht, um sich einzupegeln — reine Interna, keine
// brauchbare Info für einen Export-Konsumenten ("kann damit nichts anfangen"). Rekursiv, weil ein
// bestätigter Außentrend durchaus einen noch unbestätigten (unknown) Nested-CHoCH-Kandidaten tragen
// kann — der fliegt dann ebenfalls raus, alles darunter ist laut advanceNestedTrend
// (marketStructureAnalysis.ts) ohnehin garantiert null. Bewusst NICHT in summarizeMarketStructureState
// selbst (das speist auch das Debug-Metadaten-Panel, das die volle Rohstruktur unabhängig vom
// Bestätigungsstatus zeigen soll) — nur hier am Export-Rand gefiltert.
function dropUnknownStructureLevels(summarized) {
  if (!summarized || summarized.trend === "unknown") return null;
  return { ...summarized, nestedTrend: dropUnknownStructureLevels(summarized.nestedTrend) };
}

// Läuft bis currentTimeSec (Replay-Cutoff oder echtes "jetzt") — derselbe "wir kennen die Zukunft
// noch nicht"-Grundsatz wie beim M5-Export gilt genauso für den Trend-State, sonst würde der
// Backtest heimlich Wissen aus der Zukunft einfließen lassen.
// structureConfig übernimmt die tatsächlich im Dashboard eingestellten Werte (periodOuter/Inner,
// lookbackHoursOuter/Inner, fixedStartActive/fixedStartTime) — siehe DataExportModal.vue.
// fixedStartActive gilt für BEIDE Perioden gemeinsam (EIN gemeinsamer Startzeitpunkt), exakt wie
// computeRangesPivotsFor in PriceChart.vue: der Fixed-Start ERSETZT den rollierenden Cutoff
// komplett, lookbackHours wird in dem Fall ignoriert.
async function compute1hStructureState(asset, currentTimeSec, structureConfig = {}) {
  const {
    periodOuter = STRUCTURE_PERIOD_OUTER,
    periodInner = STRUCTURE_PERIOD_INNER,
    lookbackHoursOuter = STRUCTURE_LOOKBACK_HOURS,
    lookbackHoursInner = STRUCTURE_LOOKBACK_HOURS,
    fixedStartActive = false,
    fixedStartTime = null,
  } = structureConfig;

  const useFixedStart = fixedStartActive && fixedStartTime != null;
  const cutoffOuter = useFixedStart ? fixedStartTime : currentTimeSec - lookbackHoursOuter * 3600;
  const cutoffInner = useFixedStart ? fixedStartTime : currentTimeSec - lookbackHoursInner * 3600;
  const earliestCutoff = Math.min(cutoffOuter, cutoffInner);
  const fetchHours = Math.ceil((currentTimeSec - earliestCutoff) / 3600) + STRUCTURE_CANDLE_BUFFER_HOURS;

  const raw = await fetchInitialCandles(asset, "1h", fetchHours, currentTimeSec * 1000);
  const candles = raw.filter((c) => c.time <= currentTimeSec);
  const pivotsOuter = computeRangesPivots(candles, periodOuter, cutoffOuter, fmtDateTime);
  const pivotsInner = computeRangesPivots(candles, periodInner, cutoffInner, fmtDateTime);
  const state = buildMarketStructureState(pivotsOuter, pivotsInner, periodOuter, periodInner, candles);
  return dropUnknownStructureLevels(summarizeMarketStructureState(state, { includeAppliedPivots: false }));
}

// "YYYY-MM-DD HH:mm" (Europe/Berlin) — dieselbe Schreibweise, die Claude selbst für datierte
// Annotationen nutzt (siehe claudeAnnotations.js/trading-ablauf.md), hier nötig, weil der 7-Tage-
// Lookback fast immer Pivots von VOR dem exportierten Tag enthält (reines "HH:mm" wäre mehrdeutig).
function formatDatedTime(unixSec) {
  return `${berlinDateStrFor(unixSec)} ${TIME_FORMATTER.format(new Date(unixSec * 1000))}`;
}

// touched:false (noch aktiv) ODER touched:true (einer der RECENT_SWEEP_COUNT zuletzt gesweepten,
// siehe filterRelevantLevels in liquidity.js) — deshalb touchedAt nur bei den touched-Einträgen,
// sonst wäre es ohnehin null. context ebenso nur, wenn eine passende Session gefunden wurde.
function formatLiquidityLevel(lvl, sessionContextLookup) {
  const context = contextForPivot(lvl.pivotTime, lvl.dir, lvl.price, sessionContextLookup);
  return {
    direction: lvl.dir === 1 ? "high" : "low",
    price: lvl.price,
    time: formatDatedTime(lvl.pivotTime),
    touched: lvl.touched,
    ...(lvl.touched ? { touchedAt: formatDatedTime(lvl.touchedTime) } : {}),
    ...(context ? { context } : {}),
  };
}

async function fetchExportCandles(asset, bar, currentTimeSec) {
  const barSeconds = barSecondsFor(bar);
  const count = Math.ceil((EXPORT_LOOKBACK_HOURS * 3600) / barSeconds) + EXPORT_CANDLE_BUFFER;
  const raw = await fetchInitialCandles(asset, bar, count, currentTimeSec * 1000);
  return raw.filter((c) => c.time <= currentTimeSec);
}

// EXAKT dieselbe Auswahl wie der Live-Chart-"Liquidität"-Indikator im Normalmodus (showSweptLiquidity
// aus, siehe refreshLiquidityInternal in PriceChart.vue): filterRelevantLevels(..., onlyRelevant:
// true) behält die noch unberührten Level PLUS die RECENT_SWEEP_COUNT zuletzt gesweepten — "relevante
// Sweeps oder ungetouchte Pivots", wie Philip es nennt. Bewusst dieselbe Funktion wiederverwendet
// ("der Liquidität Algo hat ja bereits die ganze Arbeit getan"), keine eigene Neu-Filterung.
function computeLiquidityLevelsForExport(candles, asset) {
  const { highs, lows } = detectLiquidityLevels(candles, LIQUIDITY_FRACTAL_PERIOD);
  const rangeStartSec = candles.length > 0 ? candles[0].time : 0;
  const rangeEndSec = candles.length > 0 ? candles[candles.length - 1].time + 1 : 0;
  const sessionContextLookup = buildSessionContextLookup(
    sessions.filter((s) => s.instrument === asset),
    rangeStartSec,
    rangeEndSec,
    (utcSec) => berlinOffsetMinutes(utcSec * 1000),
    candles,
  );
  return {
    highs: filterRelevantLevels(highs, LIQUIDITY_MAX_RELEVANT, true).map((lvl) => formatLiquidityLevel(lvl, sessionContextLookup)),
    lows: filterRelevantLevels(lows, LIQUIDITY_MAX_RELEVANT, true).map((lvl) => formatLiquidityLevel(lvl, sessionContextLookup)),
  };
}

function formatObZone(z) {
  return {
    direction: z.dir === 1 ? "bull" : "bear",
    top: z.top,
    bottom: z.bottom,
    weak: z.weak,
    time: formatDatedTime(z.startTime),
  };
}

// EXAKT dieselbe Live-Chart-Filterung wie "Indikatoren > OBs" im Normalmodus (showHistoricalObs
// aus, siehe filterHistorical/collectObsZones in PriceChart.vue): nur nicht invalidierte UND noch
// nicht angetestete Zonen — Philip: "1h und 4h OBs sind jetzt bereits ganz gut gefiltert", keine
// zusätzliche künstliche Deckelung nötig (anders als bei LQ-Leveln gibt es hier keine
// filterRelevantLevels-Entsprechung mit fester Obergrenze).
function computeObZonesForExport(candles, bar) {
  return detectOrderBlocks(candles, bar.toUpperCase(), true)
    .filter((z) => !z.invalidated && !z.touched)
    .map(formatObZone);
}

// Holt jeden gebrauchten Timeframe genau EINMAL (1H wird sowohl für LQ-Level als auch für
// Order-Blocks gebraucht, siehe LIQUIDITY_EXPORT_TIMEFRAMES/OB_EXPORT_TIMEFRAMES) und parallel
// (Promise.all) statt nacheinander — unabhängige Fetches, kein Grund, auf den einen zu warten,
// bevor der nächste losläuft.
async function computeExportTimeframeData(asset, currentTimeSec) {
  const bars = [...new Set([...LIQUIDITY_EXPORT_TIMEFRAMES, ...OB_EXPORT_TIMEFRAMES])];
  const perBar = await Promise.all(bars.map((bar) => fetchExportCandles(asset, bar, currentTimeSec)));
  const candlesByBar = Object.fromEntries(bars.map((bar, i) => [bar, perBar[i]]));

  const liquidityLevels = Object.fromEntries(
    LIQUIDITY_EXPORT_TIMEFRAMES.map((bar) => [bar, computeLiquidityLevelsForExport(candlesByBar[bar], asset)]),
  );
  const orderBlocks = Object.fromEntries(OB_EXPORT_TIMEFRAMES.map((bar) => [bar, computeObZonesForExport(candlesByBar[bar], bar)]));
  return { liquidityLevels, orderBlocks };
}

function rangeStats(rawCandles) {
  if (rawCandles.length === 0) return { rangeHigh: null, rangeLow: null, pips: null };
  const rangeHigh = Math.max(...rawCandles.map((c) => c.high));
  const rangeLow = Math.min(...rawCandles.map((c) => c.low));
  const pips = Math.round(((rangeHigh - rangeLow) / PIP_SIZE) * 10) / 10;
  return { rangeHigh, rangeLow, pips };
}

// replayUntilSec (optional): wenn gesetzt, wird NICHTS über diesen Zeitpunkt hinaus aufgedeckt —
// simuliert fürs Backtesting bewusst "wir kennen den weiteren Tagesverlauf noch nicht", statt den
// kompletten Tag (inkl. Ausgang) auf einmal zu zeigen. Gleiche `<=`-Grenze wie clipReplay()
// (PriceChart.vue), damit ein per Replay eingestellter Zeitpunkt exakt dieselbe letzte Kerze zeigt
// wie im Chart selbst. Liegt der gewählte Tag komplett vor replayUntilSec, hat das keinen Effekt;
// liegt er komplett danach, kommt korrekterweise ein leerer Export raus (noch nichts "bekannt").
export async function buildDataExport({ asset, dateStr, replayUntilSec = null, structureConfig = {} }) {
  const { startUtcMs, endUtcMs } = berlinDayRangeUtcMs(dateStr);
  const startSec = startUtcMs / 1000;
  const endSec = endUtcMs / 1000;
  const asiaEndSec = startSec + ASIA_SESSION_END_HOUR * 3600;

  const raw = await fetchInitialCandles(asset, "5m", M5_FETCH_COUNT, endUtcMs);
  const dayCandles = raw.filter(
    (c) => c.time >= startSec && c.time < endSec && (replayUntilSec == null || c.time <= replayUntilSec),
  );
  const asiaCandlesRaw = dayCandles.filter((c) => c.time < asiaEndSec);
  const mainCandlesRaw = dayCandles.filter((c) => c.time >= asiaEndSec);

  // "Aktuelle Zeit" aus Sicht dieses Snapshots — bei aktivem Replay der simulierte Zeitpunkt (bis
  // wohin aufgedeckt wurde), sonst die echte Wanduhrzeit. Hieß vorher generatedAt und zeigte auch
  // bei aktivem Replay immer die echte Klickzeit — Philip: "die info wann ich da genau drauf
  // drücke juckt nicht wirklich, entscheidend ist was die aktuelle Zeit des Snapshots ist".
  const currentTimeSec = replayUntilSec ?? Math.floor(Date.now() / 1000);
  const structure1h = await compute1hStructureState(asset, currentTimeSec, structureConfig);
  const { liquidityLevels, orderBlocks } = await computeExportTimeframeData(asset, currentTimeSec);

  return {
    asset,
    date: dateStr,
    timezone: "Europe/Berlin",
    currentTime: fmtDateTime(currentTimeSec),
    // untilAt dupliziert currentTime bei aktivem Replay (Philip: "ist ja dasselbe Objekt wie aus
    // dem Replay-Modus" — gleiche Form wie PriceChart.vue's replay-Metadaten, bewusst konsistent
    // gehalten statt hier abzuweichen, nur um die paar Zeichen Redundanz zu sparen).
    replay: replayUntilSec == null ? { active: false } : { active: true, until: replayUntilSec, untilAt: fmtDateTime(replayUntilSec) },
    structure1h,
    liquidityLevels,
    orderBlocks,
    asiaSession: {
      ...rangeStats(asiaCandlesRaw),
      candles: asiaCandlesRaw.map(formatCandle),
    },
    candles: mainCandlesRaw.map(formatCandle),
  };
}
