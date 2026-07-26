// Chat 2026-07-25 (gbp_h1_uptrend_uptrend_break_of_structure_und_trendumkehr.ts): der reale
// Live-Fall zeigt, dass sich ein Downtrend schon lange VOR der eigentlichen Invalidierung
// ankündigt — die Outer-Pivots 1.35583 (H) -> 1.35206 (L) -> 1.35429 (LH) -> 1.34601 (LL) bilden
// bereits eine bestätigte bärische Struktur (Change of Character), obwohl currRange.low des
// Haupttrends formal erst später real bricht. Diese Datei testet den parallel mitlaufenden
// Nested-Trend-Tracker (advanceNestedTrend, nicht exportiert — daher indirekt über
// applyMarketStructurePivot/buildMarketStructureState getestet, wie auch tryConfirmUptrend/
// markLqSweeps schon vorher nur indirekt getestet wurden) und die Promotion bei echter
// Invalidierung (applyInnerMarketStructurePivot).
import { describe, expect, it } from "vitest";
import { initMarketStructureState, applyMarketStructurePivot, applyInnerMarketStructurePivot } from "../src/marketStructureAnalysis";

const originLow = { type: "low", price: 1.0, pivotAt: "lo", pivotTime: 0, touched: false };
const originHigh = { type: "high", price: 1.1, pivotAt: "hi", pivotTime: 10, touched: false };
const pullback = { type: "low", price: 1.03, pivotAt: "pb", pivotTime: 20, touched: false };
// Bricht originHigh und bestätigt den Uptrend (protected-low = pullback) — analog zum Origin-High
// aus dem Live-Fall (pivot7, 1.35583), das später zugleich der Nested-Origin-High wird.
const confirmBreak = { type: "high", price: 1.2, pivotAt: "confirm", pivotTime: 40, touched: false };

function confirmedUptrendState() {
  let state = initMarketStructureState(originLow, originHigh);
  state = applyMarketStructurePivot(state, pullback);
  state = applyMarketStructurePivot(state, confirmBreak);
  expect(state.trend).toBe("uptrend");
  expect(state.nestedTrend).toBeNull();
  expect(state.closedRanges).toEqual([]);
  return state;
}

