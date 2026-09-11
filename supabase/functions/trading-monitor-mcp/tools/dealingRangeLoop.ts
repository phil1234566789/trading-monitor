import { z } from "npm:zod@3.24.1";
import type { McpServer } from "npm:@modelcontextprotocol/sdk@^1.12.0/server/mcp.js";
import { berlinDateTimeStrFor, berlinDateStrFor } from "../berlinTime.ts";
import { fetchForexCandles } from "../forexCandles.ts";
import { firstObFormationTimeAfter } from "../obFormationTrigger.ts";
import { barSecondsFor } from "../timeframes.ts";
import { getLoopStateForDay, updateLoopState, closeLoopState, type TradingLoopStateRow, type HeartbeatEntry, appendHeartbeat } from "../loopState.ts";
import { buildPretradeGates, type PretradeGatesResult } from "./pretradeGates.ts";
import { buildSessionWindow } from "./sessionWindow.ts";
import { buildDataSnapshot } from "./dataSnapshot.ts";
import { buildRecentReactions } from "./recentReactions.ts";
import { checkFallFour, hasReaction as computeHasReaction, computeWatchLevels, type FallFourResult, type WatchLevel } from "../fallClassifier.ts";
import { logDecision } from "../stateMachineLog.ts";
import { loadMachineForDay, transition, transitionIfPossible, type LoadedMachine } from "../machineState.ts";
import { currentNodePath } from "../tradingMachine.ts";

