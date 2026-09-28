import { detectLiquidityLevels } from './liquidityDetection.js';
import { detectTradeSetups, deriveSetupEntryInvalidation } from './tradeSetup.js';
import { tradeSetupParameters } from './tradeSetupParameters.js';
import { TRADE_SETUP_M5_FRACTAL_PERIOD } from './priceChartConstants.js';
import { orderBlockRecognitionTimes } from './orderBlockRecognitionTime.js';

export function sameChecklistSweep(a, b) {
  return a.timeframe === b.timeframe && ['dir', 'pivotTime', 'price', 'touchedTime'].every(key => a.level[key] === b.level[key]);
}

// Nur aus geschlossenen Präfixen erkannte Verbindungen; keine persistierten heutigen Setups.
// Frühere OB-Bestätigungen bleiben auffindbar, wenn das alte Suchfenster inzwischen weiterlief.
export function detectChecklistReactions({ candles, levels, obs, instrument, evaluatedAt }) {
  const confirmations = orderBlockRecognitionTimes(candles, '5m');
  const moments = new Set([evaluatedAt]);
  for (const ob of obs) {
    if (levels.some(l => l.dir === -ob.dir && l.touchedTime <= ob.startTime)) moments.add(confirmations.get(ob.startTime));
  }
  const matches = new Map();
  for (const at of [...moments].filter(t => Number.isFinite(t) && t <= evaluatedAt).sort((a, b) => a - b)) {
    const prefix = candles.filter(c => c.time + 300 <= at);
    if (!prefix.length) continue;
    const { highs, lows } = detectLiquidityLevels(prefix, TRADE_SETUP_M5_FRACTAL_PERIOD);
    const knownObs = obs.filter(ob => confirmations.get(ob.startTime) <= at);
    for (const dir of [1, -1]) {
      const h1 = levels.filter(l => l.dir === dir && l.touchedTime + 300 <= at && (l.recognizedAt == null || l.recognizedAt <= at));
      const m5 = dir === 1 ? highs : lows;
      const setups = detectTradeSetups(dir, m5, h1, m5, knownObs,
        tradeSetupParameters(instrument, prefix.at(-1).time), prefix.filter(c => !c.ignored));
      for (const setup of setups) {
        for (const sweep of setup.sweeps) {
          if (sweep.timeframe !== '1H') continue;
          const key = [dir, sweep.level.pivotTime, sweep.level.price, sweep.level.touchedTime].join(':');
          if (matches.has(key)) continue;
          const { setupEntry, invalidation } = deriveSetupEntryInvalidation(setup);
          matches.set(key, { sweep, recognizedAt: at, entryPrice: setupEntry,
            invalidation: { price: invalidation, knownAt: at },
            ob: { dir: -dir, top: setup.obTop, bottom: setup.obBottom, startTime: setup.obStartTime, fvg: setup.obFvg } });
        }
      }
    }
  }
  return [...matches.values()];
}
