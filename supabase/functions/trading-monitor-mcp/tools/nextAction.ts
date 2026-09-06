import { z } from "npm:zod@3.24.1";
import type { McpServer } from "npm:@modelcontextprotocol/sdk@^1.12.0/server/mcp.js";
import { berlinDateStrFor } from "../berlinTime.ts";
import { getLoopStateForDay } from "../loopState.ts";
import { NEXT_ACTION_MAP, NEXT_ACTION_FALLBACK } from "../nextActionMap.ts";

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

  return {
    instrument,
    dateStr,
    initialized: true as const,
    currentNode: node,
    currentStep: loopState.currentStep,
    direction: loopState.direction,
    ...action,
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
        "`tool=null` heißt: nichts weiter zu tun (Kein Trade heute / Trade abgeschlossen).",
      inputSchema: {
        instrument: z.enum(["GBPUSD", "EURUSD"]).describe("Forex-Instrument"),
        replayUntilSec: z.number().int().optional().describe("Unix-Sekunden — Backtest/Replay-Tag statt live 'heute'"),
      },
    },
    async (args) => json(await buildNextAction(args)),
  );
}
