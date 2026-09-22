const SECONDS = { '1m': 60, '3m': 180, '5m': 300, '15m': 900, '1h': 3600, '4h': 14400, '1D': 86400 };

export function validateCandles(body, now = Date.now()) {
  if (!Array.isArray(body?.candles) || body.candles.length < 1 || body.candles.length > 500) {
    throw new Error('Expected 1–500 candles');
  }
  return body.candles.map((row) => {
    const seconds = SECONDS[row?.bar];
    const time = Date.parse(row?.time);
    const { open, high, low, close, volume } = row;
    if (!['GBPUSD', 'EURUSD'].includes(row.instrument) || !seconds ||
        typeof row.time !== 'string' || !/(Z|[+]00:00)$/.test(row.time) ||
        !Number.isFinite(time) || time % 1000 !== 0 || time + seconds * 1000 > now ||
        ![open, high, low, close, volume].every((v) => typeof v === 'number' && Number.isFinite(v)) ||
        low <= 0 || volume < 0 || low > Math.min(open, close) || high < Math.max(open, close)) {
      throw new Error('Invalid or unfinished candle');
    }
    return { instrument: row.instrument, bar: row.bar, time: new Date(time).toISOString(),
      open, high, low, close, volume, source: 'fxcm' };
  });
}
