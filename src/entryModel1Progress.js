import { candleTouchesOrderBlock } from './orderBlockDetection.js';

export function entryModel1FvgAt(rows,direction) {
  const window=rows.slice(-4);
  if(window.length!==4 || window.some((c,i)=>c.ignored || (i && c.time!==window[i-1].time+60)))return null;
  const [,first,impulse,last]=window;
  const gap=direction==='short'?first.low-last.high:last.low-first.high;
  // Entry-FVG hat keine Pip-Mindestgröße; der allgemeine OB-Filter bleibt unabhängig.
  return gap>1e-9 ? {direction,candleTime:impulse.time,recognizedAt:last.time+60,gap} : null;
}

export function advanceEntryModel1Follow(rows,orderBlocks,confirmedAt,direction,evaluatedAt,progress) {
  const start=Math.ceil(confirmedAt/60)*60;
  const valid=progress.start===start && progress.direction===direction && progress.at<=evaluatedAt
    && progress.first===rows[0]?.time && progress.count<=rows.length && progress.last===rows[progress.count-1]?.time;
  if(!valid)Object.assign(progress,{start,direction,at:-Infinity,first:rows[0]?.time,count:0,last:null,
    next:start,touches:new Map(),latestFvg:null});
  const fresh=rows.filter(c=>c.time>=start && c.time+60>progress.at);
  if(fresh.some((c,i)=>c.time!==progress.next+i*60)
    || progress.next+fresh.length*60<Math.floor(evaluatedAt/60)*60){progress.at=Infinity;return {status:'unknown',retest:null,fvg:null};}
  for(const ob of orderBlocks){
    const key=`${ob.dir}:${ob.startTime}`;
    if(!progress.touches.get(key)){
      const search=progress.touches.has(key)?fresh:rows.filter(c=>c.time>=start);
      const touch=search.find(c=>!c.ignored && c.time>=ob.recognizedAt && candleTouchesOrderBlock(c,ob));
      progress.touches.set(key,touch?{candleTime:touch.time,recognizedAt:touch.time+60}:null);
    }
  }
  for(let i=0;i<rows.length;i++)if(rows[i].time>=start && rows[i].time+60>progress.at){
    const fvg=entryModel1FvgAt(rows.slice(Math.max(0,i-3),i+1),direction);
    if(fvg)progress.latestFvg=fvg;
    progress.processed=(progress.processed ?? 0)+1;
  }
  progress.at=evaluatedAt;progress.count=rows.length;progress.last=rows.at(-1)?.time;progress.next+=fresh.length*60;
  const retests=orderBlocks.flatMap(ob=>{
    const touch=progress.touches.get(`${ob.dir}:${ob.startTime}`);return touch?[{...touch,orderBlock:ob}]:[];
  }).sort((a,b)=>a.recognizedAt-b.recognizedAt || a.orderBlock.startTime-b.orderBlock.startTime);
  const fvg=progress.latestFvg,retest=fvg && retests.find(r=>r.recognizedAt<fvg.recognizedAt);
  return {status:'ready',retest:retest ?? retests.at(-1) ?? null,fvg:retest?fvg:null};
}
