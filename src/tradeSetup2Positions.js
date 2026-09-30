// Übersicht und Journalrenderer verwenden dasselbe Anzeigeformat. Simulationen
// bekommen eigene IDs und werden nicht zu Journal-Ausführungen umgedeutet.
export function tradeSetup2Positions(results, {instrument,variant,asOf,historyCount=5,candles=[]}) {
  const known=results.filter(r=>r.instrument===instrument && r.variant===variant && r.entryTime<=asOf
    && r.status!=='notExecutable');
  const limit=Math.max(0,Math.floor(historyCount));
  const selected=['long','short'].flatMap(direction=>known.filter(r=>r.direction===direction)
    .sort((a,b)=>b.entryTime-a.entryTime).slice(0,limit));
  return selected.map(r=>{
    const closed=Number.isFinite(r.exitRecognizedAt) && r.exitRecognizedAt<=asOf;
    const ambiguous=r.status==='ambiguous' && Number.isFinite(r.ambiguityRecognizedAt) && r.ambiguityRecognizedAt<=asOf;
    const checkedThrough=Math.min(asOf,r.evaluatedAt ?? asOf);
    const last=ambiguous?null:candles.findLast(c=>c.time<checkedThrough && c.time>=r.entryTime);
    const t1Known=Number.isFinite(r.t1RecognizedAt) && r.t1RecognizedAt<=asOf;
    return {id:`setup2:${r.runId}:${r.entryId}:${r.variant}`,snapshotId:r.snapshotId ?? r.entryId,runId:r.runId,
      setupKey:r.setupKey,instrument:r.instrument,direction:r.direction,entryTime:r.entryTime,entryPrice:r.entryPrice,
      exitTime:closed?r.exitTime:last?.time ?? null,exitPrice:closed?r.exitPrice:last?.close ?? null,
      outcome:closed?(r.pnlUsd>0?'win':r.pnlUsd<0?'loss':'open'):'open',
      isOpen:!closed&&!ambiguous,status:closed?r.status:ambiguous?'ambiguous':'open',variant:r.variant,
      t1Time:t1Known?r.t1Time:null,t1Price:t1Known?r.target1Price ?? r.t1Price:null,
      evaluatedAt:checkedThrough,actualRisk:r.actualRisk,lots:r.lots,pnlUsd:closed?r.pnlUsd:null};
  });
}