function json(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

const BATCH_HOURS = 2;
const M5_BAR_SECONDS = barSecondsFor("5m");
const BATCH_CANDLES = Math.round((BATCH_HOURS * 3600) / M5_BAR_SECONDS); // 24 M5-Kerzen
const DEFAULT_MAX_BATCHES = 10;
// Vorlauf fuer firstObFormationTimeAfter: eine FVG braucht die 3 Kerzen vor sich, sonst waere eine
// Zone direkt am Batch-Anfang nicht erkennbar. Beeinflusst den Watch-Level-Vergleich nicht, der
// laeuft weiter nur auf relevantCandles (> cursorSec).
const OB_DETECTION_WARMUP_CANDLES = 4;

// Aufmerksamkeitslevel hoch = Fall 1/2, erkennbar an den M5-Watch-Leveln, die performFullTick nur
// im reactionFound-Zweig setzt (docs/attention-levels.md). Nur dort darf eine neue M5-OB-Zone den
// Loop wecken — in Fall 3 ("Markt gibt nichts her") entstehen mehrere pro Stunde und wuerden den
// bewussten Token-Spar-Modus aushebeln.
function isHighAttention(loopState: TradingLoopStateRow): boolean {
  return loopState.watchLevelAbove?.timeframe === "5M" || loopState.watchLevelBelow?.timeframe === "5M";
}

function earliestOf(a: number | null, b: number | null): number | null {
  if (a == null) return b;
  if (b == null) return a;
  return Math.min(a, b);
}

// Ab wann ein Setup in GEGENrichtung den Loop anhalten darf. Deutlich enger als dataSnapshots
// SETUP_MAX_AGE_HOURS (48h): dort geht es um "existiert noch", hier um "ist gerade jetzt handelbar".
// Ohne diese Grenze würde ein tagealtes Gegen-Setup jeden einzelnen Tick anhalten, da
// snapshot.tradeSetups je Richtung immer das aktuellste liefert (Fall 3 gäbe es dann nie mehr).
const OPPOSITE_SETUP_FRESH_HOURS = 2;

// exclude kombiniert tradingHours- UND news-Gate (siehe buildPretradeGates), die Heartbeats unten
// nannten bisher IMMER "News-Blackout" — auch wenn tatsächlich die Handelszeit (z.B. Freitag 18 Uhr
// Fensterschluss) der Grund war (Bug-Report Philip 07.09.2026, GBPUSD-Backtest 28.08.: 3x
// "News-Blackout" ohne jedes News-Event an dem Tag, tatsächlich schlicht außerhalb 08-18-Uhr-Fenster).
function gateBlockLabel(gates: PretradeGatesResult): string {
  return gates.tradingHours.exclude ? "Außerhalb Handelszeit" : "News-Blackout";
}

export interface TickResult {
  loopStateId: number;
  direction: "long" | "short";
  atSec: number;
  at: string;
  currentPrice: number | null;
  sessionWindow: unknown;
  fallFour: FallFourResult;
  hasReaction: boolean;
  mustNotifyPhilip: boolean;
  watchLevelAbove: WatchLevel | null;
  watchLevelBelow: WatchLevel | null;
  evidence: {
    completedTradeSetup: unknown;
    oppositeSetup: unknown;
    confluenceObReactions: unknown[];
    invalidatedObReactions: unknown[];
    liquiditySweeps: unknown[];
  };
  currentNode: string;
}

// Ein voller Schritt-5-Durchlauf bei atSec: check_session_window + get_data_snapshot/
// get_recent_reactions fest verdrahtet (nicht optional, siehe Vorfall in docs/state-machine.md),
// Fall 4 (Preisvergleich) und Fall 3 (hasReaction=false) mechanisch geprüft, restliche Evidenz nur
// gesammelt/gefiltert, nicht bewertet. Treibt die State-Machine (tradingMachine.ts) von
// `s45.refetch` nach `s45.fallClassification` — bei Fall 3/4 automatisch weiter, sonst
// (hasReaction=true) bleibt der Actor geparkt, bis Lana über log_fall_classification ihr Urteil
// (Fall 1 oder 2) einträgt.
async function performFullTick(loaded: LoadedMachine, loopState: TradingLoopStateRow, instrument: string, atSec: number): Promise<TickResult> {
  const direction = loopState.direction;
  if (!direction) {
    // Sollte laut runDealingRangeLoops eigenem Guard (siehe dort) nie erreicht werden — hier nur
    // fürs Typsystem (TradingLoopStateRow.direction ist seit S1/S2-Sichtbarkeit nullable) UND als
    // zweite Absicherung, falls performFullTick je aus einem anderen Aufrufpfad genutzt wird.
    throw new Error(`Loop ${loopState.id} hat keinen Bias (direction=null) — kein gültiger Zustand für einen Schritt-5-Tick.`);
  }
  const wantedSweepDir: "high" | "low" = direction === "long" ? "low" : "high";

  const [sessionWindow, snapshot, reactions] = await Promise.all([
    buildSessionWindow({ instrument, nowSec: atSec, loopStateId: loopState.id }),
    buildDataSnapshot({ instrument, replayUntilSec: atSec }),
    // htfConfluenceLimit: 2 statt Default 1 — Schritt 5 (Dealing Range bestimmen) braucht mehr
    // Kontext als eine reine Confluence-Abfrage (Philip 05.09.2026, siehe orderblöcke.md#retest-status).
    buildRecentReactions({ instrument, replayUntilSec: atSec, htfConfluenceLimit: 2 }),
  ]);

  const currentPrice: number | null = (snapshot as any).referencePrice ?? null;
  const liquiditySweeps: any[] = ((reactions as any).liquiditySweeps ?? []).filter((s: any) => s.direction === wantedSweepDir);
  const obReactionsFiltered: any[] = ((reactions as any).obReactions ?? []).filter((z: any) => z.direction === direction);
  const setup = (snapshot as any).tradeSetups?.[direction] ?? null;
  // buildDataSnapshot berechnet ohnehin beide Richtungen — die Gegenrichtung wurde hier bisher
  // schlicht weggeworfen, wodurch ein laufendes Gegen-Setup für Lana unsichtbar war (siehe
  // HasReactionInput.hasFreshOppositeSetup).
  const oppositeSetupRaw = (snapshot as any).tradeSetups?.[direction === "long" ? "short" : "long"] ?? null;
  const oppositeSetup = oppositeSetupRaw != null && oppositeSetupRaw.ageHours <= OPPOSITE_SETUP_FRESH_HOURS ? oppositeSetupRaw : null;

  const fallFour: FallFourResult =
    currentPrice == null
      ? { hit: false, reason: null }
      : checkFallFour({ direction, currentPrice, trendTarget: loopState.trendTarget, countertrendTarget: loopState.countertrendTarget, invalidation: loopState.invalidation });

  const reactionFound = computeHasReaction({
    hasCompletedTradeSetup: setup != null,
    obReactionCount: obReactionsFiltered.length,
    liquiditySweepCount: liquiditySweeps.length,
    hasFreshOppositeSetup: oppositeSetup != null,
  });

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
      result: { hasCompletedTradeSetup: setup != null, obReactionCount: obReactionsFiltered.length, liquiditySweepCount: liquiditySweeps.length, hasFreshOppositeSetup: oppositeSetup != null, reactionFound },
      message: reactionFound
        ? `Reaktion gefunden (Setup: ${setup != null}, OB-Reaktionen: ${obReactionsFiltered.length}, Sweeps: ${liquiditySweeps.length}, Gegen-Setup: ${oppositeSetup != null})`
        : "keine Reaktion",
      loopStateId: loopState.id,
    }),
  ]);

  // State-Machine V2: s45.refetch -> s45.fallClassification. Fall 4 (reiner Preisvergleich) UND
  // Fall 3 (hasReaction=false, "nichts gefunden") sind automatisch entschieden, siehe
  // fallClassifier.ts-Kopfkommentar + 05-dealing-range-bestaetigen.md ("nur Fall 3 läuft ohne
  // Rückfrage weiter") — Fall 1/2 bleiben geparkt für Lanas log_fall_classification-Aufruf, weil nur
  // DORT wirklich mehrdeutig ist, welcher der beiden zutrifft. Der Watch-Level-Pin bei Fall 3
  // (F3 im Diagramm) wird hier automatisch mitgeschickt statt über einen echten add_pin_entry-Call —
  // bewusste Vereinfachung fürs automatische Backtest-Fast-Forward (siehe PIN_SET-Kommentar unten),
  // in Live nutzt Lana weiterhin add_pin_entry selbst, das denselben PIN_SET-Event sendet.
  await transition(loaded, instrument, { type: "REFETCH_DONE" }, atSec);
  if (fallFour.hit) {
    await transition(loaded, instrument, { type: "FALL_CLASSIFIED", case: 4 }, atSec);
  } else if (!reactionFound) {
    await transition(loaded, instrument, { type: "FALL_CLASSIFIED", case: 3 }, atSec);
    await transition(loaded, instrument, { type: "PIN_SET" }, atSec);
  }

  // Aufmerksamkeitslevel (docs/attention-levels.md): Fall 3 (keine Reaktion, "Markt gibt nichts
  // her") bleibt bei 1H/4H + Schritt-3-Bias-Resten — hier wird bewusst an Tokens/Aufrufen gespart.
  // Fall 1/2 (reactionFound) braucht M5-Granularität (Philip: Daytrader, M5 ist sein meistgenutztes
  // TF) statt der teils weit entfernten Bias-Reste, die den tatsächlich nahen, laufenden
  // Trade-Setup-OB sonst verdecken (Bug-Report 07.09.2026, GBPUSD-Backtest 28.08.: watchLevelAbove
  // zeigte auf den >60 Pips entfernten Schritt-3-Countertrend-Target statt auf den ~30 Pips
  // entfernten Setup-OB). m5Liquidity/m5ObZones kommen aus `reactions` (get_recent_reactions) —
  // schon oben berechnet, kein zweiter Kerzen-Fetch/keine zweite Erkennung nötig.
  let watchLevels: { above: WatchLevel | null; below: WatchLevel | null };
  if (currentPrice == null) {
    watchLevels = { above: null, below: null };
  } else if (reactionFound) {
    const m5Liquidity = ((reactions as any).m5Liquidity ?? []).map((l: any) => ({ price: l.price, touched: l.touched, timeframe: "5M", id: l.id ?? null }));
    const m5ObZones = ((reactions as any).m5ObZones ?? []).map((z: any) => ({ top: z.top, bottom: z.bottom, touched: z.touched, invalidated: false, timeframe: "5M", id: z.id ?? null }));
    watchLevels = computeWatchLevels(currentPrice, m5Liquidity, m5ObZones);
  } else {
    const candidateLiquidity = [
      ...((snapshot as any).liquidity ?? []),
      ...[loopState.trendTarget, loopState.countertrendTarget, loopState.intermediateLevel]
        .filter((l): l is NonNullable<typeof l> => l != null)
        .map((l) => ({ price: l.price, touched: false, timeframe: l.timeframe ?? "?", id: l.refId ?? null })),
    ];
    const candidateOb = (snapshot as any).obZones ?? [];
    watchLevels = computeWatchLevels(currentPrice, candidateLiquidity, candidateOb);
  }

  if (fallFour.hit) {
    // status muss weg von 'active', sonst verhindert der Partial-Unique-Index (nur ein aktiver Loop
    // je Instrument), dass der nächste run_bias_check (Fall 4 -> Schritt 3) einen neuen anlegen kann
    // — die Maschine selbst regelt nur current_node/current_step, nicht status.
    await closeLoopState(loopState.id, "fall4_pending_bias", 4);
  } else {
    await updateLoopState(loopState.id, { watchLevelAbove: watchLevels.above, watchLevelBelow: watchLevels.below, lastAnalysisTimeSec: atSec });
  }

  return {
    loopStateId: loopState.id,
    direction,
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
      // Frisches Setup in Gegenrichtung (null, wenn keins oder älter als OPPOSITE_SETUP_FRESH_HOURS).
      // Ist es gesetzt, ist die Fall-1/2-Frage richtungsoffen zu stellen — ein valider Sweep in
      // Gegenrichtung ist Fall 1 für eine NEUE Dealing Range, nicht Fall 2 für die laufende Idee
      // (05-dealing-range-bestaetigen.md#die-vier-fälle).
      oppositeSetup,
      // "confluenceObReactions" statt "heldObReactions" (Bug-Report Philip 05.09.2026, GBPUSD-
      // Retest 28.08.2026): eine getouchte, nicht invalidierte OB zählt erst als Confluence, wenn
      // der Retest nachweislich abgeschlossen ist (z.retested, siehe orderblöcke.md#retest-status)
      // — unabhängig vom Alter. Zonen, die zwar getouched aber noch unentschieden sind ("Retest
      // läuft", touched && !invalidated && !retested), tauchen hier bewusst NICHT auf (Philip: "schau
      // ma mal, was wir mit denen noch machen" — noch keine definierte Behandlung).
      confluenceObReactions: obReactionsFiltered.filter((z) => z.touched && !z.invalidated && z.retested),
      invalidatedObReactions: obReactionsFiltered.filter((z) => z.invalidated),
      liquiditySweeps,
    },
    currentNode: currentNodePath(loaded.actor),
  };
}

