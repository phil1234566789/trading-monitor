import { z } from "npm:zod@3.24.1";
import type { McpServer } from "npm:@modelcontextprotocol/sdk@^1.12.0/server/mcp.js";
import { berlinDateStrFor, berlinDateTimeStrFor } from "../berlinTime.ts";
import { getLoopStateForDay } from "../loopState.ts";
import { NEXT_ACTION_MAP, NEXT_ACTION_FALLBACK } from "../nextActionMap.ts";

// Live tickt der CronCreate-Auto-Loop alle 5 Minuten (05-dealing-range-bestaetigen.md) — im Backtest
// gibt's keinen Cron, also muss get_next_action selbst den nächsten Analysezeitpunkt vorgeben.
// Ohne das (Bug-Report Philip 07.09.2026, GBPUSD-Backtest 28.08.) blieb es Lana überlassen, welches
// replayUntilSec sie an run_dealing_range_loop übergibt — ein zu weit gewählter Wert übersprang
// Handelsschluss/Wochenende unbemerkt, obwohl die Maschine "Fall 2 = aktiv beobachten" schon lange
// kennt (tradingMachine.ts), nur nie an Lana kommuniziert hat, WAS "aktiv beobachten" mechanisch heißt.
const BACKTEST_TICK_SEC = 300;

function json(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

export interface NextActionArgs {
  instrument: string;
  replayUntilSec?: number;
}

// get_next_action — der Wegweiser, der auf den bereits bestehenden Entscheidungsbaum draufschaut
// (docs/state-machine.md#naechster-schritt, Philip 06.09.2026: "woher weiß Lana, welche Tool-
// Aufrufe sie gerade machen soll?"). tradingMachine.ts erzwingt schon, DASS die Reihenfolge
// eingehalten wird (sendGuarded blockt falsche Züge) — dieses Tool beantwortet die davor liegende
// Frage, WELCHER Aufruf als Nächstes gültig ist, ohne dass Lana current_node selbst gegen
// tradingMachine.ts/die Doku abgleichen muss.
export async function buildNextAction({ instrument, replayUntilSec }: NextActionArgs) {
  const atSec = replayUntilSec ?? Math.floor(Date.now() / 1000);
  const dateStr = berlinDateStrFor(atSec);
  const loopState = await getLoopStateForDay(instrument, dateStr);

  if (!loopState) {
    return {
      instrument,
      dateStr,
      initialized: false as const,
      hint: `${instrument}/${dateStr} wurde noch nicht initialisiert.`,
      tool: "check_pretrade_gates",
      judgment: false as const,
    };
  }

  const node = loopState.currentNode;
  const action = (node != null && NEXT_ACTION_MAP[node]) || NEXT_ACTION_FALLBACK;

  // Backtest (replayUntilSec gesetzt) UND noch mitten in Schritt 5 (Fall 2/3-Jagd, kein Fall-
  // Urteil o.ä. ansteht) -> nächsten Analysezeitpunkt explizit vorgeben statt "irgendwie weiterspulen".
  let tickOverride: { hint: string; nextReplayUntilSec: number } | null = null;
  if (replayUntilSec != null && (node === "s45.entry" || node === "s45.backtestBatch") && loopState.lastAnalysisTimeSec != null) {
    const nextSec = loopState.lastAnalysisTimeSec + BACKTEST_TICK_SEC;
    tickOverride = {
      nextReplayUntilSec: nextSec,
      hint: `Nächster Analysezeitpunkt: ${berlinDateTimeStrFor(nextSec)} Uhr — run_dealing_range_loop(replayUntilSec=${nextSec}) aufrufen (5-Minuten-Takt wie live, nicht weiter vorspulen).`,
    };
  }

  return {
    instrument,
    dateStr,
    initialized: true as const,
    currentNode: node,
    currentStep: loopState.currentStep,
    direction: loopState.direction,
    ...action,
    ...tickOverride,
  };
}

export function registerNextActionTool(server: McpServer) {
  server.registerTool(
    "get_next_action",
    {
      title: "Wegweiser: nächster Schritt",
      description:
        "IMMER ALS ERSTES aufrufen, wenn du (wieder) mit einem Instrument weitermachst — egal ob " +
        "nach 5 Minuten, 2 Stunden oder einer komplett neuen Chat-Session. Liest den aktuellen " +
        "Knoten der State-Machine (tradingMachine.ts) und sagt in Klartext, welches Tool als " +
        "Nächstes gültig ist und warum — ohne dass du current_node selbst gegen die Doku abgleichen " +
        "musst. `judgment=true` heißt: das ist ein echtes Urteil, das nur du treffen kannst (die " +
        "Maschine parkt hart, bis es kommt) — `judgment=false` heißt: der genannte Tool-Aufruf " +
        "treibt die Maschine als Nebeneffekt seiner eigentlichen Aufgabe voran, du musst dich nicht " +
        "extra um die State-Machine kümmern. `initialized=false` heißt: für diesen Tag+Instrument " +
        "wurde noch gar nichts angelegt — zuerst check_pretrade_gates/run_bias_check aufrufen. " +
        "`tool=null` heißt: nichts weiter zu tun (Kein Trade heute / Trade abgeschlossen). " +
        "Backtest, mitten in Schritt 5 (Fall 2/3 noch offen): `nextReplayUntilSec` gibt den nächsten " +
        "Analysezeitpunkt (letzter Analysezeitpunkt + 5 Minuten, wie beim Live-Cron-Takt) fest vor — " +
        "GENAU diesen Wert an run_dealing_range_loop übergeben, nicht selbst weiter in die Zukunft springen.",
      inputSchema: {
        instrument: z.enum(["GBPUSD", "EURUSD"]).describe("Forex-Instrument"),
        replayUntilSec: z.number().int().optional().describe("Unix-Sekunden — Backtest/Replay-Tag statt live 'heute'"),
      },
    },
    async (args) => json(await buildNextAction(args)),
  );
}
