// Verifiziert die 'LQ-sweep'-Reklassifizierung aus applyInnerMarketStructurePivot (siehe
// marketStructureAnalysis.ts: markLqSweeps/closesBelowLevel) — Regel aus Chat 2026-07-19,
// gbp_h1_uptrend_mit_LQ_sweep_LONG_SETUP.ts rangeState1_1: ein touched LOW-structurePivot, das NIE
// eine Kerze drunter geschlossen hat, ist ein Liquidity-Grab statt eines echten Bruchs. Synthetische
// statt echter Fixture-Kerzen, weil das reale Beispiel (pivot6..pivot12) einen mehrtägigen
// Kerzenbereich bräuchte — die Regel selbst ist gegen die echten Kerzen bereits per Skript geprüft
// (siehe Kommentar über rangeState1_1 in der Testdatei).
import { describe, expect, it } from "vitest";
import { initMarketStructureState, applyInnerMarketStructurePivot } from "../src/marketStructureAnalysis";

const origin = {
  low: { type: "low", price: 1.0, pivotAt: "a", pivotTime: 0, touched: false },
  high: { type: "high", price: 5.0, pivotAt: "b", pivotTime: 100, touched: false }, // weit weg, damit unser Test-Pivot ihn nie bricht
};

// levelSweep: touched (Docht drunter), aber NIE eine Kerze geschlossen drunter -> soll LQ-sweep werden.
const levelSweep = { type: "low", price: 1.2, pivotAt: "sweep", pivotTime: 1000, touched: { price: 1.2, touchedAt: "x" } };
// levelRealBreak: touched UND eine Kerze schließt tatsächlich drunter -> bleibt normales 'low'.
const levelRealBreak = { type: "low", price: 1.3, pivotAt: "break", pivotTime: 2000, touched: { price: 1.3, touchedAt: "y" } };
// levelUntouched: nie touched -> darf gar nicht erst geprüft/reklassifiziert werden.
const levelUntouched = { type: "low", price: 1.1, pivotAt: "untouched", pivotTime: 1500, touched: false };

function baseState() {
  return {
    ...initMarketStructureState(origin.low, origin.high),
    structurePivots: [levelSweep, levelRealBreak, levelUntouched],
  };
}

const triggerPivot = { type: "low", price: 0.9, pivotAt: "trigger", pivotTime: 9000, touched: false };

const candles = [
  // nach levelSweep (1000), Preis bleibt immer über 1.2 -> nie ein Close drunter
  { time: 1200, open: 1.25, high: 1.28, low: 1.19, close: 1.25 }, // Docht unter 1.2, aber Close drüber
  { time: 1400, open: 1.24, high: 1.3, low: 1.22, close: 1.26 },
  // nach levelRealBreak (2000): EIN echter Close unter 1.3
  { time: 2200, open: 1.29, high: 1.31, low: 1.24, close: 1.25 },
  { time: 2400, open: 1.26, high: 1.29, low: 1.25, close: 1.28 },
];

describe("marketStructureAnalysis: LQ-sweep-Reklassifizierung (applyInnerMarketStructurePivot)", () => {
  it("touched LOW ohne jeden Close drunter -> 'LQ-sweep'", () => {
    const s = applyInnerMarketStructurePivot(baseState(), triggerPivot, { candles });
    const sweep = s.structurePivots.find((p) => p.pivotAt === "sweep");
    expect(sweep.type).toBe("LQ-sweep");
  });

  it("touched LOW MIT echtem Close drunter -> bleibt 'low'", () => {
    const s = applyInnerMarketStructurePivot(baseState(), triggerPivot, { candles });
    const realBreak = s.structurePivots.find((p) => p.pivotAt === "break");
    expect(realBreak.type).toBe("low");
  });

  it("nie touched -> wird gar nicht erst geprüft, bleibt 'low'", () => {
    const s = applyInnerMarketStructurePivot(baseState(), triggerPivot, { candles });
    const untouched = s.structurePivots.find((p) => p.pivotAt === "untouched");
    expect(untouched.type).toBe("low");
  });

  it("ohne Kerzendaten (candles=[]) konservativ KEIN Sweep behaupten", () => {
    const s = applyInnerMarketStructurePivot(baseState(), triggerPivot, {});
    const sweep = s.structurePivots.find((p) => p.pivotAt === "sweep");
    expect(sweep.type).toBe("low");
  });

  // Regressionstest für den Bug vom 2026-07-19 ("aktuell werden 3 1h LQ-Sweeps erkannt"): touched
  // ist der volle Fixture-Endstand, steht also schon fest, bevor der Replay den tatsächlichen
  // Docht-Moment überhaupt erreicht — ein FRÜHER Zwischenschritt (toTime vor dem echten Close-
  // drunter) kann levelRealBreak fälschlich schon als 'LQ-sweep' markieren. Ohne Rückweg bliebe
  // das für immer hängen, obwohl ein späterer Schritt den echten Close-drunter längst sieht.
  it("einmal fälschlich als LQ-sweep markiert (früher Zwischenschritt) korrigiert sich bei einem späteren Schritt wieder zurück zu 'low'", () => {
    const early = { type: "low", price: 0.9, pivotAt: "early", pivotTime: 2100, touched: false }; // VOR dem Close-drunter-Candle (2200)
    const s1 = applyInnerMarketStructurePivot(baseState(), early, { candles });
    expect(s1.structurePivots.find((p) => p.pivotAt === "break").type).toBe("LQ-sweep"); // (noch) verfrüht, aber nachvollziehbar

    const later = { type: "low", price: 0.9, pivotAt: "later", pivotTime: 2500, touched: false }; // NACH dem Close-drunter-Candle
    const s2 = applyInnerMarketStructurePivot(s1, later, { candles });
    expect(s2.structurePivots.find((p) => p.pivotAt === "break").type).toBe("low"); // korrigiert sich zurück
  });
});
