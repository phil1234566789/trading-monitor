// Exponential Moving Average — Standard-Trendfilter (siehe Chat: Teil von Philips "Trend über EMA
// + Anzahl protected highs/lows"-Idee, KISS statt der verworfenen verschachtelten Trend-State-
// Machine). Generisches Indikator-Modul, unabhängig vom Range-/Pivot-Domain-Code.

// Startet die EMA-Rekursion mit dem ersten Close statt einer SMA-Vorlaufphase — vereinfacht,
// braucht dafür etwas Vorlauf-Historie, bis sich der Wert eingependelt hat (Faustregel: mehrere
// Vielfache von `period`). Bei genug geladener Historie (siehe TREND_ANALYSIS_CANDLE_COUNT in
// PriceChart.vue) macht sich das im sichtbaren, aktuellen Bereich nicht mehr bemerkbar.
export function computeEma(candles, period) {
  if (candles.length === 0) return [];
  const k = 2 / (period + 1);
  let ema = candles[0].close;
  const result = [{ time: candles[0].time, value: ema }];
  for (let i = 1; i < candles.length; i++) {
    ema = candles[i].close * k + ema * (1 - k);
    result.push({ time: candles[i].time, value: ema });
  }
  return result;
}
