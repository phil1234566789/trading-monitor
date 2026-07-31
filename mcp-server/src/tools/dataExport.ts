import { fetchForexCandles, type Candle } from "../forexCandles.js";
import { berlinDayRangeUtcMs, berlinDateStrFor, berlinDateTimeStrFor } from "../berlinTime.js";
import { getObZones, getLiquidityLevels } from "../db.js";
// Reine Trend-Mathematik (siehe CLAUDE.md "MCP-Server") — seit dem Split von marketStructureAnalysis.ts
// (Chat 2026-07-31, Rendering lebt jetzt separat in marketStructureRendering.ts) frei von Browser-
// Abhängigkeiten und direkt aus dem Frontend-Quellbaum importierbar, kein dritter Algorithmus-Port.
import { computeRangesPivots, buildMarketStructureState, summarizeMarketStructureState } from "../../../src/marketStructureAnalysis.js";

// Asia-Session laut Philip: 00:00-07:00 Europe/Berlin, separat ausgewertet — siehe
// src/dataExport.js ASIA_SESSION_END_HOUR (dieselbe Konvention, hier dupliziert statt importiert,
// siehe CLAUDE.md "MCP-Server" für die Begründung).
const ASIA_SESSION_END_HOUR = 7;
const M5_FETCH_COUNT = 300;

// Defaults exakt wie im "Daten-Export"-Button (src/dataExport.js) — dieselben rollierenden
// Lookback-Werte, damit L ohne explizite structureConfig-Angabe dasselbe sieht wie der Chart im
// Standard-Zustand. Philips TATSÄCHLICH im Dashboard eingestellte Werte (falls von den Defaults
// abweichend, z.B. "fixer Start") leben nur in seinem Browser-localStorage (siehe CLAUDE.md-Notiz)
// — dafür nimmt get_data_export optionale structureConfig-Parameter entgegen, die L bei Bedarf von
// Philip erfragen kann, statt sie zu erraten.
const STRUCTURE_PERIOD_OUTER = 5;
const STRUCTURE_PERIOD_INNER = 2;
const STRUCTURE_LOOKBACK_HOURS = 7 * 24;
const STRUCTURE_CANDLE_BUFFER_HOURS = 40;

function rangeStats(rawCandles: Candle[]) {
  if (rawCandles.length === 0) return { rangeHigh: null, rangeLow: null };
  const rangeHigh = Math.max(...rawCandles.map((c) => c.high));
  const rangeLow = Math.min(...rawCandles.map((c) => c.low));
  return { rangeHigh, rangeLow };
}

export interface StructureConfig {
  periodOuter?: number;
  periodInner?: number;
  lookbackHoursOuter?: number;
  lookbackHoursInner?: number;
  fixedStartActive?: boolean;
  fixedStartTime?: number | null;
}

// Port von compute1hStructureState (src/dataExport.js) — identische Logik, nur candles über den
// mcp-server-eigenen forexCandles.ts-Client statt src/forexCandles.js geholt. Gibt zusätzlich zum
// Trend-State das TATSÄCHLICH verwendete Zeitfenster zurück (window) — Philip: "L soll immer den
// Startpunkt des Trend-Algos mit einzeichnen, damit ich abchecken kann, ob das passt, denn was L
// sieht ist ja nicht zwingend dasselbe, was ich im Chart sehe" (2026-07-31). Ohne das hätte L keine
// Möglichkeit, Philip zu zeigen, ab welchem Zeitpunkt sie tatsächlich gerechnet hat.
async function compute1hStructureState(instrument: string, currentTimeSec: number, structureConfig: StructureConfig = {}) {
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

  const raw = await fetchForexCandles(instrument, "1h", { count: fetchHours, toMs: currentTimeSec * 1000 });
  const candles = raw.filter((c) => c.time <= currentTimeSec);
  const pivotsOuter = computeRangesPivots(candles, periodOuter, cutoffOuter);
  const pivotsInner = computeRangesPivots(candles, periodInner, cutoffInner);
  const state = buildMarketStructureState(pivotsOuter, pivotsInner, periodOuter, periodInner, candles);
  return {
    trend: summarizeMarketStructureState(state, { includeAppliedPivots: false }),
    window: {
      periodOuter,
      periodInner,
      fixedStartActive: useFixedStart,
      cutoffOuter,
      cutoffOuterAt: berlinDateTimeStrFor(cutoffOuter),
      cutoffInner,
      cutoffInnerAt: berlinDateTimeStrFor(cutoffInner),
    },
  };
}

export interface DataExportArgs {
  instrument: string;
  dateStr?: string;
  replayUntilSec?: number;
  structureConfig?: StructureConfig;
}

// Haupt-Einstiegspunkt für Claude (siehe CLAUDE.md "MCP-Server") — bündelt M5-Kerzen des Tages +
// Asia-Session-Range, relevante Liquidity-Level, relevante OB-Zonen UND den 1H-Structure-Trend in
// einem Call, damit Claude sich nicht erst durch mehrere Einzel-Tools hangeln muss.
export async function buildDataExport({ instrument, dateStr, replayUntilSec, structureConfig }: DataExportArgs) {
  const effectiveDateStr = dateStr ?? berlinDateStrFor(replayUntilSec ?? Math.floor(Date.now() / 1000));
  const { startUtcMs, endUtcMs } = berlinDayRangeUtcMs(effectiveDateStr);
  const startSec = startUtcMs / 1000;
  const endSec = endUtcMs / 1000;
  const asiaEndSec = startSec + ASIA_SESSION_END_HOUR * 3600;

  const raw = await fetchForexCandles(instrument, "5m", { count: M5_FETCH_COUNT, toMs: endUtcMs });
  const dayCandles = raw.filter((c) => c.time >= startSec && c.time < endSec && (replayUntilSec == null || c.time <= replayUntilSec));
  const asiaCandles = dayCandles.filter((c) => c.time < asiaEndSec);
  const mainCandles = dayCandles.filter((c) => c.time >= asiaEndSec);

  // "Aktuelle Zeit" aus Sicht dieses Snapshots — bei aktivem Replay der simulierte Zeitpunkt, sonst
  // die echte Wanduhrzeit (analog src/dataExport.js currentTimeSec).
  const currentTimeSec = replayUntilSec ?? Math.floor(Date.now() / 1000);

  const [liquidityLevels, obZones, structureResult] = await Promise.all([
    getLiquidityLevels(instrument),
    getObZones(instrument),
    compute1hStructureState(instrument, currentTimeSec, structureConfig),
  ]);

  return {
    instrument,
    date: effectiveDateStr,
    timezone: "Europe/Berlin",
    replay: replayUntilSec == null ? { active: false } : { active: true, until: replayUntilSec },
    structure1h: structureResult.trend,
    // Siehe compute1hStructureState oben: der tatsächlich verwendete Cutoff, damit L ihn immer als
    // Marker/Linie einzeichnen kann (post_chart_annotations) — Philips Sichtkontrolle gegen den
    // eigenen Chart.
    structureWindow: structureResult.window,
    liquidityLevels,
    obZones,
    asiaSession: { ...rangeStats(asiaCandles), candles: asiaCandles },
    candles: mainCandles,
  };
}
