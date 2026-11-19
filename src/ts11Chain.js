import {currentTradeSetup11Range} from './tradeSetup11Ownership.js';

// TS1.1-Kette (Wurzel = Tiefe 0 … innerste Ebene) zum Zeitpunkt at; Chart-Debugger und Hauptchart lesen dieselbe Kette.
export function ts11ChainAt(resolve,closeReactionCache,at){
 const context=resolve(at);
 if(context.status!=='ready')return {status:context.status,reason:context.reason,links:[],current:null,key:`${context.status}:${context.reason}`};
 const point=p=>p&&{price:p.price,pivotTime:p.pivotTime};
 const links=context.chain.map((s,depth)=>({depth,trend:s.trend,low:point(s.currRange.low),high:point(s.currRange.high)}));
 const c=currentTradeSetup11Range(context,closeReactionCache);
 const current=c&&{depth:c.depth,trend:c.trend,basis:c.basis??null,low:point(c.low),high:point(c.high),
  originTime:c.confirmation?.originTime??null,recognizedAt:c.confirmation?.recognizedAt??c.knownAt??null};
 return {status:'ready',links,current,key:JSON.stringify([links,current])};
}

// Jede Ebene als Zickzack-Schenkel vom älteren zum jüngeren Grenzpivot (Philip: Linien statt Kästen).
export function ts11LevelLegs(chain){
 if(chain?.status!=='ready')return [];
 const same=(a,b)=>a?.high?.price===b?.high?.price&&a?.low?.price===b?.low?.price;
 const levels=[...chain.links.filter(l=>!same(l,chain.current)),...(chain.current?[{...chain.current,current:true}]:[])];
 return levels.filter(l=>l.low&&l.high).map(l=>({depth:l.depth,trend:l.trend,
  points:[l.low,l.high].sort((a,b)=>a.pivotTime-b.pivotTime),
  label:`T${l.depth} ${l.trend==='uptrend'?'↑':l.trend==='downtrend'?'↓':'?'}${l.depth===0?' Wurzel':''}${l.current?' aktuell':''}`}));
}
