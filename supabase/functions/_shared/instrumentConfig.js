// Tick/Anzeige und Strategieabstände sind getrennt: Gold-Schwellen stammen aus dem September-Test.
export function instrumentConfig(symbol) {
  return symbol === 'XAUUSD'
    ? { precision: 2, tick: 0.01, pip: 0.01, strategyScale: 15000,
        minFvg: { '5m': 0.75, '1H': 2.53, '4H': 6.19 } }
    : { precision: 5, tick: 0.00001, pip: 0.0001, strategyScale: 1, minFvg: {} };
}

export function strategyDistance(forexPriceDistance, symbol) {
  return forexPriceDistance * instrumentConfig(symbol).strategyScale;
}

export function obMinimum(symbol, timeframe) {
  return instrumentConfig(symbol).minFvg[timeframe] ?? null;
}