export interface DealingRangeLoopArgs {
  instrument: string;
  replayUntilSec?: number;
  maxBatches?: number;
}

export async function runDealingRangeLoop({ instrument, replayUntilSec, maxBatches = DEFAULT_MAX_BATCHES }: DealingRangeLoopArgs) {
  // dateStr: live = heutiges Berlin-Datum, Backtest = das Replay-Datum — (instrument, dateStr) ist
  // seit 06.09.2026 die permanente Identität einer Zeile (siehe machineState.ts-Kopfkommentar),
  // Voraussetzung dafür, dass dieser Aufruf garantiert die richtige Zeile trifft, auch wenn
  // parallel z.B. ein live-Gate-Check für einen ANDEREN Tag desselben Instruments läuft.
  const dateStr = berlinDateStrFor(replayUntilSec ?? Math.floor(Date.now() / 1000));
  const loopState = await getLoopStateForDay(instrument, dateStr);
  if (!loopState) {
    throw new Error(`${instrument}/${dateStr} wurde noch nicht initialisiert — zuerst run_bias_check aufrufen (Schritt 3), das die Zeile anlegt.`);
  }
  if (loopState.direction == null) {
    // Seit 06.09.2026 (S1/S2-Sichtbarkeit) kann die Zeile eines Tages auch ein reiner Gate-Block
    // sein (current_step 1/2, siehe machineState.ts loadOrCreateMachineForDay) — ohne diesen Check
    // würde performFullTick unten mit direction=null weiterlaufen (falsches wantedSweepDir, falsche
    // OB-Filterung) statt klar zu sagen, woran es liegt.
    throw new Error(
      `${instrument}/${dateStr} (id=${loopState.id}, Schritt ${loopState.currentStep}) hat noch keinen Bias — ` +
        `Handelszeit-/News-Gate ist noch nicht durchlaufen (aktueller Knoten: ${loopState.currentNode}). Zuerst run_bias_check aufrufen (Schritt 3).`,
    );
  }
  const loaded = await loadMachineForDay(instrument, dateStr);

  // Actor parkt bereits bei s45.fallClassification (Lanas Fall-1/2-Urteil steht noch aus) — jeder
  // erneute Aufruf würde sonst entweder still no-oppen (replayUntilSec bereits erreicht) oder hart
  // gegen die Guard-Transition laufen (ein neuer Batch/Live-Tick ist an diesem Knoten ungültig).
  // loopStateId/direction hier zurückgeben, statt sie unauffindbar zu machen — log_fall_classification
  // braucht loopStateId, die sonst nur aus einem frischen tick-Ergebnis käme.
  if (currentNodePath(loaded.actor) === "s45.fallClassification") {
    return {
      instrument,
      alreadyParked: true as const,
      currentNode: "s45.fallClassification",
      loopStateId: loopState.id,
      direction: loopState.direction,
      message: "Wartet bereits auf log_fall_classification (Fall 1 vs. 2) — get_data_snapshot/get_recent_reactions erneut aufrufen für die Evidenz, dann Urteil loggen.",
    };
  }

  if (replayUntilSec != null && loopState.lastAnalysisTimeSec != null && replayUntilSec < loopState.lastAnalysisTimeSec) {
    // Ohne diesen Guard: die Batch-Schleife unten startet mit cursorSec=lastAnalysisTimeSec, deren
    // for-Header (cursorSec < replayUntilSec) ist dann von Anfang an false -> stiller No-op mit
    // IRREFÜHRENDEM "stopped: true, stopReason: replayUntilSec erreicht" (sieht identisch aus wie
    // "gerade am Ziel angekommen", siehe Bug-Report Philip 07.09.2026, GBPUSD-Backtest 28.08.: ein
    // replayUntilSec, das schon länger in der Vergangenheit lag, wurde für "Ziel erreicht" gehalten).
    throw new Error(
      `replayUntilSec (${berlinDateTimeStrFor(replayUntilSec)}) liegt VOR dem aktuellen Analysestand ` +
        `(${berlinDateTimeStrFor(loopState.lastAnalysisTimeSec)}) — kein Rücksprung möglich.`,
    );
  }

  if (replayUntilSec == null) {
    // LIVE: Watch-Level-Vorprüfung, wie im Diagramm (LTICK/LHIT) — nur bei Treffer voller Refetch.
    // Erster Tick dieses Loops (noch kein Watch-Level gesetzt) erzwingt sofort die volle Auswertung.
    const nowSec = Math.floor(Date.now() / 1000);
    // persist:false — dieser Aufruf treibt die Maschine selbst per eigenen transition()-Calls
    // unten, kein zusätzlicher S1/S2-Gate-Actor-Umweg nötig (der Actor ist hier ohnehin längst
    // über s1/s2 hinaus).
    const gates = await buildPretradeGates({ instrument, nowSec, loopStateId: loopState.id, persist: false });
    if (gates.exclude) return { instrument, mode: "live" as const, blockedByGate: true, gates };

    await transitionIfPossible(loaded, instrument, { type: "S45_ENTER" }, nowSec);
    await transitionIfPossible(loaded, instrument, { type: "MODE_SELECTED", mode: "live" }, nowSec);

    const above = loopState.watchLevelAbove?.price ?? null;
    const below = loopState.watchLevelBelow?.price ?? null;
    let hit = true;
    if (above != null || below != null) {
      const snapshot = await buildDataSnapshot({ instrument });
      const price: number | null = (snapshot as any).referencePrice ?? null;
      hit = price != null && ((above != null && price >= above) || (below != null && price <= below));
      // Zweiter, gleichberechtigter Trigger (siehe obFormationTrigger.ts): auch ohne Preis-Treffer
      // aufwachen, wenn seit dem letzten Tick eine neue M5-OB-Zone entstanden ist.
      if (!hit && isHighAttention(loopState) && loopState.lastAnalysisTimeSec != null) {
        const sinceSec = loopState.lastAnalysisTimeSec;
        const count = Math.min(Math.ceil((nowSec - sinceSec) / M5_BAR_SECONDS), BATCH_CANDLES) + OB_DETECTION_WARMUP_CANDLES;
        const m5Candles = await fetchForexCandles(instrument, "5m", { count, toMs: nowSec * 1000 });
        hit = firstObFormationTimeAfter(m5Candles, sinceSec, nowSec) != null;
      }
    }
    await transition(loaded, instrument, { type: "LIVE_LEVEL_CHECKED", hit }, nowSec);
    if (!hit) {
      return { instrument, mode: "live" as const, blockedByGate: false, tick: null, currentNode: currentNodePath(loaded.actor) };
    }
    const tick = await performFullTick(loaded, loopState, instrument, nowSec);
    return { instrument, mode: "live" as const, blockedByGate: false, tick };
  }

  // BACKTEST: Batch-Fast-Forward vom letzten Analysezeitpunkt des Loops bis replayUntilSec, mit
  // Heartbeat bei JEDEM Batch (siehe Vorfall in docs/state-machine.md: über eine Stunde
  // Backtest-Vorspulen ohne einen einzigen Heartbeat). Stoppt bei Fall 4 ODER Fall 1/2
  // (hasReaction=true, nicht mechanisch unterscheidbar — siehe fallClassifier.ts), läuft bei
  // Fall 3 (nichts gefunden) automatisch weiter.
  const heartbeats: HeartbeatEntry[] = [];
  let cursorSec = loopState.lastAnalysisTimeSec ?? Math.floor(new Date(loopState.biasComputedAt ?? Date.now()).getTime() / 1000);
  let currentLoopState: TradingLoopStateRow | null = loopState;

  await transitionIfPossible(loaded, instrument, { type: "S45_ENTER" }, cursorSec);
  await transitionIfPossible(loaded, instrument, { type: "MODE_SELECTED", mode: "backtest" }, cursorSec);

  async function heartbeat(atSec: number, message: string, loopId: number) {
    const entry: HeartbeatEntry = { atSec, at: berlinDateTimeStrFor(atSec), message };
    heartbeats.push(entry);
    await appendHeartbeat(loopId, entry);
  }

  // Erster Tick dieses Loops (kein Watch-Level aus einem vorherigen Tick) — SOFORT an cursorSec
  // selbst auswerten (buildRecentReactions schaut ohnehin lookbackHours=24 zurück), statt künstlich
  // einen Kerzen-Batch nach vorne zu holen. Behebt den Bug vom 05.09.2026: ein Aufruf mit
  // replayUntilSec == cursorSec (kein verstrichener Zeitraum, z.B. direkt nach run_bias_check zum
  // selben Analysezeitpunkt) lief bisher in einen stillen No-op, weil die Batch-Schleife unten
  // cursorSec < replayUntilSec voraussetzt.
  if (currentLoopState.watchLevelAbove == null && currentLoopState.watchLevelBelow == null) {
    const gates = await buildPretradeGates({ instrument, nowSec: cursorSec, loopStateId: currentLoopState.id, persist: false });
    if (gates.exclude) {
      await heartbeat(cursorSec, `${gateBlockLabel(gates)} ---> erster Tick pausiert.`, currentLoopState.id);
    } else {
      // Actor steht hier bei s45.backtestBatch (nach MODE_SELECTED oben) — die beiden mechanischen
      // Zwischenknoten (News-Blackout, Watch-Level-Treffer) müssen auch für den Erster-Tick-
      // Shortcut real durchlaufen werden (kein Watch-Level gesetzt = Treffer trivial wahr), sonst
      // sitzt performFullTicks REFETCH_DONE am falschen Knoten fest (Bug vom 05.09.2026, Retest).
      await transition(loaded, instrument, { type: "NEWS_BLACKOUT_CHECKED", active: false }, cursorSec);
      await transition(loaded, instrument, { type: "BATCH_LEVEL_CHECKED", hit: true }, cursorSec);
      const tick = await performFullTick(loaded, currentLoopState, instrument, cursorSec);
      const stopSummary = tick.fallFour.hit ? `Fall 4 (${tick.fallFour.reason})` : tick.hasReaction ? "Reaktion gefunden (Fall 1/2/3, siehe evidence)" : "keine Reaktion";
      await heartbeat(cursorSec, `Erster Tick (${berlinDateTimeStrFor(cursorSec)}) ---> ${stopSummary}.`, currentLoopState.id);
      if (tick.fallFour.hit || tick.hasReaction) {
        return { instrument, mode: "backtest" as const, stopped: true, stopReason: stopSummary, heartbeats, tick };
      }
      // Fall 3 (auto-klassifiziert in performFullTick) -> Actor steht bei s45.entry, zurück in den
      // Batch-Modus für die weitere Vorwärts-Suche unten.
      await transition(loaded, instrument, { type: "S45_ENTER" }, cursorSec);
      await transition(loaded, instrument, { type: "MODE_SELECTED", mode: "backtest" }, cursorSec);
      currentLoopState = await getLoopStateForDay(instrument, dateStr);
    }
  }

  for (let i = 0; i < maxBatches && cursorSec < replayUntilSec && currentLoopState; i++) {
    const gates = await buildPretradeGates({ instrument, nowSec: cursorSec, loopStateId: currentLoopState.id, persist: false });
    await transition(loaded, instrument, { type: "NEWS_BLACKOUT_CHECKED", active: gates.exclude }, cursorSec);
    if (gates.exclude) {
      await heartbeat(cursorSec, `${gateBlockLabel(gates)} ---> Batch pausiert.`, currentLoopState.id);
      cursorSec = Math.min(cursorSec + BATCH_HOURS * 3600, replayUntilSec);
      await transition(loaded, instrument, { type: "BACKTEST_BATCH_FETCHED" }, cursorSec);
      continue;
    }

    const batchEndSec = Math.min(cursorSec + BATCH_HOURS * 3600, replayUntilSec);
    await heartbeat(cursorSec, `Hole Kerzen ${berlinDateTimeStrFor(cursorSec)}–${berlinDateTimeStrFor(batchEndSec)} Uhr.`, currentLoopState.id);
    const candles = await fetchForexCandles(instrument, "5m", { count: BATCH_CANDLES + OB_DETECTION_WARMUP_CANDLES, toMs: batchEndSec * 1000 });
    const relevantCandles = candles.filter((c) => c.time > cursorSec && c.time <= batchEndSec);

    const above = currentLoopState.watchLevelAbove?.price ?? null;
    const below = currentLoopState.watchLevelBelow?.price ?? null;
    const levelHitSec = relevantCandles.find((c) => (above != null && c.high >= above) || (below != null && c.low <= below))?.time ?? null;
    // Zweiter, gleichberechtigter Trigger neben dem gespeicherten Watch-Level (siehe
    // obFormationTrigger.ts) — sonst weckt eine neu entstandene Entry-Zone den Loop erst, wenn
    // zufaellig ein ALTES Level getroffen wird.
    const newObSec = isHighAttention(currentLoopState) ? firstObFormationTimeAfter(candles, cursorSec, batchEndSec) : null;
    const hitTimeSec = earliestOf(levelHitSec, newObSec);
    const triggerLabel = hitTimeSec != null && hitTimeSec === levelHitSec ? "Watch-Level" : "Neuer M5-OB";

    await transition(loaded, instrument, { type: "BATCH_LEVEL_CHECKED", hit: hitTimeSec != null }, batchEndSec);

    if (hitTimeSec == null) {
      await heartbeat(batchEndSec, `Kein Watch-Level-Treffer und keine neue M5-OB-Zone bis ${berlinDateTimeStrFor(batchEndSec)} ---> nächster Batch.`, currentLoopState.id);
      currentLoopState = await updateLoopState(currentLoopState.id, { lastAnalysisTimeSec: batchEndSec, replayUntilSec: batchEndSec });
      cursorSec = batchEndSec;
      await transition(loaded, instrument, { type: "BACKTEST_BATCH_FETCHED" }, cursorSec);
      continue;
    }

    const tick = await performFullTick(loaded, currentLoopState, instrument, hitTimeSec);
    const stopSummary = tick.fallFour.hit ? `Fall 4 (${tick.fallFour.reason})` : tick.hasReaction ? "Reaktion gefunden (Fall 1/2/3, siehe evidence)" : "keine Reaktion";
    await heartbeat(hitTimeSec, `${triggerLabel} ausgelöst (${berlinDateTimeStrFor(hitTimeSec)}) ---> ${stopSummary}.`, currentLoopState.id);

    if (tick.fallFour.hit || tick.hasReaction) {
      return { instrument, mode: "backtest" as const, stopped: true, stopReason: stopSummary, heartbeats, tick };
    }
    // Fall 3 (performFullTick hat bereits FALL_CLASSIFIED{case:3}+PIN_SET automatisch geschickt,
    // Actor steht jetzt bei s45.entry) — läuft ohne Rückfrage weiter, siehe
    // 05-dealing-range-bestaetigen.md: "Nur Fall 3 läuft ohne Rückfrage weiter".
    await transition(loaded, instrument, { type: "S45_ENTER" }, hitTimeSec);
    await transition(loaded, instrument, { type: "MODE_SELECTED", mode: "backtest" }, hitTimeSec);
    currentLoopState = await getLoopStateForDay(instrument, dateStr);
    cursorSec = hitTimeSec;
  }

  return {
    instrument,
    mode: "backtest" as const,
    stopped: cursorSec >= replayUntilSec,
    stopReason: cursorSec >= replayUntilSec ? "replayUntilSec erreicht" : "maxBatches erreicht",
    heartbeats,
    lastCursorSec: cursorSec,
    currentNode: currentNodePath(loaded.actor),
  };
}

