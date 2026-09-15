// checkFallFour + hasReaction + computeWatchLevels (Schritt 5, siehe docs/state-machine.md +
// 05-dealing-range-bestaetigen.md). Nur Fall 4 wird hier mechanisch entschieden (reiner
// Preisvergleich) — Fall 1/2/3 bleiben bewusst Lanas eigene Einordnung (Philip, 31.08.2026: "eig
// sind alle drei Punkte LLM Sache", auch "OB hält"/"valider Sweep"), `hasReaction` ist nur eine
// reine Existenz-Prüfung, keine Bewertung. Inkl. eines Fixtures, das den GBPUSD-28.08.2026-
// News-Spike nachstellt (muss Fall 4 klassifizieren, der eigentliche Vorfall, der diese ganze
// State Machine ausgelöst hat).
import { describe, expect, it } from "vitest";
import { checkFallFour, hasReaction, computeWatchLevels, isDrTrackingBusy } from "../supabase/functions/trading-monitor-mcp/fallClassifier.ts";

const baseInput = {
  direction: "long",
  currentPrice: 1.364,
  trendTarget: { price: 1.3656 },
  countertrendTarget: { price: 1.362 },
  invalidation: 1.3615,
};

describe("checkFallFour", () => {
  it("Trend-Target erreicht (Preis über dem Long-Trend-Target)", () => {
    const result = checkFallFour({ ...baseInput, currentPrice: 1.3657 });
    expect(result.hit).toBe(true);
    expect(result.reason).toMatch(/Trend-Target/);
  });

  it("Invalidierung erreicht (GBPUSD-28.08.2026-News-Spike-Nachstellung)", () => {
    // Der eigentliche Vorfall: ein News-Spike hat das alte Trend-Target/die Invalidierung
    // gebrochen — muss zuverlässig als Fall 4 erkannt werden, unabhängig davon, ob Lana danach noch
    // aufmerksam ist.
    const result = checkFallFour({ direction: "short", trendTarget: { price: 1.358 }, countertrendTarget: { price: 1.362 }, invalidation: 1.362, currentPrice: 1.3625 });
    expect(result.hit).toBe(true);
  });

  it("Countertrend-Target erreicht", () => {
    const result = checkFallFour({ ...baseInput, currentPrice: 1.3619 });
    expect(result.hit).toBe(true);
    expect(result.reason).toMatch(/Countertrend-Target/);
  });

  it("kein Level erreicht -> hit=false", () => {
    const result = checkFallFour(baseInput);
    expect(result.hit).toBe(false);
    expect(result.reason).toBeNull();
  });
});

describe("hasReaction", () => {
  it("false, wenn nichts vorliegt", () => {
    expect(hasReaction({ hasAnyCompletedTradeSetup: false, obReactionCount: 0, liquiditySweepCount: 0 })).toBe(false);
  });
  it("true bei vollständigem Trade-Setup", () => {
    expect(hasReaction({ hasAnyCompletedTradeSetup: true, obReactionCount: 0, liquiditySweepCount: 0 })).toBe(true);
  });
  it("true bei mindestens einer OB-Reaktion", () => {
    expect(hasReaction({ hasAnyCompletedTradeSetup: false, obReactionCount: 1, liquiditySweepCount: 0 })).toBe(true);
  });
  it("true bei mindestens einem Sweep", () => {
    expect(hasReaction({ hasAnyCompletedTradeSetup: false, obReactionCount: 0, liquiditySweepCount: 1 })).toBe(true);
  });
  // Backtest GBPUSD 09.09.2026: hasAnyCompletedTradeSetup zählt beide Richtungen gleichrangig (kein
  // "eigenes"/"Gegen"-Setup mehr, siehe dealingRangeLoop.ts) — ein Setup in Gegenrichtung zum Bias
  // löst genauso eine Reaktion aus wie eins in Bias-Richtung, sonst lief es im Fast-Forward
  // still durch.
  it("true bei einem Setup in Gegenrichtung zum Bias, unabhängig davon, welche Richtung gemeint ist", () => {
    expect(hasReaction({ hasAnyCompletedTradeSetup: true, obReactionCount: 0, liquiditySweepCount: 0 })).toBe(true);
  });
});

