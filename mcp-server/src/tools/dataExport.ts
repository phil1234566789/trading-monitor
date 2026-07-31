import { fetchForexCandles, type Candle } from "../forexCandles.js";
import { berlinDayRangeUtcMs, berlinDateStrFor } from "../berlinTime.js";
import { getObZones, getLiquidityLevels } from "../db.js";

// Asia-Session laut Philip: 00:00-07:00 Europe/Berlin, separat ausgewertet — siehe
// src/dataExport.js ASIA_SESSION_END_HOUR (dieselbe Konvention, hier dupliziert statt importiert,
// siehe CLAUDE.md "MCP-Server" für die Begründung).
const ASIA_SESSION_END_HOUR = 7;
const M5_FETCH_COUNT = 300;

function rangeStats(rawCandles: Candle[]) {
  if (rawCandles.length === 0) return { rangeHigh: null, rangeLow: null };
  const rangeHigh = Math.max(...rawCandles.map((c) => c.high));
  const rangeLow = Math.min(...rawCandles.map((c) => c.low));
  return { rangeHigh, rangeLow };
}

export interface DataExportArgs {
  instrument: string;
  dateStr?: string;
  replayUntilSec?: number;
}

// Haupt-Einstiegspunkt für Claude (siehe CLAUDE.md "MCP-Server") — bündelt M5-Kerzen des Tages +
// Asia-Session-Range, relevante Liquidity-Level und relevante OB-Zonen in einem Call, damit Claude
// sich NICHT erst durch mehrere Einzel-Tools hangeln muss, um sich ein Bild zu machen. KEIN
// 1H-Structure-Trend (siehe CLAUDE.md-Begründung: marketStructureAnalysis.ts hängt transitiv an
// Browser-Only-Code, für v1 bewusst ausgeklammert).
export async function buildDataExport({ instrument, dateStr, replayUntilSec }: DataExportArgs) {
  const effectiveDateStr = dateStr ?? berlinDateStrFor(replayUntilSec ?? Math.floor(Date.now() / 1000));
  const { startUtcMs, endUtcMs } = berlinDayRangeUtcMs(effectiveDateStr);
  const startSec = startUtcMs / 1000;
  const endSec = endUtcMs / 1000;
  const asiaEndSec = startSec + ASIA_SESSION_END_HOUR * 3600;

  const raw = await fetchForexCandles(instrument, "5m", { count: M5_FETCH_COUNT, toMs: endUtcMs });
  const dayCandles = raw.filter((c) => c.time >= startSec && c.time < endSec && (replayUntilSec == null || c.time <= replayUntilSec));
  const asiaCandles = dayCandles.filter((c) => c.time < asiaEndSec);
  const mainCandles = dayCandles.filter((c) => c.time >= asiaEndSec);

  const [liquidityLevels, obZones] = await Promise.all([getLiquidityLevels(instrument), getObZones(instrument)]);

  return {
    instrument,
    date: effectiveDateStr,
    timezone: "Europe/Berlin",
    replay: replayUntilSec == null ? { active: false } : { active: true, until: replayUntilSec },
    liquidityLevels,
    obZones,
    asiaSession: { ...rangeStats(asiaCandles), candles: asiaCandles },
    candles: mainCandles,
  };
}
