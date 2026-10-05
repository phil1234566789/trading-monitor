export const ENTRY_PATTERN_1_VERSION = 'countertrend-entry-model-1-v4';
export const isEntryPattern1 = version => [ENTRY_PATTERN_1_VERSION, 'countertrend-entry-model-1-v3', 'countertrend-entry-model-1-v2', 'countertrend-entry-model-1-v1'].includes(version);
export const usesM5BosEntryPattern1 = version => [ENTRY_PATTERN_1_VERSION,'countertrend-entry-model-1-v3','countertrend-entry-model-1-v2'].includes(version);
export const usesPivotBreakEntryPattern1 = version => version===ENTRY_PATTERN_1_VERSION;

export function entryPattern1ConditionsReady(conditions, direction, entryAt, version = ENTRY_PATTERN_1_VERSION) {
  const {retest,fvg}=conditions ?? {};
  const legacy=version==='countertrend-entry-model-1-v1';
  const pivotBreak=usesPivotBreakEntryPattern1(version);
  const m5=conditions?.[legacy?'m5Choch':'m5Bos'],m1=conditions?.[legacy?'m1Bos':pivotBreak?'m1PivotBreak':'m1Choch'];
  const known = fact => Number.isFinite(fact?.recognizedAt) && fact.recognizedAt <= entryAt;
  const same = fact => known(fact) && fact.direction === direction;
  return ['short','long'].includes(direction) && Number.isFinite(entryAt)
    && same(m5) && m5.type === (legacy?'CHoCH':'BOS') && same(m1) && m1.type === (legacy?'BOS':pivotBreak?'pivot-break':'CHoCH')
    && known(retest) && retest.orderBlock?.dir === (direction === 'short' ? -1 : 1)
    && same(fvg) && fvg.recognizedAt > retest.recognizedAt;
}
