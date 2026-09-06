import { z } from "npm:zod@3.24.1";
import type { McpServer } from "npm:@modelcontextprotocol/sdk@^1.12.0/server/mcp.js";
import { getTradingSchedule, getNewsEvents } from "../db.ts";
import { berlinDayRangeUtcMs, berlinDateStrFor } from "../berlinTime.ts";
import { evaluateTradingHoursGate, evaluateNewsGate, type TradingWindows, type NewsEventInput } from "../pretradeGates.ts";
import { logDecision } from "../stateMachineLog.ts";
import { loadOrCreateMachineForDay, transitionIfPossible } from "../machineState.ts";
import { currentNodePath } from "../tradingMachine.ts";

function json(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

// check_pretrade_gates (Schritt 1+2, siehe docs/state-machine.md) — bei einem direkten (live)
// Aufruf treibt es den permanenten Pro-Tag-Loop-State durch s1_handelszeit/s2_news (siehe
// machineState.ts loadOrCreateMachineForDay); run_bias_check/run_dealing_range_loop rufen intern
// mit persist:false auf und treiben die Maschine über ihre eigenen transition()-Aufrufe selbst.
// Fetcht trading_schedules (Handelszeit) + news_events (News-Fenster ±1 Tag um nowSec, damit sowohl
// eine bereits eingetretene News von vor bis zu einem Tag als auch eine spätere NY-Zeit-News
// desselben Tages erfasst wird) und wertet beide Gates rein aus.
const NEWS_FETCH_WINDOW_SEC = 24 * 3600;

export interface PretradeGatesArgs {
  instrument: string;
  nowSec?: number;
  // Nur von internen Aufrufern gesetzt (run_bias_check/run_dealing_range_loop), sobald bereits ein
  // Loop existiert — verknüpft die geloggten Gate-Verdikte mit dem Loop, der sie ausgelöst hat.
  // Bleibt null, solange (noch) kein Loop existiert (z.B. ein direkter check_pretrade_gates-Aufruf
  // oder ein Gate-Block VOR dem ersten run_bias_check-Loop-Write).
  loopStateId?: number | null;
  // false NUR bei einem Backtest-/Replay-Aufruf (siehe run_bias_check: persist = replayUntilSec ==
  // null) — ein Gate-Check für einen vergangenen Zeitpunkt darf trading_loop_state nicht anfassen,
  // sonst kollidiert er mit der historischen Zeile desselben Instruments/Tages. Default true (jeder
  // direkte check_pretrade_gates-Aufruf ist per Definition live).
  persist?: boolean;
}

export interface PretradeGatesResult {
  instrument: string;
  nowSec: number;
  tradingHours: ReturnType<typeof evaluateTradingHoursGate>;
  news: ReturnType<typeof evaluateNewsGate>;
  exclude: boolean;
  // Nur gesetzt, wenn persist=true (Backtest-Aufrufe übergeben persist:false, siehe oben) — der
  // permanente Loop-State für (instrument, Tag), siehe S1/S2-Sichtbarkeit, 06.09.2026.
  currentNode?: string | null;
  loopStateId?: number | null;
}

export async function buildPretradeGates({ instrument, nowSec, loopStateId = null, persist = true }: PretradeGatesArgs): Promise<PretradeGatesResult> {
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

  // S1/S2 im Trading-Flow-Graphen sichtbar machen (docs/state-machine.md#s1-s2-sichtbar,
  // 06.09.2026) + permanente Pro-Tag-Identität — bei jedem LIVE-Aufruf (persist=true) den
  // permanenten Actor für (instrument, Tag) holen/anlegen und durch s1_handelszeit/s2_news
  // schicken, ob geblockt oder nicht: ein bereits weiter fortgeschrittener Tag (z.B. schon bei
  // Schritt 5) lässt diese Events einfach ungültig no-oppen (transitionIfPossible), ein noch nicht
  // initialisierter Tag wird hier zum ersten Mal angelegt. last_analysis_time_sec bewegt sich dabei
  // NUR, wenn tatsächlich ein Event feuert (siehe persistTransition in machineState.ts) — ein
  // wiederholter Check, der am selben Knoten parkt, lässt "Stand" bewusst unverändert.
  //
  // ponytail: end_keinTrade ist in tradingMachine.ts ein XState-Endzustand (final) — ein Check VOR
  // Fensteröffnung (z.B. 07:00 bei 08:00-18:00-Fenster) landet dort genauso wie einer NACH
  // Fensterschluss, und der Actor kann von einem "final"-Knoten nicht mehr weg, selbst wenn das
  // Fenster später am selben Tag noch öffnet — bis zum nächsten echten run_bias_check-Aufruf zeigt
  // der Graph dann optisch "Kein Trade", obwohl Handel im Tagesverlauf noch stattfindet. Rein
  // kosmetisch, kein funktionaler Fehler. Upgrade bei Bedarf: evaluateTradingHoursGate um "vor
  // Fenster" vs. "nach Fenster" erweitern und nur Letzteres auf end_keinTrade transitionieren.
  let currentNode: string | null = null;
  let gateLoopStateId: number | null = null;
  if (persist) {
    const loaded = await loadOrCreateMachineForDay(instrument, dateStr, effectiveNowSec);
    await transitionIfPossible(loaded, instrument, { type: "HANDELSZEIT_CHECKED", outsideHours: tradingHours.exclude }, effectiveNowSec);
    if (!tradingHours.exclude) {
      await transitionIfPossible(loaded, instrument, { type: "NEWS_CHECKED", imminent: news.exclude }, effectiveNowSec);
    }
    currentNode = currentNodePath(loaded.actor);
    gateLoopStateId = loaded.loopId;
  }

  const effectiveLoopStateId = gateLoopStateId ?? loopStateId;

  // Beide Gate-Verdikte werden HIER geloggt, unabhängig davon, ob der aufrufende Tool-Aufruf (Lana)
  // danach abbricht — genau das schließt die Lücke aus dem Auslöser-Vorfall (ein geblockter
  // run_bias_check-Versuch verschwand bisher spurlos, siehe Task-Beschreibung).
  await Promise.all([
    logDecision({ instrument, dateStr, sec: effectiveNowSec, step: 1, tool: "check_pretrade_gates", decision: "trading_hours_gate", result: tradingHours, message: tradingHours.resultText, loopStateId: effectiveLoopStateId }),
    logDecision({ instrument, dateStr, sec: effectiveNowSec, step: 2, tool: "check_pretrade_gates", decision: "news_gate", result: news, message: news.textBlocks.join(" | "), loopStateId: effectiveLoopStateId }),
  ]);

  return {
    instrument,
    nowSec: effectiveNowSec,
    tradingHours,
    news,
    exclude,
    ...(currentNode ? { currentNode, loopStateId: gateLoopStateId } : {}),
  };
}

export function registerPretradeGatesTool(server: McpServer) {
  server.registerTool(
    "check_pretrade_gates",
    {
      title: "Schritt 1+2: Handelszeit + News-Gate",
      description:
        "Mechanisiert Schritt 1 (Check Handelszeit) + Schritt 2 (Check News) aus 00-trading-steps — " +
        "kein Bias (das bleibt run_bias_check). Legt/lädt dabei die permanente Loop-State-Zeile für " +
        "(instrument, heutiges Datum) und treibt sie durch s1_handelszeit/s2_news — die Zeile bleibt " +
        "IMMER bestehen (auch bei `exclude=true`, auch über den Rest des Tages hinweg), egal welcher " +
        "Schritt/Fall zuletzt erreicht wurde; sie verschwindet nur durch explizites Löschen. " +
        "`exclude=true` heißt: kein Trade, Ablauf hier abbrechen — `currentNode`/`loopStateId` in " +
        "der Antwort zeigen dann auf `end_keinTrade` (außerhalb Handelszeit) oder `newsPause` " +
        "(News-Block), sichtbar unter /trading-flow. `tradingHours` prüft gegen " +
        "trading_schedules.trading_windows (siehe Handelszeiten-Seite im Dashboard) statt eines fest " +
        "hinterlegten Zeitfensters. `news` liefert vorformulierte Textbausteine je News-Termin " +
        "(siehe 02-check-news.md) — `hasData=false` heißt 'keine Daten für diesen Tag hinterlegt', " +
        "NICHT zwingend 'keine News' (die Tabelle wird nur für aktuell gehandelte Tage gepflegt). " +
        "Bei News-Block liefert `news.retryAtSec`/`retryAt` die exakte Freigabe-Zeit fertig " +
        "berechnet mit — NICHT selbst raten/pollen, einfach mit dieser Zeit als nowSec erneut " +
        "aufrufen. " +
        "nowSec optional für einen Backtest/Replay-Zeitpunkt (Default: jetzt).",
      inputSchema: {
        instrument: z.enum(["GBPUSD", "EURUSD"]).describe("Forex-Instrument"),
        nowSec: z.number().int().optional().describe("Unix-Sekunden, Default: jetzt"),
      },
    },
    async (args) => json(await buildPretradeGates(args)),
  );
}
