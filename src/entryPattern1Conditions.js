import {entryPositionSizeFactor} from './entryCategory.js';
import { entryPattern1M5BosMatches, entryPattern1CountertrendKnown } from './entryPattern1M5Bos.js';

export const ENTRY_PATTERN_1_VERSION = 'countertrend-entry-model-1-v10';
export const isEntryPattern1 = version => [ENTRY_PATTERN_1_VERSION,'countertrend-entry-model-1-v9','countertrend-entry-model-1-v8','countertrend-entry-model-1-v7','countertrend-entry-model-1-v6','countertrend-entry-model-1-v5', 'countertrend-entry-model-1-v4', 'countertrend-entry-model-1-v3', 'countertrend-entry-model-1-v2', 'countertrend-entry-model-1-v1'].includes(version);
export const usesM5BosEntryPattern1 = version => [ENTRY_PATTERN_1_VERSION,'countertrend-entry-model-1-v9','countertrend-entry-model-1-v8','countertrend-entry-model-1-v7','countertrend-entry-model-1-v6','countertrend-entry-model-1-v5', 'countertrend-entry-model-1-v4','countertrend-entry-model-1-v3','countertrend-entry-model-1-v2'].includes(version);
export const usesPivotBreakEntryPattern1 = version => [ENTRY_PATTERN_1_VERSION,'countertrend-entry-model-1-v9','countertrend-entry-model-1-v8','countertrend-entry-model-1-v7','countertrend-entry-model-1-v6','countertrend-entry-model-1-v5','countertrend-entry-model-1-v4'].includes(version);

export const usesCountertrendM5BosEntryPattern1 = version => [ENTRY_PATTERN_1_VERSION,'countertrend-entry-model-1-v9','countertrend-entry-model-1-v8','countertrend-entry-model-1-v7','countertrend-entry-model-1-v6','countertrend-entry-model-1-v5'].includes(version);

export function entryPattern1ConditionsReady(conditions, direction, entryAt, version = ENTRY_PATTERN_1_VERSION) {
  const {retest,fvg}=conditions ?? {};
  const legacy=version==='countertrend-entry-model-1-v1';
  const pivotBreak=usesPivotBreakEntryPattern1(version);
  const m5=conditions?.[legacy?'m5Choch':'m5Bos'],m1=conditions?.[legacy?'m1Bos':pivotBreak?'m1PivotBreak':'m1Choch'];
  const known = fact => Number.isFinite(fact?.recognizedAt) && fact.recognizedAt <= entryAt;
  const same = fact => known(fact) && fact.direction === direction;
  return ['short','long'].includes(direction) && Number.isFinite(entryAt)
    && (usesOptionalM5BosEntryPattern1(version)
      ? entryPattern1CountertrendKnown(conditions?.m5Countertrend,direction,entryAt)
      : (!usesCountertrendM5BosEntryPattern1(version) || entryPattern1M5BosMatches(m5,conditions?.m5Countertrend,direction,entryAt))
        && same(m5) && m5.type === (legacy?'CHoCH':'BOS'))
    && same(m1) && m1.type === (legacy?'BOS':pivotBreak?'pivot-break':'CHoCH')
    && known(retest) && retest.orderBlock?.dir === (direction === 'short' ? -1 : 1)
    && same(fvg) && fvg.recognizedAt > retest.recognizedAt;
}

export const usesOptionalM5BosEntryPattern1 = version => version === ENTRY_PATTERN_1_VERSION;

export function entryPattern1StructureCategory(conditions, direction, at, version = ENTRY_PATTERN_1_VERSION) {
  const pivot=conditions?.m1PivotBreak;
  if (pivot?.type !== 'pivot-break' || pivot.direction !== direction
    || !Number.isFinite(pivot.recognizedAt) || pivot.recognizedAt > at) return null;
  const full=entryPattern1M5BosMatches(conditions?.m5Bos,conditions?.m5Countertrend,direction,at);
  if (full) return 'full';
  return usesOptionalM5BosEntryPattern1(version)
    && entryPattern1CountertrendKnown(conditions?.m5Countertrend,direction,at) ? 'risky' : null;
}

export function entryPattern1CategoryMetadata(category) {
  if(!['full','risky'].includes(category))return null;
  return {entryCategory:category,positionSizeFactor:entryPositionSizeFactor({entryCategory:category}),
    optionalConditionsMissing:category==='risky'?['m5Bos']:[]};
}
