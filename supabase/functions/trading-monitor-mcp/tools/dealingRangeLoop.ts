import { z } from "npm:zod@3.24.1";
import type { McpServer } from "npm:@modelcontextprotocol/sdk@^1.12.0/server/mcp.js";
import { berlinDateTimeStrFor, berlinDateStrFor } from "../berlinTime.ts";
import { fetchForexCandles } from "../forexCandles.ts";
import { getActiveLoopState, updateLoopState, closeLoopState, appendHeartbeat, type TradingLoopStateRow, type HeartbeatEntry } from "../loopState.ts";
import { buildPretradeGates } from "./pretradeGates.ts";
import { buildSessionWindow } from "./sessionWindow.ts";
import { buildDataSnapshot } from "./dataSnapshot.ts";
import { buildRecentReactions } from "./recentReactions.ts";
import { checkFallFour, hasReaction as computeHasReaction, computeWatchLevels, type FallFourResult, type WatchLevel } from "../fallClassifier.ts";
import { logDecision } from "../stateMachineLog.ts";

function json(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

const BATCH_HOURS = 2;
const BATCH_CANDLES = Math.round((BATCH_HOURS * 3600) / 300); // 24 M5-Kerzen
const DEFAULT_MAX_BATCHES = 10;

export interface TickResult {
  atSec: number;
  at: string;
  currentPrice: number | null;
  sessionWindow: unknown;
  fallFour: FallFourResult;
  hasReaction: boolean;
  mustNotifyPhilip: boolean;
  watchLevelAbove: WatchLevel | null;
  watchLevelBelow: WatchLevel | null;
  // Rohe Evidenz für Lanas eigene Fall-1/2/3-Einordnung (siehe fallClassifier.ts-Kopfkommentar) —
  // bewusst KEIN "case"-Feld, kein automatisches add_trade_confirmation/add_trade_target/
  // remove_pin_entry. Wie bisher: Lana ruft diese Tools selbst auf, sobald sie Fall 1 erkennt.
  evidence: {
    completedTradeSetup: unknown;
    heldObReactions: unknown[];
    invalidatedObReactions: unknown[];
    liquiditySweeps: unknown[];
  };
}

// Ein voller Schritt-5-Durchlauf bei atSec: check_session_window + get_data_snapshot/
// get_recent_reactions fest verdrahtet (nicht optional, siehe Vorfall in docs/state-machine.md),
// Fall 4 mechanisch geprüft, restliche Evidenz nur gesammelt/gefiltert, nicht bewertet.
async function performFullTick(loopState: TradingLoopStateRow, instrument: string, atSec: number): Promise<TickResult> {
  const direction = loopState.direction;
  const wantedSweepDir: "high" | "low" = direction === "long" ? "low" : "high";

  const [sessionWindow, snapshot, reactions] = await Promise.all([
    buildSessionWindow({ instrument, nowSec: atSec, loopStateId: loopState.id }),
    buildDataSnapshot({ instrument, replayUntilSec: atSec }),
    buildRecentReactions({ instrument, replayUntilSec: atSec }),
  ]);

  const currentPrice: number | null = (snapshot as any).referencePrice ?? null;
  const liquiditySweeps: any[] = ((reactions as any).liquiditySweeps ?? []).filter((s: any) => s.direction === wantedSweepDir);
  const obReactionsFiltered: any[] = ((reactions as any).obReactions ?? []).filter((z: any) => z.direction === direction);
  const setup = (snapshot as any).tradeSetups?.[direction] ?? null;

  const fallFour: FallFourResult =
    currentPrice == null
      ? { hit: false, reason: null }
      : checkFallFour({ direction, currentPrice, trendTarget: loopState.trendTarget, countertrendTarget: loopState.countertrendTarget, invalidation: loopState.invalidation });

  const reactionFound = computeHasReaction({ hasCompletedTradeSetup: setup != null, obReactionCount: obReactionsFiltered.length, liquiditySweepCount: liquiditySweeps.length });

  const dateStr = berlinDateStrFor(atSec);
  await Promise.all([
    logDecision({
      instrument,
      dateStr,
      sec: atSec,
      step: 5,
      tool: "run_dealing_range_loop",
      decision: "fall_four",
      result: fallFour,
      message: fallFour.hit ? fallFour.reason : "nicht erreicht",
      loopStateId: loopState.id,
    }),
    logDecision({
      instrument,
      dateStr,
      sec: atSec,
      step: 5,
      tool: "run_dealing_range_loop",
      decision: "has_reaction",
      result: { hasCompletedTradeSetup: setup != null, obReactionCount: obReactionsFiltered.length, liquiditySweepCount: liquiditySweeps.length, reactionFound },
      message: reactionFound
        ? `Reaktion gefunden (Setup: ${setup != null}, OB-Reaktionen: ${obReactionsFiltered.length}, Sweeps: ${liquiditySweeps.length})`
        : "keine Reaktion",
      loopStateId: loopState.id,
    }),
  ]);

  const candidateLiquidity = [
    ...((snapshot as any).liquidity ?? []),
    ...[loopState.trendTarget, loopState.countertrendTarget, loopState.intermediateLevel]
      .filter((l): l is NonNullable<typeof l> => l != null)
      .map((l) => ({ price: l.price, touched: false, timeframe: l.timeframe ?? "?", id: l.refId ?? null })),
  ];
  const candidateOb = (snapshot as any).obZones ?? [];
  const watchLevels = currentPrice != null ? computeWatchLevels(currentPrice, candidateLiquidity, candidateOb) : { above: null, below: null };

  if (fallFour.hit) {
    await closeLoopState(loopState.id, "fall4_pending_bias", 4);
  } else {
    await updateLoopState(loopState.id, { watchLevelAbove: watchLevels.above, watchLevelBelow: watchLevels.below, lastAnalysisTimeSec: atSec });
  }

  return {
    atSec,
    at: berlinDateTimeStrFor(atSec),
    currentPrice,
    sessionWindow,
    fallFour,
    hasReaction: reactionFound,
    // Benachrichtigungspflicht gilt für Fall 1 UND Fall 2 (05-dealing-range-bestaetigen.md) — ohne
    // die beiden mechanisch zu unterscheiden (siehe fallClassifier.ts), gilt "irgendeine Reaktion
    // gefunden" als Auslöser für beide.
    mustNotifyPhilip: reactionFound,
    watchLevelAbove: watchLevels.above,
    watchLevelBelow: watchLevels.below,
    evidence: {
      completedTradeSetup: setup,
      heldObReactions: obReactionsFiltered.filter((z) => z.touched && !z.invalidated),
      invalidatedObReactions: obReactionsFiltered.filter((z) => z.invalidated),
      liquiditySweeps,
    },
  };
}

export interface DealingRangeLoopArgs {
  instrument: string;
  replayUntilSec?: number;
  maxBatches?: number;
}

export async function runDealingRangeLoop({ instrument, replayUntilSec, maxBatches = DEFAULT_MAX_BATCHES }: DealingRangeLoopArgs) {
  const loopState = await getActiveLoopState(instrument);
  if (!loopState) {
    throw new Error(`Kein aktiver Loop für ${instrument} — zuerst run_bias_check aufrufen (Schritt 3), das den Loop-State anlegt.`);
  }

  if (replayUntilSec == null) {
    // LIVE: ein einzelner Tick bei "jetzt".
    const nowSec = Math.floor(Date.now() / 1000);
    const gates = await buildPretradeGates({ instrument, nowSec, loopStateId: loopState.id });
    if (gates.exclude) return { instrument, mode: "live" as const, blockedByGate: true, gates };
    const tick = await performFullTick(loopState, instrument, nowSec);
    return { instrument, mode: "live" as const, blockedByGate: false, tick };
  }

  // BACKTEST: Batch-Fast-Forward vom letzten Analysezeitpunkt des Loops bis replayUntilSec, mit
  // Heartbeat bei JEDEM Batch (siehe Vorfall in docs/state-machine.md: über eine Stunde
  // Backtest-Vorspulen ohne einen einzigen Heartbeat). Stoppt bei Fall 4 ODER irgendeiner
  // gefundenen Reaktion (Fall 1/2, nicht mechanisch unterscheidbar — siehe fallClassifier.ts),
  // läuft nur automatisch weiter, wenn NICHTS gefunden wird (Fall 3).
  const heartbeats: HeartbeatEntry[] = [];
  let cursorSec = loopState.lastAnalysisTimeSec ?? Math.floor(new Date(loopState.biasComputedAt ?? Date.now()).getTime() / 1000);
  let currentLoopState: TradingLoopStateRow | null = loopState;

  async function heartbeat(atSec: number, message: string, loopId: number) {
    const entry: HeartbeatEntry = { atSec, at: berlinDateTimeStrFor(atSec), message };
    heartbeats.push(entry);
    await appendHeartbeat(loopId, entry);
  }

  for (let i = 0; i < maxBatches && cursorSec < replayUntilSec && currentLoopState; i++) {
    const gates = await buildPretradeGates({ instrument, nowSec: cursorSec, loopStateId: currentLoopState.id });
    if (gates.exclude) {
      await heartbeat(cursorSec, `News-Blackout ---> Batch pausiert.`, currentLoopState.id);
      cursorSec = Math.min(cursorSec + BATCH_HOURS * 3600, replayUntilSec);
      continue;
    }

    const batchEndSec = Math.min(cursorSec + BATCH_HOURS * 3600, replayUntilSec);
    await heartbeat(cursorSec, `Hole Kerzen ${berlinDateTimeStrFor(cursorSec)}–${berlinDateTimeStrFor(batchEndSec)} Uhr.`, currentLoopState.id);
    const candles = await fetchForexCandles(instrument, "5m", { count: BATCH_CANDLES, toMs: batchEndSec * 1000 });
    const relevantCandles = candles.filter((c) => c.time > cursorSec && c.time <= batchEndSec);

    const above = currentLoopState.watchLevelAbove?.price ?? null;
    const below = currentLoopState.watchLevelBelow?.price ?? null;
    let hitTimeSec: number | null = null;
    if (above == null && below == null) {
      // Erster Tick dieses Loops (noch keine Watch-Level aus einem vorherigen Tick) — volle
      // Auswertung am Batch-Ende erzwingen, statt blind weiterzuspulen.
      hitTimeSec = relevantCandles[relevantCandles.length - 1]?.time ?? batchEndSec;
    } else {
      const hitCandle = relevantCandles.find((c) => (above != null && c.high >= above) || (below != null && c.low <= below));
      hitTimeSec = hitCandle?.time ?? null;
    }

    if (hitTimeSec == null) {
      await heartbeat(batchEndSec, `Kein Watch-Level-Treffer bis ${berlinDateTimeStrFor(batchEndSec)} ---> nächster Batch.`, currentLoopState.id);
      currentLoopState = await updateLoopState(currentLoopState.id, { lastAnalysisTimeSec: batchEndSec, replayUntilSec: batchEndSec });
      cursorSec = batchEndSec;
      continue;
    }

    const tick = await performFullTick(currentLoopState, instrument, hitTimeSec);
    const stopSummary = tick.fallFour.hit ? `Fall 4 (${tick.fallFour.reason})` : tick.hasReaction ? "Reaktion gefunden (Fall 1/2, siehe evidence)" : "keine Reaktion";
    await heartbeat(hitTimeSec, `Watch-Level ausgelöst (${berlinDateTimeStrFor(hitTimeSec)}) ---> ${stopSummary}.`, currentLoopState.id);

    if (tick.fallFour.hit || tick.hasReaction) {
      return { instrument, mode: "backtest" as const, stopped: true, stopReason: stopSummary, heartbeats, tick };
    }
    // Keine Reaktion (Fall 3) -> automatisch weiter (05-dealing-range-bestaetigen.md: "Nur Fall 3
    // läuft ohne Rückfrage weiter").
    currentLoopState = await getActiveLoopState(instrument);
    cursorSec = hitTimeSec;
  }

  return {
    instrument,
    mode: "backtest" as const,
    stopped: cursorSec >= replayUntilSec,
    stopReason: cursorSec >= replayUntilSec ? "replayUntilSec erreicht" : "maxBatches erreicht",
    heartbeats,
    lastCursorSec: cursorSec,
  };
}

export function registerDealingRangeLoopTool(server: McpServer) {
  server.registerTool(
    "run_dealing_range_loop",
    {
      title: "Schritt 5: Dealing-Range-Loop-Evidenz",
      description:
        "Mechanisiert den Datenbeschaffungs-/Loop-Teil von Schritt 5 (Dealing Range bestätigen) aus " +
        "00-trading-steps — braucht einen aktiven Loop (siehe run_bias_check, Schritt 3, das " +
        "trading_loop_state anlegt). OHNE replayUntilSec: EIN Live-Tick bei 'jetzt' — ruft " +
        "check_session_window + get_data_snapshot/get_recent_reactions fest verdrahtet auf (nicht " +
        "optional). `fallFour` ist die EINZIGE mechanisch entschiedene Klassifikation (reiner " +
        "Preisvergleich gegen Trend-/Countertrend-Target/Invalidierung) — bei `fallFour.hit=true` " +
        "wird der Loop-Status automatisch auf 'fall4_pending_bias' gesetzt, KEIN automatischer " +
        "Bias-Neudurchlauf, ruf run_bias_check selbst wieder auf. Fall 1/2/3 sind bewusst NICHT " +
        "mechanisch klassifiziert (auch 'OB hält'/'valider Sweep' ist eine Einordnung, die du selbst " +
        "triffst, keine reine Preis-/Flag-Ablesung) — `evidence` liefert nur die rohen Bausteine " +
        "(vollständiges Trade-Setup, gehaltene/invalidierte OB-Reaktionen, Sweeps), `hasReaction` " +
        "zeigt nur an, ob IRGENDETWAS davon existiert (für Benachrichtigungspflicht/Backtest-" +
        "Abbruch). Erkennst du daraus Fall 1: die TSC-Verknüpfung (Bootstrap/Bestätigung/Target/Pin-" +
        "Aufräumen) rufst du wie gewohnt selbst über add_trade_confirmation/add_trade_target/" +
        "remove_pin_entry auf — dieses Tool tut das NICHT automatisch. MIT replayUntilSec: Backtest-" +
        "Batch-Fast-Forward vom letzten Analysezeitpunkt des Loops bis dorthin, mit einer " +
        "Heartbeat-Zeile pro Batch (`heartbeats` in der Antwort — kopiere sie 1:1 in den Chat) und " +
        "News-Blackout-Pause je Batch-Start. Stoppt bei Fall 4 ODER sobald `hasReaction=true` " +
        "(Fall 1/2 nicht unterscheidbar, du entscheidest), läuft automatisch weiter, solange " +
        "gar nichts gefunden wird (Fall 3) — bis `maxBatches` (Default 10).",
      inputSchema: {
        instrument: z.enum(["GBPUSD", "EURUSD"]).describe("Forex-Instrument"),
        replayUntilSec: z.number().int().optional().describe("Unix-Sekunden — Backtest-Zielzeitpunkt, bis zu dem vorgespult wird. Weglassen = Live-Tick 'jetzt'."),
        maxBatches: z.number().int().positive().optional().describe("Nur Backtest — Sicherheits-Cap, Default 10 (~20h Abdeckung)"),
      },
    },
    async (args: DealingRangeLoopArgs) => json(await runDealingRangeLoop(args)),
  );
}
