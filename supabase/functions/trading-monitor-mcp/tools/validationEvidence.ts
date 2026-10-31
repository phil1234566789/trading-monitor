import { z } from "npm:zod@3.24.1";
import type { McpServer } from "npm:@modelcontextprotocol/sdk@^1.12.0/server/mcp.js";
import { berlinDateTimeStrFor } from "../../_shared/berlinTime.ts";
import { fetchForexCandles } from "../forexCandles.ts";
import { fetchActiveTscRangeId, fetchDealingRangeCockpit, getOpenOppositeDealingRanges } from "../db.ts";
import { findAntiConfluenceCandidates } from "../findAntiConfluenceCandidates.js";
import { buildRecentReactions } from "./recentReactions.ts";
import { computeEvidenceScore } from "../evidenceScoring.ts";
import { REPLAY_UNTIL_SEC } from "../toolParams.ts";
import { json } from "../jsonResponse.ts";

export interface ValidationEvidenceArgs {
  instrument: string;
  dealingRangeId?: number;
  currentTimeSec?: number;
}

export async function buildValidationEvidence({ instrument, dealingRangeId, currentTimeSec }: ValidationEvidenceArgs) {
  const effectiveTimeSec = currentTimeSec ?? Math.floor(Date.now() / 1000);
  const rangeId = dealingRangeId ?? (await fetchActiveTscRangeId(instrument));
  if (rangeId == null) {
    throw new Error(`Keine aktive Dealing-Range für ${instrument} gefunden — dealingRangeId explizit angeben oder eine Dealing Range anlegen.`);
  }
  const cockpit = await fetchDealingRangeCockpit(rangeId);
  if (!cockpit) throw new Error(`dealing_range ${rangeId} existiert nicht.`);
  const direction = cockpit.direction as "long" | "short";
  const invalidation = cockpit.invalidation as number | null;
  const targetPrices = cockpit.targets.map((t: { price: number }) => t.price);
  if (targetPrices.length === 0) {
    throw new Error(`dealing_range ${rangeId} hat noch keine Targets — zuerst add_trade_target aufrufen (Schritt 5, TSC-Verknüpfung).`);
  }
  const zoneBoundPrice = direction === "long" ? Math.max(...targetPrices) : Math.min(...targetPrices);

  const [antiConfluences, reactions, priceCandles, openOpposite] = await Promise.all([
    findAntiConfluenceCandidates({ instrument, direction, zoneBoundPrice, invalidation: invalidation ?? undefined, currentTimeSec: effectiveTimeSec }),
    buildRecentReactions({ instrument, replayUntilSec: effectiveTimeSec }),
    fetchForexCandles(instrument, "5m", { count: 1, toMs: effectiveTimeSec * 1000 }),
    getOpenOppositeDealingRanges(instrument, direction),
  ]);
  const currentPrice = priceCandles[priceCandles.length - 1]?.close ?? null;

  // Confluences: spiegelbildlich zu findAntiConfluenceCandidates — gleichgerichtete (statt
  // gegenläufige) gehaltene HTF-OB-Reaktionen/Sweeps. RSI-Divergenzen werden als Bestätigungen
  // manuell aus dem Chart übernommen und gehören deshalb nicht in diese Zusatzargument-Liste.
  const wantedSweepDir: "high" | "low" = direction === "long" ? "low" : "high";
  const obConfluences = ((reactions as any).obReactions ?? []).filter((z: any) => z.direction === direction && z.touched && !z.invalidated && (z.timeframe === "1H" || z.timeframe === "4H"));
  const sweepConfluences = ((reactions as any).liquiditySweeps ?? []).filter((s: any) => s.direction === wantedSweepDir && (s.timeframe === "1H" || s.timeframe === "4H"));
  const confluenceCount = obConfluences.length + sweepConfluences.length;
  const antiConfluenceCount = antiConfluences.obCandidates.length + antiConfluences.sweepCandidates.length + antiConfluences.divergenceCandidates.length + antiConfluences.invalidationObCandidates.length;
  const score = computeEvidenceScore({ confluenceCount, antiConfluenceCount, hasActiveOppositeDealingRange: openOpposite.length > 0 });

  return {
    instrument,
    dealingRangeId: rangeId,
    direction,
    invalidation,
    zoneBoundPrice,
    currentPrice,
    asOf: { sec: effectiveTimeSec, at: berlinDateTimeStrFor(effectiveTimeSec) },
    confluences: { obCandidates: obConfluences, sweepCandidates: sweepConfluences },
    antiConfluences,
    openOppositeDealingRanges: openOpposite,
    score,
    finalVerdict: null,
    consolidationProtectionNote:
      "Konsolidierungsschutz (M5-Frühwarnsignale, marktstruktur.md#konsolidierungsschutz--priorität) ist in diesem ersten Wurf noch nicht als eigenes Kandidaten-Feld abgebildet — manuell prüfen.",
  };
}

export function registerValidationEvidenceTool(server: McpServer) {
  server.registerTool(
    "get_validation_evidence",
    {
      title: "Validierungs-Evidenz (Confluences/Anti-Confluences)",
      description: "Sammelt Confluences und Anti-Confluences zu einer Dealing Range mit mindestens einem Target. Der additive Score ist ein Anhaltspunkt; finalVerdict bleibt zur eigenen qualitativen Bewertung null. dealingRangeId optional, Standard ist die aktive TSC-Range.",
      inputSchema: {
        instrument: z.enum(["GBPUSD", "EURUSD"]).describe("Forex-Instrument"),
        dealingRangeId: z.number().int().optional().describe("Default: aktive TSC-Range des Instruments"),
        replayUntilSec: REPLAY_UNTIL_SEC,
      },
    },
    async ({ replayUntilSec, ...rest }) => json(await buildValidationEvidence({ ...rest, currentTimeSec: replayUntilSec })),
  );

}
