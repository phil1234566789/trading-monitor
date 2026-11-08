import { detectSweepRetestSources } from './sweepRetestSources.js';
import {markCountertrendCandles} from './countertrendSnapshotCompletion.js';
import {naturalSourceFamilyKey,SOURCE_FAMILY_VERSION} from './setupSourceFamily.js';
import {setupSourceKey} from './setupSourceIdentity.js';
export {isSweepRetestSource,setupSourceId,setupSourceKey,setupSourceRecognitionTime} from './setupSourceIdentity.js';

export function assembleSetupSources(input) {
  const existing=input.tradeSetups ?? [];
  if(!input.includeSweepRetestSources || input.sourcesAssembled)return existing;
  const additional=detectSweepRetestSources({...input,
    m5Candles:markCountertrendCandles(input.m5Candles,input.instrument,input.sessionConfigs),
    h1Candles:markCountertrendCandles(input.h1Candles,input.instrument,input.sessionConfigs)});
  // Gleiche Sweep-/OB-Geometrie beweist keine gleichen Targets: erst die bekannte Idee darf zusammengeführt werden.
  const identities=new Set(existing.map(setupSourceKey));
  return [...existing,...additional.filter(source=>{
    const key=setupSourceKey(source);if(identities.has(key))return false;
    identities.add(key);return true;
  })].map(source=>{
    const key=naturalSourceFamilyKey(source);
    return key?{...source,sourceFamilyKey:key,sourceFamilyVersion:SOURCE_FAMILY_VERSION}:source;
  });
}
