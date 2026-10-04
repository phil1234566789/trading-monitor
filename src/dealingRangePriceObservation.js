import { candleTimeIndex } from './candleTimeIndex.js';
import { candleTouchesPrice } from './structurePivotTime';
import { groupSetupSnapshots } from './tradeSetup2Review.js';

export const DR_PRICE_OBSERVATION_VERSION = 'validated-frozen-levels-m5-v1';

// Preisbeobachtung ist unabhängig von H und Execution-Ausgängen. Rohdaten reichen
// über das erste Endereignis hinaus, damit spätere SQL-Schwellen auswertbar bleiben.
export function observeDealingRangePrice({ candles, target1, target2 = null, invalidation,
  validatedAt, validationPrice, direction, windowEnd }) {
  const result = { version: DR_PRICE_OBSERVATION_VERSION, validatedAt, validationPrice, direction,
    target1, target2, invalidation, stage1: 'open', stage2: null, t1At: null, t2At: null,
    invalidationReturnAt: null, validationPriceReturnAt: null, extremePrice: null, extremeAt: null,
    endAt: windowEnd, endReason: 'windowEnd', rawThrough: null, processedCandles: 0, processedAfterT1: 0 };
  let next = Math.ceil(validatedAt / 300) * 300;
  const below = direction === 'short';
  const missing = () => {
    if (result.stage1 === 'open') result.stage1 = 'unknown';
    if (result.stage2 === 'open') result.stage2 = 'unknown';
    if (result.endReason === 'windowEnd') { result.endReason = 'missingHistory'; result.endAt = next; }
    result.rawEndReason = 'missingHistory';
    return result;
  };
  if (![validatedAt, target1, invalidation, windowEnd, validationPrice].every(Number.isFinite)
    || windowEnd < validatedAt || !['short', 'long'].includes(direction)) return missing();
  for (let i = candleTimeIndex(candles, next); i < candles.length && candles[i].time + 300 <= windowEnd; i++) {
    const c = candles[i];
    if (c.time !== next || ![c.high, c.low].every(Number.isFinite)) return missing();
    next += 300; result.processedCandles++; result.rawThrough = next;
    if (c.ignored) continue;
    const invalid = candleTouchesPrice(c, invalidation, !below);
    const t1 = candleTouchesPrice(c, target1, below);
    const t2 = Number.isFinite(target2) && candleTouchesPrice(c, target2, below);
    if (result.stage1 === 'open' && (invalid || t1)) {
      result.stage1 = invalid && t1 ? 'ambiguous' : invalid ? 'invalidation' : 'target1';
      result.t1At = t1 ? c.time : null;
      if (result.stage1 !== 'target1') {
        result.endAt = next; result.endReason = result.stage1; return result;
      }
      result.stage2 = Number.isFinite(target2) ? 'open' : 'noTarget2';
    }
    if (result.stage1 !== 'target1') continue;
    result.processedAfterT1++;
    const extreme = below ? c.low : c.high;
    if (result.extremePrice == null || (below ? extreme < result.extremePrice : extreme > result.extremePrice)) {
      result.extremePrice = extreme; result.extremeAt = c.time;
    }
    if (t2 && result.t2At == null) result.t2At = c.time;
    // Die T1-Kerze kann T2 belegen, aber keine zeitlich geordnete Rückkehr zum Startpreis.
    if (c.time > result.t1At) {
      if (invalid && result.invalidationReturnAt == null) result.invalidationReturnAt = c.time;
      if (candleTouchesPrice(c, validationPrice, !below) && result.validationPriceReturnAt == null) result.validationPriceReturnAt = c.time;
    }
    if (result.stage2 === 'open' && (t2 || invalid)) {
      result.stage2 = t2 && invalid ? 'ambiguous' : t2 ? 'target2' : 'returned';
      result.endAt = next; result.endReason = result.stage2;
    }
  }
  if (next < Math.floor(windowEnd / 300) * 300) return missing();
  result.rawEndReason = 'windowEnd';
  return result;
}

export function completeDealingRangePriceObservations(snapshots, candles, windowEnd) {
  const observations = new Map();
  for (const group of groupSetupSnapshots(snapshots)) {
    const first = group.firstValidated;
    if (!first) continue;
    const primary = first.checklist?.setup?.primary, selection = primary?.targetSelection;
    const index = candleTimeIndex(candles, Math.floor(first.knownAt / 300) * 300) - 1;
    const reference = candles[index];
    const observation = observeDealingRangePrice({ candles, target1: selection?.target1?.price,
      target2: selection?.target2?.price ?? null, invalidation: primary?.invalidation,
      direction: primary?.direction, validatedAt: first.knownAt,
      validationPrice: reference?.time + 300 === Math.floor(first.knownAt / 300) * 300 ? reference.close : null, windowEnd });
    observations.set(group.key, { ...observation, setupKey: first.setupKey });
  }
  return snapshots.map(s => {
    const observation = observations.get(`${s.runId ?? ''}:${s.instrument}:${s.setupKey ?? s.entry?.setupKey ?? s.id}`);
    return observation ? { ...s, priceObservation: observation } : s;
  });
}
