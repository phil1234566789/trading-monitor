import { closedChecklistCandles } from './tradeSetupChecklistTimeBasis.js';
export const COUNTERTREND_RANGE_COURSE_VERSION='countertrend-validation-t1-be-t2-v2';

export function countertrendRangeCourse(candidate) {
  if (!candidate?.lifecycle || candidate.targetSelection?.status!=='passed') return null;
  const selection=candidate.targetSelection;
  return {version:COUNTERTREND_RANGE_COURSE_VERSION,setupKey:candidate.id,validatedAt:candidate.recognizedAt,
    direction:candidate.direction,selectedAt:selection.selectedAt,target1:selection.target1.price,
    target2:selection.target2?.price ?? null,invalidation:candidate.invalidation,source:'FXCM Bid M5/M1',lifecycle:candidate.lifecycle};
}

export function countertrendLifecycleEnd({ invalid, target1, target2, hasTarget2, entries = [] }) {
  if (invalid) return 'invalidation';
  if (target1 && (!hasTarget2 || entries.length === 0)) return 'target1';
  if (target2) return 'target2';
  if (!target1) return null;
  if (entries.every(e => e.status === 'closed')) return 'entriesClosed';
  return null;
}

/** T1 sperrt neue Entries, beendet eine DR mit offenen Restpositionen aber noch nicht. */
export function evaluateCountertrendLifecycle({ selection, invalidation, candles, evaluatedAt, entries = [], m1Candles = [], progress }) {
  let main = { state: 'unknown', reason: 'missingSelection', endedAt: null, recognizedAt: null };
  let result = { main, target1: { status: 'open', hitAt: null, recognizedAt: null },
    target2: { status: selection?.target2 ? 'open' : 'notApplicable', hitAt: null, recognizedAt: null },
    events: [], entrySearchAllowed: false, evaluatedAt };
  if (selection?.status !== 'passed' || !selection.target1 || !Number.isFinite(invalidation)) return result;
  main.state = 'active'; main.reason = null; result.entrySearchAllowed = true;
  // Bei Erkennung mitten in einer Kerze darf deren bereits vergangener Docht kein Ende auslösen.
  const minuteStart=Math.ceil(selection.selectedAt/60)*60;
  const minutes=closedChecklistCandles(m1Candles,'1m',evaluatedAt).filter(c=>c.time>=minuteStart);
  const duration=minutes[0]?.time===minuteStart ? 60 : 300;
  const key=JSON.stringify([selection,invalidation,duration]);
  // Nachgelieferte historische Entries können das damalige T1-Ende ändern; dann neu beginnen.
  const previous=progress?.key===key && progress.at<=evaluatedAt && progress.result
    && !entries.some(e=>!progress.entryTimes.includes(e.entryTime) && e.entryTime<progress.at) ? progress : null;
  if(previous){result=structuredClone(previous.result);result.evaluatedAt=evaluatedAt;main=result.main;}
  let next=previous?.next ?? Math.ceil(selection.selectedAt/duration)*duration;
  const save=()=>{
    if(progress){progress.key=key;progress.at=evaluatedAt;progress.next=next;progress.entryTimes=entries.map(e=>e.entryTime);
      progress.result=main.state==='unknown'?null:structuredClone(result);}
    return result;
  };
  if(main.state==='ended')return save();
  const rows=duration===60 ? minutes : closedChecklistCandles(candles,'5m',evaluatedAt).filter(c=>c.time>=next);
  const short = selection.direction === 'short';
  const touches = (c, price, favorable) => Number.isFinite(price)
    && (favorable === short ? c.low <= price : c.high >= price);
  for (const c of rows) {
    if(c.time<next)continue;
    if (c.time !== next || ![c.high,c.low].every(Number.isFinite)) {
      main.state = 'unknown'; main.reason = 'missingHistory'; result.entrySearchAllowed = false; return save();
    }
    next += duration;
    if(progress)progress.processed=(progress.processed ?? 0)+1;
    if (c.ignored) continue;
    const invalid = touches(c,invalidation,false);
    const t1 = touches(c,selection.target1.price,true);
    const t2 = touches(c,selection.target2?.price,true);
    if (t1 && result.target1.hitAt == null) {
      result.target1={status:'reached',hitAt:c.time,recognizedAt:next};
      result.events.push({type:'target1',time:c.time,recognizedAt:next}); result.entrySearchAllowed=false;
    }
    if (t2) result.target2={status:invalid?'unknown':'reached',hitAt:invalid?null:c.time,recognizedAt:next};
    // Spätere Entry-Ausgänge dürfen den historischen M5-Präfix nicht rückwirkend beenden.
    const knownEntries = entries.filter(e => e.entryTime <= next).map(e => e.exitRecognizedAt <= next ? e : {...e,status:'open'});
    const reason = invalid && (t1 || t2) ? 'both' : countertrendLifecycleEnd({invalid,target1:result.target1.hitAt!=null,target2:t2,
      hasTarget2:!!selection.target2,entries:knownEntries});
    if (reason) {
      const last=reason==='entriesClosed' ? knownEntries.reduce((a,b)=>a.exitRecognizedAt>b.exitRecognizedAt?a:b) : null;
      Object.assign(main,{state:'ended',reason,endedAt:last?.exitTime ?? c.time,recognizedAt:last?.exitRecognizedAt ?? next});
      if (reason==='both') main.ambiguous=true;
      result.entrySearchAllowed=false; return save();
    }
  }
  if (next < Math.floor(evaluatedAt/duration)*duration) { main.state='unknown'; main.reason='missingHistory'; result.entrySearchAllowed=false; }
  const entryT1=entries.filter(e=>Number.isFinite(e.t1RecognizedAt) && e.t1RecognizedAt<=evaluatedAt)
    .sort((a,b)=>a.t1RecognizedAt-b.t1RecognizedAt)[0];
  if (entryT1 && result.target1.hitAt==null) {
    result.target1={status:'reached',hitAt:entryT1.t1Time,recognizedAt:entryT1.t1RecognizedAt};
    result.events.push({type:'target1',time:entryT1.t1Time,recognizedAt:entryT1.t1RecognizedAt});
    result.entrySearchAllowed=false;
    if (!selection.target2) Object.assign(main,{state:'ended',reason:'target1',endedAt:entryT1.t1Time,recognizedAt:entryT1.t1RecognizedAt});
  }
  // BE kann zwischen zwei M5-Schlüssen liegen; die bestehende M1-Simulation liefert den Beleg.
  if (main.state==='active' && result.target1.hitAt!=null && entries.length && entries.every(e=>e.status==='closed' && e.exitRecognizedAt<=evaluatedAt)) {
    const last=entries.reduce((a,b)=>a.exitRecognizedAt>b.exitRecognizedAt?a:b);
    Object.assign(main,{state:'ended',reason:'entriesClosed',endedAt:last.exitTime,recognizedAt:last.exitRecognizedAt});
  }
  return save();
}