describe("marketStructureAnalysis: Nested-Trend/CHoCH-Erkennung (advanceNestedTrend, direction='down')", () => {
  it("baut sich Schritt für Schritt auf: H -> L (Seed) -> LH (Pullback), noch NICHT bestätigt", () => {
    let state = confirmedUptrendState();
    // pivotB: analog pivot8 (1.35206) — erster Pullback-Low nach confirmBreak, seedet den Nested-Tracker.
    const pivotB = { type: "low", price: 1.05, pivotAt: "pivotB", pivotTime: 50, touched: false };
    state = applyMarketStructurePivot(state, pivotB);
    expect(state.nestedTrend).not.toBeNull();
    expect(state.nestedTrend.trend).toBe("unknown");
    expect(state.nestedTrend.currRange).toEqual({ high: { ...confirmBreak, type: "high" }, low: { ...pivotB, type: "low" } });

    // pivotC: analog pivot9 (1.35429) — Lower High, bricht confirmBreak (1.2) NICHT -> bleibt Pullback.
    const pivotC = { type: "high", price: 1.15, pivotAt: "pivotC", pivotTime: 60, touched: false };
    state = applyMarketStructurePivot(state, pivotC);
    expect(state.nestedTrend.trend).toBe("unknown"); // noch kein CHoCH
    expect(state.nestedTrend.structurePivots).toEqual([pivotC]);
  });

  it("CHoCH-Bestätigung: Bruch von pivotB löst tryConfirmTrend(direction='down') aus, pivotC wird protected-high", () => {
    let state = confirmedUptrendState();
    const pivotB = { type: "low", price: 1.05, pivotAt: "pivotB", pivotTime: 50, touched: false };
    const pivotC = { type: "high", price: 1.15, pivotAt: "pivotC", pivotTime: 60, touched: false };
    state = applyMarketStructurePivot(state, pivotB);
    state = applyMarketStructurePivot(state, pivotC);

    // pivotD: analog pivot10 (1.34601) — bricht pivotB (1.05) nach unten, bestätigt den Gegentrend.
    const pivotD = { type: "low", price: 1.02, pivotAt: "pivotD", pivotTime: 70, touched: false };
    state = applyMarketStructurePivot(state, pivotD);

    expect(state.nestedTrend.trend).toBe("downtrend");
    expect(state.nestedTrend.currRange.high).toEqual({ ...confirmBreak, type: "high" });
    expect(state.nestedTrend.currRange.low).toEqual({ ...pivotD, type: "low" });
    expect(state.nestedTrend.structurePivots).toEqual([{ ...pivotC, type: "protected-high" }]);
    // Der Haupttrend selbst bleibt davon unberührt — CHoCH ist nur ein Vorlauf-Signal.
    expect(state.trend).toBe("uptrend");
    // Anker fürs CHoCH-Label (Rendering) ist die URSPRÜNGLICHE Nested-Origin-Low (pivotB), NICHT
    // der brechende Pivot (pivotD) — Bug-Report Philip 2026-07-25: "IST 1.34601, SOLL 1.35206".
    expect(state.nestedTrend.appliedPivots[1]).toEqual({ ...pivotB, type: "low" });
    // firstConfirmedAt ist der Anker fürs Linien-ENDE der CHoCH-Darstellung, eingefroren auf den
    // Bestätigungsmoment selbst (pivotD) — siehe nächster Test für den eigentlichen Bug.
    expect(state.nestedTrend.firstConfirmedAt).toEqual({ ...pivotD, type: "low" });
  });

  it("firstConfirmedAt bleibt eingefroren, auch wenn der noch nicht promotete Nested-Trend über pivotD hinaus weiterwandert", () => {
    let state = confirmedUptrendState();
    const pivotB = { type: "low", price: 1.05, pivotAt: "pivotB", pivotTime: 50, touched: false };
    const pivotC = { type: "high", price: 1.15, pivotAt: "pivotC", pivotTime: 60, touched: false };
    const pivotD = { type: "low", price: 1.02, pivotAt: "pivotD", pivotTime: 70, touched: false };
    state = applyMarketStructurePivot(state, pivotB);
    state = applyMarketStructurePivot(state, pivotC);
    state = applyMarketStructurePivot(state, pivotD);
    expect(state.nestedTrend.trend).toBe("downtrend");

    // Ein weiterer Pullback + ein NEUER, tieferer Bruch (analog: der Gegentrend läuft weiter,
    // solange die eigentliche Uptrend-Invalidierung noch nicht real passiert ist) — currRange.low
    // rückt vor, firstConfirmedAt darf sich NICHT mitverschieben (Bug-Report Philip 2026-07-25:
    // "CHOCH Linie geht noch zu weit" — die Linie wuchs vorher mit currRange.low mit). Bewusst
    // ÜBER dem Haupttrend-Ursprung (1.0, originLow) — sonst würde pivotF seit Chat 2026-07-25
    // ("Punkt 2": Outer-Pivot-Invalidierung) selbst schon den Haupttrend invalidieren/promoten,
    // was hier NICHT getestet werden soll (siehe eigene Promotion-Tests weiter unten).
    const pivotE = { type: "high", price: 1.08, pivotAt: "pivotE", pivotTime: 80, touched: false };
    const pivotF = { type: "low", price: 1.01, pivotAt: "pivotF", pivotTime: 90, touched: false };
    state = applyMarketStructurePivot(state, pivotE);
    state = applyMarketStructurePivot(state, pivotF);

    expect(state.nestedTrend.currRange.low).toEqual({ ...pivotF, type: "low" }); // weitergerückt
    expect(state.nestedTrend.firstConfirmedAt).toEqual({ ...pivotD, type: "low" }); // unverändert
  });

  it("ein bereits bestätigter Nested-Trend wird verworfen, sobald der Haupttrend danach noch ein ECHTES neues Hoch bricht", () => {
    let state = confirmedUptrendState();
    const pivotB = { type: "low", price: 1.05, pivotAt: "pivotB", pivotTime: 50, touched: false };
    const pivotC = { type: "high", price: 1.15, pivotAt: "pivotC", pivotTime: 60, touched: false };
    const pivotD = { type: "low", price: 1.02, pivotAt: "pivotD", pivotTime: 70, touched: false };
    state = applyMarketStructurePivot(state, pivotB);
    state = applyMarketStructurePivot(state, pivotC);
    state = applyMarketStructurePivot(state, pivotD);
    expect(state.nestedTrend.trend).toBe("downtrend"); // CHoCH bestätigt

    // Widerspricht der Lower-High-Prämisse des CHoCH: der Haupttrend bricht NACH der Bestätigung
    // noch ein neues, höheres Hoch (analog zu einer Fortsetzung des Uptrends statt der erwarteten
    // Umkehr) — Bug-Report Philip 2026-07-25: "Choch Linie immernoch zu weit", weil ein längst
    // überholter, bereits bestätigter Nested-Tracker vorher NIE wieder verworfen wurde.
    const newHigh = { type: "high", price: 1.3, pivotAt: "newHigh", pivotTime: 80, touched: false };
    state = applyMarketStructurePivot(state, newHigh);

    expect(state.currRange.high).toEqual({ ...newHigh, type: "high" });
    expect(state.nestedTrend).toBeNull(); // der überholte CHoCH ist weg, wartet auf einen neuen Pullback-Low
  });

  it("Reseed: eine weitere reguläre HH VOR der CHoCH-Bestätigung verwirft den bisherigen Nested-Tracker", () => {
    let state = confirmedUptrendState();
    const pivotB = { type: "low", price: 1.05, pivotAt: "pivotB", pivotTime: 50, touched: false };
    const pivotC = { type: "high", price: 1.15, pivotAt: "pivotC", pivotTime: 60, touched: false };
    state = applyMarketStructurePivot(state, pivotB);
    state = applyMarketStructurePivot(state, pivotC);
    expect(state.nestedTrend.structurePivots).toEqual([pivotC]); // noch unbestätigter Zwischenstand

    // Neues, höheres High bricht confirmBreak (1.2) -> currRange.high rückt vor, der alte
    // Nested-Ursprung (confirmBreak) ist damit überholt.
    const newHigh = { type: "high", price: 1.3, pivotAt: "newHigh", pivotTime: 65, touched: false };
    state = applyMarketStructurePivot(state, newHigh);
    expect(state.currRange.high).toEqual({ ...newHigh, type: "high" });
    expect(state.nestedTrend).toBeNull(); // verworfen, wartet auf den nächsten Pullback-Low

    const pivotF = { type: "low", price: 1.25, pivotAt: "pivotF", pivotTime: 70, touched: false };
    state = applyMarketStructurePivot(state, pivotF);
    expect(state.nestedTrend).not.toBeNull();
    expect(state.nestedTrend.currRange).toEqual({ high: { ...newHigh, type: "high" }, low: { ...pivotF, type: "low" } });
  });
});

