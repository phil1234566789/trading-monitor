// Verifiziert die 'LQ-sweep'-Reklassifizierung aus applyInnerMarketStructurePivot (siehe
// marketStructureAnalysis.ts: markLqSweeps/closesBelowLevel) — Regel aus Chat 2026-07-19,
// gbp_h1_uptrend_mit_LQ_sweep_LONG_SETUP.ts rangeState1_1: ein touched LOW-structurePivot, das NIE
// eine Kerze drunter geschlossen hat, ist ein Liquidity-Grab statt eines echten Bruchs. Synthetische
// statt echter Fixture-Kerzen, weil das reale Beispiel (pivot6..pivot12) einen mehrtägigen
// Kerzenbereich bräuchte — die Regel selbst ist gegen die echten Kerzen bereits per Skript geprüft
// (siehe Kommentar über rangeState1_1 in der Testdatei).
import { describe, expect, it } from "vitest";
import { initMarketStructureState, applyMarketStructurePivot, applyInnerMarketStructurePivot } from "../src/marketStructureAnalysis";

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

  // War bis Chat 2026-07-24 ein Regressionstest für den Bug vom 2026-07-19 ("aktuell werden 3 1h
  // LQ-Sweeps erkannt") UND demonstrierte gleichzeitig eine bewusst hingenommene Verzögerung: toTime
  // war die pivotTime des GERADE ankommenden Pivots selbst, nicht die letzte bereits geladene Kerze
  // — ein früher Zwischenschritt sah den echten Close-drunter (Kerze bei 2200) deshalb noch nicht,
  // obwohl `candles` ihn längst enthielt. Genau diese Verzögerung war die Ursache für den Live-Bug
  // ("kein BOS trotz längst erfolgtem Kerzenschluss unter dem Level", siehe
  // test/marketStructureAnalysisRealPipeline.test.js) — seit dem Fix (latestKnownTime in
  // marketStructureAnalysis.ts: toTime = letzte bekannte Kerze, nicht die pivotTime des auslösenden
  // Pivots) wird ein bereits in `candles` sichtbarer Close-drunter SOFORT erkannt, auch an einem
  // frühen Zwischenschritt — kein Zurückkorrigieren mehr nötig.
  it("ein bereits in candles sichtbarer Close-drunter wird sofort erkannt, auch an einem frühen Zwischenschritt (kein Nachlauf mehr)", () => {
    const early = { type: "low", price: 0.9, pivotAt: "early", pivotTime: 2100, touched: false }; // VOR dem Close-drunter-Candle (2200), aber candles reicht schon bis 2400
    const s1 = applyInnerMarketStructurePivot(baseState(), early, { candles });
    expect(s1.structurePivots.find((p) => p.pivotAt === "break").type).toBe("low"); // sofort korrekt, kein verfrühtes 'LQ-sweep' mehr

    const later = { type: "low", price: 0.9, pivotAt: "later", pivotTime: 2500, touched: false };
    const s2 = applyInnerMarketStructurePivot(s1, later, { candles });
    expect(s2.structurePivots.find((p) => p.pivotAt === "break").type).toBe("low"); // bleibt stabil
  });

  // Chat 2026-07-24 ("pivot 1.336 fällt unter 1.33806 ohne Chance auf LS"): ein protected-low, das
  // per echtem Kerzenschluss bricht, ist strukturell schwerwiegender als ein gewöhnlicher Pullback
  // -> eigener Typ 'break-of-structure' statt einfach nur 'low'. trend selbst bleibt unangetastet
  // (kein voller Reset wie bei der Trendumkehr über currRange.low, siehe
  // marketStructureAnalysisTrendInvalidation.test.js).
  it("protected-low MIT echtem Close drunter -> wird 'break-of-structure', nicht nur 'low'", () => {
    const protectedLow = { type: "protected-low", price: 1.3, pivotAt: "pb", pivotTime: 2000, touched: { price: 1.3, touchedAt: "y" } };
    const state = { ...initMarketStructureState(origin.low, origin.high), trend: "uptrend", structurePivots: [protectedLow] };

    const s = applyInnerMarketStructurePivot(state, triggerPivot, { candles }); // candles: echter Close unter 1.3 bei t=2200

    const pb = s.structurePivots.find((p) => p.pivotAt === "pb");
    expect(pb.type).toBe("break-of-structure");
    expect(s.trend).toBe("uptrend"); // unverändert — nur ein Warnsignal, kein Trendwechsel
  });

  it("protected-low NUR touched (kein Close drunter) -> wird weiterhin 'LQ-sweep', nicht 'break-of-structure'", () => {
    const protectedLow = { type: "protected-low", price: 1.2, pivotAt: "pb", pivotTime: 1000, touched: { price: 1.2, touchedAt: "x" } };
    const state = { ...initMarketStructureState(origin.low, origin.high), trend: "uptrend", structurePivots: [protectedLow] };

    const s = applyInnerMarketStructurePivot(state, triggerPivot, { candles }); // candles: nie ein Close unter 1.2

    expect(s.structurePivots.find((p) => p.pivotAt === "pb").type).toBe("LQ-sweep");
  });

  it("einmal 'break-of-structure' bleibt dauerhaft — wird bei weiteren Pivots nicht mehr zurückbewertet", () => {
    const protectedLow = { type: "protected-low", price: 1.3, pivotAt: "pb", pivotTime: 2000, touched: { price: 1.3, touchedAt: "y" } };
    let state = { ...initMarketStructureState(origin.low, origin.high), trend: "uptrend", structurePivots: [protectedLow] };
    state = applyInnerMarketStructurePivot(state, triggerPivot, { candles });
    expect(state.structurePivots.find((p) => p.pivotAt === "pb").type).toBe("break-of-structure");

    // Preis bewusst INNERHALB der Range (nicht unter origin.low=1.0, sonst triggert das die
    // Trend-Invalidierung von applyInnerMarketStructurePivot statt nur einen weiteren Pullback).
    const evenLater = { type: "low", price: 2.0, pivotAt: "even-later", pivotTime: 9999, touched: false };
    state = applyInnerMarketStructurePivot(state, evenLater, { candles: [] }); // keine Kerzen -> würde 'protected-low'/'low' sonst evtl. umbewerten
    expect(state.structurePivots.find((p) => p.pivotAt === "pb").type).toBe("break-of-structure"); // unverändert
  });

  // Chat 2026-07-24, Bug-Report Philip: "allerspätestens mit Bildung des folgenden P5-Fraktals
  // sollte ein BOS stehen" — applyMarketStructurePivot (Periode 5) rief markLqSweeps bis hierhin
  // NIE auf, nur applyInnerMarketStructurePivot (Periode 2). Ein reiner Periode-5-Pivot konnte
  // LQ-sweep/break-of-structure also nie auslösen, egal wie viele davon noch kamen.
  describe("markLqSweeps läuft jetzt auch über applyMarketStructurePivot (Periode 5), nicht nur über die Periode-2-Seite", () => {
    it("ein reiner Periode-5-Pivot mit echtem Kerzenschluss reklassifiziert ein protected-low zu 'break-of-structure'", () => {
      const protectedLow = { type: "protected-low", price: 1.3, pivotAt: "pb", pivotTime: 2000, touched: { price: 1.3, touchedAt: "y" } };
      const state = { ...initMarketStructureState(origin.low, origin.high), trend: "uptrend", structurePivots: [protectedLow] };

      // triggerPivot bricht hier sogar noch currRange.low selbst (0.9 < origin.low=1.0) — spielt
      // für den Test keine Rolle, markLqSweeps läuft in JEDEM der drei Zweige von
      // applyMarketStructurePivot, nicht nur beim reinen Pullback-Fall.
      const s = applyMarketStructurePivot(state, triggerPivot, { candles });

      expect(s.structurePivots.find((p) => p.pivotAt === "pb").type).toBe("break-of-structure");
    });

    it("ohne candles-Argument (Default []) bleibt der bisherige, konservative 'kein Sweep'-Default erhalten", () => {
      const untouchedLow = { type: "low", price: 1.03, pivotAt: "untouched", pivotTime: 1500, touched: false };
      const state = { ...initMarketStructureState(origin.low, origin.high), structurePivots: [untouchedLow] };

      const s = applyMarketStructurePivot(state, triggerPivot); // kein drittes Argument — darf nicht crashen, candles defaultet auf []

      expect(s.structurePivots.find((p) => p.pivotAt === "untouched").type).toBe("low"); // nie touched -> wird gar nicht erst geprüft
    });
  });
});
