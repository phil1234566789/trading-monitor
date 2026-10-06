import { candleTouchesOrderBlock, candleInvalidatesOrderBlock } from './orderBlockDetection.js';
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
  // Der Fensterbeginn ist keine Wiedergeburt: frühere Mitigationen zählen ab knownAt.
  const rows=closedChecklistCandles(m1Candles,'1m',evaluatedAt),start=Math.ceil(orderBlock.recognizedAt/60)*60;
  const key=JSON.stringify([start,fromTime,orderBlock.dir,orderBlock.startTime,orderBlock.recognizedAt,orderBlock.top,orderBlock.bottom]);
  const valid=progress.key===key && !progress.invalid && progress.at<=evaluatedAt
    && progress.first===rows[0]?.time && progress.count<=rows.length && progress.last===rows[progress.count-1]?.time;
  if(!valid)Object.assign(progress,{key,at:-Infinity,first:rows[0]?.time,count:0,last:null,next:start,retest:null,fvg:null,invalid:false,excluded:false});
  // Spätere M5-Statusflags dürfen den gültigen ersten M1-Beleg nicht rückwirkend entwerten.
  const result=()=>progress.excluded ? {status:'ready',retest:null,fvg:null} : {status:'ready',
    retest:progress.retest?{...progress.retest,orderBlock:{...orderBlock,touched:true,invalidated:false,retested:false,retestedAt:null,endTime:progress.retest.candleTime}}:null,fvg:progress.fvg};
  if(progress.fvg || progress.excluded)return result();
  for(let i=progress.count;i<rows.length;i++){
    const c=rows[i];
    if(c.time>=start){
      if(c.time!==progress.next){progress.invalid=true;return empty;}
      progress.next+=60;
      // Wick-Durchbruch gilt auch zwischen erstem Kontakt und FVG-Schluss.
      if(!c.ignored && candleInvalidatesOrderBlock(c,orderBlock)){
        progress.excluded=true;progress.at=evaluatedAt;return result();
      }
      if(!progress.retest && !c.ignored && c.time>=orderBlock.recognizedAt && candleTouchesOrderBlock(c,orderBlock))
        progress.retest={candleTime:c.time,recognizedAt:c.time+60};
      const fvg=progress.retest && orderBlockMitigationFvg(rows.slice(Math.max(0,i-3),i+1),orderBlock.dir===-1?'short':'long');
      // Ein OB liefert genau eine Mitigation. Weitere FVGs oder Retests ersetzen sie nicht.
      if(fvg && fvg.recognizedAt>progress.retest.recognizedAt){
        progress.fvg=fvg;
        progress.excluded=fvg.recognizedAt<fromTime;
      }
      progress.processed=(progress.processed ?? 0)+1;
    }
    progress.count=i+1;progress.last=c.time;
    if(progress.fvg)break;
  }
  progress.at=evaluatedAt;
  if(!progress.fvg && progress.next<Math.floor(evaluatedAt/60)*60){progress.invalid=true;return empty;}
  return result();
}