describe("marketStructureAnalysis: Promotion bei Invalidierung mit bereits bestätigtem Nested-Trend", () => {
  function chochConfirmedState() {
    let state = confirmedUptrendState();
    const pivotB = { type: "low", price: 1.05, pivotAt: "pivotB", pivotTime: 50, touched: false };
    const pivotC = { type: "high", price: 1.15, pivotAt: "pivotC", pivotTime: 60, touched: false };
    const pivotD = { type: "low", price: 1.02, pivotAt: "pivotD", pivotTime: 70, touched: false };
    state = applyMarketStructurePivot(state, pivotB);
    state = applyMarketStructurePivot(state, pivotC);
    state = applyMarketStructurePivot(state, pivotD);
    expect(state.nestedTrend.trend).toBe("downtrend");
    return state;
  }

  it("echte Invalidierung (Kerze schließt unter currRange.low) übernimmt den bestätigten Nested-Trend UND lässt den brechenden Pivot selbst noch gegen die übernommene Range zählen", () => {
    let state = chochConfirmedState();
    const nestedBeforePromotion = state.nestedTrend;
    const breakingPivot = { type: "low", price: 0.8, pivotAt: "break-low", pivotTime: 80, touched: false };
    // Kerze zwischen currRange.low (Zeit 0) und dem brechenden Pivot, schließt klar unter 1.0.
    const candles = [{ time: 75, open: 0.98, high: 0.99, low: 0.75, close: 0.85 }];

    state = applyInnerMarketStructurePivot(state, breakingPivot, { candles });

    expect(state.trend).toBe("downtrend"); // nicht 'unknown' -> Promotion statt vollem Reset
    // Der brechende Pivot (0.8) liegt AUCH unter dem übernommenen nested.currRange.low (1.02) —
    // zählt deshalb nicht nur als Promotion-Auslöser, sondern zieht die übernommene Range noch
    // einen Schritt weiter (Bug-Report Philip 2026-07-25: "haben ein innerpivot 1.33003 unter dem
    // range.low ... neues range.low sollte 1.33003 sein" — vorher wurde dieser Pivot NUR als
    // Auslöser der Promotion verwendet und sein eigener Wert danach verworfen).
    expect(state.currRange).toEqual({ high: nestedBeforePromotion.currRange.high, low: { ...breakingPivot, type: "low" } });
    expect(state.structurePivots).toEqual(nestedBeforePromotion.structurePivots);
    expect(state.appliedPivots).toEqual(nestedBeforePromotion.appliedPivots);
    expect(state.innerStructurePivots).toEqual([{ ...breakingPivot, type: "low" }]);
    expect(state.nestedTrend).toBeNull();
    // Alte Uptrend-Range archiviert für die Darstellung — ZigZag low->middle->high, middle ist der
    // zuletzt bestätigte protected-low DIESER (jetzt abgeschlossenen) Range (Chat 2026-07-25,
    // zweite Runde: "ich hätte gerne die ZickZack Linie ... noch im Chart drin").
    expect(state.closedRanges).toEqual([
      { low: { ...originLow, type: "low" }, middle: { ...pullback, type: "protected-low" }, high: { ...confirmBreak, type: "high" }, trend: "uptrend" },
    ]);
  });

  it("Promotion ohne weiteren Bruch: der auslösende Pivot bricht nested.currRange.low NUR preislich (kein Close drunter) -> Range bleibt beim übernommenen Nested-Stand", () => {
    let state = chochConfirmedState();
    const nestedBeforePromotion = state.nestedTrend;
    const breakingPivot = { type: "low", price: 0.8, pivotAt: "break-low", pivotTime: 80, touched: false };
    // Frühe Kerze (vor nested.currRange.low, Zeit 70) schließt real unter dem Haupttrend-Ursprung
    // (1.0) -> löst die Promotion aus. Die einzige Kerze NACH nested.currRange.low (Zeit 70) bleibt
    // aber über dessen Preis (1.02) -> kein echter Bruch von nested.currRange.low selbst.
    const candles = [
      { time: 5, open: 0.6, high: 0.6, low: 0.4, close: 0.5 },
      { time: 75, open: 1.04, high: 1.05, low: 1.0, close: 1.03 },
    ];

    state = applyInnerMarketStructurePivot(state, breakingPivot, { candles });

    expect(state.trend).toBe("downtrend");
    // Kein echter Bruch von nested.currRange.low -> nur 'sweeped-low', Preis/Zeit unverändert.
    expect(state.currRange).toEqual({
      high: nestedBeforePromotion.currRange.high,
      low: { ...nestedBeforePromotion.currRange.low, type: "sweeped-low" },
    });
    expect(state.innerStructurePivots).toEqual([{ ...breakingPivot, type: "low" }]);
  });

  it("Fallback bleibt erhalten: ohne bestätigten Nested-Trend weiterhin voller Reset auf 'unknown', nestedTrend/closedRanges bleiben leer", () => {
    let state = confirmedUptrendState(); // kein nestedTrend aufgebaut
    const breakingPivot = { type: "low", price: 0.9, pivotAt: "break-low", pivotTime: 50, touched: false };
    const candles = [{ time: 45, open: 0.98, high: 0.99, low: 0.85, close: 0.88 }];

    state = applyInnerMarketStructurePivot(state, breakingPivot, { candles });

    expect(state.trend).toBe("unknown");
    expect(state.nestedTrend).toBeNull();
    expect(state.closedRanges).toEqual([]);
  });
});

