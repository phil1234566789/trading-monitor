import { z } from "npm:zod@3.24.1";
import type { McpServer } from "npm:@modelcontextprotocol/sdk@^1.12.0/server/mcp.js";
import { berlinDateTimeStrFor } from "../../_shared/berlinTime.ts";
import { fetchForexCandles } from "../forexCandles.ts";
import { fetchActiveTscRangeId, fetchDealingRangeCockpit, findRecentTradeSetupIdsByKey, getLatestDailyStructureStartTime, getSessions } from "../db.ts";
import { markIgnored } from "../../_shared/ignoredCandles.ts";
import { buildNearRelevantLiquidityLevels } from "./nearRelevantLiquidityLevels.ts";
import { buildNearRelevantObZones } from "./nearRelevantObZones.ts";
import { computeCurrentEma, computeCurrentRsi } from "./reads.ts";
import { isBoxInvalidated } from "../../_shared/orderBlocks.ts";
import type { DetectedTradeSetup } from "../../_shared/tradeSetup.ts";
import { setup1StructureWindow, TRADE_SETUP_M5_CANDLE_COUNT } from "../../../../src/setup1Detection.js";
import { detectLiveSetup1 } from "../../_shared/setup1Live.ts";
import { passedTs11Setups } from "../ts11TradeSetups.ts";
import { json } from "../jsonResponse.ts";

// get_data_snapshot (Task "schlankes Schritt-5-Tool"/get-trade-setups-filtern, 2026-08-30) —
// Philip: Lana braucht ein schlankes "was ist JETZT relevant"-Bündel statt sich das aus
// get_data_export/get_trade_setups selbst zusammenzusuchen, live UND für einen Backtest/Replay-
// Zeitpunkt (replayUntilSec, dieselbe Konvention wie get_data_export/get_forex_ema/get_forex_rsi).
// Bewusst enger als get_near_relevant_liquidity_levels (40 Pips/7 Tage) — dieses Tool ist für
// "gerade jetzt", nicht für ein Tages-Gesamtbild, wird laut Philip mehrfach pro Tag aufgerufen.
const SNAPSHOT_RANGE_PIPS = 15;
const SNAPSHOT_RECENCY_HOURS = 24;
const SETUP_MAX_AGE_HOURS = 48;

// Task "Live-Trade-Setup-Erkennung serverseitig für Lana" (2026-09-05): live aus frisch geholten
// Kerzen statt aus dem Cron-Schreibstand, mit derselben Pipeline wie Chart und poi-watcher
// (src/setup1Detection.js: M5-Fenster, H1-Struktur-Level, Parameter).

function curateLiveTradeSetup(direction: "long" | "short", setup: DetectedTradeSetup | null, asOfSec: number, persistedIdByKey: Map<string, number>) {
  if (!setup) return null;
  // ageHours bezieht sich auf obStartTime (Bestätigungszeitpunkt des Setups), NICHT auf
  // fractal.pivotTime: ohne bestätigtes Fraktal ist fractal === ls (siehe tradeSetup.ts), dessen
  // Pivot beliebig alt sein kann, obwohl der bestätigende OB gerade erst entstanden ist.
  const ageHours = (asOfSec - setup.obStartTime) / 3600;
  if (ageHours > SETUP_MAX_AGE_HOURS) return null;
  return {
    // id nur gesetzt, wenn poi-watcher dasselbe Setup (Key: direction+ob_start_time, wie
    // dessen eigener Dedup-Check) bereits selbst persistiert hat — der dokumentierte Weg fürs
    // Verlinken (create_trade/update_dealing_range) bleibt get_trade_setups (siehe trades.ts),
    // hier nur Komfort-Match. Kein obZoneId-Feld (mehr) — add_trade_confirmation(kind='ob')/
    // add_pin_entry(kind='m5_ob') lösen die OB-Zone selbst per Find-or-Create aus obTop/obBottom/
    // obStartTime auf (idempotent), eine ID hier vorab aufzulösen hätte für jeden Snapshot-Call den
    // kompletten 5M-ob_zones-Bestand gebraucht, ohne dass sie irgendwo tatsächlich gebraucht wird.
    id: persistedIdByKey.get(`${direction}_${setup.obStartTime}`) ?? null,
    // Der Preis, der halten muss — ferne OB-Kante, identisch mit der generierten Spalte
    // trade_setups.invalidation (siehe deriveSetupEntryInvalidation in der JS-Kopie).
    invalidation: direction === "short" ? setup.obTop : setup.obBottom,
    fractalPrice: setup.fractal.price,
    fractalPivotTime: setup.fractal.pivotTime,
    lsPrice: setup.ls.price,
    lsPivotTime: setup.ls.pivotTime,
    lsTouchedTime: setup.ls.touchedTime,
    obTop: setup.obTop,
    obBottom: setup.obBottom,
    obStartTime: setup.obStartTime,
    ageHours: Math.round(ageHours * 100) / 100,
  };
}

