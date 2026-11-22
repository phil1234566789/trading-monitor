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

// Kerzen zu Buckets fester Länge (z.B. M5 -> H1) zusammenfassen; Bucket-Start = floor(time / seconds).
// Markierte Kerzen (markIgnoredCandles): der Bucket ist ignored, wenn alle seine Kerzen es sind (OB-Erkennung auf M15/H1).
export function aggregateCandles(candles, seconds) {
  const out = [];
  for (const c of candles) {
    const time = Math.floor(c.time / seconds) * seconds, last = out[out.length - 1];
    if (last?.time === time) {
      last.high = Math.max(last.high, c.high);
      last.low = Math.min(last.low, c.low);
      last.close = c.close;
      if ('ignored' in last) last.ignored &&= !!c.ignored;
    } else out.push({ time, open: c.open, high: c.high, low: c.low, close: c.close, ...('ignored' in c ? { ignored: !!c.ignored } : {}) });
  }
  return out;
}

// H1-ATR(period) der letzten zum Zeitpunkt t abgeschlossenen Stunde, aus feineren Kerzen gebaut. Nur bereits
// geschlossene Stunden, damit der Wert am LS nicht von Kerzen danach abhängt.
export function closedHourAtrResolver(candles, period = 14) {
  const h1 = aggregateCandles(candles, 3600), atr = wilderAtrValues(h1, period);
  return (t) => {
    let lo = 0, hi = h1.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (h1[m].time <= t - 3600) lo = m + 1; else hi = m; }
    return lo > 0 ? atr[lo - 1] : null;
  };
}

// Kerzen mit from <= time < to aus einer nach Zeit sortierten Reihe (binäre Suche; Fenster je Trade über eine Jahreshistorie).
export function candlesInWindow(candles, from, to) {
  const at = t => { let lo = 0, hi = candles.length; while (lo < hi) { const m = (lo + hi) >> 1; if (candles[m].time < t) lo = m + 1; else hi = m; } return lo; };
  return candles.slice(at(from), at(to));
}
