// Bar-Laenge je Timeframe, aus forexCandles.ts herausgeloest, seit replayAsOf.ts dieselbe
// Umrechnung braucht (Kerzen-Oeffnung -> Kerzen-Schluss) und forexCandles.ts nicht importieren
// kann, ohne Supabase- und cTrader-Client mitzuziehen. Akzeptiert sowohl die API-Schreibweise
// ("5m"/"1h") als auch die DB-Spalte `timeframe` ("5M"/"1H"/"4H").
const BAR_SECONDS: Record<string, number> = { "1m": 60, "3m": 180, "5m": 300, "15m": 900, "1h": 3600, "4h": 14400, "1d": 86400 };

export function barSecondsFor(bar: string): number {
  return BAR_SECONDS[bar.toLowerCase()] ?? 60;
}