export interface LogFallClassificationArgs {
  instrument: string;
  loopStateId: number;
  sec: number;
  case: 1 | 2;
  reasoning: string;
}

// Pendant zu log_bias_decision (Schritt 3) für Schritt 5: NUR Fall 1 vs. 2 ist wirklich Lanas Urteil
// (siehe fallClassifier.ts/docs/state-machine.md) — Fall 3 (hasReaction=false) und Fall 4 (reiner
// Preisvergleich) klassifiziert performFullTick bereits automatisch. NACH run_dealing_range_loop
// aufrufen, sobald Lana aus `evidence` (hasReaction=true) eine Einordnung getroffen hat.
export async function logFallClassification({ instrument, loopStateId, sec, case: fallCase, reasoning }: LogFallClassificationArgs) {
  const loaded = await loadMachineForDay(instrument, berlinDateStrFor(sec));
  const currentNode = await transition(loaded, instrument, { type: "FALL_CLASSIFIED", case: fallCase }, sec);
  await logDecision({
    instrument,
    dateStr: berlinDateStrFor(sec),
    sec,
    step: 5,
    tool: "run_dealing_range_loop",
    decision: "substep_fall_classification",
    result: { case: fallCase, reasoning },
    message: `Fall ${fallCase}: ${reasoning}`,
    loopStateId,
  });
  return { logged: true as const, case: fallCase, currentNode };
}

