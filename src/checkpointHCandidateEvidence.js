import {setupEntryConditions} from './tradeSetup2Review.js';
import {entryPatternVersion} from './entryPattern.js';
import {isEntryPattern1,usesOptionalM5BosEntryPattern1,entryPattern1ConditionResults,usesCountertrendM5BosEntryPattern1} from './entryPattern1Conditions.js';
import {formatBerlinTime,formatDatedTime} from './berlinTime.js';

export const CHECKPOINT_H_KEYS=new Set(['time','active','anchor','structure','m5Bos','m1PivotBreak','m1Choch','m5Choch','m1Bos','retest','fvg','entry']);
const fields=(value,keys)=>value!=null&&keys.every(key=>Object.hasOwn(value,key));
const countertrendComplete=(value,direction)=>fields(value,['trend','recognizedAt','range'])&&fields(value.range?.[direction==='short'?'high':'low'],['pivotTime']);
const states={fulfilled:['Erfüllt','✓','positive'],missing:['Nicht erfüllt','✕','negative'],optionalMissing:['Nicht erfüllt','–','warning'],uncertain:['Nicht beurteilbar','?','neutral']};
const known=(t,at)=>Number.isFinite(t)&&t<=at;

// Jeder Kandidat verwendet nur seinen eigenen Originalstand, nie zusammengeführte spätere Belege.
export function checkpointHCandidateEvidence(snapshot,at) {
 const frames=[...(snapshot.checklistHistory?.entries ?? []),snapshot].filter(f=>known(f.knownAt,at)&&known(f.m1Check?.evaluatedAt,at));
 const candidates=[...new Set(frames.map(f=>f.m1Check.conditions?.fvg?.recognizedAt ?? f.m1Check.fvg?.recognizedAt).filter(t=>known(t,at)))].sort((a,b)=>a-b);
 return candidates.map(candidateAt=>{
  const frame=frames.find(f=>f.knownAt===candidateAt&&f.m1Check.evaluatedAt===candidateAt
   &&(f.m1Check.conditions?.fvg?.recognizedAt ?? f.m1Check.fvg?.recognizedAt)===candidateAt);
  const version=entryPatternVersion(frame?.m1Check) ?? entryPatternVersion(frame?.checklist);
  const supported=isEntryPattern1(version),m1=frame?.m1Check;
  const source=frame?{...frame,instrument:snapshot.instrument,direction:snapshot.direction,entry:snapshot.entry?.recognizedAt===candidateAt?snapshot.entry:null}
   :{knownAt:candidateAt,instrument:snapshot.instrument,direction:snapshot.direction};
  if(!frame||!supported)return {at:candidateAt,version,pattern:'Entry Pattern nicht beurteilbar',rows:[],state:'uncertain',summary:'Entry / kein Entry nicht beurteilbar: Originalprüfung oder historische Regelversion zu diesem Kandidatenzeitpunkt fehlt.',timeline:[],sourceLabel:`Prüfung ${formatDatedTime(candidateAt)} Uhr`};
  const ruleResults=entryPattern1ConditionResults(m1.conditions,snapshot.direction,candidateAt,version);
  const baseRows=setupEntryConditions(source).rows.filter(r=>CHECKPOINT_H_KEYS.has(r.key)&&!['entry','structure'].includes(r.key));
  {
   baseRows.splice(2,0,{key:'direction',label:'Gültige Setup-Richtung',details:[]});
   baseRows.push({key:'retestOrderBlock',label:'Retest-Orderblock in Setup-Richtung',details:[]},{key:'fvgAfterRetest',label:'FVG erst nach bestätigtem Retest',details:[]});
   if(usesCountertrendM5BosEntryPattern1(version))baseRows.splice(4,0,{key:'m5Countertrend',label:'Zugehöriger M5-Countertrend belegt',details:[]});
  }
  const rows=baseRows.map(row=>{
   if(row.key==='retest')row.label='M5-OB-Retest bestätigt';
   if(row.key==='fvg')row.label='Gleichgerichtete M1-FVG bestätigt';
   const required=!(row.key==='m5Bos'&&usesOptionalM5BosEntryPattern1(version));
   let state=row.status==='passed'?'fulfilled':row.status==='observed'?'optionalMissing':row.status==='unmet'?'missing':'uncertain';
   let details=row.details ?? [];
   if(m1.status==='error'||['loading','disabled','abc','time','ended'].includes(m1.reason))state='uncertain';
   else if(ruleResults.some(r=>r.key===row.key)){
    const rule=ruleResults.find(r=>r.key===row.key),conditions=m1.conditions ?? {},signal=conditions[row.key];
    const complete=row.key==='direction'||(row.key==='retestOrderBlock'?fields(conditions.retest?.orderBlock,['dir']):
     row.key==='fvgAfterRetest'?fields(conditions.fvg,['recognizedAt'])&&fields(conditions.retest,['recognizedAt']):
     Object.hasOwn(conditions,row.key)&&(signal===null||(
     row.key==='m5Countertrend'?countertrendComplete(signal,snapshot.direction):row.key==='retest'?fields(signal,['recognizedAt']):
     row.key==='fvg'?fields(signal,['recognizedAt','direction']):
     fields(signal,['recognizedAt','direction','type'])&&(row.key!=='m5Bos'||!usesCountertrendM5BosEntryPattern1(version)||fields(signal,['originTime'])&&countertrendComplete(conditions.m5Countertrend,snapshot.direction)))));
    state=rule.passed?'fulfilled':complete?(required?'missing':'optionalMissing'):'uncertain';
    if(state==='missing'||state==='optionalMissing')details=['Bei dieser Prüfung nicht erfüllt: Signaltyp, Richtung, zeitliche Reihenfolge und erforderliche Strukturzuordnung nach der gespeicherten Regelversion.'];
    if(state==='fulfilled'&&!details.length)details=['Durch die gespeicherten zeitgleichen Regelfelder belegt.'];
   }
   if(m1.status!=='error'&&row.key==='active'){
    const primary=frame?.checklist?.setup?.primary,life=primary?.lifecycle;
    if(life?.main?.reason==='missingHistory')state='uncertain';
    else if(life?.main?.state==='active'&&life.entrySearchAllowed===true)state='fulfilled';
    else if(life?.main?.state==='ended'&&!known(life.main.recognizedAt,candidateAt))state='uncertain';
   }
   if(state==='uncertain')details=['Zeitgleicher Regelbeleg nicht vollständig gespeichert.'];
   const [stateLabel,icon,tone]=states[state];
   return {...row,label:row.label.replace(' · optional für Full Entry',''),required,state,stateLabel,icon,tone,details};
  });
  const missing=rows.filter(r=>r.required&&r.state==='missing');
  const entry=source.entry;
  const state=entry?'fulfilled':missing.length?'missing':'uncertain';
  const summary=entry?'Entry gespeichert.':missing.length?`Kein Entry: Pflichtregel ${missing.map(r=>r.label).join(', ')} nicht erfüllt um ${formatBerlinTime(candidateAt)} Uhr.`
   :'Entry / kein Entry nicht vollständig beurteilbar: zeitgleiche Prüfbelege fehlen.';
  const timeline=rows.filter(r=>r.state==='missing'||r.state==='optionalMissing').flatMap(row=>{
   const later=frames.map(f=>f.m1Check.conditions?.[row.key]).filter(s=>known(s?.recognizedAt,at)&&s.recognizedAt>candidateAt&&(!s.direction||s.direction===snapshot.direction)).sort((a,b)=>a.recognizedAt-b.recognizedAt)[0];
   return later?[`${row.label}: erst später um ${formatBerlinTime(later.recognizedAt)} Uhr bestätigt; unverändert nicht erfüllt bei dieser Prüfung.`]:[];
  });
  return {at:candidateAt,version,pattern:'Entry Pattern 1',rows,state,summary,timeline,
   versionNote:usesOptionalM5BosEntryPattern1(version)?'Aus altem Lauf übernommen: M5-BOS war unter v10 optional; aktuelle v11-Regeln machen ihn verpflichtend. Dieser Prüfstand bleibt nach v10 bewertet.':'',
   technicalNote:m1?.status==='error'?`Technischer Fehler bei dieser Prüfung: ${(m1.details ?? []).join(' ')}`:'',
   sourceLabel:`Prüfung ${formatDatedTime(candidateAt)} Uhr`};
 });
}
