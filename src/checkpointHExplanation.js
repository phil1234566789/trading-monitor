import {setupEntryConditions} from './tradeSetup2Review.js';
import {snapshotChecklistAt} from './checklistReplayView.js';
import {checkpointHCandidateEvidence} from './checkpointHCandidateEvidence.js';
import {formatDatedTime} from './berlinTime.js';

export const CHECKPOINT_H_KEYS=new Set(['time','active','anchor','structure','m5Bos','m1PivotBreak','m1Choch','m5Choch','m1Bos','retest','fvg','entry']);
export const CHECKPOINT_H_STATES={
  fulfilled:{label:'Erfüllt',icon:'✓',tone:'positive'},
  missing:{label:'Fehlt am Prüfstand',icon:'!',tone:'warning'},
  waiting:{label:'Noch ausstehend',icon:'…',tone:'warning'},
  uncertain:{label:'Nicht vollständig belegt',icon:'?',tone:'warning'},
  notStored:{label:'Nicht gespeichert',icon:'?',tone:'warning'},
  notChecked:{label:'Nicht geprüft',icon:'–',tone:'neutral'},
  observed:{label:'Nur Kontext / optional',icon:'–',tone:'neutral'},
  blocked:{label:'Bestätigte Sperre',icon:'✕',tone:'negative'},
  technical:{label:'Technischer Fehler',icon:'!',tone:'negative'},
};

// Der letzte Kandidatenstand kann m1Check verlieren; der gespeicherte Verlauf bleibt der Beleg.
export function checkpointHExplanation(snapshot,at=snapshot.knownAt) {
  const known=t=>Number.isFinite(t)&&t<=at;
  const entries=(snapshot.checklistHistory?.entries ?? []).filter(e=>known(e.knownAt));
  const current=snapshotChecklistAt(snapshot,at) ?? {knownAt:at,instrument:snapshot.instrument,direction:snapshot.direction};
  const m1=[...entries.map(e=>e.m1Check),known(snapshot.knownAt)?snapshot.m1Check:null]
    .filter(m=>known(m?.evaluatedAt)).sort((a,b)=>b.evaluatedAt-a.evaluatedAt)[0] ?? null;
  const entry=known(snapshot.entry?.recognizedAt)?snapshot.entry:null;
  const reviewAt=Math.max(current.knownAt ?? -Infinity,m1?.evaluatedAt ?? -Infinity,entry?.recognizedAt ?? -Infinity);
  const review=setupEntryConditions({...current,knownAt:reviewAt,m1Check:m1,entry});
  const life=current.checklist?.setup?.primary?.lifecycle;
  const ended=life?.main?.state==='ended'&&known(life.main.recognizedAt);
  const historyMissing=life?.main?.reason==='missingHistory';
  const waiting=m1?.status==='loading'||m1?.reason==='loading';
  const notChecked=['abc','disabled','ended','time'].includes(m1?.reason);
  const rows=review.rows.filter(r=>CHECKPOINT_H_KEYS.has(r.key)&&r.key!=='entry').map(row=>{
    let state=row.status==='passed'?'fulfilled':row.status==='observed'?'observed':row.status==='unmet'?'missing':'notStored';
    let details=row.details;
    if(row.key==='active'){
      if(historyMissing){state='uncertain';details=['Lebenszyklus nicht beurteilbar: Historie fehlt. T1 oder ein bestätigtes Ende sind damit nicht belegt.'];}
      else if(ended)state='blocked';
      else if(row.status==='unmet'){state='uncertain';details=['Entry-Suche nicht freigegeben; ein bestätigter Beendigungsgrund ist nicht gespeichert.'];}
    }else if(row.key==='time'&&row.status==='unmet')state='blocked';
    else if(row.status!=='passed'&&row.status!=='observed'){
      const signal=m1?.conditions?.[row.key] ?? m1?.[row.key];
      if(waiting){state='waiting';details=['Die M1-Auswertung war am gespeicherten Stand noch ausstehend.'];}
      else if(notChecked){state='notChecked';details=m1.details ?? ['M1-Auswertung am gespeicherten Stand nicht ausgeführt.'];}
      else if(signal&&!known(signal.recognizedAt)){state='waiting';details=['Zu diesem Prüfstand noch nicht zeitlich belegt.'];}
      else if(['m5Bos','m1PivotBreak','m1Choch','m5Choch','m1Bos'].includes(row.key)&&m1&&!Object.hasOwn(m1.conditions ?? {},row.key)){
        state='notStored';details=['Die Prüfung dieser Patternbedingung ist nicht gespeichert.'];
      }
      else if(!m1){state=ended?'notChecked':'notStored';details=[ended?'Nach dem bestätigten Ende keine weitere M1-Prüfung.':'Für diesen Punkt ist keine M1-Prüfung gespeichert.'];}
      else if(row.status==='unknown'){state='uncertain';details=['Dieser Punkt ist in der gespeicherten M1-Prüfung nicht abschließend belegt.'];}
    }
    if(row.key==='time'&&row.status==='unknown'){state='notStored';details=['Handelszeit-, Session- und News-Prüfung nicht gespeichert. Daraus folgt weder eine Sperre noch eine Freigabe.'];}
    const {label:stateLabel,...presentation}=CHECKPOINT_H_STATES[state];
    return {...row,state,details:details?.filter(Boolean) ?? [],...presentation,stateLabel};
  });
  const causality=checkpointHCandidateEvidence(snapshot,at);
  const technical=m1?.status==='error'?m1:known(snapshot.knownAt)&&snapshot.checklist?.status==='error'?snapshot.checklist
    :current.checklist?.status==='error'?current.checklist:null;
  let {state,summary}=causality;
  if(entry){state='fulfilled';summary='Entry am gespeicherten Stand belegt.';}
  else if(technical&&!causality.candidateAt){state='technical';summary='Technischer Fehler bei der gespeicherten Prüfung.';}
  else if(waiting&&!causality.candidateAt){state='waiting';summary='M1-Prüfung am gespeicherten Stand noch ausstehend.';}
  const technicalNote=technical?`Technischer Zustand am ${formatDatedTime(technical.evaluatedAt ?? snapshot.knownAt)} Uhr: ${(technical.details ?? []).filter(Boolean).join(' ')}`:'';
  let context=notChecked?(m1?.details ?? []).filter(Boolean).join(' '):'';
  if(ended)context+=' Die spätere Beendigung ist keine Erklärung für frühere Nicht-Entries. Für die Zeit davor gelten nur die gespeicherten Prüfbelege.';
  return {state,summary,causality,technicalNote,context:context.trim(),sourceAt:m1?.evaluatedAt ?? null,at:current.knownAt,rows,...CHECKPOINT_H_STATES[state]};
}