export interface RetractFall1ClassificationArgs {
  instrument: string;
  sec: number;
  reasoning: string;
}

// Gegenstück zu logFallClassification, für den Fall, dass sich die Fall-1-Einordnung NACH
// find_targets als falsch herausstellt (Philip 07.09.2026, Backtest GBPUSD 28.08.: "wir sind doch
// nicht in Fall 1 sondern Fall 2, da es gerade nicht so viel Sinn macht, Targets zu finden, wenn
// die Bewegung noch im Gange ist"). find_targets koppelt "Fall 1 komplett?" fest an sich selbst
// (siehe tools/tsc.ts) — ohne dieses Tool gäbe es keinen Weg zurück zu #s45 außer einem
// manuellen machine_snapshot-Fix. Nur an s45.llmPickTarget gültig (sendGuarded blockt sonst hart)
// — bewusst NICHT von addTarget/pinCheck2/notify aus erreichbar, ein bereits per add_trade_target
// geschriebenes Target müsste dafür separat entfernt werden (größerer Scope, YAGNI).
export async function retractFall1Classification({ instrument, sec, reasoning }: RetractFall1ClassificationArgs) {
  const loaded = await loadMachineForDay(instrument, berlinDateStrFor(sec));
  const currentNode = await transition(loaded, instrument, { type: "FALL1_RETRACTED" }, sec);
  await logDecision({
    instrument,
    dateStr: berlinDateStrFor(sec),
    sec,
    step: 5,
    tool: "run_dealing_range_loop",
    decision: "fall1_retracted",
    result: { reasoning },
    message: `Fall-1-Klassifikation zurückgezogen: ${reasoning}`,
    loopStateId: loaded.loopId,
  });
  return { retracted: true as const, currentNode };
}

