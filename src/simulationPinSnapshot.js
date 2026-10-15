import {berlinDateStrFor} from './berlinTime.js';
import {savedDealingRangeStatus} from './tradeSetup2DealingRange.js';
import {simulationReviewFeatures} from './simulationReviewFeatures.js';
import {entryPatternVersion} from './entryPattern.js';
import { formatDatedTime } from './berlinTime.js';
import { simulationChartLink,simulationEntryResult } from './tradeSetupSimulationStatistics.js';
import { featureDetails } from './simulationReviewFeatures.js';

export function simulationPinKey({kind,group,feature,entry,variant='both'}) {
  if(group.snapshot.source==='live-watcher')return JSON.stringify([kind,'live-watcher',group.instrument,group.snapshot.setupKey,feature?.key ?? entry?.id ?? '',kind==='simulation_entry'?variant:'']);
  return JSON.stringify([kind,group.snapshot.runId,group.snapshot.setupKey ?? group.key,
    feature?.key ?? entry?.id ?? '',kind==='simulation_entry'?variant:'']);
}
export function simulationPinSnapshot(target,run,results,pinnedAt=new Date().toISOString()) {
  const {group,feature,entry,kind,variant='both'}=target,snapshot=group.snapshot;
  const time=sec=>Number.isFinite(sec)?{utc:new Date(sec*1000).toISOString(),berlin:formatDatedTime(sec),unix:sec}:null;
  const config=run?.configuration,live=snapshot.source==='live-watcher',sourceSnapshot=entry ?? (kind==='simulation_dr' && group.latestCandidate?.evidenceRecordId?group.latestCandidate:snapshot),record=live && sourceSnapshot.evidenceRecordId;
  const source=!live?null:record?{kind:'live-watcher',recordId:record,configurationId:sourceSnapshot.configurationId,evaluationMode:sourceSnapshot.evaluationMode,capturedAt:sourceSnapshot.evidenceCapturedAt,evaluatedThrough:sourceSnapshot.evidenceEvaluatedThrough,viewId:'live-watcher:'+berlinDateStrFor(sourceSnapshot.knownAt).slice(0,7)+(sourceSnapshot.evaluationMode==='catchup'?':catchup':'')}
    :{kind:'live-watcher',eventId:sourceSnapshot.liveEventId,evaluationMode:sourceSnapshot.evaluationMode ?? 'live',viewId:'live-watcher:'+berlinDateStrFor(sourceSnapshot.knownAt).slice(0,7)};
  return {contextVersion:record?'simulation-pin-context-v4':live?'simulation-pin-context-v3':'simulation-pin-context-v2',
    ...(live?{source}:{}),...(record && sourceSnapshot.observationRecordId?{observationSource:{
      recordId:sourceSnapshot.observationRecordId,configurationId:sourceSnapshot.observationConfigurationId,evaluationMode:sourceSnapshot.observationEvaluationMode,
      capturedAt:sourceSnapshot.observationCapturedAt,evaluatedThrough:sourceSnapshot.observationEvaluatedThrough,
      coverage:sourceSnapshot.liveCoverage ?? null}}:{}),dealingRangeVersion:(record?sourceSnapshot:group.latestCandidate ?? snapshot).dealingRange?.version ?? null,
    dealingRangeReason:(record?sourceSnapshot:group.latestCandidate ?? snapshot).dealingRange?.reason ?? null,kind,runId:live?null:snapshot.runId,runVersion:run?.version ?? null,ruleVersion:(live?sourceSnapshot:snapshot).checklist?.ruleVersion ?? null,
    entryPatternVersion:entryPatternVersion(entry?.entry ?? (live?snapshot.entry:null)) ?? entryPatternVersion(config) ?? entryPatternVersion((live?sourceSnapshot:snapshot).checklist) ?? null,
    drId:live?JSON.stringify([group.instrument,snapshot.setupKey]):group.key,snapshotId:live?sourceSnapshot.id:snapshot.id,setupKey:snapshot.setupKey,setup1Id:(live?sourceSnapshot:snapshot).checklist?.setup?.primary?.tradeSetupId ?? null,
    instrument:group.instrument,direction:group.direction,setupType:group.setupType,stage:record?savedDealingRangeStatus(sourceSnapshot):group.stage,outcome:group.outcome,
    recognizedAt:time(group.recognizedAt),snapshotAt:time(live?sourceSnapshot.knownAt:snapshot.knownAt),validatedAt:time(group.firstValidated?.knownAt),
    ...(feature?{checkpoint:{...feature,details:featureDetails(group.features,feature)}}:{}),
    features:record?simulationReviewFeatures(sourceSnapshot):group.features,
    ...(entry?{entry:{id:entry.id,entryId:entry.entry.id,time:time(entry.entry.recognizedAt),price:entry.entry.price,
      stops:entry.entry.stops,variant,results:Object.fromEntries(['wide','narrow'].map(v=>[v,simulationEntryResult(results,entry,v) ?? null]))}}:{}),
    chartLink:simulationChartLink({...entry ?? (live?sourceSnapshot:snapshot),variant:variant==='both'?'wide':variant},snapshot.runId),pinnedAt};
}
