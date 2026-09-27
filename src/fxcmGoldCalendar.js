// Konservativer Wochenendkern: keine Feiertage oder veränderlichen Randzeiten unterstellen.
export function goldWeekendClosed(timeMs) {
  const date = new Date(timeMs);
  return date.getUTCDay() === 6 || (date.getUTCDay() === 0 && date.getUTCHours() < 20);
}

export function isGoldWeekendPlaceholder(symbol, candle) {
  const time = typeof candle.time === 'number' ? candle.time * 1000 : Date.parse(candle.time);
  return symbol === 'XAUUSD' && goldWeekendClosed(time)
    && candle.open === candle.high && candle.high === candle.low && candle.low === candle.close;
}
