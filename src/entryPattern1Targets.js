import { entryPattern1CountertrendState } from './entryPattern1M5Bos.js';

export const usesEntryPattern1TargetReplacement = version => version === 'countertrend-entry-model-1-v7';

export function entryPattern1TargetExclusions(primary, direction, selectedAt) {
  const countertrend = entryPattern1CountertrendState(primary, direction, selectedAt);
  const nested = countertrend?.nestedTrend;
  const origin = countertrend?.currRange?.[direction === 'short' ? 'high' : 'low'];
  const [start, seed] = nested?.appliedPivots ?? [];
  // 9312: Das erste Drehungslevel der konkreten T57-Ebene (NY), nicht deren
  // geschütztes BOS-Level (MMM), darf die Entry-Suche vor der Drehung nicht beenden.
  if (nested?.trend !== 'unknown' || start?.pivotTime !== origin?.pivotTime
    || !Number.isFinite(seed?.pivotTime) || !Number.isFinite(seed.price)
    || seed.type !== (direction === 'short' ? 'low' : 'high')) return [];
  return [{ pivotTime: seed.pivotTime, price: seed.price, dir: direction === 'short' ? -1 : 1 }];
}

