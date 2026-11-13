import {positionRiskMultiple,targetDraftAllocation} from './targetPlanContract.js';
const positive=n=>typeof n==='number'&&Number.isFinite(n)&&n>0;
const round=n=>Number(n.toFixed(10));

export function stopDraftAllocation(drafts,volume,quote,direction){
 const result=targetDraftAllocation(drafts,volume,quote?.volume_step);
 const percentTotal=drafts.reduce((n,s)=>n+Number(s.percent),0);
 if(result.remainder>0&&drafts.length&&drafts.every(s=>s.percent!=null)&&Math.abs(percentTotal-100)<1e-7){
  const outer=drafts.reduce((chosen,s,index)=>direction==='long'?(Number(s.price)<=Number(drafts[chosen].price)?index:chosen):(Number(s.price)>=Number(drafts[chosen].price)?index:chosen),0);
  result.targets[outer].volume=round(result.targets[outer].volume+result.remainder);result.remainder=0;
 }
 return result;
}

export function validateStopAllocation(stops,position,quote,entry,basisSl){
 if(!Array.isArray(stops)||!stops.length||stops.length>5)throw new Error('invalid_stop_count');
 if(![position?.volume,quote?.minimum_volume,quote?.volume_step,quote?.maximum_volume,quote?.point,entry].every(positive))throw new Error('target_specs_unavailable');
 const {minimum_volume:min,volume_step:step,maximum_volume:max,point}=quote;
 const units=v=>Math.abs(v/step-Math.round(v/step))<1e-7;
 if(!units(position.volume))throw new Error('invalid_position_volume');
 const long=position.type===0,reference=long?quote.bid:quote.ask,distance=Math.max(point,quote.stops_level??0);
 if(!positive(reference))throw new Error('invalid_stop_basis');
 let total=0;
 const values=stops.map(s=>{
  if(!s||Object.keys(s).some(k=>!['price','volume'].includes(k))||!positive(s.volume)||s.volume<min-1e-10||s.volume>max||!units(s.volume))throw new Error('invalid_stop_volume');
  if(!positive(s.price)||(long?s.price>=reference-distance:s.price<=reference+distance))throw new Error('invalid_stop_price');
  if(Math.abs(s.price/point-Math.round(s.price/point))>1e-6)throw new Error('invalid_stop_precision');
  total+=s.volume;
  return {price:s.price,volume:s.volume,rr:positionRiskMultiple(long?'long':'short',entry,s.price,basisSl)};
 }).sort((a,b)=>long?b.price-a.price:a.price-b.price);
 // Jede Restmenge bleibt am äußersten nativen SL abgesichert, keine stillschweigend ungeschützten Lots.
 if(Math.abs(round(position.volume-total))>1e-8)throw new Error('stop_volume_must_cover_position');
 return {stops:values,native_sl:values.at(-1).price};
}

export function rescaleExitLeg(levels,remainingVolume,previousVolume,step,minimum){
 if(![remainingVolume,previousVolume,step,minimum].every(positive))return [];
 const covered=Math.min(remainingVolume,round(Math.floor((levels.reduce((n,l)=>n+l.volume,0)/previousVolume*remainingVolume+1e-9)/step)*step));
 let used=0;const result=[];
 for(const [index,level] of levels.entries()){
  let volume=index===levels.length-1?round(covered-used):round(Math.floor((level.volume/previousVolume*remainingVolume+1e-9)/step)*step);
  if(index===levels.length-1)while(volume<minimum-1e-9&&result.length){const previous=result.pop();used=round(used-previous.volume);volume=round(covered-used);}
  if(volume>=minimum-1e-9){result.push({...level,volume});used=round(used+volume);}
 }
 return result;
}
