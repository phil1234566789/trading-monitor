// Rohdaten-Export fürs Forex-Backtesting (siehe trading/backtest-instructions.md) — liefert M5-
// Kerzen für einen kompletten Berlin-Kalendertag, aufbereitet für Copy/Paste in den Claude-
// Project-Chat. Bewusst NUR Rohdaten, keine vorberechneten OB-/Liquiditätszonen — die Setup-
// Erkennung soll laut Plan im Claude Project anhand der Strategie-Dokumente passieren, nicht hier
// dupliziert werden.
import { fetchInitialCandles } from "./forexCandles.js";
import { fmtDateTime } from "./format.js";
import { computeRangesPivots, buildMarketStructureState, summarizeMarketStructureState } from "./marketStructureAnalysis";

// EURUSD seit Chat 2026-07-28 freigeschaltet (Philip: "ich weiß wir haben noch keinen DXY da,
// aber schalte mir mal EUR frei") — DXY-Kontext fehlt weiterhin (siehe backtest-instructions.md),
// bewusst akzeptierte Lücke, kein Blocker mehr. Liste bleibt die einzige Quelle der Wahrheit fürs
// Modal-Dropdown.
export const BACKTEST_ASSETS = ["GBPUSD", "EURUSD"];

// Asia-Session laut Philip: 00:00-07:00 Europe/Berlin, separat ausgewertet (Range/Pips fürs
// Volatilitätsgefühl) statt nur als Teil der normalen M5-Kerzenliste. Alles ab 07:00 (nach Asia)
// ist der eigentliche Handelsbereich.
const ASIA_SESSION_END_HOUR = 7;
// 1 Pip = 0.0001 bei GBPUSD/EURUSD (5. Nachkommastelle ist die Pipette) — siehe CLAUDE.md/Twelve-
// Data-Client-Kommentar zu 5-Dezimalstellen-Präzision bei Forex.
const PIP_SIZE = 0.0001;
// Puffer über die reine Tageslänge (288 M5-Kerzen/Tag) hinaus, damit Rundungen an der Tagesgrenze
// (siehe berlinDayRangeUtcMs) nie eine fehlende Randkerze verursachen — der Tages-Filter unten
// schneidet ohnehin exakt auf [start, end) zurecht.
const M5_FETCH_COUNT = 300;

// "1h-Range"-Marktstruktur-Trendalgorithmus (marketStructureAnalysis.ts) — Defaults hier nur der
// Fallback, wenn buildBacktestExport OHNE structureConfig aufgerufen wird. BacktestExportModal.vue
// übergibt normalerweise die TATSÄCHLICH im Dashboard eingestellten Werte (siehe dort), damit der
// Backtest-Export exakt den Trend-State zeigt, den Philip auch im Chart sieht ("Structure"-Toggle) —
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
// Datumsfelds im Modal, wenn Replay aktiv ist (siehe BacktestExportModal.vue). "en-CA" liefert
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

// Läuft bis currentTimeSec (Replay-Cutoff oder echtes "jetzt") — derselbe "wir kennen die Zukunft
// noch nicht"-Grundsatz wie beim M5-Export gilt genauso für den Trend-State, sonst würde der
// Backtest heimlich Wissen aus der Zukunft einfließen lassen.
// structureConfig übernimmt die tatsächlich im Dashboard eingestellten Werte (periodOuter/Inner,
// lookbackHoursOuter/Inner, fixedStartActive/fixedStartTime) — siehe BacktestExportModal.vue.
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
  return summarizeMarketStructureState(state, { includeAppliedPivots: false });
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
export async function buildBacktestExport({ asset, dateStr, replayUntilSec = null, structureConfig = {} }) {
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
    asiaSession: {
      ...rangeStats(asiaCandlesRaw),
      candles: asiaCandlesRaw.map(formatCandle),
    },
    candles: mainCandlesRaw.map(formatCandle),
  };
}
