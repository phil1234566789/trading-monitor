// Pure Scoring-Logik hinter get_validation_evidence (Schritt 6, siehe docs/state-machine.md +
// 06-dealing-range-validieren.md) — dependency-frei, testbar. Der eigentliche Kandidaten-Fetch
// (findAntiConfluenceCandidates.js unverändert wiederverwendet, plus die neue, spiegelbildliche
// Confluence-Sammlung) bleibt in tools/validationEvidence.ts (Deno-seitiger Handler).

export interface EvidenceScoreInput {
  confluenceCount: number;
  antiConfluenceCount: number;
  hasActiveOppositeDealingRange: boolean;
}

export interface EvidenceScoreBreakdownEntry {
  label: string;
  delta: number;
}

export interface EvidenceScoreResult {
  score: number;
  breakdown: EvidenceScoreBreakdownEntry[];
}

// Additive Gewichtung (Confluence +1, Anti-Confluence -1, aktive Gegen-DR -2) — bewusst KEIN
// Schwellenwert-Cutoff (06-dealing-range-validieren.md: VALIDE/INVALIDE ist eine qualitative
// Abwägung laut Handbuch, kein Score-Grenzwert). Der Score ist nur ein grober Anhaltspunkt in
// `get_validation_evidence`s Antwort, NIE die Entscheidung selbst (siehe `finalVerdict: null`).
export function computeEvidenceScore(input: EvidenceScoreInput): EvidenceScoreResult {
  const breakdown: EvidenceScoreBreakdownEntry[] = [];
  let score = 0;
  if (input.confluenceCount > 0) {
    score += input.confluenceCount;
    breakdown.push({ label: `${input.confluenceCount} Confluence(n)`, delta: input.confluenceCount });
  }
  if (input.antiConfluenceCount > 0) {
    score -= input.antiConfluenceCount;
    breakdown.push({ label: `${input.antiConfluenceCount} Anti-Confluence(n)`, delta: -input.antiConfluenceCount });
  }
  if (input.hasActiveOppositeDealingRange) {
    score -= 2;
    breakdown.push({ label: "aktive Gegen-Dealing-Range", delta: -2 });
  }
  return { score, breakdown };
}
