import { evaluateOrderBlockMitigation } from './orderBlockMitigation.js';
export { orderBlockMitigationFvg as entryModel1FvgAt } from './orderBlockMitigation.js';

export function advanceEntryModel1Follow(rows,orderBlocks,confirmedAt,direction,evaluatedAt,progress={}) {
  const states=progress.mitigations ??= new Map();
  const results=orderBlocks.filter(ob=>ob.dir===(direction==='short'?-1:1)).map(orderBlock=>{
    const key=`${orderBlock.dir}:${orderBlock.startTime}`;
    if(!states.has(key))states.set(key,{});
    return evaluateOrderBlockMitigation({orderBlock,m1Candles:rows,fromTime:confirmedAt,evaluatedAt,progress:states.get(key)});
  });
  const complete=results.filter(r=>r.fvg).sort((a,b)=>a.fvg.recognizedAt-b.fvg.recognizedAt
    || b.retest.orderBlock.recognizedAt-a.retest.orderBlock.recognizedAt);
  let latest=null;
  // Ein älterer OB darf später erstmals berührt werden; frühere Kontakte bleiben
  // im Mitigationshelfer erhalten. Ein zeitgleicher Kontakt zählt nicht als „nach“.
  for(const mitigation of complete)if(!latest || mitigation.retest.candleTime>latest.fvg.recognizedAt)latest=mitigation;
  return latest ?? {status:results.some(r=>r.status==='unknown')?'unknown':'ready',
    retest:results.filter(r=>r.retest).sort((a,b)=>a.retest.recognizedAt-b.retest.recognizedAt).at(-1)?.retest ?? null,fvg:null};
}
