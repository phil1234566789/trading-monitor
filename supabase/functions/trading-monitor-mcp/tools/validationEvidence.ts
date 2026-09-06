import { z } from "npm:zod@3.24.1";
import type { McpServer } from "npm:@modelcontextprotocol/sdk@^1.12.0/server/mcp.js";
import { berlinDateTimeStrFor, berlinDateStrFor } from "../berlinTime.ts";
import { fetchForexCandles } from "../forexCandles.ts";
import { fetchActiveTscRangeId, fetchDealingRangeCockpit, getOpenOppositeDealingRanges } from "../db.ts";
import { buildCandidatePool } from "../findTargetCandidates.js";
import { findAntiConfluenceCandidates } from "../findAntiConfluenceCandidates.js";
import { detectRsiDivergenceHistory } from "../rsi.js";
import { buildRecentReactions } from "./recentReactions.ts";
import { computeEvidenceScore } from "../evidenceScoring.ts";
import { logDecision } from "../stateMachineLog.ts";
import { safeTransitionChain, loadMachineForDay, transition } from "../machineState.ts";

function json(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

export interface ValidationEvidenceArgs {
  instrument: string;
  dealingRangeId?: number;
  currentTimeSec?: number;
}

// get_validation_evidence (Schritt 6, siehe docs/state-machine.md + 06-dealing-range-validieren.md)
// — strukturiertes Confluence/Anti-Confluence-Paket + Score, OHNE die finale VALIDE/INVALIDE-
// Entscheidung selbst zu treffen (die bleibt Lanas qualitative Abwägung). Kein
// trading_loop_state-Write (Schritt 6 hat keinen eigenen Loop-State).
export async function buildValidationEvidence({ instrument, dealingRangeId, currentTimeSec }: ValidationEvidenceArgs) {
  const effectiveTimeSec = currentTimeSec ?? Math.floor(Date.now() / 1000);
  const rangeId = dealingRangeId ?? (await fetchActiveTscRangeId(instrument));
  if (rangeId == null) {
    throw new Error(`Keine aktive Dealing-Range für ${instrument} gefunden — zuerst Schritt 5 (run_dealing_range_loop) bis Fall 1 durchlaufen, oder dealingRangeId explizit angeben.`);
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

  const [antiConfluences, reactions, candidatePool, priceCandles, openOpposite] = await Promise.all([
    findAntiConfluenceCandidates({ instrument, direction, zoneBoundPrice, invalidation: invalidation ?? undefined, currentTimeSec: effectiveTimeSec }),
    buildRecentReactions({ instrument, replayUntilSec: effectiveTimeSec }),
    buildCandidatePool(instrument, effectiveTimeSec),
    fetchForexCandles(instrument, "5m", { count: 1, toMs: effectiveTimeSec * 1000 }),
    getOpenOppositeDealingRanges(instrument, direction),
  ]);
  const currentPrice = priceCandles[priceCandles.length - 1]?.close ?? null;

  // Confluences: spiegelbildlich zu findAntiConfluenceCandidates — gleichgerichtete (statt
  // gegenläufige) gehaltene HTF-OB-Reaktionen/Sweeps (dieselbe get_recent_reactions-Rohquelle) +
  // gleichgerichtete RSI-Divergenz (dieselben M5-Kerzen wie find_anti_confluences, aus
  // buildCandidatePool, kein zweiter Fetch).
  const wantedSweepDir: "high" | "low" = direction === "long" ? "low" : "high";
  const obConfluences = ((reactions as any).obReactions ?? []).filter((z: any) => z.direction === direction && z.touched && !z.invalidated && (z.timeframe === "1H" || z.timeframe === "4H"));
  const sweepConfluences = ((reactions as any).liquiditySweeps ?? []).filter((s: any) => s.direction === wantedSweepDir && (s.timeframe === "1H" || s.timeframe === "4H"));
  const wantedDivType = direction === "long" ? "bullish" : "bearish";
  const divergenceConfluences = detectRsiDivergenceHistory(candidatePool.m5Candles).filter((d: any) => d.type === wantedDivType);

  const confluenceCount = obConfluences.length + sweepConfluences.length + divergenceConfluences.length;
  const antiConfluenceCount = antiConfluences.obCandidates.length + antiConfluences.sweepCandidates.length + antiConfluences.divergenceCandidates.length + antiConfluences.invalidationObCandidates.length;
  const score = computeEvidenceScore({ confluenceCount, antiConfluenceCount, hasActiveOppositeDealingRange: openOpposite.length > 0 });

  // State-Machine-Verdrahtung (Schritt 5 Ende -> Schritt 6 Start, siehe machineState.ts:
  // safeTransitionChain) — PIN2_CHECKED{false} holt einen übersprungenen "nichts zum Aufräumen"-
  // Zwischenschritt nach (kein Tool-Call für den negativen Zweig, siehe find_targets-Kommentar),
  // NOTIFIED repräsentiert die (Claude-Code-seitige) Benachrichtigungspflicht aus 05-dealing-range-
  // bestaetigen.md, EVIDENCE_GATHERED ist der eigentliche Schritt-6-Einstieg durch DIESEN Aufruf.
  await safeTransitionChain(instrument, [{ type: "PIN2_CHECKED", found: false }, { type: "NOTIFIED" }, { type: "EVIDENCE_GATHERED" }], effectiveTimeSec);

  // Kein trading_loop_state-Write in Schritt 6 (siehe Kommentar oben) — dieser Log-Eintrag steht
  // deshalb bewusst ohne loopStateId, per instrument/date_str/dealingRangeId (im result) trotzdem
  // auffindbar.
  await logDecision({
    instrument,
    dateStr: berlinDateStrFor(effectiveTimeSec),
    sec: effectiveTimeSec,
    step: 6,
    tool: "get_validation_evidence",
    decision: "evidence_score",
    result: { dealingRangeId: rangeId, confluenceCount, antiConfluenceCount, hasActiveOppositeDealingRange: openOpposite.length > 0, score },
    message: `Score ${score.score} (${score.breakdown.map((b) => b.label).join(", ") || "keine Faktoren"})`,
    loopStateId: null,
  });

  return {
    instrument,
    dealingRangeId: rangeId,
    direction,
    invalidation,
    zoneBoundPrice,
    currentPrice,
    asOf: { sec: effectiveTimeSec, at: berlinDateTimeStrFor(effectiveTimeSec) },
    confluences: { obCandidates: obConfluences, sweepCandidates: sweepConfluences, divergenceCandidates: divergenceConfluences },
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
      title: "Schritt 6: Validierungs-Evidenz (Confluences/Anti-Confluences)",
      description:
        "Mechanisiert die Kandidaten-Sammlung aus Schritt 6 (Dealing Range validieren) — braucht eine " +
        "bereits bestätigte Dealing Range mit mindestens einem Target (siehe run_dealing_range_loop " +
        "Fall 1). `confluences` (gleichgerichtete gehaltene HTF-OB-Reaktionen/Sweeps + gleichgerichtete " +
        "RSI-Divergenz) UND `antiConfluences` (dieselbe Kandidatenliste wie find_anti_confluences — " +
        "gegenläufige OBs/Sweeps/Divergenz zwischen aktuellem Preis und dem preislich extremsten " +
        "Target, plus unberührte gegenläufige OBs nahe der Invalidierung) sind reine Kandidatenlisten " +
        "— jede tatsächlich per add_trade_confirmation gespeicherte Confluence/Anti-Confluence MUSS " +
        "einer davon entsprechen. `score` ist additiv (Confluence +1, Anti-Confluence -1, aktive " +
        "Gegen-Dealing-Range -2) und NUR ein grober Anhaltspunkt — `finalVerdict` ist bewusst `null`, " +
        "die VALIDE/INVALIDE-Entscheidung bleibt deine eigene qualitative Abwägung laut " +
        "06-dealing-range-validieren.md, kein Schwellenwert-Cutoff. `openOppositeDealingRanges` " +
        "listet noch nicht abgeschlossene Gegen-Ideen — ob sie bereits erkennbar schwächelt, prüfst " +
        "du selbst. `consolidationProtectionNote`: der Konsolidierungsschutz-Check ist noch nicht " +
        "mechanisiert, weiter manuell laut Handbuch prüfen. dealingRangeId optional (Default: die " +
        "aktive TSC-Range des Instruments, siehe get_tsc_range).",
      inputSchema: {
        instrument: z.enum(["GBPUSD", "EURUSD"]).describe("Forex-Instrument"),
        dealingRangeId: z.number().int().optional().describe("Default: aktive TSC-Range des Instruments"),
        currentTimeSec: z.number().int().optional().describe("Unix-Sekunden — Backtest/Replay-Zeitpunkt statt live 'jetzt'"),
      },
    },
    async (args) => json(await buildValidationEvidence(args)),
  );

  // Pendant zu log_bias_decision (Schritt 3)/log_fall_classification (Schritt 5) für Schritt 6 —
  // die finale VALIDE/INVALIDE-Abwägung ist laut docs/state-machine.md dauerhaft Lanas eigene,
  // qualitative Entscheidung (kein Schwellenwert-Cutoff aus get_validation_evidence.score), hatte
  // bisher aber kein Tool, das dieses Urteil in die State-Machine einträgt (Task "State-Machine bis
  // zum letzten Schritt durchziehen", 2026-09-05) — der Graph unter /trading-flow blieb dadurch bei
  // Schritt 6 für immer stehen. Kein loopStateId-Parameter (anders als log_fall_classification):
  // get_validation_evidence gibt keinen zurück (Schritt 6 hat laut eigener Doku keinen eigenen
  // Loop-State-Write), lädt den aktiven Loop stattdessen direkt über instrument.
  server.registerTool(
    "log_validation_verdict",
    {
      title: "Schritt 6: VALIDE/INVALIDE-Urteil loggen",
      description:
        "Trägt Lanas finale VALIDE/INVALIDE-Abwägung aus Schritt 6 (Dealing Range validieren) in die " +
        "State-Machine ein — NACH get_validation_evidence aufrufen, sobald du aus den Confluences/" +
        "Anti-Confluences/dem Score eine qualitative Entscheidung getroffen hast (kein Schwellenwert-" +
        "Cutoff, siehe 06-dealing-range-validieren.md). 'valide' geht weiter zu Schritt 7 (Find " +
        "Entry), 'invalide' zurück zu Schritt 4/5 (neuer Loop-Durchlauf). Blockt hart, falls der " +
        "Loop gerade nicht bei s6_validieren.llm6_valideInvalide parkt (z.B. get_validation_evidence " +
        "noch nicht aufgerufen).",
      inputSchema: {
        instrument: z.enum(["GBPUSD", "EURUSD"]).describe("Forex-Instrument"),
        sec: z.number().int().describe("Analysezeitpunkt (Unix-Sekunden)"),
        verdict: z.enum(["valide", "invalide"]),
        reasoning: z.string().describe("Kurze Begründung für das Urteil"),
      },
    },
    async ({ instrument, sec, verdict, reasoning }) => {
      const loaded = await loadMachineForDay(instrument, berlinDateStrFor(sec));
      const currentNode = await transition(loaded, instrument, { type: "VALID_INVALID_JUDGED", verdict }, sec);
      await logDecision({
        instrument,
        dateStr: berlinDateStrFor(sec),
        sec,
        step: 6,
        tool: "log_validation_verdict",
        decision: "verdict",
        result: { verdict, reasoning },
        message: `${verdict}: ${reasoning}`,
        loopStateId: loaded.loopId,
      });
      return json({ logged: true as const, verdict, currentNode });
    },
  );
}
