import {currentM5StructureRange} from './m5StructureContext.js';

// LS-Reaktion-Kette (Wurzel = Tiefe 0 … innerste Ebene) zum Zeitpunkt at; Chart-Debugger und Hauptchart lesen dieselbe Kette.
export function lsReactionChainAt(resolve,closeReactionCache,at){
 const context=resolve(at);
 if(context.status!=='ready')return {status:context.status,reason:context.reason,links:[],current:null,key:`${context.status}:${context.reason}`};
 const point=p=>p&&{price:p.price,pivotTime:p.pivotTime};
 const links=context.chain.map((s,depth)=>({depth,trend:s.trend,low:point(s.currRange.low),high:point(s.currRange.high)}));
 const c=currentM5StructureRange(context,closeReactionCache);
 const current=c&&{depth:c.depth,trend:c.trend,basis:c.basis??null,low:point(c.low),high:point(c.high),
  originTime:c.confirmation?.originTime??null,recognizedAt:c.confirmation?.recognizedAt??c.knownAt??null};
 return {status:'ready',links,current,key:JSON.stringify([links,current])};
}

// Jede Ebene als Zeitband ab ihrem älteren Grenzpivot bis zum Start der nächsten Ebene (Philip: Bänder wie in der Skizze).
export function lsReactionLevelBands(chain,endTime){
 if(chain?.status!=='ready')return [];
 const same=(a,b)=>a?.high?.price===b?.high?.price&&a?.low?.price===b?.low?.price;
 const levels=[...chain.links.filter(l=>!same(l,chain.current)),...(chain.current?[{...chain.current,current:true}]:[])]
  .filter(l=>l.low&&l.high).map(l=>({...l,start:Math.min(l.low.pivotTime,l.high.pivotTime)}));
 return levels.map((l,i)=>({depth:l.depth,trend:l.trend,from:l.start,to:Math.max(l.start,levels[i+1]?.start??endTime),
  label:`${l.depth===0?'WURZEL':'T'+l.depth} ${l.trend==='uptrend'?'↑':l.trend==='downtrend'?'↓':'?'}${l.current?' · aktuell':''}`}));
}
