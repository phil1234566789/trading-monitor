import { formatDatedTime } from './berlinTime.js';
import { simulationChartLink,simulationEntryResult } from './tradeSetupSimulationStatistics.js';
import { featureDetails } from './simulationReviewFeatures.js';

export function simulationPinKey({kind,group,feature,entry,variant='both'}) {
  return JSON.stringify([kind,group.snapshot.runId,group.snapshot.setupKey ?? group.key,
    feature?.key ?? entry?.id ?? '',kind==='simulation_entry'?variant:'']);
}
export function simulationPinSnapshot(target,run,results,pinnedAt=new Date().toISOString()) {
  const {group,feature,entry,kind,variant='both'}=target,snapshot=group.snapshot;
  const time=sec=>Number.isFinite(sec)?{utc:new Date(sec*1000).toISOString(),berlin:formatDatedTime(sec),unix:sec}:null;
  const config=run?.configuration;
  return {kind,runId:snapshot.runId,runVersion:run?.version ?? null,ruleVersion:snapshot.checklist?.ruleVersion ?? null,
    entryModelVersion:entry?.entry?.entryModel ?? config?.entryModel ?? snapshot.checklist?.entryModel ?? null,
    drId:group.key,snapshotId:snapshot.id,setupKey:snapshot.setupKey,setup1Id:snapshot.checklist?.setup?.primary?.tradeSetupId ?? null,
    instrument:group.instrument,direction:group.direction,setupType:group.setupType,stage:group.stage,outcome:group.outcome,
    recognizedAt:time(group.recognizedAt),snapshotAt:time(snapshot.knownAt),validatedAt:time(group.firstValidated?.knownAt),
    ...(feature?{checkpoint:{...feature,details:featureDetails(group.features,feature)}}:{}),
    features:group.features,
    ...(entry?{entry:{id:entry.id,entryId:entry.entry.id,time:time(entry.entry.recognizedAt),price:entry.entry.price,
      stops:entry.entry.stops,variant,results:Object.fromEntries(['wide','narrow'].map(v=>[v,simulationEntryResult(results,entry,v) ?? null]))}}:{}),
    chartLink:simulationChartLink({...entry ?? snapshot,variant:variant==='both'?'wide':variant},snapshot.runId),pinnedAt};
}