// detectSetupObs/detectTradeSetup führen selbst KEINEN Invalidierungs-Check auf die gefundene OB-Box
// durch (SetupOb hat kein invalidated-Feld, siehe tradeSetup.ts) — ohne diesen Check würde ein
// Setup, dessen OB seither per Wick überschritten (siehe isBoxInvalidated/orderBlocks.ts) und damit
// tot ist, trotzdem als aktuelles Setup ausgegeben (Bug-Report Philip 2026-09-05, GBPUSD-Setup #443:
// OB 1.35923–1.3595 wurde um 16:00 bis 1.35966 durchstochen, danach als bärische Resistance tot).
// Eigener, exakt bedarfsgroßer Kerzen-Fetch ab obStartTime statt des festen Erkennungsfensters unten.
async function isSetupObStillValid(
  instrument: string,
  obStartTime: number,
  obTop: number,
  obBottom: number,
  direction: "long" | "short",
  asOfSec: number,
): Promise<boolean> {
  if (asOfSec <= obStartTime) return true;
  const count = Math.ceil((asOfSec - obStartTime) / 300) + 2;
  const candles = await fetchForexCandles(instrument, "5m", { count, toMs: asOfSec * 1000 });
  const sinceOb = candles.filter((c) => c.time > obStartTime && c.time <= asOfSec);
  const dir: 1 | -1 = direction === "long" ? 1 : -1;
  return !isBoxInvalidated(sinceOb, { top: obTop, bottom: obBottom }, dir);
}

export interface DataSnapshotArgs {
  instrument: string;
  replayUntilSec?: number;
}

