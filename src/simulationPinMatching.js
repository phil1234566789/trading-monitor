import { simulationPinKey } from './simulationPinSnapshot.js';
import { featureDetails } from './simulationReviewFeatures.js';
import { simulationChartLink } from './tradeSetupSimulationStatistics.js';
import { simulationRunLabel } from './simulationRunPresentation.js';

// IDs und Regelversionen wechseln zwischen Läufen. Nur vollständig belegte Marktobjekte zuordnen.
export function simulationDrIdentity(snapshot) {
  const primary=snapshot?.checklist?.setup?.primary, sweep=primary?.sweep, level=sweep?.level, ob=primary?.reactionOB;
  const numbers=[level?.pivotTime,level?.price,level?.fineTouchedTime ?? level?.touchedTime,ob?.startTime,ob?.top,ob?.bottom];
  if(!snapshot?.instrument || !['long','short'].includes(snapshot.direction) || !sweep?.timeframe || !numbers.every(Number.isFinite))return null;
  return JSON.stringify([snapshot.instrument,snapshot.direction,sweep.timeframe.toUpperCase(),...numbers]);
}

function matchEntry(pin,groups,origin,native) {
  const saved=pin.simulationContext, time=saved?.entry?.time?.unix ?? origin?.entry?.recognizedAt;
  const instrument=saved?.instrument ?? origin?.instrument, direction=saved?.direction ?? origin?.direction;
  let candidates=groups.flatMap(group=>group.entries.map(entry=>({group,entry}))).filter(({entry,group})=>native
    ? entry.id===pin.simulationEntrySnapshotId
    : instrument && ['long','short'].includes(direction) && Number.isFinite(time)
      && (entry.instrument ?? group.snapshot.instrument)===instrument
      && (entry.direction ?? group.snapshot.direction)===direction && entry.entry?.recognizedAt===time);
  // Ein Entry überlebt korrigierte Eltern-DRs und Stops. Der Preis hilft nur bei mehreren zeitgleichen Treffern.
  const price=saved?.entry?.price ?? origin?.entry?.price;
  if(candidates.length>1 && Number.isFinite(price)) {
    const precise=candidates.filter(({entry})=>entry.entry?.price===price);
    if(precise.length)candidates=precise;
  }
  return candidates.length===1?candidates[0]:{reason:candidates.length>1
    ?'Mehrere Entries passen; eine eindeutige Zuordnung ist nicht möglich.'
    :!native && (!instrument || !['long','short'].includes(direction) || !Number.isFinite(time))
      ?'Instrument, Richtung oder exakter Zeitpunkt des ursprünglichen Entries fehlen.'
      :'Kein Entry mit demselben Instrument, derselben Richtung und demselben Zeitpunkt in diesem Lauf.'};
}
function sameFeature(group,saved) {
  const current=group.features.find(f=>f.key===saved?.key);
  // JSONB ordnet Objektschlüssel neu; ihre Speicherreihenfolge ist kein geänderter Befund.
  const signature=features=>JSON.stringify(features?.map(f=>[f.key,f.group,f.label,f.value,f.details]));
  return current && signature(featureDetails(group.features,current))===signature(saved.details);
}

export function matchSimulationPins(pins,groups,runId,origins=new Map(),runs=[]) {
  const index=new Map();
  for(const group of groups) {
    const key=simulationDrIdentity(group.snapshot);
    if(key)index.set(key,[...index.get(key)??[],group]);
  }
  const matched=[],unmatched=[];
  for(const pin of pins) {
    const originRun=runs.find(r=>r.id===pin.simulationRunId);
    const base={...pin,originLabel:originRun?simulationRunLabel(originRun):`Ursprünglicher Lauf ${pin.simulationRunId}`};
    const native=pin.simulationRunId===runId;
    const origin=origins.get(pin.id);
    const key=simulationDrIdentity(origin);
    const reference=pin.simulationSnapshotId ?? pin.simulationEntrySnapshotId;
    const candidates=native?groups.filter(g=>pin.simulationContext?.setupKey!=null&&g.snapshot.setupKey===pin.simulationContext.setupKey
      || reference!=null&&[g.snapshot.id,g.candidate?.id,g.latestCandidate?.id,...g.entries.map(e=>e.id)].includes(reference)):
      key?index.get(key)??[]:[];
    let reason=!native&&origin?.pinReadError?'Der ursprüngliche Snapshot konnte nicht geladen werden. Bitte erneut laden.':
      !native&&!key?'Sweep- oder OB-Merkmale des ursprünglichen Snapshots fehlen.':
      !candidates.length?'Keine DR mit denselben Sweep- und OB-Merkmalen in diesem Lauf.':
      candidates.length>1?'Mehrere DRs passen; eine eindeutige Zuordnung ist nicht möglich.':null;
    let group=candidates[0],feature,entry;
    if(pin.kind==='simulation_entry') ({group,entry,reason}=matchEntry(pin,groups,origin,native));
    if(!reason && pin.kind==='simulation_checkpoint') {
      feature=group.features.find(f=>f.key===pin.simulationCheckpointKey);
      if(!feature || !native&&!sameFeature(group,pin.simulationContext?.checkpoint))reason='Checkpoint fehlt oder sein gespeicherter Befund hat sich geändert.';
    }
    if(reason){unmatched.push({...base,unmatchedReason:reason});continue;}
    const target={kind:pin.kind,group,feature,entry};
    matched.push({...base,associationKey:simulationPinKey(target),associationGroupKey:group.key,associatedRunId:runId,
      currentChartLink:simulationChartLink({...entry??group.snapshot,drReplayTime:group.outcome?.replayTime,variant:pin.simulationVariant==='narrow'?'narrow':'wide'},runId)});
  }
  return {matched,unmatched};
}
