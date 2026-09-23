// Färbt die Impuls-Kerzen der bestätigenden FVGs ein (Test Philip 2026-09-23). Die FVG ist das
// einzige Stück eines Trade-Setups, das im Chart bisher gar nicht markiert war — LS-Linie,
// Fraktal-Linie und OB-Box gibt es, die Lücke selbst nicht, obwohl der Telegram-Alarm ihre Größe
// seit 2026-09-23 nennt.
//
// Bewusst eine reine Funktion ohne Chart- und ohne chartColors-Bezug (die Farbe kommt als
// Parameter): lightweight-charts nimmt Farben pro Datenpunkt entgegen, die Einfärbung ist damit
// nichts weiter als eine Umformung der Kerzenliste — und ohne Browser testbar.

// setup.obStartTime ist der Zeitpunkt der MITTLEREN Impuls-Kerze (siehe detectSetupObs/
// orderBlocks.js), also genau der Kerze, die die Lücke aufreißt.
export function fvgCandleTimes(setups) {
  return new Set((setups ?? []).filter((s) => s?.obStartTime != null).map((s) => s.obStartTime));
}

// Nur auf dem M5-Chart: ein Setup ist immer M5-basiert, auf 1h/4h träfe obStartTime entweder gar
// keine Kerze oder — wenn der Stundenanfang zufällig auf denselben Unix-Wert fällt — die falsche.
export function tintFvgCandles(candles, setups, bar, farbe) {
  if (bar !== "5m" || !farbe) return candles;
  const zeiten = fvgCandleTimes(setups);
  if (zeiten.size === 0) return candles;
  return candles.map((c) => (zeiten.has(c.time) ? { ...c, color: farbe, wickColor: farbe } : c));
}
