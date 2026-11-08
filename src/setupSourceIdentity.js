import {setup1RecognitionTime} from './setup1RecognitionTime.js';
import {SWEEP_RETEST_SOURCE_KIND} from './sweepRetestSources.js';

export const isSweepRetestSource=source=>source?.sourceKind===SWEEP_RETEST_SOURCE_KIND;
export const setupSourceId=source=>isSweepRetestSource(source)?source.sourceKey:source.tradeSetupId;
export const setupSourceKey=source=>`${source.instrument}:${isSweepRetestSource(source)?'sweep-retest':'setup1'}:${setupSourceId(source)}`;
export function setupSourceRecognitionTime(source){
 if(!isSweepRetestSource(source))return setup1RecognitionTime(source);
 if(!source.sourceKey||!Number.isFinite(source.recognizedAt)||!Number.isFinite(source.orderBlockKnownAt)
  ||source.orderBlockKnownAt>source.recognizedAt||!Number.isFinite(source.sourceRetest?.recognizedAt)
  ||source.sourceRetest.recognizedAt>source.recognizedAt)throw new Error('Sweep-/M5-OB-Retestquelle ohne kausal vollständige Bekannt-Zeitpunkte.');
 return source.recognizedAt;
}
