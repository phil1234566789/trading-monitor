import {liveMonthBounds,liveMonthGroups,liveSourceMonth,liveSourceMode,liveEventMode} from './liveWatcherMonth.js';

export function liveWatcherRun(option) {
  const month=liveSourceMonth(option.id),{from,to}=liveMonthBounds(month);
  return {id:option.id,source:'live-watcher',status:'live',from:Date.parse(from)/1000,to:Date.parse(to)/1000,
    evaluationMode:liveSourceMode(option.id),configuration:{label:option.label ?? `${liveSourceMode(option.id)==='catchup'?'Nachholerkennung':'Live-Watcher'} · ${new Intl.DateTimeFormat('de-DE',{month:'long',year:'numeric',timeZone:'Europe/Berlin'}).format(new Date(from))}`} ,provenance:{source:liveSourceMode(option.id)==='catchup'?'Gespeicherte Nachholerkennung':'Gespeicherte Live-Watcher-Belege',limitations:[
      'Originalstände mit Quelle und Speicherzeit; ältere Alarmbelege können unvollständig sein.',
      'Fehlende Originaldaten und Entry-Ergebnisse bleiben ausdrücklich unbekannt; keine nachträgliche Monatsberechnung.']}};
}
export function liveWatcherSnapshots(events,runId) {
  return liveMonthGroups(events.filter(event=>liveEventMode(event)===liveSourceMode(runId)),liveSourceMonth(runId)).flatMap(group=>{
    const through=Math.max(...group.events.map(event=>Date.parse(event.signal_at)/1000));
    const snapshots=group.events.filter(event=>event.stage!==3).concat(group.entries).map(event=>{
      const entry=event.stage===3?event.payload.entry:null;
      return {id:entry?.id ?? event.id,runId,source:'live-watcher',observationOnly:true,
        instrument:group.instrument,direction:group.direction,setupKey:group.setupKey,
        knownAt:entry?.recognizedAt ?? Date.parse(event.signal_at)/1000,entry,
        evaluationMode:liveEventMode(event),liveObservedThrough:through,liveEventId:event.id,liveObservation:event.payload,
        liveDetectedAt:Date.parse(event.detected_at)/1000,liveMissedReason:event.missed_reason ?? null,
        evidence:entry?entryEvidence(entry):[]};
    });
    return snapshots;
  });
}
function entryEvidence(entry) {
  const ob=entry.conditions?.retest?.orderBlock;
  return ob && [ob.startTime,ob.top,ob.bottom].every(Number.isFinite)?[{
    kind:'zone',role:'entryOrderBlock',timeframe:'5m',knownAt:entry.recognizedAt,
    fromTime:ob.startTime,toTime:entry.recognizedAt,top:ob.top,bottom:ob.bottom,
    styleKey:entry.direction==='long'?'obBullM5':'obBearM5',label:'Gespeicherter Entry-OB'}]:[];
}
export function liveWatcherEntryResults(snapshot) {
  if(!snapshot.entry)return [];
  const variants=snapshot.liveObservation.variants ?? [];
  return ['wide','narrow'].map(variant=>{
    const sizing=variants.find(row=>row.variant===variant) ?? {};
    // Ausführbare Größe ist kein gespeicherter Exit, Gewinn oder noch offener Trade.
    return {...sizing,runId:snapshot.runId,snapshotId:snapshot.id,setupKey:snapshot.setupKey,
      instrument:snapshot.instrument,direction:snapshot.direction,entryId:snapshot.entry.id,
      entryTime:snapshot.entry.recognizedAt,entryPrice:snapshot.entry.price,stopPrice:sizing.stopPrice ?? snapshot.entry.stops?.[variant]?.price ?? null,variant,
      evaluatedAt:snapshot.knownAt,status:'notStored',outcome:null,reason:'resultNotStored',
      netPnlUsd:null,pnlUsd:null,rMultiple:null,netRMultiple:null,commissionUsd:null};
  });
}
