import { z } from "npm:zod@3.24.1";
import type { McpServer } from "npm:@modelcontextprotocol/sdk@^1.12.0/server/mcp.js";
import { getTradingSchedule, getNewsEvents } from "../db.ts";
import { berlinDayRangeUtcMs, berlinDateStrFor } from "../berlinTime.ts";
import { evaluateTradingHoursGate, evaluateNewsGate, type TradingWindows, type NewsEventInput } from "../pretradeGates.ts";
import { logDecision } from "../stateMachineLog.ts";

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
  // Nur von internen Aufrufern gesetzt (run_bias_check/run_dealing_range_loop), sobald bereits ein
  // Loop existiert — verknüpft die geloggten Gate-Verdikte mit dem Loop, der sie ausgelöst hat.
  // Bleibt null, solange (noch) kein Loop existiert (z.B. ein direkter check_pretrade_gates-Aufruf
  // oder ein Gate-Block VOR dem ersten run_bias_check-Loop-Write).
  loopStateId?: number | null;
}

export async function buildPretradeGates({ instrument, nowSec, loopStateId = null }: PretradeGatesArgs) {
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

  // Beide Gate-Verdikte werden HIER geloggt, unabhängig davon, ob der aufrufende Tool-Aufruf (Lana)
  // danach abbricht — genau das schließt die Lücke aus dem Auslöser-Vorfall (ein geblockter
  // run_bias_check-Versuch verschwand bisher spurlos, siehe Task-Beschreibung).
  await Promise.all([
    logDecision({ instrument, dateStr, sec: effectiveNowSec, step: 1, tool: "check_pretrade_gates", decision: "trading_hours_gate", result: tradingHours, message: tradingHours.resultText, loopStateId }),
    logDecision({ instrument, dateStr, sec: effectiveNowSec, step: 2, tool: "check_pretrade_gates", decision: "news_gate", result: news, message: news.textBlocks.join(" | "), loopStateId }),
  ]);

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
