import { z } from "npm:zod@3.24.1";
import type { McpServer } from "npm:@modelcontextprotocol/sdk@^1.12.0/server/mcp.js";
import { berlinDateTimeStrFor, berlinDateStrFor, berlinDayRangeUtcMs } from "../../_shared/berlinTime.ts";
import { fetchForexCandles } from "../forexCandles.ts";
import { buildPretradeGates } from "./pretradeGates.ts";
import { compute1hStructureState } from "./dataExport.ts";
import { buildCandidatePool, findNearestLiquidityTargets, findNearestObTargets } from "../findTargetCandidates.js";
import { isSpreadHourPivot, findIntermediateLevel, buildPendingDecisions } from "../biasEngine.ts";
import { assessForce, type ForceLiquidityInput, type ForceObInput } from "../forceAssessment.ts";
import { json } from "../jsonResponse.ts";

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

export async function buildBiasCheck({ instrument, replayUntilSec }: BiasCheckArgs) {
  const currentTimeSec = replayUntilSec ?? Math.floor(Date.now() / 1000);
  const dateStr = berlinDateStrFor(currentTimeSec);
  // persist:false — dieser Aufruf holt/erzeugt den permanenten Pro-Tag-Actor selbst (unten) und
  // treibt ihn über seine eigenen transition()-Aufrufe, statt buildPretradeGates das nochmal
  // separat machen zu lassen (siehe pretradeGates.ts-Kopfkommentar).
  const gates = await buildPretradeGates({ instrument, nowSec: currentTimeSec });
  if (gates.exclude) {
    return {
      instrument,
      asOf: { sec: currentTimeSec, at: berlinDateTimeStrFor(currentTimeSec) },
      gates,
      blocked: true as const,
    };
  }
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

  // findTargetCandidates.js ist unveränderte Plain-JS (siehe docs/mcp-server.md) ohne JSDoc-Typannotationen — TS leitet daraus lockere Typen (string statt
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

  // Kraftabwägung (Prüfpunkt 4, kontext-analyse.md#kraft--herleitung-im-kontext-der-trade-ableitung):
  // BEIDE Quellen (LQ-Sweeps + OB-Reaktionen) und BEIDE Richtungen aus dem ohnehin schon preis-/
  // zeitgefilterten Kandidatenpool. Vorher wurde genau EIN gegenläufiges OB und EIN gegenläufiges
  // Level bewertet — die Gegenseite war damit unsichtbar, obwohl "kein Trade bei ausgeglichenem
  // Kampf" (allgemeines.md) sie zwingend braucht.
  const levelsForForce: ForceLiquidityInput[] = filteredLiquidity
    .filter((l: any) => (l.timeframe === "1H" || l.timeframe === "4H") && l.pivotTime != null)
    .map((l: any) => ({ price: l.price, direction: l.direction, pivotTimeSec: l.pivotTime, touched: l.touched, kontext: l.kontext ?? null, timeframe: l.timeframe }));
  const obsForForce: ForceObInput[] = filteredObZones
    .filter((z: any) => z.timeframe === "1H" || z.timeframe === "4H")
    .map((z: any) => ({ direction: z.dir === 1 ? "long" : "short", timeframe: z.timeframe, touched: z.touched, invalidated: z.invalidated, retested: z.retested ?? false, top: z.top, bottom: z.bottom }));
  const force = assessForce(levelsForForce, obsForForce, currentTimeSec);

  const invalidation = countertrendTarget?.price ?? null;

  const pendingDecisions = buildPendingDecisions({
    force,
    trendTargetFound: trendTarget != null,
    countertrendTargetFound: countertrendTarget != null,
    intermediateLevelFound: intermediateLevel != null,
  });

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
    force,
    pendingDecisions,
    // Bewusst null — qualitative Kontext-Synthese bleibt bei Lana:
    // Kontext-Info-Synthese (zwei Beobachtungen zu einer Einordnung verknüpfen). Macht sichtbar,
    // was mechanisch fertig ist und was Lana selbst beisteuern muss.
    kontextInfoSynthesis: null,
  };
}

export function registerBiasCheckTool(server: McpServer) {
  server.registerTool(
    "run_bias_check",
    {
      title: "HTF-Bias + Targets",
      description: "Liefert 1H-Struktur, Trend-/Countertrend-Target, Zwischen-Level und Kraft-Signale beider Richtungen. Prüft zuerst Handelszeit/News. pendingDecisions enthält offene qualitative Entscheidungen; kontextInfoSynthesis bleibt zur eigenen Bewertung null. Reine Analyse ohne Ablaufsteuerung.",
      inputSchema: {
        instrument: z.enum(["GBPUSD", "EURUSD"]).describe("Forex-Instrument"),
        replayUntilSec: z.number().int().optional().describe("Unix-Sekunden — Backtest/Replay-Zeitpunkt statt live 'jetzt'"),
      },
    },
    async (args) => json(await buildBiasCheck(args)),
  );

}
