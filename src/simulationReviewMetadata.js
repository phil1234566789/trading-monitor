import { entryPatternVersion } from './entryPattern.js';
import { restoreChecklistObservationChecks } from './checklistObservationRules.js';

// Listen brauchen gespeicherte Entscheidungen, nicht die Chart-Bäume samt Speicherpool.
// Diese Felder liegen in raw/v1/v2 direkt vor; der Einzelabruf decodiert weiter alle Belege.
const paths = [
  'knownAt','setupKey','dealingRange','rangeCourse','priceObservation','entry','m1Check','entryEligibility',
  ...['model','entryPattern','entryModel','ruleVersion','status','evaluatedAt'].map(k=>`checklist.${k}`),
  ...['id','tradeSetupId','direction','setupType','recognizedAt','reactionRecognizedAt','targetSelection','validity','lifecycle','sweep','reactionOB'].map(k=>`checklist.setup.primary.${k}`),
  ...['h1Trend','outerM5Trend','m5Trend'].flatMap(k=>['status','details','m1Anchor'].map(field=>`checklist.checks.${k}.${field}`)),
  ...['liquiditySweep','reaction','targets','time'].map(k=>`checklist.checks.${k}`),
  ...['antiConfluences','confluences'].flatMap(k=>['status','rules','ruleVersion','divergences'].map(field=>`checklist.checks.${k}.${field}`)),
];
export const SIMULATION_REVIEW_METADATA_FIELDS = ['id,run_id,instrument,direction',
  ...paths.map((path,i)=>`review${i}:snapshot->${path.split('.').join('->')}`)].join(',');

export function simulationReviewMetadata(row) {
  const snapshot={id:row.id,runId:row.run_id,instrument:row.instrument,direction:row.direction};
  paths.forEach((path,i)=>{
    const value=row[`review${i}`];
    if(value==null)return;
    const keys=path.split('.');let target=snapshot;
    for(const key of keys.slice(0,-1))target=target[key]??= {};
    target[keys.at(-1)]=value;
  });
  if(snapshot.checklist){
    snapshot.checklist.entryPattern=entryPatternVersion(snapshot.checklist);
    snapshot.checklist.checks=restoreChecklistObservationChecks(snapshot.checklist.checks);
  }
  return snapshot;
}
