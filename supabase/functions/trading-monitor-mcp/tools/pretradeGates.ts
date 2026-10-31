import { z } from "npm:zod@3.24.1";
import type { McpServer } from "npm:@modelcontextprotocol/sdk@^1.12.0/server/mcp.js";
import { getTradingSchedule, getNewsEvents } from "../db.ts";
import { berlinDayRangeUtcMs, berlinDateStrFor } from "../../_shared/berlinTime.ts";
import { evaluateTradingHoursGate, evaluateNewsGate, type TradingWindows, type NewsEventInput } from "../pretradeGates.ts";
import { REPLAY_UNTIL_SEC, deprecatedTimeParam } from "../toolParams.ts";
import { json } from "../jsonResponse.ts";

const NEWS_FETCH_WINDOW_SEC = 24 * 3600;

export interface PretradeGatesArgs {
  instrument: string;
  nowSec?: number;
}

export interface PretradeGatesResult {
  instrument: string;
  nowSec: number;
  tradingHours: ReturnType<typeof evaluateTradingHoursGate>;
  news: ReturnType<typeof evaluateNewsGate>;
  exclude: boolean;
}

export async function buildPretradeGates({ instrument, nowSec }: PretradeGatesArgs): Promise<PretradeGatesResult> {
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
  const exclude = tradingHours.exclude || news.exclude;

  return {
    instrument,
    nowSec: effectiveNowSec,
    tradingHours,
    news,
    exclude,
  };
}

export function registerPretradeGatesTool(server: McpServer) {
  server.registerTool(
    "check_pretrade_gates",
    {
      title: "Handelszeit + News-Gate",
      description: "Prüft trading_schedules.trading_windows und News-Fenster. exclude=true sperrt den Handel. news.hasData=false bedeutet fehlende Tagesdaten, nicht zwingend keine News. news.retryAtSec nennt die Freigabe nach einem News-Block. replayUntilSec optional für historische Abfragen.",
      inputSchema: {
        instrument: z.enum(["GBPUSD", "EURUSD"]).describe("Forex-Instrument"),
        replayUntilSec: REPLAY_UNTIL_SEC,
        nowSec: deprecatedTimeParam("nowSec"),
      },
    },
    async ({ replayUntilSec, nowSec: _nowSec, ...rest }) => json(await buildPretradeGates({ ...rest, nowSec: replayUntilSec })),
  );
}
