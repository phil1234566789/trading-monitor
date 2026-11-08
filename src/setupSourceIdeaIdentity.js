export const SOURCE_IDEA_EXIT_POLICY='half-t1-be-rest-t2-exact-half-v1';
const text=value=>typeof value==='string'&&value.length>0;
const known=(time,at)=>Number.isFinite(time)&&time<=at;

function targetIdentity(target,selectedAt,asOf){
  if(!target||!Number.isFinite(target.price)||!known(target.knownAt,selectedAt)
    ||target.selectedAt!=null&&!known(target.selectedAt,asOf))return null;
  const time=target.sourceTime??target.pivotTime;
  const id=text(target.id)?target.id:null;
  if(!id&&!(Number.isFinite(time)&&text(target.timeframe)&&text(target.source)))return null;
  return [id,Number.isFinite(time)?time:null,target.timeframe??null,target.source??null,target.price];
}

// Auswahlzeit ist eine Wissensgrenze, keine neue Idee bei identischem Zielpivot.
export function knownSourceIdeaKey(candidate,asOf){
  const selection=candidate?.targetSelection,instrument=candidate?.instrument??selection?.instrument;
  if(!Number.isFinite(asOf)||!text(candidate?.sourceFamilyKey)||!text(instrument)||!known(candidate?.recognizedAt,asOf)
    ||selection?.instrument!=null&&selection.instrument!==instrument
    ||!['short','long'].includes(candidate.direction)||!Number.isFinite(candidate.invalidation)
    ||!text(candidate.exitPolicy)||selection?.status!=='passed'||!known(selection.selectedAt,asOf))return null;
  const first=targetIdentity(selection.target1,selection.selectedAt,asOf);
  const second=selection.target2==null?null:targetIdentity(selection.target2,selection.selectedAt,asOf);
  if(!first||selection.target2!=null&&!second)return null;
  return JSON.stringify(['known-source-idea-v1',candidate.sourceFamilyKey,instrument,candidate.direction,
    candidate.invalidation,first,second,candidate.exitPolicy]);
}

// Die gebundene Idee trägt Zielidentitäten/Exitpolicy; tatsächliche Zielpreise sichern die Ausführung zusätzlich.
export function executionSignature(entry,ideaKey){
  if(!text(ideaKey)||!text(entry?.instrument)||!['short','long'].includes(entry.direction)
    ||![entry.recognizedAt,entry.price,entry.stops?.wide?.price,entry.stops?.narrow?.price].every(Number.isFinite))return null;
  const targets=variant=>{
    const rows=entry.scales?.[variant]?.targets??entry.targets;
    return Array.isArray(rows)&&rows.length>0&&rows.every(row=>Number.isFinite(row?.price))?rows.map(row=>row.price):null;
  };
  const wide=targets('wide'),narrow=targets('narrow');
  if(!wide||!narrow)return null;
  const size=[entry.sizing?.factor??entry.positionSizeFactor??null,entry.sizing?.fullFactor??null,
    entry.executionContract?.version??null,entry.executionContract?.unitsPerLot??null];
  return JSON.stringify(['source-execution-v1',ideaKey,entry.instrument,entry.direction,entry.recognizedAt,
    entry.price,entry.stops.wide.price,entry.stops.narrow.price,wide,narrow,entry.exitPolicy??null,size]);
}
