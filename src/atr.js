// ATR nach Wilder, einzige Quelle im Frontend (DOB-POI auf H1, Liquidität 2.0 auf dem Chart-Timeframe).
// values[i] = ATR nach Schluss von candles[i], null solange noch keine `period` True Ranges vorliegen.
export function wilderAtrValues(candles, period = 14) {
  const values = candles.map(() => null);
  for (let i = 1, value = null, sum = 0; i < candles.length; i++) {
    const c = candles[i], prev = candles[i - 1].close;
    const tr = Math.max(c.high - c.low, Math.abs(c.high - prev), Math.abs(c.low - prev));
    if (i <= period) {
      sum += tr;
      if (i === period) value = sum / period;
    } else value = (value * (period - 1) + tr) / period;
    values[i] = value;
  }
  return values;
}