export interface LogNoEntryFoundArgs {
  instrument: string;
  sec: number;
  reasoning: string;
}

// Schritt 7 (Find Entry) ist rein Philips manuelle Aufgabe — die Maschine kannte bislang aber nur
// den Erfolgsfall (ENTRY_FOUND). Fand sich in Schritt 6 zwar eine VALIDE Range, aber Philip nimmt
// den Trade am Ende nicht (DR im UI geschlossen, kein Entry) oder das Fenster läuft ab, gab es
// keinen Weg zurück zu Schritt 4/5 — jeder weitere run_bias_check/run_dealing_range_loop-Aufruf
// blockte hart (Bug-Vorfall 08.09.2026, EURUSD live). Bildet DR-Status "VALIDE, kein Trade"/"Entry
// verpasst" aus 00-trading-steps.md ab — die eigentliche dealing_range bleibt dabei unangetastet
// (Philip schließt/verwirft sie selbst im UI), dieses Tool synchronisiert nur die Maschine dazu.
export async function logNoEntryFound({ instrument, sec, reasoning }: LogNoEntryFoundArgs) {
  const loaded = await loadMachineForDay(instrument, berlinDateStrFor(sec));
  const currentNode = await transition(loaded, instrument, { type: "NO_ENTRY_FOUND" }, sec);
  await logDecision({
    instrument,
    dateStr: berlinDateStrFor(sec),
    sec,
    step: 6, // LogDecisionArgs.step kennt nur 1-6 (siehe stateMachineLog.ts) — wie persistTransition wird Schritt 7 auf 6 geklemmt.
    tool: "log_no_entry_found",
    decision: "no_entry_found",
    result: { reasoning },
    message: `Kein Entry gefunden: ${reasoning}`,
    loopStateId: loaded.loopId,
  });
  return { logged: true as const, currentNode };
}

export interface LogFallAgainCheckArgs {
  instrument: string;
  sec: number;
  complete: boolean;
  reasoning: string;
}

