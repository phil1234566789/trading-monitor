// Ab wie viel Pixel PRO STUNDE Chart-Zeit Text-Labels noch gezeichnet werden — Chat 2026-07-25:
// "wenn ich im 1h den chart etwas herauszoome (Kerzen werden dünner), dann verdecken mir die
// Labels die Sicht ... kann man die dynamisch ausblenden".
//
// BEWUSST NICHT einfach chart.timeScale().options().barSpacing (Pixel PRO ANGEZEIGTER KERZE)
// direkt verglichen (Bug-Report Philip: "dieser Schwellenwert unterscheidet sich von M5 und 1h") —
// bei GLEICHER Kerzenbreite hat M5 zwölfmal so viele Kerzen pro Stunde wie 1H, also zwölfmal so
// viel Platz für ein Label in derselben Zeitspanne. Normalisiert auf "Pixel pro Stunde" (über die
// tatsächliche Kerzendauer aus `candles`), damit EIN Schwellwert für alle Timeframes konsistent
// funktioniert, statt pro Timeframe einzeln nachjustiert werden zu müssen.
//
// EIN gemeinsamer Schwellwert für ALLE Indikator-Labels (Liquidität/Structure/Sessions/OBs/
// Trade-Marker) — Linien/Boxen/Zonen selbst bleiben davon unberührt, nur die TEXT-Labels
// verschwinden. Bewusst eine feste Konstante statt UI-Regler (Chat: "fester Wert im Code reicht")
// — bei Bedarf hier einfach anpassen.
export const MIN_PIXELS_PER_HOUR_FOR_LABELS = 8;

// chart/candles sind optional (manche Primitives werden in Tests ohne echten Chart/ohne Kerzen
// konstruiert) — ohne beide konservativ IMMER anzeigen, statt fälschlich alles auszublenden.
export function canShowLabels(chart, candles) {
  if (!chart) return true;
  const barSpacing = chart.timeScale().options().barSpacing;
  if (!candles || candles.length < 2) return true; // keine Kerzendauer ermittelbar -> nicht raten
  const barSeconds = candles[1].time - candles[0].time;
  if (!barSeconds) return true;
  const pixelsPerHour = barSpacing * (3600 / barSeconds);
  return pixelsPerHour >= MIN_PIXELS_PER_HOUR_FOR_LABELS;
}
