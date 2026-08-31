import { z } from "npm:zod@3.24.1";
import type { McpServer } from "npm:@modelcontextprotocol/sdk@^1.12.0/server/mcp.js";
import { getTradingSchedule, getNewsEvents } from "../db.ts";
import { berlinDayRangeUtcMs, berlinDateStrFor } from "../berlinTime.ts";
import { evaluateTradingHoursGate, evaluateNewsGate, type TradingWindows, type NewsEventInput } from "../pretradeGates.ts";

function json(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

// check_pretrade_gates (Schritt 1+2, siehe docs/state-machine.md) — reine Vorprüfung, kein
// State-Write (siehe run_bias_check für den Loop-State-Write, der diese Gate-Logik intern zuerst
// aufruft). Fetcht trading_schedules (Handelszeit) + news_events (News-Fenster ±1 Tag um
// nowSec, damit sowohl eine bereits eingetretene News von vor bis zu einem Tag als auch eine
// spätere NY-Zeit-News desselben Tages erfasst wird) und wertet beide Gates rein aus.
const NEWS_FETCH_WINDOW_SEC = 24 * 3600;

export interface PretradeGatesArgs {
  instrument: string;
  nowSec?: number;
}

export async function buildPretradeGates({ instrument, nowSec }: PretradeGatesArgs) {
  const effectiveNowSec = nowSec ?? Math.floor(Date.now() / 1000);
  const dateStr = berlinDateStrFor(effectiveNowSec);
  const { startUtcMs, endUtcMs } = berlinDayRangeUtcMs(dateStr);

  const [schedule, windowEvents, dayEvents] = await Promise.all([
    getTradingSchedule(instrument),
    getNewsEvents(new Date((effectiveNowSec - NEWS_FETCH_WINDOW_SEC) * 1000).toISOString(), new Date((effectiveNowSec + NEWS_FETCH_WINDOW_SEC) * 1000).toISOString()),
    getNewsEvents(new Date(startUtcMs).toISOString(), new Date(endUtcMs).toISOString()),
  ]);
  if (!schedule) throw new Error(`Keine trading_schedules-Zeile für ${instrument} — siehe Handelszeiten-Seite im Dashboard.`);

  const newsInputs: NewsEventInput[] = windowEvents.map((e) => ({
    eventTimeSec: Math.floor(new Date(e.event_time as string).getTime() / 1000),
    currency: e.currency as string,
    title: e.title as string,
  }));

  const tradingHours = evaluateTradingHoursGate(effectiveNowSec, schedule.trading_windows as TradingWindows);
  const news = evaluateNewsGate(effectiveNowSec, newsInputs, dayEvents.length > 0);

  return {
    instrument,
    nowSec: effectiveNowSec,
    tradingHours,
    news,
    exclude: tradingHours.exclude || news.exclude,
  };
}

export function registerPretradeGatesTool(server: McpServer) {
  server.registerTool(
    "check_pretrade_gates",
    {
      title: "Schritt 1+2: Handelszeit + News-Gate",
      description:
        "Mechanisiert Schritt 1 (Check Handelszeit) + Schritt 2 (Check News) aus 00-trading-steps — " +
        "reine Vorprüfung, kein Bias, kein State-Write (siehe run_bias_check, das dieses Gate " +
        "intern zuerst aufruft und bei Blockade sofort abbricht). `exclude=true` heißt: kein Trade, " +
        "Ablauf hier abbrechen. `tradingHours` prüft gegen trading_schedules.trading_windows (siehe " +
        "Handelszeiten-Seite im Dashboard) statt eines fest hinterlegten Zeitfensters. `news` liefert " +
        "vorformulierte Textbausteine je News-Termin (siehe 02-check-news.md) — `hasData=false` " +
        "heißt 'keine Daten für diesen Tag hinterlegt', NICHT zwingend 'keine News' (die Tabelle wird " +
        "nur für aktuell gehandelte Tage gepflegt). nowSec optional für einen Backtest/Replay-" +
        "Zeitpunkt (Default: jetzt).",
      inputSchema: {
        instrument: z.enum(["GBPUSD", "EURUSD"]).describe("Forex-Instrument"),
        nowSec: z.number().int().optional().describe("Unix-Sekunden, Default: jetzt"),
      },
    },
    async (args) => json(await buildPretradeGates(args)),
  );
}