// Lanas Urteil an s45.fallAgainCheck ("Fall 1 komplett?" im Graphen/tradingMachineGraph.js). Die
// Maschine selbst unterstützt FALL_AGAIN_CHECKED{complete:false} schon lange (tradingMachine.ts) —
// es fehlte nur ein Tool, das es direkt feuert, ohne den find_targets-Umweg (das complete IMMER
// auf true zwingt, siehe dessen Beschreibung + retract_fall1_classification-Kommentar). Philip
// 07.09.2026, Backtest GBPUSD 28.08.: Graph und State-Machine sollen 1:1 dasselbe abbilden — dieser
// Knoten ist im Graphen ein echter Diamant mit ja/nein, kein an find_targets gekoppelter Nebeneffekt.
// complete=true -> weiter zu find_targets (Zielauswahl), complete=false -> zurück zu Schritt 4
// (#s45), run_dealing_range_loop danach normal weiter aufrufen.
export async function logFallAgainCheck({ instrument, sec, complete, reasoning }: LogFallAgainCheckArgs) {
  const loaded = await loadMachineForDay(instrument, berlinDateStrFor(sec));
  const currentNode = await transition(loaded, instrument, { type: "FALL_AGAIN_CHECKED", complete }, sec);
  await logDecision({
    instrument,
    dateStr: berlinDateStrFor(sec),
    sec,
    step: 5,
    tool: "run_dealing_range_loop",
    decision: "fall_again_check",
    result: { complete, reasoning },
    message: `Fall 1 komplett=${complete}: ${reasoning}`,
    loopStateId: loaded.loopId,
  });
  return { logged: true as const, complete, currentNode };
}

