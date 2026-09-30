import { SessionBandPrimitive } from "./sessions.js";

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
