import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getObZones, getLiquidityLevels, getTradeSetups, getJournal, getNewsEvents, getTradingSchedule } from "../db.js";
import { fetchForexCandles } from "../forexCandles.js";
import { buildDataExport } from "./dataExport.js";

function json(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

const INSTRUMENT = z.enum(["GBPUSD", "EURUSD"]).describe("Forex-Instrument");

// Registriert alle Read-Tools am Server. get_data_export zuerst und mit Beschreibung, die Claude
// aktiv dazu anhält, es zuerst aufzurufen (Philips Punkt: nicht zig einzelne GETs am Gesprächs-
// anfang) — die granularen Tools danach für alles, was das Bündel nicht abdeckt.
export function registerReadTools(server: McpServer) {
  server.registerTool(
    "get_data_export",
    {
      title: "Daten-Export (Gesamtbild)",
      description:
        "RUFE DIESES TOOL ZUERST AUF, bevor du andere trading-monitor-Tools nutzt. Liefert in einem " +
        "Call: M5-Kerzen des Tages + Asia-Session-Range, den 1H-Structure-Trend, relevante " +
        "Liquidity-Level (1H+M5) und relevante OB-Zonen (1H+4H) für ein Instrument — dasselbe " +
        "Bündel wie der 'Daten-Export'-Button in der App. Nutze die granularen get_*-Tools nur, " +
        "wenn du darüber hinaus mehr brauchst (andere Zeitspanne, Journal, News, Handelszeiten). " +
        "Der Structure-Trend nutzt standardmäßig einen rollierenden 7-Tage-Lookback (Periode " +
        "5/2) — falls Philip im Dashboard einen 'fixen Start' eingestellt hat (nur in seinem " +
        "Browser-localStorage sichtbar, nicht von hier aus abfragbar), frag ihn danach und gib es " +
        "über structureConfig mit.",
      inputSchema: {
        instrument: INSTRUMENT,
        dateStr: z.string().optional().describe("YYYY-MM-DD (Europe/Berlin), Default: heute"),
        replayUntilSec: z.number().optional().describe("Unix-Sekunden — deckt nur bis zu diesem Zeitpunkt auf (Replay-Simulation)"),
        structureConfig: z
          .object({
            periodOuter: z.number().int().positive().optional().describe("Default 5"),
            periodInner: z.number().int().positive().optional().describe("Default 2"),
            lookbackHoursOuter: z.number().positive().optional().describe("Default 168 (7 Tage)"),
            lookbackHoursInner: z.number().positive().optional().describe("Default 168 (7 Tage)"),
            fixedStartActive: z.boolean().optional().describe("true = fixedStartTime statt rollierendem Lookback nutzen"),
            fixedStartTime: z.number().optional().describe("Unix-Sekunden, nur relevant wenn fixedStartActive"),
          })
          .optional()
          .describe("Nur setzen, wenn Philip explizit von den Dashboard-Defaults abweichende Structure-Settings nennt"),
      },
    },
    async ({ instrument, dateStr, replayUntilSec, structureConfig }) =>
      json(await buildDataExport({ instrument, dateStr, replayUntilSec, structureConfig })),
  );

  server.registerTool(
    "get_ob_zones",
    {
      title: "OB-Zonen",
      description: "Order-Block-Zonen aus der ob_zones-Tabelle (von poi-watcher alle 5min aktualisiert). Default: nur nicht-invalidierte, nicht-angetestete Zonen (wie der Live-Chart).",
      inputSchema: {
        instrument: INSTRUMENT,
        timeframe: z.enum(["1H", "4H"]).optional(),
        includeAll: z.boolean().optional().describe("Auch invalidierte/angetestete Zonen mitliefern"),
      },
    },
    async ({ instrument, timeframe, includeAll }) => json(await getObZones(instrument, timeframe, includeAll)),
  );

  server.registerTool(
    "get_liquidity_levels",
    {
      title: "Liquidity-Level",
      description: "Liquiditäts-Level aus der liquidity_levels-Tabelle. Default: nur relevante Level (unberührte + die 2 zuletzt gesweepten pro Richtung, wie der Live-Chart-Indikator).",
      inputSchema: {
        instrument: INSTRUMENT,
        timeframe: z.enum(["1h", "5m"]).optional(),
        includeAll: z.boolean().optional(),
      },
    },
    async ({ instrument, timeframe, includeAll }) => json(await getLiquidityLevels(instrument, timeframe, includeAll)),
  );

  server.registerTool(
    "get_trade_setups",
    {
      title: "Trade-Setups",
      description: "Erkannte Trade-Setups (M5 Sweep + Fraktal + OB) aus der trade_setups-Tabelle.",
      inputSchema: { instrument: INSTRUMENT },
    },
    async ({ instrument }) => json(await getTradeSetups(instrument)),
  );

  server.registerTool(
    "get_journal",
    {
      title: "Trade-Journal",
      description: "Einträge aus dem Trade-Journal (signals-Tabelle, inkl. Ziele/Teilausstiege).",
      inputSchema: {
        instrument: INSTRUMENT.optional(),
        source: z.enum(["backtest", "paper", "live"]).optional(),
        limit: z.number().int().positive().max(200).optional(),
      },
    },
    async ({ instrument, source, limit }) => json(await getJournal(instrument, source, limit)),
  );

  server.registerTool(
    "get_news_events",
    {
      title: "News-Events",
      description: "High-Impact News-Events (ForexFactory, manuell erfasst) aus news_events, optional in einem Zeitfenster.",
      inputSchema: {
        fromTime: z.string().optional().describe("ISO-Zeitstempel, untere Grenze (inklusiv)"),
        toTime: z.string().optional().describe("ISO-Zeitstempel, obere Grenze (inklusiv)"),
      },
    },
    async ({ fromTime, toTime }) => json(await getNewsEvents(fromTime, toTime)),
  );

  server.registerTool(
    "get_trading_schedule",
    {
      title: "Handelszeiten",
      description: "Konfigurierte Handels-/Alarmfenster für ein Instrument aus trading_schedules.",
      inputSchema: { instrument: INSTRUMENT },
    },
    async ({ instrument }) => json(await getTradingSchedule(instrument)),
  );

  server.registerTool(
    "get_forex_candles",
    {
      title: "Forex-Kerzen",
      description: "Rohkerzen für GBPUSD/EURUSD über die forex-candles Edge Function (Twelve Data). Für BTC den okx-market-MCP-Server nutzen.",
      inputSchema: {
        instrument: INSTRUMENT,
        timeframe: z.enum(["1m", "3m", "5m", "15m", "1h", "4h", "1D"]),
        count: z.number().int().positive().max(5000).default(300),
      },
    },
    async ({ instrument, timeframe, count }) => json(await fetchForexCandles(instrument, timeframe, { count })),
  );
}
