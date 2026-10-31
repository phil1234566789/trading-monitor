import {computed,shallowReactive} from 'vue';
// Nur Entwürfe im Browser; weder Ziehen noch Tippen sendet einen Brokerauftrag.
const drafts=shallowReactive(new Map());
export function setTargetDraft(orderId,value){drafts.set(orderId,value);}
export function removeTargetDraft(orderId){drafts.delete(orderId);}
export function moveTargetDraft(orderId,index,price){
 const value=drafts.get(orderId);if(!value||!Number.isFinite(price)||price<=0)return;
 const rounded=Number.isInteger(value.digits)?Number(price.toFixed(value.digits)):price;
 const targets=value.targets.map((t,i)=>i===index?{...t,price:rounded}:t);
 drafts.set(orderId,{...value,targets,dirty:true});
}
export function useTargetDraft(orderId){return computed(()=>drafts.get(orderId));}
export function targetDraftLines(symbol){
 return [...drafts.entries()].filter(([,d])=>d.symbol===symbol).flatMap(([orderId,d])=>d.targets.flatMap((target,index)=>Number.isFinite(Number(target.price))&&Number(target.price)>0?[{
  orderId,index,price:Number(target.price),entryTime:d.entryTime,entryPrice:d.entryPrice,initialSl:d.initialSl,
  direction:d.direction,label:`TP ${index+1} · ${d.dirty?'Entwurf':'gespeichert'} · ${target.volume??'—'} Lot`,
 }]:[]));
}