describe("computeWatchLevels", () => {
  it("findet nächstes Level oberhalb UND unterhalb, ignoriert touched/invalidated", () => {
    const result = computeWatchLevels(
      1.364,
      [
        { price: 1.365, touched: false, id: 1, timeframe: "1H" },
        { price: 1.3635, touched: false, id: 2, timeframe: "1H" },
        { price: 1.363, touched: true, id: 3, timeframe: "1H" }, // touched -> ignoriert
      ],
      [{ top: 1.3648, bottom: 1.3644, touched: false, invalidated: false, id: 4, timeframe: "4H" }],
    );
    expect(result.above.price).toBe(1.3644); // nächste OB-Kante oberhalb schlägt das weiter entfernte Liquiditäts-Level
    expect(result.below.price).toBe(1.3635);
  });

  it("liefert null, wenn keine Seite Kandidaten hat", () => {
    const result = computeWatchLevels(1.364, [], []);
    expect(result.above).toBeNull();
    expect(result.below).toBeNull();
  });
});

// A/B/C-Umbau, Etappe 3 (milk-city-Task a-b-c-dauerlauf-statt-linearer-trading-steps-sequenz) — die
// eine Entscheidung, die zwischen "State-Machine antasten" (performFullTick) und "nur beobachten,
// nichts anfassen" (computeObservationOnly) unterscheidet. Root Cause: vorher gab es dafür nur einen
// Stub bei GENAU EINEM DR-Ketten-Knoten (s45.fallClassification); an jedem anderen (tscLink/pinCheck/
// fallAgainCheck/...) wäre ein erneuter Tick mit einem harten sendGuarded-Fehler abgebrochen
// (REFETCH_DONE ist dort kein gültiges Event).
describe("isDrTrackingBusy", () => {
  it("Tick-Zyklus-Knoten (Mode-Wahl/Watch-Level-Warten/Batch/Refetch) sind NICHT busy", () => {
    for (const node of ["s45.entry", "s45.mode", "s45.liveTick", "s45.liveWait", "s45.backtestBatch", "s45.backtestSkip", "s45.watchLevelHit", "s45.backtestHeartbeat", "s45.refetch"]) {
      expect(isDrTrackingBusy(node)).toBe(false);
    }
  });

  it("jeder Knoten der DR-Kette (fallClassification bis notify) ist busy", () => {
    for (const node of ["s45.fallClassification", "s45.fall3Pin", "s45.tscLink", "s45.pinCheck", "s45.pinRemove", "s45.fallAgainCheck", "s45.findTargets", "s45.llmPickTarget", "s45.addTarget", "s45.pinCheck2", "s45.pinRemove2", "s45.notify"]) {
      expect(isDrTrackingBusy(node)).toBe(true);
    }
  });

  it("Knoten außerhalb von s45 (Schritt 3/6/7/8/Endzustände) sind nie busy — dort greift ein anderer, bestehender Fehlerpfad", () => {
    for (const node of ["s1_handelszeit", "s2_news", "newsPause", "s3_bias.computing", "s3_bias.llm3_kontextSynthese", "s6_validieren.evidenceGathering", "s6_validieren.llm6a_antiConfluenceAuswahl", "s6_validieren.llm6_valideInvalide", "s7_findEntry", "s8_tradeManagement", "end_keinTrade", "end_positionGeschlossen"]) {
      expect(isDrTrackingBusy(node)).toBe(false);
    }
  });

  it("ein unbekannter s45.*-Knoten gilt als busy (fail-closed statt fail-open)", () => {
    expect(isDrTrackingBusy("s45.irgendEinNeuerKnoten")).toBe(true);
  });
});
