// computeEvidenceScore (Schritt 6, siehe docs/state-machine.md + 06-dealing-range-validieren.md) —
// additive Gewichtung, kein Schwellenwert (die VALIDE/INVALIDE-Entscheidung bleibt qualitativ bei Lana).
import { describe, expect, it } from "vitest";
import { computeEvidenceScore } from "../supabase/functions/trading-monitor-mcp/evidenceScoring.ts";

describe("computeEvidenceScore", () => {
  it("keine Confluences/Anti-Confluences/Gegen-DR -> Score 0, leeres Breakdown", () => {
    const result = computeEvidenceScore({ confluenceCount: 0, antiConfluenceCount: 0, hasActiveOppositeDealingRange: false });
    expect(result.score).toBe(0);
    expect(result.breakdown).toEqual([]);
  });

  it("Confluences zählen positiv (+1 je Stück)", () => {
    const result = computeEvidenceScore({ confluenceCount: 3, antiConfluenceCount: 0, hasActiveOppositeDealingRange: false });
    expect(result.score).toBe(3);
    expect(result.breakdown).toEqual([{ label: "3 Confluence(n)", delta: 3 }]);
  });

  it("Anti-Confluences zählen negativ (-1 je Stück)", () => {
    const result = computeEvidenceScore({ confluenceCount: 0, antiConfluenceCount: 2, hasActiveOppositeDealingRange: false });
    expect(result.score).toBe(-2);
  });

  it("aktive Gegen-Dealing-Range zieht zusätzlich -2 ab", () => {
    const result = computeEvidenceScore({ confluenceCount: 0, antiConfluenceCount: 0, hasActiveOppositeDealingRange: true });
    expect(result.score).toBe(-2);
    expect(result.breakdown).toEqual([{ label: "aktive Gegen-Dealing-Range", delta: -2 }]);
  });

  it("kombiniert alle drei additiv", () => {
    const result = computeEvidenceScore({ confluenceCount: 3, antiConfluenceCount: 1, hasActiveOppositeDealingRange: true });
    expect(result.score).toBe(3 - 1 - 2);
    expect(result.breakdown).toHaveLength(3);
  });
});
