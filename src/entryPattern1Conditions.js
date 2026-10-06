import { entryPattern1M5BosMatches } from './entryPattern1M5Bos.js';

export const ENTRY_PATTERN_1_VERSION = 'countertrend-entry-model-1-v7';
export const isEntryPattern1 = version => [ENTRY_PATTERN_1_VERSION,'countertrend-entry-model-1-v6','countertrend-entry-model-1-v5', 'countertrend-entry-model-1-v4', 'countertrend-entry-model-1-v3', 'countertrend-entry-model-1-v2', 'countertrend-entry-model-1-v1'].includes(version);
export const usesM5BosEntryPattern1 = version => [ENTRY_PATTERN_1_VERSION,'countertrend-entry-model-1-v6','countertrend-entry-model-1-v5', 'countertrend-entry-model-1-v4','countertrend-entry-model-1-v3','countertrend-entry-model-1-v2'].includes(version);
export const usesPivotBreakEntryPattern1 = version => [ENTRY_PATTERN_1_VERSION,'countertrend-entry-model-1-v6','countertrend-entry-model-1-v5','countertrend-entry-model-1-v4'].includes(version);

export const usesCountertrendM5BosEntryPattern1 = version => [ENTRY_PATTERN_1_VERSION,'countertrend-entry-model-1-v6','countertrend-entry-model-1-v5'].includes(version);

export function entryPattern1ConditionsReady(conditions, direction, entryAt, version = ENTRY_PATTERN_1_VERSION) {
  const {retest,fvg}=conditions ?? {};
  const legacy=version==='countertrend-entry-model-1-v1';
  const pivotBreak=usesPivotBreakEntryPattern1(version);
  const m5=conditions?.[legacy?'m5Choch':'m5Bos'],m1=conditions?.[legacy?'m1Bos':pivotBreak?'m1PivotBreak':'m1Choch'];
  const known = fact => Number.isFinite(fact?.recognizedAt) && fact.recognizedAt <= entryAt;
  const same = fact => known(fact) && fact.direction === direction;
  return ['short','long'].includes(direction) && Number.isFinite(entryAt)
    && (!usesCountertrendM5BosEntryPattern1(version) || entryPattern1M5BosMatches(m5,conditions?.m5Countertrend,direction,entryAt))
    && same(m5) && m5.type === (legacy?'CHoCH':'BOS') && same(m1) && m1.type === (legacy?'BOS':pivotBreak?'pivot-break':'CHoCH')
    && known(retest) && retest.orderBlock?.dir === (direction === 'short' ? -1 : 1)
    && same(fvg) && fvg.recognizedAt > retest.recognizedAt;
}
