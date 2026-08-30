import { fetchForexCandles } from "../forexCandles.ts";
import { getObZones } from "../db.ts";
import { PIP_SIZE } from "../pipConfig.js";

// Pendant zu nearRelevantLiquidityLevels.ts, nur für OB-Zonen (Task "schlankes Schritt-5-Tool",
// 2026-08-30) — get_ob_zones hat anders als get_near_relevant_liquidity_levels bisher KEINE
// Preis-Distanz-Filterung; ohne die kamen beim Live-Test für ein aktuelles GBPUSD-Replay nur
// uralte, preislich völlig irrelevante 4H-Zonen zurück (siehe PLAN-notifications.md/Commit-
// Historie dieses Tasks). Gleiche Zeit-/Preis-Auswahlregel wie bei Liquidity:
// - touched/invalidated Zonen: relevant, wenn ihr Sweep-/Invalidierungs-Zeitpunkt (end_time) im
//   Fenster [fromSec, toSec] liegt (Zeit-Kriterium, Preis egal).
// - offene Zonen: relevant, wenn ihre Preisspanne [bottom, top] innerhalb von rangePips um den
//   Referenzpreis liegt ODER der Referenzpreis selbst innerhalb der Zone liegt — ein Band-Test
//   statt reiner Punkt-Distanz, weil eine OB-Zone (anders als ein Liquidity-Level) eine Breite hat.
// Nur 1H/4H (wie die bestehende Liquidity-Variante) — 5M-Zonen sind extrem kleinteilig/viele
// Near-Duplikate pro Kerze, das widerspricht "schlank"; 5M bleibt get_data_exports Live-Recompute
// vorbehalten (m5ObZones dort).
const DEFAULT_LOOKBACK_HOURS = 7 * 24;
// Gleicher Wert/gleiche Begründung wie SAME_PRICE_EPSILON in db.ts (dropLowerTfDuplicates) bzw.
// dataExport.ts (coincidesWithHtf) — hier eine dritte lokale Kopie statt eines Cross-Imports, da
// diese winzige Konstante nicht die Kosten eines gemeinsamen Exports rechtfertigt (siehe CLAUDE.md
// "MCP-Server" zum etablierten "lokale Kopie"-Muster in diesem Ordner).
const SAME_PRICE_EPSILON = 0.05 * PIP_SIZE;

export interface NearRelevantObZonesArgs {
  instrument: string;
  fromSec?: number;
  toSec?: number;
  rangePips?: number;
}

// 4H gewinnt vor 1H bei (praktisch) identischer Preisspanne — analog zu dropLowerTfDuplicates
// (db.ts), nur auf top/bottom statt eines einzelnen price-Werts.
function dropLowerTfDuplicateZones<T extends { top: number; bottom: number; timeframe: string }>(zones: T[]): T[] {
  const htf = zones.filter((z) => z.timeframe === "4H");
  return zones.filter(
    (z) => z.timeframe !== "1H" || !htf.some((h) => Math.abs(h.top - z.top) <= SAME_PRICE_EPSILON && Math.abs(h.bottom - z.bottom) <= SAME_PRICE_EPSILON),
  );
}

export async function buildNearRelevantObZones({ instrument, fromSec, toSec, rangePips = 40 }: NearRelevantObZonesArgs) {
  const effectiveToSec = toSec ?? Math.floor(Date.now() / 1000);
  const effectiveFromSec = fromSec ?? effectiveToSec - DEFAULT_LOOKBACK_HOURS * 3600;
  const rangePrice = rangePips * PIP_SIZE;

  // includeAll:true + asOfSec:effectiveToSec — wie buildNearRelevantLiquidityLevels: der volle,
  // Replay-konsistent zurückgerechnete Zeilensatz, der SQL-seitige !includeAll-Filter würde bei
  // aktivem asOfSec ohnehin übersprungen (siehe getObZones/db.ts).
  const [rows1h4h, priceCandles] = await Promise.all([
    getObZones(instrument, undefined, true, effectiveToSec),
    fetchForexCandles(instrument, "5m", { count: 1, toMs: effectiveToSec * 1000 }),
  ]);
  const rows = rows1h4h.filter((z) => z.timeframe === "1H" || z.timeframe === "4H");

  const referencePrice = priceCandles[priceCandles.length - 1]?.close ?? null;

  const relevant = rows.filter((z) => {
    if (z.touched || z.invalidated) {
      const endSec = z.end_time != null ? Math.floor(new Date(z.end_time).getTime() / 1000) : null;
      return endSec != null && endSec >= effectiveFromSec && endSec <= effectiveToSec;
    }
    if (referencePrice == null) return false;
    const withinBand = Math.min(Math.abs(z.top - referencePrice), Math.abs(z.bottom - referencePrice)) <= rangePrice;
    const priceInsideZone = z.bottom <= referencePrice && z.top >= referencePrice;
    return withinBand || priceInsideZone;
  });

  const deduped = dropLowerTfDuplicateZones(relevant);
  const range = { fromSec: effectiveFromSec, toSec: effectiveToSec };

  const zones = deduped.map((z) => ({
    id: z.id,
    timeframe: z.timeframe,
    direction: z.direction,
    top: z.top,
    bottom: z.bottom,
    touched: z.touched,
    invalidated: z.invalidated,
    startTime: Math.floor(new Date(z.start_time).getTime() / 1000),
    endTime: z.end_time != null ? Math.floor(new Date(z.end_time).getTime() / 1000) : null,
  }));

  return { instrument, referencePrice, range, rangePips, zones };
}
