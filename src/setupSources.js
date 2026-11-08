import { setup1RecognitionTime } from './setup1RecognitionTime.js';
import { detectSweepRetestSources,SWEEP_RETEST_SOURCE_KIND } from './sweepRetestSources.js';
import {markCountertrendCandles} from './countertrendSnapshotCompletion.js';

export const isSweepRetestSource=source=>source?.sourceKind===SWEEP_RETEST_SOURCE_KIND;
export const setupSourceId=source=>isSweepRetestSource(source)?source.sourceKey:source.tradeSetupId;
export const setupSourceKey=source=>`${source.instrument}:${isSweepRetestSource(source)?'sweep-retest':'setup1'}:${setupSourceId(source)}`;
export function setupSourceRecognitionTime(source) {
  if(!isSweepRetestSource(source))return setup1RecognitionTime(source);
  if(!source.sourceKey||!Number.isFinite(source.recognizedAt)||!Number.isFinite(source.orderBlockKnownAt)
    ||source.orderBlockKnownAt>source.recognizedAt||!Number.isFinite(source.sourceRetest?.recognizedAt)
    ||source.sourceRetest.recognizedAt>source.recognizedAt)throw new Error('Sweep-/M5-OB-Retestquelle ohne kausal vollständige Bekannt-Zeitpunkte.');
  return source.recognizedAt;
}

export function assembleSetupSources(input) {
  const existing=input.tradeSetups ?? [];
  if(!input.includeSweepRetestSources || input.sourcesAssembled)return existing;
  const additional=detectSweepRetestSources({...input,
    m5Candles:markCountertrendCandles(input.m5Candles,input.instrument,input.sessionConfigs),
    h1Candles:markCountertrendCandles(input.h1Candles,input.instrument,input.sessionConfigs)});
  // Beide Startwege teilen nur bei identischem Sweep UND OB dieselbe Idee.
  const natural=source=>JSON.stringify([source.instrument,source.dir,source.ls?.dir,source.ls?.price,
    source.ls?.pivotTime,source.ls?.touchedTime,source.obStartTime,source.obTop,source.obBottom]);
  const identities=new Set(existing.map(natural));
  return [...existing,...additional.filter(source=>{
    const key=natural(source);if(identities.has(key))return false;identities.add(key);return true;
  })];
}
