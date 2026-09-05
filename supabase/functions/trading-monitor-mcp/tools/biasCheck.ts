import { z } from "npm:zod@3.24.1";
import type { McpServer } from "npm:@modelcontextprotocol/sdk@^1.12.0/server/mcp.js";
import { berlinDateTimeStrFor, berlinDateStrFor, berlinDayRangeUtcMs } from "../berlinTime.ts";
import { fetchForexCandles } from "../forexCandles.ts";
import { startLoopState } from "../loopState.ts";
import { buildPretradeGates } from "./pretradeGates.ts";
import { compute1hStructureState } from "./dataExport.ts";
import { buildCandidatePool, findNearestLiquidityTargets, findNearestObTargets } from "../findTargetCandidates.js";
import { isSpreadHourPivot, findIntermediateLevel, determineTrendForce, buildPendingDecisions, type TrendForceLevelInput, type TrendForceObInput } from "../biasEngine.ts";
import { logDecision } from "../stateMachineLog.ts";
import { initMachineAfterBiasComputed } from "../machineState.ts";

function json(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

export interface BiasCheckArgs {
  instrument: string;
  replayUntilSec?: number;
}

// Deepste bestätigte Trend-Ebene (dropUnknownStructureLevels/summarizeMarketStructureState hat
// 'unknown' bereits ausgefiltert, siehe dataExport.ts) — 03-htf-bias.md: "die tiefste gelieferte
// Ebene 1:1 als maßgeblichen 1H-Trend übernehmen", nestedTrend=null ist der Normalfall.
function deepestTrend<T extends { trend: "uptrend" | "downtrend"; nestedTrend: T | null }>(node: T | null): T | null {
  if (!node) return null;
  let cur = node;
  while (cur.nestedTrend) cur = cur.nestedTrend;
  return cur;
}

// Nächstgelegenes HTF-Liquiditätslevel in der gesuchten Richtung, UNABHÄNGIG vom touched-Status
// (anders als findNearestLiquidityTargets, das nur unberührte Level fürs Ziel sucht) — für
// Prüfpunkt (4)/determineTrendForce muss auch ein BEREITS geswepptes Level gefunden werden können.
function nearestHtfLevel(levels: { price: number; direction: "high" | "low"; touched: boolean; timeframe: string; kontext?: string | null }[], direction: "high" | "low", currentPrice: number) {
  return levels
    .filter((l) => l.direction === direction && (l.timeframe === "1H" || l.timeframe === "4H"))
    .slice()
    .sort((a, b) => Math.abs(a.price - currentPrice) - Math.abs(b.price - currentPrice))[0] ?? null;
}

export async function buildBiasCheck({ instrument, replayUntilSec }: BiasCheckArgs) {
  const currentTimeSec = replayUntilSec ?? Math.floor(Date.now() / 1000);
  const gates = await buildPretradeGates({ instrument, nowSec: currentTimeSec });
  if (gates.exclude) {
    // Genau die Lücke aus dem Auslöser-Vorfall (01.09.2026): ohne diesen Log verschwindet ein
    // geblockter run_bias_check-Versuch spurlos, weil trading_loop_state hier NICHT geschrieben
    // wird (kein Loop, den ein späterer Blick auf heartbeat_log finden könnte) — loopStateId bleibt
    // deshalb null.
    await logDecision({
      instrument,
      dateStr: berlinDateStrFor(currentTimeSec),
      sec: currentTimeSec,
      step: 3,
      tool: "run_bias_check",
      decision: "blocked_by_gate",
      result: gates,
      message: gates.tradingHours.exclude ? gates.tradingHours.resultText : gates.news.textBlocks.join(" | "),
      loopStateId: null,
    });
    return { instrument, asOf: { sec: currentTimeSec, at: berlinDateTimeStrFor(currentTimeSec) }, gates, blocked: true as const };
  }

  const dateStr = berlinDateStrFor(currentTimeSec);
  const { startUtcMs } = berlinDayRangeUtcMs(dateStr);
  const asiaEndSec = startUtcMs / 1000 + 7 * 3600; // marktsessions.md#asia-session (00:00-07:00 Berlin)

  const [structureResult, candidatePool, priceCandles] = await Promise.all([
    compute1hStructureState(instrument, currentTimeSec),
    buildCandidatePool(instrument, currentTimeSec),
    fetchForexCandles(instrument, "5m", { count: 1, toMs: currentTimeSec * 1000 }),
  ]);
  const currentPrice = priceCandles[priceCandles.length - 1]?.close ?? null;
  const asiaCandles = candidatePool.m5Candles.filter((c) => c.time >= startUtcMs / 1000 && c.time < asiaEndSec);
  const asiaRange =
    asiaCandles.length > 0
      ? { rangeHigh: Math.max(...asiaCandles.map((c) => c.high)), rangeLow: Math.min(...asiaCandles.map((c) => c.low)), today: true }
      : { rangeHigh: null, rangeLow: null, today: false };

  const deepest = deepestTrend(structureResult.trend);
  if (!deepest || currentPrice == null) {
    // Fall 5 (03-htf-bias.md): kein bestätigter 1H-Trend ODER kein aktueller Preis verfügbar —
    // KEIN trading_loop_state-Write (kein Bias, auf dem ein Loop aufbauen könnte), Lana macht die
    // manuelle Kraft-Abwägung selbst, siehe Textbaustein "1H-Ebene unbestätigt (Algo)".
    await logDecision({
      instrument,
      dateStr,
      sec: currentTimeSec,
      step: 3,
      tool: "run_bias_check",
      decision: "unresolved_trend",
      result: { structure1h: structureResult.trend, structureTrendAge: structureResult.trendAge, currentPrice },
      message: "1H-Ebene unbestätigt (Algo) ---> manuelle Kraft-Abwägung",
      loopStateId: null,
    });
    return {
      instrument,
      asOf: { sec: currentTimeSec, at: berlinDateTimeStrFor(currentTimeSec) },
      gates,
      blocked: false as const,
      structure1h: structureResult.trend,
      structureTrendAge: structureResult.trendAge,
      unresolvedTrend: true as const,
      resultText: "1H-Ebene unbestätigt (Algo) ---> manuelle Kraft-Abwägung",
      kontextInfoSynthesis: null,
    };
  }

  const trend = deepest.trend as "uptrend" | "downtrend";
  const trendDirection: "long" | "short" = trend === "uptrend" ? "long" : "short";
  const counterDirection: "long" | "short" = trendDirection === "long" ? "short" : "long";

  // findTargetCandidates.js ist unveränderte Plain-JS (siehe docs/state-machine.md "Kritische
  // Dateien") ohne JSDoc-Typannotationen — TS leitet daraus lockere Typen (string statt
  // 'high'|'low', number statt 1|-1) her, `as any` hier ist nur ein Grenz-Cast an dieser
  // JS/TS-Schnittstelle, kein Laufzeit-Risiko (dieselben Objektformen wie überall sonst im Pool).
  const filteredLiquidity = candidatePool.liquidityLevels.filter((l: any) => l.pivotTime == null || !isSpreadHourPivot(l.pivotTime)) as any[];
  const filteredObZones = candidatePool.obZones.filter((z: any) => z.startTime == null || !isSpreadHourPivot(z.startTime)) as any[];

  const trendTargetLiquidity = findNearestLiquidityTargets(filteredLiquidity, { direction: trendDirection, currentPrice, limit: 1 })[0] ?? null;
  const counterTargetOb =
    (findNearestObTargets(filteredObZones, { direction: counterDirection, currentPrice, timeframe: "1H" as any, limit: 1 })[0] as any) ??
    (findNearestObTargets(filteredObZones, { direction: counterDirection, currentPrice, timeframe: "4H" as any, limit: 1 })[0] as any) ??
    (findNearestObTargets(filteredObZones, { direction: counterDirection, currentPrice, limit: 1 })[0] as any) ??
    null;

  const trendTarget = trendTargetLiquidity
    ? { price: trendTargetLiquidity.price, kind: "liquidity", refId: trendTargetLiquidity.id ?? null, timeframe: trendTargetLiquidity.timeframe, sourceTimeSec: trendTargetLiquidity.pivotTime }
    : null;
  const countertrendTarget = counterTargetOb
    ? {
        price: counterTargetOb.targetPrice,
        kind: "ob",
        refId: counterTargetOb.id ?? null,
        timeframe: counterTargetOb.timeframe,
        rangeLow: counterTargetOb.bottom,
        rangeHigh: counterTargetOb.top,
        sourceTimeSec: counterTargetOb.startTime,
      }
    : null;

  const intermediateLevel = trendTarget
    ? findIntermediateLevel({ direction: trendDirection, currentPrice, trendTargetPrice: trendTarget.price, liquidityLevels: filteredLiquidity, obZones: filteredObZones, asiaRange })
    : null;

  // Trend-Kraft (Prüfpunkt 4) — relevantes gegenläufiges HTF-OB ist i.d.R. das Countertrend-Target
  // selbst (siehe 03-htf-bias.md), relevantes gegenläufiges HTF-Level das nächstgelegene HTF-Level
  // in derselben Richtung wie das Countertrend-OB.
  const obForForce: TrendForceObInput | null = counterTargetOb ? { direction: counterTargetOb.direction, timeframe: counterTargetOb.timeframe, touched: counterTargetOb.touched, invalidated: counterTargetOb.invalidated } : null;
  const wantedLevelDir = counterDirection === "short" ? "high" : "low";
  const nearestLevel = nearestHtfLevel(filteredLiquidity, wantedLevelDir, currentPrice);
  const levelForForce: TrendForceLevelInput | null = nearestLevel ? { direction: nearestLevel.direction, price: nearestLevel.price, timeframe: nearestLevel.timeframe, touched: nearestLevel.touched } : null;
  const trendForce = determineTrendForce(trend, obForForce, levelForForce, currentPrice);

  const invalidation = countertrendTarget?.price ?? null;

  const pendingDecisions = buildPendingDecisions({
    trendForce,
    trendTargetFound: trendTarget != null,
    countertrendTargetFound: countertrendTarget != null,
    intermediateLevelFound: intermediateLevel != null,
  });

  const loopState = await startLoopState({
    instrument,
    dateStr,
    direction: trendDirection,
    trendTarget,
    countertrendTarget,
    intermediateLevel,
    invalidation,
    biasComputedAt: new Date(currentTimeSec * 1000).toISOString(),
    lastAnalysisTimeSec: currentTimeSec,
    replayUntilSec: replayUntilSec ?? null,
  });

  const currentNode = await initMachineAfterBiasComputed(loopState.id, instrument, currentTimeSec);

  await Promise.all([
    logDecision({
      instrument,
      dateStr,
      sec: currentTimeSec,
      step: 3,
      tool: "run_bias_check",
      decision: "trend_force",
      result: trendForce,
      message: [trendForce.ob.text, trendForce.level.text].filter(Boolean).join(" | ") || null,
      loopStateId: loopState.id,
    }),
    logDecision({
      instrument,
      dateStr,
      sec: currentTimeSec,
      step: 3,
      tool: "run_bias_check",
      decision: "intermediate_level",
      result: { intermediateLevel },
      message: intermediateLevel ? `Zwischen-Level gefunden: ${intermediateLevel.price} (${intermediateLevel.kind})` : "kein Zwischen-Level gefunden",
      loopStateId: loopState.id,
    }),
  ]);

  return {
    instrument,
    asOf: { sec: currentTimeSec, at: berlinDateTimeStrFor(currentTimeSec) },
    gates,
    blocked: false as const,
    currentPrice,
    structure1h: structureResult.trend,
    structureTrendAge: structureResult.trendAge,
    structureWindow: structureResult.window,
    trend,
    trendDirection,
    trendTarget,
    countertrendTarget,
    intermediateLevel,
    invalidation,
    trendForce,
    pendingDecisions,
    loopStateId: loopState.id,
    // State-Machine V2 (tradingMachine.ts) — steht nach diesem Aufruf bei "s3_bias.llm3_kontextSynthese",
    // wartet auf check_session_window (Schritt 4), das den Übergang nach s45 auslöst.
    currentNode,
    // Bewusst null — reine LLM-Anteile (siehe docs/state-machine.md, dauerhaft bei Lana):
    // Kontext-Info-Synthese (zwei Beobachtungen zu einer Einordnung verknüpfen) und der
    // Pace-Check-Hinweis (Chop-Phase zwischen Sweep/Fraktal und Reaktion). Macht sichtbar, was
    // mechanisch fertig ist und was Lana selbst beisteuern muss.
    kontextInfoSynthesis: null,
    paceCheckNote: null,
  };
}

// Pilot Schritt 3 (05.09.2026): loggt eine getroffene Wahl aus pendingDecisions separat von den
// automatisch geloggten Gate-/Trend-Kraft-Einträgen, weil DIESE Entscheidung erst entsteht, nachdem
// Lana die Tool-Antwort gelesen und interpretiert hat — kein Wert, den run_bias_check selbst kennt.
export async function logBiasDecision({ instrument, sec, loopStateId, substep, choice }: { instrument: string; sec: number; loopStateId: number; substep: string; choice: string }) {
  await logDecision({
    instrument,
    dateStr: berlinDateStrFor(sec),
    sec,
    step: 3,
    tool: "run_bias_check",
    decision: `substep_${substep}`,
    result: { substep, choice },
    message: choice,
    loopStateId,
  });
  return { logged: true as const, substep, choice };
}

export function registerBiasCheckTool(server: McpServer) {
  server.registerTool(
    "run_bias_check",
    {
      title: "Schritt 3: HTF-Bias + Targets",
      description:
        "Mechanisiert Schritt 3 (HTF-Bias bestimmen) aus 00-trading-steps — ruft check_pretrade_gates " +
        "intern zuerst auf und bricht bei `blocked=true` sofort ab (kein State-Write). Sonst: " +
        "1H-Struktur-Trend (`structure1h`, wie get_data_export), Trend-/Countertrend-Target (dieselbe " +
        "find_targets-Auswahl-Logik, Spread-Hour-Pivots übersprungen), Zwischen-Level-Check " +
        "(`intermediateLevel`, inkl. heutiger Asia-Range), Trend-Kraft am relevanten gegenläufigen " +
        "HTF-OB/-Level (`trendForce`) — UND schreibt/erneuert `trading_loop_state` für dieses " +
        "Instrument (ein bisheriger aktiver Loop wird dabei immer ersetzt, nie nur gepatcht, siehe " +
        "loopStateId in der Antwort). `kontextInfoSynthesis`/`paceCheckNote` sind bewusst `null` — " +
        "die beiden echten LLM-only-Anteile dieses Schritts, die DU selbst ergänzen musst (freie " +
        "Kontext-Info-Synthese aus zwei Beobachtungen, Pace-Check bei einer Chop-Phase vor der " +
        "Reaktion). `unresolvedTrend=true` heißt: Algo liefert keinen bestätigten 1H-Trend, manuelle " +
        "Kraft-Abwägung nötig, kein Loop-State-Write. `pendingDecisions` listet explizit, welche der " +
        "03-htf-bias.md-Teilentscheidungen noch offen ist (Substep 3.1 Trend+Kraft, 3.2 Targets, " +
        "ggf. 3.2b Zwischen-Level, 3.3 S/R-Zone) — bei `options` triffst DU die Wahl, bei `resolved` " +
        "steht die Antwort aus den Rohdaten schon fest und muss nur noch als Textbaustein formuliert " +
        "werden. `pendingDecisions` IMMER vollständig im Chat ausgeben (nicht nur deine eigene " +
        "Schlussfolgerung), damit Philip jeden Unterschritt einzeln nachvollziehen kann. Sobald du " +
        "für ein `options`-Feld eine Wahl getroffen hast, `log_bias_decision` aufrufen. Danach weiter " +
        "zu check_session_window (Schritt 4), dann run_dealing_range_loop (Schritt 5).",
      inputSchema: {
        instrument: z.enum(["GBPUSD", "EURUSD"]).describe("Forex-Instrument"),
        replayUntilSec: z.number().int().optional().describe("Unix-Sekunden — Backtest/Replay-Zeitpunkt statt live 'jetzt'"),
      },
    },
    async (args) => json(await buildBiasCheck(args)),
  );

  server.registerTool(
    "log_bias_decision",
    {
      title: "Schritt 3: Unterschritt-Entscheidung loggen",
      description:
        "Loggt eine getroffene Wahl aus run_bias_checks pendingDecisions in state_machine_log (Pilot " +
        "Schritt 3, 05.09.2026) — NACH der eigentlichen Analyse aufrufen, sobald du für ein " +
        "`options`-Feld eine Wahl getroffen hast (z.B. Substep 3.1: welcher Struktur-Fall zutrifft). " +
        "Für `resolved`-Felder (z.B. 3.2 Targets) nicht nötig, die stehen schon aus den Rohdaten fest.",
      inputSchema: {
        instrument: z.enum(["GBPUSD", "EURUSD"]).describe("Forex-Instrument"),
        sec: z.number().int().describe("Analysezeitpunkt (Unix-Sekunden), wie bei run_bias_check"),
        loopStateId: z.number().int().describe("loopStateId aus der run_bias_check-Antwort"),
        substep: z.string().describe("z.B. '3.1', '3.3'"),
        choice: z.string().describe("gewählte Option bzw. formulierte Entscheidung"),
      },
    },
    async (args) => json(await logBiasDecision(args)),
  );
}
