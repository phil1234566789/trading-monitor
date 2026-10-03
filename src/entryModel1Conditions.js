export const ENTRY_MODEL_1_VERSION = 'countertrend-entry-model-1-v1';

export function entryModel1ConditionsReady(conditions, direction, entryAt) {
  const {m5Choch,m1Bos,retest,fvg}=conditions ?? {};
  const known = fact => Number.isFinite(fact?.recognizedAt) && fact.recognizedAt <= entryAt;
  const same = fact => known(fact) && fact.direction === direction;
  return ['short','long'].includes(direction) && Number.isFinite(entryAt)
    && same(m5Choch) && m5Choch.type === 'CHoCH' && same(m1Bos) && m1Bos.type === 'BOS'
    && known(retest) && retest.orderBlock?.dir === (direction === 'short' ? -1 : 1)
    && same(fvg) && fvg.recognizedAt > retest.recognizedAt;
}
