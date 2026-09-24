// Trendphasen ("ab wann bis wann welcher Trend") für die M5-Hintergrundbänder (PLAN-m5-trend.md).
// buildMarketStructureState liefert nur den Endzustand — die Sequenz kommt über dessen onStep-
// Protokoll, damit die Merge-Schleife nicht ein zweites Mal nachgebaut wird.
import { buildMarketStructureState, collectNestedChain } from "./marketStructureAnalysis";
import { SessionBandPrimitive } from "./sessions.js";
import { firstTouchAfter } from "./marketStructureRendering";

// Phase = Trend der innersten bestätigten Ebene. pre=true, solange das nur ein Nested-Trend ist
// (CHoCH bestätigt, Haupttrend noch nicht gekippt), voll erst bei der Promotion.
// Phasengrenze = Verarbeitungszeitpunkt des Pivots (pivotTime + period * barSeconds) — außer beim
// CHoCH: da beginnt das Band schon an der Kerze, die den CHoCH-Level berührt (Philip 24.09.2026).
// Das ist rückdatiert: live erscheint der Abschnitt erst, wenn der Algo den CHoCH bestätigt hat.
// events: je Phasenwechsel der auslösende Pivot + was erkannt wurde (Debug-Labels an den Pivots).
export function buildStructureWithPhases(pivotsOuter, pivotsInner, periodOuter, periodInner, candles, barSeconds) {
  const phases = [];
  const events = [];
  const endTime = candles.length > 0 ? candles[candles.length - 1].time : null;
  let prevDepth = 0;
  const state = buildMarketStructureState(pivotsOuter, pivotsInner, periodOuter, periodInner, candles, {
    barSeconds,
    onStep: (at, s, pivot) => {
      const chain = collectNestedChain(s);
      const inner = chain[chain.length - 1];
      const depth = chain.length - 1;
      const pre = depth > 0;
      const reason = depth > prevDepth ? "CHoCH" : depth < prevDepth ? "Trend gekippt" : "Trendwechsel";
      prevDepth = depth;
      const last = phases[phases.length - 1];
      if (last && last.trend === inner.trend && last.pre === pre) return;
      let from = at;
      let touchAt = null;
      if (reason === "CHoCH" && inner.appliedPivots[1]?.pivotTime != null) {
        touchAt = firstTouchAfter(candles, inner.appliedPivots[1], barSeconds, inner.trend === "downtrend");
        if (touchAt != null && touchAt < at) from = Math.max(touchAt, last ? last.from : touchAt);
      }
      if (last) last.to = from;
      phases.push({ trend: inner.trend, pre, from, to: endTime ?? at });
      if (inner.trend !== "unknown") events.push({ pivot, at, trend: inner.trend, pre, reason, touchAt, level: reason === "CHoCH" ? inner.appliedPivots[1].price : null });
    },
  });
  // Ein Pivot kann erst nach der letzten geladenen Kerze "verarbeitet" sein (Lookahead im Replay).
  return { state, events, phases: phases.filter((p) => p.trend !== "unknown" && p.from < p.to) };
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
