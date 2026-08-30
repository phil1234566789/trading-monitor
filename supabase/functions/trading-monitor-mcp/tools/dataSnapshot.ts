import { z } from "npm:zod@3.24.1";
import type { McpServer } from "npm:@modelcontextprotocol/sdk@^1.12.0/server/mcp.js";
import { berlinDateTimeStrFor } from "../berlinTime.ts";
import { fetchForexCandles } from "../forexCandles.ts";
import { getLatestTradeSetupPerDirection, fetchActiveTscRangeId, fetchDealingRangeCockpit } from "../db.ts";
import { buildNearRelevantLiquidityLevels } from "./nearRelevantLiquidityLevels.ts";
import { buildNearRelevantObZones } from "./nearRelevantObZones.ts";
import { computeCurrentEma, computeCurrentRsi } from "./reads.ts";

function json(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

// get_data_snapshot (Task "schlankes Schritt-5-Tool"/get-trade-setups-filtern, 2026-08-30) —
// Philip: Lana braucht ein schlankes "was ist JETZT relevant"-Bündel statt sich das aus
// get_data_export/get_trade_setups selbst zusammenzusuchen, live UND für einen Backtest/Replay-
// Zeitpunkt (replayUntilSec, dieselbe Konvention wie get_data_export/get_forex_ema/get_forex_rsi).
// Bewusst enger als get_near_relevant_liquidity_levels (40 Pips/7 Tage) — dieses Tool ist für
// "gerade jetzt", nicht für ein Tages-Gesamtbild, wird laut Philip mehrfach pro Tag aufgerufen.
const SNAPSHOT_RANGE_PIPS = 15;
const SNAPSHOT_RECENCY_HOURS = 24;
const SETUP_MAX_AGE_HOURS = 48;

// Curated Felder statt roher trade_setups-Zeile (notified/notified_at/alert_price/created_at/
// updated_at raus) — ageHours bezieht sich auf fractal_pivot_time (Alter des Musters selbst, siehe
// getLatestTradeSetupPerDirection/db.ts), obZoneId bleibt drin, damit Lana per ID gegen eine
// OB-Zone matchen kann (z.B. für add_trade_confirmation kind='ob'), analog zu m5ObZoneIdByKey in
// dataExport.ts.
function curateTradeSetup(row: Record<string, unknown> | null, asOfSec: number) {
  if (!row) return null;
  const fractalPivotTime = Math.floor(new Date(row.fractal_pivot_time as string).getTime() / 1000);
  return {
    id: row.id,
    fractalPrice: row.fractal_price,
    fractalPivotTime,
    lsPrice: row.ls_price,
    lsPivotTime: Math.floor(new Date(row.ls_pivot_time as string).getTime() / 1000),
    lsTouchedTime: Math.floor(new Date(row.ls_touched_time as string).getTime() / 1000),
    obTop: row.ob_top,
    obBottom: row.ob_bottom,
    obStartTime: Math.floor(new Date(row.ob_start_time as string).getTime() / 1000),
    obZoneId: row.ob_zone_id ?? null,
    ageHours: Math.round(((asOfSec - fractalPivotTime) / 3600) * 100) / 100,
  };
}

export interface DataSnapshotArgs {
  instrument: string;
  replayUntilSec?: number;
}

export async function buildDataSnapshot({ instrument, replayUntilSec }: DataSnapshotArgs) {
  const asOfSec = replayUntilSec ?? Math.floor(Date.now() / 1000);
  const fromSec = asOfSec - SNAPSHOT_RECENCY_HOURS * 3600;

  const [priceCandles, setups, liquidity, obZones, ema, rsi, activeTscRangeId] = await Promise.all([
    fetchForexCandles(instrument, "5m", { count: 1, toMs: asOfSec * 1000 }),
    getLatestTradeSetupPerDirection(instrument, replayUntilSec, SETUP_MAX_AGE_HOURS),
    buildNearRelevantLiquidityLevels({ instrument, fromSec, toSec: asOfSec, rangePips: SNAPSHOT_RANGE_PIPS }),
    buildNearRelevantObZones({ instrument, fromSec, toSec: asOfSec, rangePips: SNAPSHOT_RANGE_PIPS }),
    computeCurrentEma(instrument, replayUntilSec),
    computeCurrentRsi(instrument, replayUntilSec),
    fetchActiveTscRangeId(instrument),
  ]);

  // Nur id+direction, nicht der volle Cockpit (Confirmations/Targets) — das bleibt get_tsc_range
  // vorbehalten, damit dieses Tool schlank bleibt.
  const tscRange = activeTscRangeId == null ? null : await fetchDealingRangeCockpit(activeTscRangeId).then((r) => (r ? { id: r.id, direction: r.direction } : null));

  const referencePrice = priceCandles[priceCandles.length - 1]?.close ?? null;

  return {
    instrument,
    asOf: { sec: asOfSec, at: berlinDateTimeStrFor(asOfSec), timezone: "Europe/Berlin" },
    replay: replayUntilSec == null ? { active: false } : { active: true, until: replayUntilSec },
    referencePrice,
    tradeSetups: {
      long: curateTradeSetup(setups.long, asOfSec),
      short: curateTradeSetup(setups.short, asOfSec),
    },
    // Nur 1H/4H (wie obZones) — buildNearRelevantLiquidityLevels filtert anders als
    // buildNearRelevantObZones NICHT nach Timeframe (get_near_relevant_liquidity_levels liefert
    // bewusst auch 5M mit), hier aber zusätzlich gefiltert, damit "schlank" auch für Liquidity
    // gilt (Bug-Report Philip 2026-08-30, live beim ersten echten Testaufruf aufgefallen: 9 5M-
    // Einträge landeten unfiltriert mit in der Antwort). Ohne context/kontext-Session-Label
    // (anders als get_near_relevant_liquidity_levels) — bewusst weggelassen, das ist für "gerade
    // jetzt" kein Mehrwert und hält die Response klein.
    liquidity: liquidity.levels
      .filter((l) => l.timeframe === "1H" || l.timeframe === "4H")
      .map(({ context: _context, kontext: _kontext, ...rest }) => rest),
    obZones: obZones.zones,
    ema,
    rsi,
    tscRange,
  };
}

export function registerDataSnapshotTools(server: McpServer) {
  server.registerTool(
    "get_data_snapshot",
    {
      title: "Daten-Snapshot (Jetzt-Zeitpunkt)",
      description:
        "Schlankes 'was ist JETZT relevant'-Bündel für Lana (statt get_data_export erneut zu " +
        "senden oder sich das aus mehreren Einzel-Tools selbst zusammenzusuchen) — gedacht für " +
        `häufige Aufrufe pro Tag, deshalb eng gefasst: umliegende Liquidity-Level/OB-Zonen ` +
        `(1H/4H, ${SNAPSHOT_RANGE_PIPS} Pips um den aktuellen Kurs ODER innerhalb der letzten ` +
        `${SNAPSHOT_RECENCY_HOURS}h geswept/invalidiert), je Richtung nur das aktuellste ` +
        `Trade-Setup (max. ${SETUP_MAX_AGE_HOURS}h alt, sonst null), aktuelle EMA(50/200) und ` +
        "RSI(14) NUR als Punkt (keine Serie), sowie der Status der offenen TSC-Idee (id+direction " +
        "oder null, siehe get_tsc_range für die volle Cockpit-Ansicht mit Confirmations/Targets). " +
        "Ohne replayUntilSec live 'jetzt', mit replayUntilSec ein Backtest/Replay-Zeitpunkt " +
        "(gleiche Semantik wie get_data_export) — Trade-Setups werden dabei anhand ihres " +
        "Erkennungszeitpunkts gefiltert, nicht anhand des Musterzeitpunkts, damit ein Replay kein " +
        "Setup sieht, das poi-watcher zu diesem simulierten Zeitpunkt noch gar nicht erkannt hatte.",
      inputSchema: {
        instrument: z.enum(["GBPUSD", "EURUSD"]).describe("Forex-Instrument"),
        replayUntilSec: z.number().optional().describe("Unix-Sekunden — Backtest/Replay-Zeitpunkt statt live 'jetzt'"),
      },
    },
    async ({ instrument, replayUntilSec }) => json(await buildDataSnapshot({ instrument, replayUntilSec })),
  );
}
