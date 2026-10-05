export const ENTRY_MODEL_1_VERSION = 'countertrend-entry-model-1-v4';
export const isEntryModel1 = version => [ENTRY_MODEL_1_VERSION, 'countertrend-entry-model-1-v3', 'countertrend-entry-model-1-v2', 'countertrend-entry-model-1-v1'].includes(version);
export const usesM5BosEntryModel1 = version => [ENTRY_MODEL_1_VERSION,'countertrend-entry-model-1-v3','countertrend-entry-model-1-v2'].includes(version);
export const usesPivotBreakEntryModel1 = version => version===ENTRY_MODEL_1_VERSION;

export function entryModel1ConditionsReady(conditions, direction, entryAt, version = ENTRY_MODEL_1_VERSION) {
  const {retest,fvg}=conditions ?? {};
  const legacy=version==='countertrend-entry-model-1-v1';
  const pivotBreak=usesPivotBreakEntryModel1(version);
  const m5=conditions?.[legacy?'m5Choch':'m5Bos'],m1=conditions?.[legacy?'m1Bos':pivotBreak?'m1PivotBreak':'m1Choch'];
  const known = fact => Number.isFinite(fact?.recognizedAt) && fact.recognizedAt <= entryAt;
  const same = fact => known(fact) && fact.direction === direction;
  return ['short','long'].includes(direction) && Number.isFinite(entryAt)
    && same(m5) && m5.type === (legacy?'CHoCH':'BOS') && same(m1) && m1.type === (legacy?'BOS':pivotBreak?'pivot-break':'CHoCH')
    && known(retest) && retest.orderBlock?.dir === (direction === 'short' ? -1 : 1)
    && same(fvg) && fvg.recognizedAt > retest.recognizedAt;
}