describe("marketStructureAnalysis: Periode-2-Verfeinerung des Nested-Trackers (applyInnerMarketStructurePivot, direction='down')", () => {
  const pivotB = { type: "low", price: 1.05, pivotAt: "pivotB", pivotTime: 50, touched: false };
  const pivotC = { type: "high", price: 1.15, pivotAt: "pivotC", pivotTime: 60, touched: false };
  const pivotD = { type: "low", price: 1.02, pivotAt: "pivotD", pivotTime: 70, touched: false };

  function chochConfirmedState() {
    let state = confirmedUptrendState();
    state = applyMarketStructurePivot(state, pivotB);
    state = applyMarketStructurePivot(state, pivotC);
    state = applyMarketStructurePivot(state, pivotD);
    expect(state.nestedTrend.trend).toBe("downtrend");
    return state;
  }

  it("ein Periode-2-Pivot lässt currRange.low des bereits bestätigten Nested-Trends weiter nachrücken (Bug-Report Philip: 'range.low vom nestedTrend sollte schon tiefer sein, ein innerPivot hat sich bereits gebildet')", () => {
    let state = chochConfirmedState();
    // Bricht nestedTrend.currRange.low (1.02), aber NICHT den Haupttrend (dessen currRange.low
    // bleibt bei 1.0) — reiner Periode-2-Pivot, kein Outer-Pivot.
    const innerLow = { type: "low", price: 1.01, pivotAt: "innerLow", pivotTime: 75, touched: false };
    state = applyInnerMarketStructurePivot(state, innerLow, { candles: [] });

    expect(state.nestedTrend.currRange.low).toEqual({ ...innerLow, type: "low" });
    expect(state.nestedTrend.trend).toBe("downtrend"); // bleibt bestätigt, nur weitergerückt
    expect(state.trend).toBe("uptrend"); // Haupttrend unberührt
    expect(state.currRange.low).toEqual({ ...originLow, type: "low" });
  });

  it("ein Periode-2-Pivot invalidiert einen bereits bestätigten Nested-Trend, wenn er dessen Origin-High mit echtem Kerzenschluss bricht", () => {
    let state = chochConfirmedState();
    const innerHigh = { type: "high", price: 1.25, pivotAt: "innerHigh", pivotTime: 75, touched: false };
    state = applyInnerMarketStructurePivot(state, innerHigh, { candles: [] });

    expect(state.trend).toBe("uptrend"); // Haupttrend bestätigt unabhängig weiter
    expect(state.nestedTrend).not.toBeNull();
    // CHoCH widerlegt (Preis macht ein neues Hoch über dem alten Nested-Origin) -> frischer Start,
    // KEINE Promotion (ein Nested-Tracker hat selbst keine tiefere Verschachtelung).
    expect(state.nestedTrend.trend).toBe("unknown");
    // Bug-Report Philip 2026-07-25 (Ursprung-Bug): der alte pivotD wäre chronologisch VOR
    // innerHigh, was die bärische "High VOR Low"-Eligibility für immer sperren würde (siehe
    // Kommentar in applyInnerMarketStructurePivotCore) — stattdessen dient der auslösende Pivot
    // selbst (als "low" umetikettiert) als selbstkorrigierender Platzhalter.
    expect(state.nestedTrend.currRange).toEqual({
      high: { ...innerHigh, type: "high" },
      low: { ...innerHigh, type: "low" },
    });
  });

  it("ein einzelner Periode-2-Pivot repariert den NOCH NICHT eligible Platzhalter (reine Zeit-Reparatur, kein 'Strukturpunkt 3'), aber sobald eligible, bewegt ein WEITERER Periode-2-Pivot die Grenze nicht mehr — nur Outer, und ein Bruch danach kann wieder bestätigen (Regressionstest für den Ursprung-Bug UND für den GBPUSD-Fixture-Bug, siehe marketStructureAnalysisRealPipeline.test.js)", () => {
    let state = chochConfirmedState();
    const innerHigh = { type: "high", price: 1.25, pivotAt: "innerHigh", pivotTime: 75, touched: false };
    state = applyInnerMarketStructurePivot(state, innerHigh, { candles: [] });
    expect(state.nestedTrend.trend).toBe("unknown");
    // Degenerierter Platzhalter (high===low, gleicher Zeitpunkt) -> NICHT eligible.
    expect(state.nestedTrend.currRange.low.pivotTime).toBe(state.nestedTrend.currRange.high.pivotTime);

    // Der Platzhalter ist noch NICHT eligible -> ein Periode-2-Pivot DARF ihn reparieren (reine
    // Zeit-Korrektur, kein Strukturpunkt-3-Aufbau, siehe isOriginEligible).
    const innerPullback = { type: "low", price: 1.2, pivotAt: "innerPullback", pivotTime: 80, touched: false };
    state = applyInnerMarketStructurePivot(state, innerPullback, { candles: [] });
    expect(state.nestedTrend.trend).toBe("unknown");
    expect(state.nestedTrend.currRange.low).toEqual({ ...innerPullback, type: "low" }); // repariert

    // Jetzt ist der Ursprung eligible (lowTime 80 > highTime 75) -> ein WEITERER Periode-2-Pivot
    // bewegt die Grenze nicht mehr (das wäre jetzt echter "Strukturpunkt 3"-Aufbau).
    const innerPullback2 = { type: "low", price: 1.15, pivotAt: "innerPullback2", pivotTime: 83, touched: false };
    state = applyInnerMarketStructurePivot(state, innerPullback2, { candles: [] });
    expect(state.nestedTrend.currRange.low).toEqual({ ...innerPullback, type: "low" }); // unverändert

    // Ein Outer-Pivot repariert/bewegt die Grenze weiterhin uneingeschränkt.
    const outerPullback = { type: "low", price: 1.15, pivotAt: "outerPullback", pivotTime: 84, touched: false };
    state = applyMarketStructurePivot(state, outerPullback, { candles: [] });
    expect(state.nestedTrend.currRange.low).toEqual({ ...outerPullback, type: "low" });
    expect(state.nestedTrend.trend).toBe("unknown"); // noch nicht bestätigt, nur bewegt

    // Ein weiterer Pullback-High (bricht das Nested-Origin-High 1.25 NICHT) liefert den
    // qualifizierenden Kandidaten für 'protected-high' bei der nächsten Bestätigung — MUSS seit
    // Chat 2026-07-26 ein Outer-Pivot sein, damit er in nested.structurePivots landet (nicht nur
    // innerStructurePivots) und als Kandidat zählt (siehe tryConfirmTrend).
    const pullbackHigh = { type: "high", price: 1.22, pivotAt: "pullbackHigh", pivotTime: 85, touched: false };
    state = applyMarketStructurePivot(state, pullbackHigh, { candles: [] });

    // Jetzt bricht ein echter Kerzenschluss unter outerPullback -> sollte wieder bestätigen können
    // (der bestätigende Bruch selbst darf weiterhin Periode-2 sein).
    const breakLow = { type: "low", price: 1.1, pivotAt: "breakLow", pivotTime: 90, touched: false };
    const candles = [{ time: 87, open: 1.15, high: 1.16, low: 1.09, close: 1.1 }];
    state = applyInnerMarketStructurePivot(state, breakLow, { candles });
    expect(state.nestedTrend.trend).toBe("downtrend");
  });

  it("ohne bereits existierenden Nested-Trend passiert nichts (kein Reseed über Periode-2-Pivots)", () => {
    let state = confirmedUptrendState(); // kein nestedTrend aufgebaut
    const innerLow = { type: "low", price: 1.05, pivotAt: "innerLow", pivotTime: 30, touched: false };
    state = applyInnerMarketStructurePivot(state, innerLow, { candles: [] });
    expect(state.nestedTrend).toBeNull();
  });
});

