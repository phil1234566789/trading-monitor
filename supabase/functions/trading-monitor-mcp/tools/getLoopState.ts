import { z } from "npm:zod@3.24.1";
import type { McpServer } from "npm:@modelcontextprotocol/sdk@^1.12.0/server/mcp.js";
import { berlinDateStrFor, berlinDateTimeStrFor } from "../berlinTime.ts";
import { getLoopStateForDay } from "../loopState.ts";

function json(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

export interface GetLoopStateArgs {
  instrument: string;
  replayUntilSec?: number;
}

// get_loop_state — reiner Lese-Zugriff auf trading_loop_state, ohne die Maschine anzustoßen
// (Gegenstück zu get_next_action, das denselben Tag+Instrument nachschlägt, aber nur den
// Wegweiser zurückgibt, nicht den Rest der Zeile). Vorfall 06.09.2026: ohne dieses Tool musste
// Lana last_analysis_time_sec per Hand aus einem rohen Unix-Timestamp in Berlin-Zeit umrechnen —
// ging in Git Bash (fehlende Europe/Berlin-Zeitzonendaten) zweimal um 2h daneben. Alle *Sec-Felder
// kommen deshalb hier IMMER zusätzlich als fertig formatierter Berlin-String (Intl.DateTimeFormat,
// DST-sicher), damit dieser Fehler strukturell nicht mehr passieren kann.
export async function buildGetLoopState({ instrument, replayUntilSec }: GetLoopStateArgs) {
  const atSec = replayUntilSec ?? Math.floor(Date.now() / 1000);
  const dateStr = berlinDateStrFor(atSec);
  const loopState = await getLoopStateForDay(instrument, dateStr);

  if (!loopState) {
    return {
      instrument,
      dateStr,
      initialized: false as const,
      hint: `${instrument}/${dateStr} wurde noch nicht initialisiert — check_pretrade_gates/run_bias_check wurde für diesen Tag noch nie aufgerufen.`,
    };
  }

  return {
    instrument,
    dateStr,
    initialized: true as const,
    status: loopState.status,
    currentNode: loopState.currentNode,
    currentStep: loopState.currentStep,
    currentCase: loopState.currentCase,
    direction: loopState.direction,
    dealingRangeId: loopState.dealingRangeId,
    trendTarget: loopState.trendTarget,
    countertrendTarget: loopState.countertrendTarget,
    intermediateLevel: loopState.intermediateLevel,
    invalidation: loopState.invalidation,
    watchLevelAbove: loopState.watchLevelAbove,
    watchLevelBelow: loopState.watchLevelBelow,
    biasComputedAt: loopState.biasComputedAt,
    lastAnalysisTime: loopState.lastAnalysisTimeSec == null ? null : { sec: loopState.lastAnalysisTimeSec, berlin: berlinDateTimeStrFor(loopState.lastAnalysisTimeSec) },
    replayUntil: loopState.replayUntilSec == null ? null : { sec: loopState.replayUntilSec, berlin: berlinDateTimeStrFor(loopState.replayUntilSec) },
    heartbeatLog: loopState.heartbeatLog.map((h) => ({ ...h, berlin: berlinDateTimeStrFor(h.atSec) })),
    updatedAt: loopState.updatedAt,
  };
}

export function registerGetLoopStateTool(server: McpServer) {
  server.registerTool(
    "get_loop_state",
    {
      title: "State lesen: trading_loop_state",
      description:
        "Liest die komplette State-Machine-Zeile für (instrument, Tag) — Status/Knoten/Schritt/" +
        "Richtung/Targets/Invalidierung/Watch-Level/Heartbeat-Log, OHNE die Maschine anzustoßen " +
        "(reines Lesen, im Gegensatz zu check_pretrade_gates/run_bias_check/run_dealing_range_loop). " +
        "Alle Zeitfelder kommen fertig als Berlin-Lokalzeit UND Unix-Sekunden zurück — NICHT selbst " +
        "umrechnen (Zeitzonen-Bibliotheken sind in der Ausführungsumgebung unzuverlässig verfügbar). " +
        "`initialized=false` heißt: für diesen Tag+Instrument existiert noch keine Zeile. Für " +
        "'was ist als Nächstes zu tun' get_next_action nutzen, nicht dieses Tool.",
      inputSchema: {
        instrument: z.enum(["GBPUSD", "EURUSD"]).describe("Forex-Instrument"),
        replayUntilSec: z.number().int().optional().describe("Unix-Sekunden — Backtest/Replay-Tag statt live 'heute'; nur das Berlin-Datum daraus zählt für die Zeilen-Auflösung"),
      },
    },
    async (args) => json(await buildGetLoopState(args)),
  );
}
