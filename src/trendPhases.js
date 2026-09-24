// Trendphasen ("ab wann bis wann welcher Trend") für die M5-Hintergrundbänder (PLAN-m5-trend.md).
// buildMarketStructureState liefert nur den Endzustand — die Sequenz kommt über dessen onStep-
// Protokoll, damit die Merge-Schleife nicht ein zweites Mal nachgebaut wird.
import { buildMarketStructureState, collectNestedChain } from "./marketStructureAnalysis";
import { SessionBandPrimitive } from "./sessions.js";

// Phase = Trend der innersten bestätigten Ebene. pre=true, solange das nur ein Nested-Trend ist
// (CHoCH bestätigt, Haupttrend noch nicht gekippt) — Philip darf ab dem CHoCH schon traden, das
// Band zeigt das als Vorstufen-Farbe. Voll wird es erst bei der Promotion (Nested wird Haupttrend).
// Phasengrenze = Verarbeitungszeitpunkt des Pivots (pivotTime + period * barSeconds), NICHT
// pivotTime selbst — erst dann "weiß" der Algo vom Trendwechsel. Kein Glätten/keine Mindestbreite:
// kurze Phasen sind das echte Messergebnis, an dem Philip die Perioden beurteilt.
export function buildStructureWithPhases(pivotsOuter, pivotsInner, periodOuter, periodInner, candles, barSeconds) {
  const steps = [];
  const state = buildMarketStructureState(pivotsOuter, pivotsInner, periodOuter, periodInner, candles, {
    barSeconds,
    onStep: (at, s) => {
      const chain = collectNestedChain(s);
      steps.push({ at, trend: chain[chain.length - 1].trend, pre: chain.length > 1 });
    },
  });
  const endTime = candles.length > 0 ? candles[candles.length - 1].time : null;
  const phases = [];
  for (const { at, trend, pre } of steps) {
    const last = phases[phases.length - 1];
    if (last && last.trend === trend && last.pre === pre) continue;
    if (last) last.to = at;
    phases.push({ trend, pre, from: at, to: endTime ?? at });
  }
  // Ein Pivot kann erst nach der letzten geladenen Kerze "verarbeitet" sein (Lookahead im Replay).
  return { state, phases: phases.filter((p) => p.trend !== "unknown" && p.from < p.to) };
}

// Volle Panehöhe: SessionBandPrimitive ohne high/low fällt genau darauf zurück (zOrder "bottom").
// colors: { up, upPre, down, downPre } als fertige CSS-Farben.
export function renderTrendPhaseBands(series, phases, existingPrimitives, candles, colors) {
  for (const p of existingPrimitives) series.detachPrimitive(p);
  existingPrimitives.length = 0;
  for (const phase of phases) {
    const fill = colors[(phase.trend === "uptrend" ? "up" : "down") + (phase.pre ? "Pre" : "")];
    const primitive = new SessionBandPrimitive(phase.from, phase.to, { fill, label: null }, { candles });
    series.attachPrimitive(primitive);
    existingPrimitives.push(primitive);
  }
}
