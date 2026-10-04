import {tradeSetup2Positions} from './tradeSetup2Positions.js';
import {dealingRangeLabel} from './tradeSetup2DealingRange.js';

// Kandidaten und Ausführungen teilen sich die Anzeigegrenze. Ein späterer Entry
// ersetzt die Idee erst ab seiner Erkennung, auch beim Zurückspulen.
export function tradeSetup2HistoryItems(results,candidates,options) {
  const entries=tradeSetup2Positions(results,{...options,historyCount:Number.MAX_SAFE_INTEGER})
    .map(p=>({...p,kind:'entry',sortTime:p.entryTime,labelTime:p.entryTime,timeLabel:'Entry'}));
  const bySetup=new Map();
  for(const c of candidates) {
    if(c.instrument!==options.instrument||c.knownAt>options.asOf)continue;
    const key=c.setupKey ?? c.id,previous=bySetup.get(key);
    if(previous&&previous.sortTime>=c.knownAt)continue;
    const primary=c.snapshot?.checklist?.setup?.primary;
    // Der Tageslauf speichert auch ältere Sweeps um Mitternacht. Ihre Anzeigezeit
    // darf weder die Snapshot-Sichtbarkeit noch die Historienreihenfolge verändern.
    const sweepKnown=Number.isFinite(primary?.recognizedAt)&&primary.recognizedAt<=c.knownAt;
    const bounds=[];
    if(Number.isFinite(primary?.invalidation)&&primary.reactionRecognizedAt<=options.asOf)
      bounds.push({price:primary.invalidation,label:'Invalidierung',styleKey:'tradeLoss'});
    const selection=primary?.targetSelection;
    if(selection?.status==='passed'&&selection.selectedAt<=options.asOf)
      for(const [name,label] of [['target1','T1'],['target2','T2']])
        if(Number.isFinite(selection[name]?.price))bounds.push({price:selection[name].price,label,styleKey:'tradeWin'});
    const lifecycle=primary?.lifecycle?.main ?? primary?.validity;
    const ended=lifecycle?.state==='ended'&&lifecycle.recognizedAt<=options.asOf;
    const reason={invalidation:'Invalidation vor T1',target1:'T1 vor Invalidation',both:'beendet, Reihenfolge unklar'}[lifecycle?.reason] ?? 'beendet';
    bySetup.set(key,{id:`setup2:${c.runId}:${c.id}:candidate`,snapshotId:c.id,setupKey:key,runId:c.runId,
      instrument:c.instrument,direction:c.direction,kind:'candidate',sortTime:c.knownAt,
      labelTime:sweepKnown?primary.recognizedAt:c.knownAt,timeLabel:sweepKnown?'Sweep':'Stand',
      sweepPrice:Number.isFinite(primary?.sweep?.level?.price)?primary.sweep.level.price:null,
      isOpen:false,candidateStatus:`ohne Entry · ${dealingRangeLabel(c.snapshot ?? c)}${ended?' · Marktidee '+reason:''}`,bounds,
      fromTime:c.knownAt-60,toTime:Math.min(c.knownAt+1800,options.asOf-60)});
  }
  for(const entry of entries) {
    const key=entry.setupKey ?? entry.snapshotId,previous=bySetup.get(key);
    if(previous?.kind==='entry'&&previous.sortTime>=entry.sortTime)continue;
    bySetup.set(key,entry);
  }
  const limit=Math.max(0,Math.floor(options.historyCount ?? 5));
  return ['long','short'].flatMap(direction=>[...bySetup.values()].filter(p=>p.direction===direction)
    .sort((a,b)=>b.sortTime-a.sortTime).slice(0,limit));
}
