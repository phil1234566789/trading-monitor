// Guard hinter add_trade_target (Schritt 5). Fixture ist der reale Fehlerfall GBPUSD 09.09.2026
// 09:00: find_targets lieferte acht Kandidaten, gewählt wurde der ENTFERNTESTE (1.35368), weil das
// Ziel schon aus Schritt 3 feststand und die Liste nur noch zum Abnicken benutzt wurde.
import { describe, expect, it } from "vitest";
import {
  flattenTargetCandidates,
  findUnexplainedNearerTargets,
  unexplainedNearerTargetsError,
} from "../supabase/functions/trading-monitor-mcp/targetChoiceGuard.ts";

// 1:1 aus der find_targets(GBPUSD, short, 1788937200)-Antwort.
const gbpusd090926 = {
  currentPrice: 1.35588,
  liquidityCandidates: [
    { price: 1.35528, direction: "high", timeframe: "1H" },
    { price: 1.35481, direction: "low", timeframe: "5M" },
    { price: 1.35443, direction: "low", timeframe: "5M" },
    { price: 1.3544, direction: "low", timeframe: "5M" },
    { price: 1.35413, direction: "low", timeframe: "5M" },
  ],
  obCandidates: [
    { targetPrice: 1.35439, direction: "long", timeframe: "5M" },
    { targetPrice: 1.35368, direction: "long", timeframe: "1H" },
    { targetPrice: 1.35341, direction: "long", timeframe: "5M" },
  ],
};

const candidates = flattenTargetCandidates(gbpusd090926);
const currentPrice = gbpusd090926.currentPrice;

describe("findUnexplainedNearerTargets", () => {
  it("blockt den realen Fehlerfall: 1.35368 ohne Begründungen", () => {
    const unexplained = findUnexplainedNearerTargets(candidates, { price: 1.35368, currentPrice });
    // Alle sechs Kandidaten zwischen Kurs und 1.35368 (22,0 Pips) — auch 1.35413 mit 17,5 Pips.
    expect(unexplained.map((c) => c.price).sort()).toEqual([1.3544, 1.35413, 1.35439, 1.35443, 1.35481, 1.35528].sort());
  });

  it("lässt den nächstgelegenen Kandidaten ohne Begründung durch", () => {
    expect(findUnexplainedNearerTargets(candidates, { price: 1.35528, currentPrice })).toEqual([]);
  });

  it("lässt einen weiter entfernten Kandidaten durch, wenn jeder nähere begründet ist", () => {
    const unexplained = findUnexplainedNearerTargets(candidates, {
      price: 1.35439,
      currentPrice,
      skippedCandidates: ["1.35528 = Hoch, kein Short-Ziel", "1.35481 = zu eng am Entry", "1.35443 und 1.35440 = Asia-Mid-Cluster"],
    });
    expect(unexplained).toEqual([]);
  });

  it("nennt weiterhin die Lücke, wenn nur EIN näherer Kandidat unbegründet bleibt", () => {
    const unexplained = findUnexplainedNearerTargets(candidates, {
      price: 1.35439,
      currentPrice,
      skippedCandidates: ["1.35528 = Hoch", "1.35481 = zu eng", "1.35443 = Asia-Mid"],
    });
    expect(unexplained.map((c) => c.price)).toEqual([1.3544]);
  });

  it("liest Preise auch mit deutschem Komma aus den Begründungen", () => {
    const unexplained = findUnexplainedNearerTargets(candidates, {
      price: 1.35481,
      currentPrice,
      skippedCandidates: ["1,35528 = Hoch, kein Short-Ziel"],
    });
    expect(unexplained).toEqual([]);
  });

  it("zählt den gewählten Kandidaten nicht gegen sich selbst", () => {
    // 1.35439 (OB) und 1.3544 (Liquidität) liegen 0,1 Pip auseinander — der gewählte darf nicht
    // über die Epsilon-Grenze als eigener übersprungener Kandidat zurückkommen.
    const unexplained = findUnexplainedNearerTargets(candidates, { price: 1.35528, currentPrice });
    expect(unexplained.some((c) => c.price === 1.35528)).toBe(false);
  });
});

describe("unexplainedNearerTargetsError", () => {
  it("listet die fehlenden Kandidaten von nah nach fern", () => {
    const unexplained = findUnexplainedNearerTargets(candidates, { price: 1.35368, currentPrice });
    const msg = unexplainedNearerTargetsError(unexplained, currentPrice);
    expect(msg).toContain("1.35528");
    expect(msg.indexOf("1.35528")).toBeLessThan(msg.indexOf("1.35413"));
  });
});
