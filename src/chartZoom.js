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

// Eigener (höherer) Schwellwert für Timeframes unter 1h (Bug-Report Philip 2026-07-30: "1h TF ist
// schon gut, M5 ist noch etwas nervig" — die Pixel-pro-Stunde-Normalisierung oben gleicht zwar die
// reine Kerzendichte aus, aber auf M5 clustern Indikator-Events (OBs/Liquidität/Sessions/Trades)
// in derselben Wanduhrzeit-Spanne trotzdem dichter als auf 1h, die Labels drängeln sich also bei
// GLEICHEM Zoom-Wert schneller. Getrennt von MIN_PIXELS_PER_HOUR_FOR_LABELS (nicht einfach höher
// gesetzt), damit 1h wie bisher bei 8 bleibt und nur Intraday-TFs strenger gefiltert werden — bei
// Bedarf hier einfach anpassen.
export const MIN_PIXELS_PER_HOUR_FOR_LABELS_INTRADAY = 70;

// chart/candles sind optional (manche Primitives werden in Tests ohne echten Chart/ohne Kerzen
// konstruiert) — ohne beide konservativ IMMER anzeigen, statt fälschlich alles auszublenden.
// `lenientThreshold` (Bug-Report Philip 2026-08-26: "die Labels der HTF LQ-Levels werden im M5
// nicht angezeigt") — die INTRADAY-Schwelle wurde gegen Gedrängel bei den VIELEN M5-eigenen Events
// gebaut (s.o.), greift aber unabsichtlich auch für die wenigen 1H/4H-Level, die seit derselben
// Session (Punkt 0, "HTF-Level bekommen IMMER ein Label") absichtlich chart-timeframe-unabhängig
// sichtbar sein sollen — mit nur einer Handvoll HTF-Leveln besteht dort nicht dasselbe
// Gedrängel-Risiko wie bei M5-eigenen Events. true = immer die lockere Schwelle nutzen, unabhängig
// von barSeconds.
export function canShowLabels(chart, candles, lenientThreshold = false) {
  if (!chart) return true;
  const barSpacing = chart.timeScale().options().barSpacing;
  if (!candles || candles.length < 2) return true; // keine Kerzendauer ermittelbar -> nicht raten
  const barSeconds = candles[1].time - candles[0].time;
  if (!barSeconds) return true;
  const pixelsPerHour = barSpacing * (3600 / barSeconds);
  const threshold = !lenientThreshold && barSeconds < 3600 ? MIN_PIXELS_PER_HOUR_FOR_LABELS_INTRADAY : MIN_PIXELS_PER_HOUR_FOR_LABELS;
  return pixelsPerHour >= threshold;
}
