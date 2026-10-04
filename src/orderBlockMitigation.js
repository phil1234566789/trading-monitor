import { candleTouchesOrderBlock } from './orderBlockDetection.js';
import { closedChecklistCandles } from './tradeSetupChecklistTimeBasis.js';

export function orderBlockMitigationFvg(rows,direction,end=rows.length,start=0) {
  const window=rows.slice(Math.max(start,end-4),end);
  if(window.length!==4 || window.some((c,i)=>c.ignored || (i && c.time!==window[i-1].time+60)))return null;
  const [,first,impulse,last]=window;
  const gap=direction==='short'?first.low-last.high:last.low-first.high;
  return gap>1e-9 ? {direction,candleTime:impulse.time,recognizedAt:last.time+60,gap} : null;
}

// Der OB kann aus jedem TF stammen; die Mitigation wird immer im M1 bestätigt.
export function evaluateOrderBlockMitigation({orderBlock,m1Candles,fromTime,evaluatedAt,progress={}}) {
  const empty={status:'unknown',retest:null,fvg:null};
  if(![-1,1].includes(orderBlock?.dir) || !Number.isFinite(orderBlock.recognizedAt)
    || !Number.isFinite(fromTime) || !Number.isFinite(evaluatedAt))return empty;
  const rows=closedChecklistCandles(m1Candles,'1m',evaluatedAt),start=Math.ceil(fromTime/60)*60;
  const key=JSON.stringify([start,orderBlock.dir,orderBlock.startTime,orderBlock.recognizedAt,orderBlock.top,orderBlock.bottom]);
  const valid=progress.key===key && !progress.invalid && progress.at<=evaluatedAt
    && progress.first===rows[0]?.time && progress.count<=rows.length && progress.last===rows[progress.count-1]?.time;
  if(!valid)Object.assign(progress,{key,at:-Infinity,first:rows[0]?.time,count:0,last:null,next:start,retest:null,fvg:null,invalid:false});
  if(progress.fvg)return {status:'ready',retest:{...progress.retest,orderBlock},fvg:progress.fvg};
  for(let i=progress.count;i<rows.length;i++){
    const c=rows[i];
    if(c.time>=start){
      if(c.time!==progress.next){progress.invalid=true;return empty;}
      progress.next+=60;
      if(!progress.retest && !c.ignored && c.time>=orderBlock.recognizedAt && candleTouchesOrderBlock(c,orderBlock))
        progress.retest={candleTime:c.time,recognizedAt:c.time+60};
      const fvg=progress.retest && orderBlockMitigationFvg(rows.slice(Math.max(0,i-3),i+1),orderBlock.dir===-1?'short':'long');
      // Ein OB liefert genau eine Mitigation. Weitere FVGs oder Retests ersetzen sie nicht.
      if(fvg && fvg.recognizedAt>progress.retest.recognizedAt)progress.fvg=fvg;
      progress.processed=(progress.processed ?? 0)+1;
    }
    progress.count=i+1;progress.last=c.time;
    if(progress.fvg)break;
  }
  progress.at=evaluatedAt;
  if(!progress.fvg && progress.next<Math.floor(evaluatedAt/60)*60){progress.invalid=true;return empty;}
  return {status:'ready',retest:progress.retest?{...progress.retest,orderBlock}:null,fvg:progress.fvg};
}
