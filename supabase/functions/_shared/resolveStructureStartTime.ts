// Löst einen 1D-Periode-4-Pivot (siehe daily-structure-pivots/index.ts) auf die tatsächliche
// 1H-Kerze auf, deren High/Low den Pivot-Preis gebildet hat — eine 1D-Kerze hat selbst keinen
// Intraday-Zeitpunkt, den der 1H-Market-Structure-Algo (marketStructureAnalysis.ts) als Cutoff
// braucht. Die 1D-Kerze definiert ihre Tagesgrenze bereits exakt: [pivot.pivotTime,
// pivot.pivotTime + 86400) ist per Konstruktion genau der Zeitraum, aus dem die 1D-Kerze ihr
// High/Low gebildet hat (kein zusätzliches Berlin-Kalendertag-Mapping nötig).
import type { Candle } from "./orderBlocks.ts";

const DAY_SECONDS = 86400;
// Analog SAME_PRICE_EPSILON (src/priceChartLiquidity.js / trading-monitor-mcp/tools/dataExport.ts)
// — Toleranz gegen Float-Rundung beim Preisvergleich, nicht exaktes `===`. Lokal statt aus
// pipConfig.js importiert (das lebt nur in trading-monitor-mcp, kein Cross-Function-Import über
// eine andere Funktion hinaus möglich, siehe CLAUDE.md "MCP-Server").
const PIP_SIZE = 0.0001;
const SAME_PRICE_EPSILON = 0.05 * PIP_SIZE;

export interface DailyPivotLike {
  direction: "high" | "low";
  price: number;
  pivotTime: number;
}

// h1Candles muss nicht vorsortiert sein — wird hier selbst chronologisch aufsteigend sortiert.
// Mehrere Treffer am selben Tag (z.B. ein Doppel-Top mit identischem Preis): ältester Treffer
// gewinnt (Philips Tie-Break-Regel). Kein Treffer (z.B. 1H-Historie für den Tag noch nicht
// archiviert) -> null, der Aufrufer lässt structure_start_time dann vorerst leer.
export function resolveStructureStartTime(pivot: DailyPivotLike, h1Candles: Candle[]): number | null {
  const dayStart = pivot.pivotTime;
  const dayEnd = pivot.pivotTime + DAY_SECONDS;
  const candidates = h1Candles
    .filter((c) => c.time >= dayStart && c.time < dayEnd)
    .filter((c) => Math.abs((pivot.direction === "high" ? c.high : c.low) - pivot.price) <= SAME_PRICE_EPSILON)
    .sort((a, b) => a.time - b.time);
  return candidates.length > 0 ? candidates[0].time : null;
}
