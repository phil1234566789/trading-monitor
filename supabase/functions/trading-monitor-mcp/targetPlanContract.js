const positive=n=>typeof n==='number'&&Number.isFinite(n)&&n>0;
const round=n=>Number(n.toFixed(10));
export function positionRiskBasis(direction,entry,stop){
 return positive(entry)&&positive(stop)&&(direction==='long'?stop<entry:stop>entry)?stop:null;
}
export function positionRiskMultiple(direction,entry,price,basisSl){
 const risk=positive(entry)&&positive(basisSl)?Math.abs(entry-basisSl):0;
 return risk>0&&positive(price)?(direction==='long'?price-entry:entry-price)/risk:null;
}
export function targetDraftAllocation(drafts,volume,step) {
 if(!positive(volume)||!positive(step))return {targets:[],remainder:null};
 const targets=drafts.map(t=>({price:Number(t.price),volume:t.percent==null?Number(t.volume):round(Math.floor((volume*Number(t.percent)/100+1e-12)/step)*step)}));
 return {targets,remainder:round(volume-targets.reduce((n,t)=>n+t.volume,0))};
}
export function validateTargetAllocation(targets,position,quote,entry,initialSl) {
 if(!Array.isArray(targets)||targets.length<1||targets.length>5)throw new Error('invalid_target_count');
 if(![position?.volume,quote?.minimum_volume,quote?.volume_step,quote?.maximum_volume,entry].every(positive))throw new Error('target_specs_unavailable');
 // Ein manueller Trade ohne SL darf seine TPs verwalten; der vorhandene SL wird niemals verändert.
 if(typeof position.sl!=='number'||!Number.isFinite(position.sl)||position.sl<0)throw new Error('invalid_position_stop');
 const step=quote.volume_step,min=quote.minimum_volume,max=quote.maximum_volume;
 const units=v=>Math.abs(v/step-Math.round(v/step))<1e-7;
 if(!units(position.volume))throw new Error('invalid_position_volume');
 const long=position.type===0,distance=Math.max(quote.stops_level??0,quote.point??0),reference=long?quote.bid:quote.ask;
 const risk=initialSl==null?null:Math.abs(entry-initialSl);
 if(!positive(reference)||(risk!==null&&!positive(risk)))throw new Error('invalid_target_basis');
 let total=0;
 const values=targets.map(t=>{
  if(!t||Object.keys(t).some(k=>!['price','volume'].includes(k))||!positive(t.volume)||t.volume<min-1e-10||t.volume>max||!units(t.volume))throw new Error('invalid_target_volume');
  if(!positive(t.price)||(long?t.price<=Math.max(entry,reference+distance):t.price>=Math.min(entry,reference-distance)))throw new Error('invalid_target_price');
  if(positive(quote.point)&&Math.abs(t.price/quote.point-Math.round(t.price/quote.point))>1e-6)throw new Error('invalid_target_precision');
  total+=t.volume;
  return {price:t.price,volume:t.volume,rr:positionRiskMultiple(long?'long':'short',entry,t.price,initialSl)};
 }).sort((a,b)=>long?a.price-b.price:b.price-a.price);
 const remainder=round(position.volume-total);
 if(remainder<0)throw new Error('target_volume_exceeds_position');
 if(remainder>0&&(remainder<min-1e-10||!units(remainder)))throw new Error('invalid_remaining_volume');
 return {targets:values,remainder,native_tp:values.length===1&&remainder===0?values[0].price:0};
}
