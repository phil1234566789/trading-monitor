// Die Kerzenzeit entscheidet, nicht die Uhrzeit des Cron-Laufs: FXCM-H4 folgt New York.
export function unprocessedTimeframes(candlesByTf, previous) {
  return new Map([...candlesByTf].filter(([tf, candles]) =>
    tf === 'M5' || candles.at(-1)?.time !== previous[tf]));
}