export async function buildDataSnapshot({ instrument, replayUntilSec }: DataSnapshotArgs) {
  const asOfSec = replayUntilSec ?? Math.floor(Date.now() / 1000);
  const fromSec = asOfSec - SNAPSHOT_RECENCY_HOURS * 3600;
  const setupIdLookupSinceSec = asOfSec - SETUP_MAX_AGE_HOURS * 3600;

  const structureStartSec = await getLatestDailyStructureStartTime(instrument, asOfSec);
  const [priceCandles, m5CandlesRoh, h1CandlesRoh, persistedIdByKey, liquidity, obZones, ema, rsi, activeTscRangeId, sessionConfigs] = await Promise.all([
    fetchForexCandles(instrument, "5m", { count: 1, toMs: asOfSec * 1000 }),
    fetchForexCandles(instrument, "5m", { count: TRADE_SETUP_M5_CANDLE_COUNT, toMs: asOfSec * 1000 }),
    fetchForexCandles(instrument, "1h", { count: setup1StructureWindow(asOfSec, structureStartSec).count, toMs: asOfSec * 1000 }),
    findRecentTradeSetupIdsByKey(instrument, setupIdLookupSinceSec, asOfSec),
    buildNearRelevantLiquidityLevels({ instrument, fromSec, toSec: asOfSec, rangePips: SNAPSHOT_RANGE_PIPS }),
    buildNearRelevantObZones({ instrument, fromSec, toSec: asOfSec, rangePips: SNAPSHOT_RANGE_PIPS }),
    computeCurrentEma(instrument, replayUntilSec),
    computeCurrentRsi(instrument, replayUntilSec),
    fetchActiveTscRangeId(instrument),
    getSessions(instrument),
  ]);

  const referencePrice = priceCandles[priceCandles.length - 1]?.close ?? null;
  // Je Richtung das neueste Setup aus derselben Erkennung wie poi-watcher. Spread
  // Hour vorher markiert (markIgnoredCandles); asOfSec trifft auch im Replay den simulierten Zeitpunkt.
  const live = detectLiveSetup1({ instrument, m5Candles: markIgnored(m5CandlesRoh, sessionConfigs),
    h1Candles: markIgnored(h1CandlesRoh, sessionConfigs), nowSec: asOfSec, structureStartSec, currentPrice: referencePrice });
  // Nur TS1.1-bestandene Setups (dasselbe Urteil wie Chart und dob-watcher), TS1.0 gibt es nicht mehr.
  const fresh = await passedTs11Setups(instrument, [...live.detected, ...live.ts11Only].sort((a, b) => a.obStartTime - b.obStartTime), asOfSec);
  const detectedShort = fresh.filter((s) => s.dir === 1).at(-1) ?? null;
  const detectedLong = fresh.filter((s) => s.dir === -1).at(-1) ?? null;

  const [longObValid, shortObValid] = await Promise.all([
    detectedLong ? isSetupObStillValid(instrument, detectedLong.obStartTime, detectedLong.obTop, detectedLong.obBottom, "long", asOfSec) : true,
    detectedShort ? isSetupObStillValid(instrument, detectedShort.obStartTime, detectedShort.obTop, detectedShort.obBottom, "short", asOfSec) : true,
  ]);

  // Nur id+direction, nicht der volle Cockpit (Confirmations/Targets) — das bleibt get_tsc_range
  // vorbehalten, damit dieses Tool schlank bleibt.
  const tscRange = activeTscRangeId == null ? null : await fetchDealingRangeCockpit(activeTscRangeId).then((r) => (r ? { id: r.id, direction: r.direction } : null));

  return {
    instrument,
    asOf: { sec: asOfSec, at: berlinDateTimeStrFor(asOfSec), timezone: "Europe/Berlin" },
    replay: replayUntilSec == null ? { active: false } : { active: true, until: replayUntilSec },
    referencePrice,
    tradeSetups: {
      long: longObValid ? curateLiveTradeSetup("long", detectedLong, asOfSec, persistedIdByKey) : null,
      short: shortObValid ? curateLiveTradeSetup("short", detectedShort, asOfSec, persistedIdByKey) : null,
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
        `TS1.1-Setup (nur mit bestandenem TS1.1-Urteil wie Chart und dob-watcher; max. ${SETUP_MAX_AGE_HOURS}h alt ODER dessen OB seither per Wick durchstochen, ` +
        "sonst null), aktuelle EMA(50/200) und " +
        "RSI(14) NUR als Punkt (keine Serie), sowie der Status der offenen TSC-Idee (id+direction " +
        "oder null, siehe get_tsc_range für die volle Cockpit-Ansicht mit Confirmations/Targets). " +
        "Ohne replayUntilSec live 'jetzt', mit replayUntilSec ein Backtest/Replay-Zeitpunkt " +
        "(gleiche Semantik wie get_data_export) — TS1.1-Setups werden live aus den Kerzen bis " +
        "replayUntilSec neu erkannt (dieselbe Erkennung wie poi-watcher, nicht dessen historischer " +
        "Schreibstand), ein Replay sieht daher nie ein Setup, dessen Muster erst nach dem " +
        "simulierten Zeitpunkt entstanden ist.",
      inputSchema: {
        instrument: z.enum(["GBPUSD", "EURUSD"]).describe("Forex-Instrument"),
        replayUntilSec: z.number().optional().describe("Unix-Sekunden — Backtest/Replay-Zeitpunkt statt live 'jetzt'"),
      },
    },
    async ({ instrument, replayUntilSec }) => json(await buildDataSnapshot({ instrument, replayUntilSec })),
  );
}
