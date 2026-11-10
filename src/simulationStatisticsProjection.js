import {reviewGroups,groupResults} from './simulationRunComparison.js';
import {applySimulationCommission} from './tradeSetupSimulationCosts.js';
import {simulationFeatureIdentity,simulationFeatureDigest} from './simulationFeatureIdentity.js';

// Bei geänderten Auswertungsregeln neu vorbereiten; alte Ableitungen niemals still umdeuten.
export const STATISTICS_PROJECTION_VERSION = 1;

function compactSnapshot(snapshot) {
  if (!snapshot) return null;
  const primary=snapshot.checklist?.setup?.primary,entry=snapshot.entry;
  return {id:snapshot.id,runId:snapshot.runId,setupKey:snapshot.setupKey,knownAt:snapshot.knownAt,
    instrument:snapshot.instrument,direction:snapshot.direction,source:snapshot.source,
    dealingRange:snapshot.dealingRange?{version:snapshot.dealingRange.version,status:snapshot.dealingRange.status,
      reason:snapshot.dealingRange.reason,main:snapshot.dealingRange.main,riskInvalidation:snapshot.dealingRange.riskInvalidation}:undefined,
    checklist:{ruleVersion:snapshot.checklist?.ruleVersion,setup:{primary:primary?{
      tradeSetupId:primary.tradeSetupId,
      sweep:primary.sweep?{timeframe:primary.sweep.timeframe,level:primary.sweep.level?{
        pivotTime:primary.sweep.level.pivotTime,price:primary.sweep.level.price,
        fineTouchedTime:primary.sweep.level.fineTouchedTime,touchedTime:primary.sweep.level.touchedTime}:undefined}:undefined,
      reactionOB:primary.reactionOB?{startTime:primary.reactionOB.startTime,top:primary.reactionOB.top,bottom:primary.reactionOB.bottom}:undefined}:undefined}},
    ...(entry?{entry:{id:entry.id,recognizedAt:entry.recognizedAt,confirmedAt:entry.confirmedAt,
      price:entry.price,entryPattern:entry.entryPattern,entryModel:entry.entryModel,
      patternMatches:entry.patternMatches?.map(match=>({id:match.id,entryPattern:match.entryPattern,entryModel:match.entryModel}))}}:{})};
}

export async function compileSimulationStatistics(snapshots,results) {
 const rows=projectSimulationStatistics(snapshots,results);
 for(const row of rows){
  const features=row.summary.features;
  // Pin-Parität braucht den exakten Befundvergleich, die Liste dagegen keine Begründungstexte.
  row.summary.featureSignatures=Object.fromEntries(await Promise.all(features.map(async f=>[f.key,await simulationFeatureDigest(simulationFeatureIdentity(features,f))])));
  row.summary.features=features.map(({details,...feature})=>feature);
 }
 return rows;
}

// Dieselben gespeicherten Entscheidungen einmal gruppieren; keine erneute Handelsberechnung.
export function projectSimulationStatistics(snapshots,results) {
  const net=results.map(applySimulationCommission);
  return reviewGroups(snapshots).map(group=>{
    const summary={...group,snapshot:compactSnapshot(group.snapshot),candidate:compactSnapshot(group.candidate),
      latestCandidate:compactSnapshot(group.latestCandidate),firstValidated:compactSnapshot(group.firstValidated),
      entries:group.entries.map(compactSnapshot)};
    const groupedResults=groupResults([group],net);
    return {key:group.key,recognizedAt:group.recognizedAt??null,summary,
      results:groupedResults,orders:groupedResults.map(r=>net.findIndex(n=>n.runId===r.runId&&n.snapshotId===r.snapshotId&&n.variant===r.variant)),detail:group};
  });
}

export function projectionDataset(rows) {
  return {prepared:true,groups:rows.map(row=>row.summary).sort((a,b)=>b.recognizedAt-a.recognizedAt||a.key.localeCompare(b.key)),
    results:rows.flatMap(row=>row.results.map((result,i)=>({result,order:row.orders[i]}))).sort((a,b)=>a.order-b.order).map(row=>row.result)};
}