describe("marketStructureAnalysis: Outer-Pivot-Invalidierung (Chat 2026-07-25, Punkt 2: 'Outer-Pivot-Low-Bruch ohne Kerzen-Check ... muss jetzt gemacht werden', applyMarketStructurePivot direction='up')", () => {
  const pivotB = { type: "low", price: 1.05, pivotAt: "pivotB", pivotTime: 50, touched: false };
  const pivotC = { type: "high", price: 1.15, pivotAt: "pivotC", pivotTime: 60, touched: false };
  const pivotD = { type: "low", price: 1.02, pivotAt: "pivotD", pivotTime: 70, touched: false };

  function chochConfirmedState() {
    let state = confirmedUptrendState();
    state = applyMarketStructurePivot(state, pivotB);
    state = applyMarketStructurePivot(state, pivotC);
    state = applyMarketStructurePivot(state, pivotD);
    expect(state.nestedTrend.trend).toBe("downtrend");
    return state;
  }

  it("Outer-Pivot bricht currRange.low NUR preislich (kein Close drunter) -> nur 'sweeped-low', Uptrend bleibt bestehen (vorher wurde IMMER hart ersetzt, ohne Kerzen-Check)", () => {
    let state = confirmedUptrendState();
    const sweepPivot = { type: "low", price: 0.9, pivotAt: "sweep-low", pivotTime: 50, touched: false };
    // Docht unter 1.0, Close bleibt drüber -> kein echter Bruch.
    const candles = [{ time: 45, open: 1.02, high: 1.03, low: 0.95, close: 1.01 }];

    state = applyMarketStructurePivot(state, sweepPivot, { candles });

    expect(state.trend).toBe("uptrend"); // unverändert
    expect(state.currRange.low).toEqual({ ...originLow, type: "sweeped-low" }); // Preis/Zeit unverändert, nur Typ
    expect(state.currRange.high.pivotAt).toBe("confirm");
  });

  it("Outer-Pivot bricht currRange.low mit echtem Kerzenschluss, kein bestätigter Nested-Trend -> voller Reset auf 'unknown' (genau wie beim Inner-Pivot-Pfad)", () => {
    let state = confirmedUptrendState();
    const breakingPivot = { type: "low", price: 0.9, pivotAt: "break-low", pivotTime: 50, touched: false };
    const candles = [{ time: 45, open: 0.98, high: 0.99, low: 0.85, close: 0.88 }];

    state = applyMarketStructurePivot(state, breakingPivot, { candles });

    expect(state.trend).toBe("unknown");
    expect(state.currRange.high).toEqual({ ...confirmBreak, type: "high" }); // alter High weiterverwendet
    expect(state.currRange.low).toEqual({ ...breakingPivot, type: "low" });
    expect(state.structurePivots).toEqual([]);
  });

  it("Outer-Pivot bricht currRange.low mit echtem Kerzenschluss, bereits bestätigter Nested-Trend -> Promotion genau wie beim Inner-Pivot-Pfad (inkl. Re-Check des brechenden Pivots gegen die übernommene Range)", () => {
    let state = chochConfirmedState();
    const breakingPivot = { type: "low", price: 0.8, pivotAt: "break-low", pivotTime: 80, touched: false };
    const candles = [{ time: 75, open: 0.98, high: 0.99, low: 0.75, close: 0.85 }];

    state = applyMarketStructurePivot(state, breakingPivot, { candles });

    expect(state.trend).toBe("downtrend");
    // Der brechende Pivot (0.8) liegt auch unter nested.currRange.low (1.02) -> wird selbst noch
    // zum neuen currRange.low, nicht nur Promotion-Auslöser (siehe invalidateUptrend).
    expect(state.currRange).toEqual({ high: { ...confirmBreak, type: "high" }, low: { ...breakingPivot, type: "low" } });
    expect(state.nestedTrend).toBeNull();
    expect(state.closedRanges).toEqual([
      { low: { ...originLow, type: "low" }, middle: { ...pullback, type: "protected-low" }, high: { ...confirmBreak, type: "high" }, trend: "uptrend" },
    ]);
  });
});
