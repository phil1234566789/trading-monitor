import { detectLiquidityLevels } from './liquidityDetection.js';
import { detectTradeSetups, deriveSetupEntryInvalidation } from './tradeSetup.js';
import { tradeSetupParameters } from './tradeSetupParameters.js';
import { TRADE_SETUP_M5_FRACTAL_PERIOD } from './priceChartConstants.js';
import { orderBlockRecognitionTimes, orderBlockFollowsSweep } from './orderBlockRecognitionTime.js';

export function sameChecklistSweep(a, b) {
  return a.timeframe === b.timeframe && ['dir', 'pivotTime', 'price', 'touchedTime'].every(key => a.level[key] === b.level[key]);
}

// Nur aus geschlossenen Präfixen erkannte Verbindungen; keine persistierten heutigen Setups.
// Frühere OB-Bestätigungen bleiben auffindbar, wenn das alte Suchfenster inzwischen weiterlief.
export function detectChecklistReactions({ candles, levels, obs, instrument, evaluatedAt, reactionCache }) {
  const confirmations = orderBlockRecognitionTimes(candles, '5m');
  const moments = new Set([evaluatedAt]);
  for (const level of levels) if (Number.isFinite(level.recognizedAt)) moments.add(level.recognizedAt);
  for (const ob of obs) {
    if (levels.some(l => l.dir === -ob.dir && orderBlockFollowsSweep(ob, l, confirmations.get(ob.startTime)))) moments.add(confirmations.get(ob.startTime));
  }
  const matches = new Map();
  for (const at of [...moments].filter(t => Number.isFinite(t) && t <= evaluatedAt).sort((a, b) => a - b)) {
    const knownLevels = levels.filter(l => l.touchedTime + 300 <= at && (l.recognizedAt == null || l.recognizedAt <= at));
    if (!knownLevels.length) continue;
    const cacheKey = reactionCache && JSON.stringify([instrument, candles[0]?.time, at, knownLevels]);
    const cached = reactionCache?.get(cacheKey);
    if (cached) {
      for (const [key, value] of cached) if (!matches.has(key)) matches.set(key, value);
      continue;
    }
    const atMatches = new Map();
    const prefix = candles.filter(c => c.time + 300 <= at);
    if (!prefix.length) continue;
    const { highs, lows } = detectLiquidityLevels(prefix, TRADE_SETUP_M5_FRACTAL_PERIOD);
    const knownObs = obs.filter(ob => confirmations.get(ob.startTime) <= at);
    for (const dir of [1, -1]) {
      const h1 = levels.filter(l => l.dir === dir && l.touchedTime + 300 <= at && (l.recognizedAt == null || l.recognizedAt <= at));
      // Der Aufrufer übernimmt ausschließlich H1-Sweeps; ohne H1-Eingabe kann
      // diese Richtung kein Ergebnis liefern, unabhängig von ihren M5-Setups.
      if (!h1.length) continue;
      const m5 = dir === 1 ? highs : lows;
      const setups = detectTradeSetups(dir, m5, h1, m5, knownObs,
        tradeSetupParameters(instrument, prefix.at(-1).time), prefix.filter(c => !c.ignored));
      for (const setup of setups) {
        for (const sweep of setup.sweeps) {
          if (sweep.timeframe !== '1H') continue;
          if (!orderBlockFollowsSweep({ startTime: setup.obStartTime }, sweep.level, confirmations.get(setup.obStartTime))) continue;
          const key = [dir, sweep.level.pivotTime, sweep.level.price, sweep.level.touchedTime].join(':');
          if (atMatches.has(key)) continue;
          const { setupEntry, invalidation } = deriveSetupEntryInvalidation(setup);
          atMatches.set(key, { sweep, recognizedAt: at, entryPrice: setupEntry,
            invalidation: { price: invalidation, knownAt: at },
            ob: { dir: -dir, top: setup.obTop, bottom: setup.obBottom, startTime: setup.obStartTime, fvg: setup.obFvg } });
        }
      }
    }
    for (const [key, value] of atMatches) if (!matches.has(key)) matches.set(key, value);
    // Nur ein Scanner über unveränderte Archivkerzen darf den Cache weiterreichen.
    // Begrenzung verhindert, dass ein Jahreslauf alle historischen Zwischenstände hält.
    if (reactionCache) {
      if (reactionCache.size >= 1024) reactionCache.delete(reactionCache.keys().next().value);
      reactionCache.set(cacheKey, atMatches);
    }
  }
  return [...matches.values()];
}