export function registerDealingRangeLoopTool(server: McpServer) {
  server.registerTool(
    "run_dealing_range_loop",
    {
      title: "Schritt 5: Dealing-Range-Loop-Evidenz",
      description:
        "Mechanisiert den Datenbeschaffungs-/Loop-Teil von Schritt 5 (Dealing Range bestätigen) aus " +
        "00-trading-steps — braucht einen aktiven Loop (siehe run_bias_check, Schritt 3, das " +
        "trading_loop_state anlegt). Treibt die State-Machine (tradingMachine.ts, siehe " +
        "docs/state-machine.md#state-machine-v2) durch den kompletten Schritt-4/5-Entscheidungsbaum " +
        "(Live-Tick/Backtest-Batch, News-Blackout, Watch-Level-Treffer) bis zu `s45.fallClassification` " +
        "— dort parkt der Actor, ein ungültiger Folgeaufruf wird jetzt hart geblockt statt (wie am " +
        "05.09.2026 passiert) still nichts zu tun. OHNE replayUntilSec: EIN Live-Tick bei 'jetzt' — " +
        "ruft check_session_window + get_data_snapshot/get_recent_reactions fest verdrahtet auf " +
        "(nicht optional). `fallFour` (reiner Preisvergleich gegen Trend-/Countertrend-Target/" +
        "Invalidierung) UND Fall 3 (`hasReaction=false`, nichts gefunden) klassifiziert dieses Tool " +
        "bereits automatisch — bei `fallFour.hit=true` wird automatisch zu Schritt 3 " +
        "zurückgesprungen (KEIN automatischer run_bias_check-Aufruf, ruf ihn selbst wieder auf), bei " +
        "Fall 3 läuft ein Backtest automatisch weiter, ohne dich zu fragen. NUR Fall 1 vs. 2 " +
        "(`hasReaction=true`) ist bewusst NICHT mechanisch klassifiziert (auch 'valider Sweep' ist " +
        "eine Einordnung, die du selbst triffst) — `evidence` liefert dafür nur die rohen Bausteine " +
        "(vollständiges Trade-Setup, `oppositeSetup`, `confluenceObReactions`/`invalidatedObReactions`, Sweeps). " +
        "`confluenceObReactions` enthält NUR OBs mit bestätigtem Retest (siehe orderblöcke.md#retest-" +
        "status) — Alter spielt dabei keine Rolle, eine seit Tagen unangetastete OB zählt genauso " +
        "als Confluence wie eine von vor 5 Minuten. Getouchte, aber noch unentschiedene OBs " +
        "('Retest läuft') tauchen hier NICHT auf. " +
        "ACHTUNG `oppositeSetup`: alle übrigen evidence-Felder sind nach der Bias-Richtung GEFILTERT — " +
        "ist `oppositeSetup` gesetzt (frisches Trade-Setup in Gegenrichtung, max. 2h alt), stell die " +
        "Fall-Frage richtungsoffen: ein valider Sweep in Gegenrichtung ist Fall 1 für eine NEUE Dealing " +
        "Range in Gegenrichtung, NICHT Fall 2 für die laufende Idee. Nach log_fall_classification dann " +
        "über einen neuen run_bias_check die Richtung drehen, statt die alte Idee weiterzuführen. " +
        "Erkennst du daraus Fall 1 oder 2: ZUERST `log_fall_classification` aufrufen (schreibt dein " +
        "Urteil in die Maschine), DANN die TSC-Verknüpfung (Bootstrap/Bestätigung/Target/Pin-" +
        "Aufräumen) wie gewohnt über add_trade_confirmation/add_trade_target/remove_pin_entry — " +
        "dieses Tool tut das NICHT automatisch. MIT replayUntilSec: Backtest-Batch-Fast-Forward vom letzten " +
        "Analysezeitpunkt des Loops bis dorthin (auch bei replayUntilSec==letzter Analysezeitpunkt: " +
        "wertet dann sofort am aktuellen Punkt aus, statt nichts zu tun), mit einer Heartbeat-Zeile " +
        "pro Batch (`heartbeats` in der Antwort — kopiere sie 1:1 in den Chat) und " +
        "News-Blackout-Pause je Batch-Start. Stoppt bei Fall 4 ODER sobald `hasReaction=true`, läuft " +
        "automatisch weiter, solange gar nichts gefunden wird — bis `maxBatches` (Default 10).",
      inputSchema: {
        instrument: z.enum(["GBPUSD", "EURUSD"]).describe("Forex-Instrument"),
        replayUntilSec: z.number().int().optional().describe("Unix-Sekunden — Backtest-Zielzeitpunkt, bis zu dem vorgespult wird. Weglassen = Live-Tick 'jetzt'."),
        maxBatches: z.number().int().positive().optional().describe("Nur Backtest — Sicherheits-Cap, Default 10 (~20h Abdeckung)"),
      },
    },
    async (args: DealingRangeLoopArgs) => json(await runDealingRangeLoop(args)),
  );

  server.registerTool(
    "log_fall_classification",
    {
      title: "Schritt 5: Fall-1/2/3-Urteil loggen",
      description:
        "Pendant zu log_bias_decision (Schritt 3), für Schritt 5: NUR Fall 1 vs. 2 (Dealing Range " +
        "existiert bereits/Trend läuft normal weiter, beides mit vorhandener Reaktion) ist wirklich " +
        "Lanas Urteil — Fall 3 (keine Reaktion) und Fall 4 (Target/Invalidierung erreicht) " +
        "klassifiziert run_dealing_range_loop schon automatisch, dafür dieses Tool NICHT aufrufen. " +
        "NACH run_dealing_range_loop aufrufen, sobald `hasReaction=true` war und du aus `evidence` " +
        "eine Einordnung getroffen hast — schreibt das Urteil in die State-Machine (blockt hart, " +
        "falls der Loop gerade nicht bei `s45.fallClassification` parkt) und ins state_machine_log.",
      inputSchema: {
        instrument: z.enum(["GBPUSD", "EURUSD"]).describe("Forex-Instrument"),
        loopStateId: z.number().int().describe("loopStateId aus der run_dealing_range_loop-Antwort"),
        sec: z.number().int().describe("Analysezeitpunkt (Unix-Sekunden), wie bei run_dealing_range_loop"),
        case: z.union([z.literal(1), z.literal(2)]).describe("Welcher Fall zutrifft"),
        reasoning: z.string().describe("Kurze Begründung, warum dieser Fall zutrifft"),
      },
    },
    async (args) => json(await logFallClassification(args)),
  );

  server.registerTool(
    "retract_fall1_classification",
    {
      title: "Schritt 5: Fall-1-Urteil zurückziehen",
      description:
        "Gegenstück zu log_fall_classification, für den Fall, dass sich die Fall-1-Einordnung NACH " +
        "find_targets (das 'Fall 1 komplett?' als Nebeneffekt fest mit sich koppelt, siehe " +
        "find_targets-Tool-Beschreibung) doch als Fall 2 herausstellt — z.B. weil kein Kandidat aus " +
        "der Liste wirklich passt oder die Bewegung noch im Gange ist. Nur gültig, solange noch KEIN " +
        "add_trade_target gelaufen ist (blockt hart mit Fehler, falls der Loop nicht mehr bei " +
        "s45.llmPickTarget parkt) — danach müsste ein bereits gesetztes Target separat entfernt " +
        "werden, dafür dieses Tool nicht nutzen. Springt zurück zu Schritt 4/5 (#s45) — " +
        "run_dealing_range_loop danach normal weiter aufrufen.",
      inputSchema: {
        instrument: z.enum(["GBPUSD", "EURUSD"]).describe("Forex-Instrument"),
        sec: z.number().int().describe("Analysezeitpunkt (Unix-Sekunden) — Backtest/Replay-Zeitpunkt statt live 'jetzt'"),
        reasoning: z.string().describe("Kurze Begründung, warum es doch Fall 2 ist"),
      },
    },
    async (args) => json(await retractFall1Classification(args)),
  );

  server.registerTool(
    "log_fall_again_check",
    {
      title: "Schritt 5: 'Fall 1 komplett?'-Urteil loggen",
      description:
        "Beantwortet den 'Fall 1 komplett?'-Diamant (s45.fallAgainCheck im Graphen) direkt, ohne " +
        "den find_targets-Umweg (das complete IMMER auf true zwingt, siehe dessen Beschreibung). " +
        "complete=true: Range/Bewegung bereit für die Zielauswahl -> weiter zu find_targets. " +
        "complete=false: Bewegung noch im Gange, Zielauswahl ergibt noch keinen Sinn -> zurück zu " +
        "Schritt 4 (#s45), run_dealing_range_loop danach normal weiter aufrufen. Blockt hart, falls " +
        "der Loop gerade nicht bei s45.fallAgainCheck parkt (z.B. weil noch ein Stand-alone-Pin " +
        "aufzuräumen ist — erst remove_pin_entry).",
      inputSchema: {
        instrument: z.enum(["GBPUSD", "EURUSD"]).describe("Forex-Instrument"),
        sec: z.number().int().describe("Analysezeitpunkt (Unix-Sekunden) — Backtest/Replay-Zeitpunkt statt live 'jetzt'"),
        complete: z.boolean().describe("true = Fall 1 komplett (weiter zur Zielauswahl), false = Fall 2 (noch im Gange, zurück zu Schritt 4)"),
        reasoning: z.string().describe("Kurze Begründung"),
      },
    },
    async (args) => json(await logFallAgainCheck(args)),
  );

  server.registerTool(
    "log_no_entry_found",
    {
      title: "Schritt 7: Kein Entry gefunden",
      description:
        "Schritt 7 (Find Entry) ist rein Philips manuelle Aufgabe — findet er dort am Ende KEINEN " +
        "Entry (DR wird ohne Ausführung geschlossen/verworfen, oder das Zeitfenster läuft ab), gibt " +
        "es sonst keinen Weg zurück zu Schritt 4/5: s7_findEntry akzeptiert nur ENTRY_FOUND, jeder " +
        "weitere run_bias_check/run_dealing_range_loop-Aufruf blockt sonst hart (Bug-Vorfall " +
        "08.09.2026, EURUSD live). Bildet DR-Status 'VALIDE, kein Trade'/'Entry verpasst' aus " +
        "00-trading-steps.md ab. Rührt die eigentliche dealing_range NICHT an (Philip schließt/" +
        "verwirft sie selbst im UI) — synchronisiert nur die State-Machine. Nur an s7_findEntry " +
        "gültig (sendGuarded blockt sonst hart).",
      inputSchema: {
        instrument: z.enum(["GBPUSD", "EURUSD"]).describe("Forex-Instrument"),
        sec: z.number().int().describe("Analysezeitpunkt (Unix-Sekunden) — Backtest/Replay-Zeitpunkt statt live 'jetzt'"),
        reasoning: z.string().describe("Kurze Begründung (z.B. 'Philip hat die DR ohne Entry geschlossen')"),
      },
    },
    async (args) => json(await logNoEntryFound(args)),
  );
}
