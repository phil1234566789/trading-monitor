import {computed,shallowReactive,toValue} from 'vue';
import {targetShares,splitTargetShares,redistributeTargetShares} from './mmtTargetShares.js';
// Nur Entwürfe im Browser; weder Ziehen noch Tippen sendet einen Brokerauftrag.
const drafts=shallowReactive(new Map());
export function setTargetDraft(orderId,value){drafts.set(orderId,value);}
export function removeTargetDraft(orderId){drafts.delete(orderId);}
export function selectTargetDraft(orderId,index){
 const value=drafts.get(orderId);if(!value?.targets[index])return;
 // Eine globale Auswahl löst auch gleichpreisige Ziele verschiedener Positionen eindeutig auf.
 for(const [id,draft] of drafts)drafts.set(id,{...draft,selectedIndex:id===orderId?index:null});
}
export function moveTargetDraft(orderId,index,price){
 const value=drafts.get(orderId);if(!value||!Number.isFinite(price)||price<=0)return;
 const rounded=Number.isInteger(value.digits)?Number(price.toFixed(value.digits)):price;
 const targets=value.targets.map((t,i)=>i===index?{...t,price:rounded}:t);
 drafts.set(orderId,{...value,targets,dirty:true});
}
export function useTargetDraft(orderId){return computed(()=>drafts.get(toValue(orderId)));}
export function splitTargetDraft(orderId,index){
 const value=drafts.get(orderId),targets=value&&splitTargetShares(value.targets,index,value.positionVolume);
 if(!targets)return null;
 drafts.set(orderId,{...value,targets,dirty:true});selectTargetDraft(orderId,targets.length-1);
 return targets.length-1;
}
export function changeTargetShare(orderId,index,percent){
 const value=drafts.get(orderId),targets=value&&redistributeTargetShares(value.targets,index,percent,value.positionVolume);
 if(!targets)return false;
 drafts.set(orderId,{...value,targets,dirty:true});return true;
}
export function targetDraftLines(symbol){
 return [...drafts.entries()].filter(([,d])=>d.symbol===symbol).flatMap(([orderId,d])=>{
 const shares=targetShares(d.targets,d.positionVolume),totalPercent=shares.reduce((sum,n)=>sum+n,0);
 return d.targets.flatMap((target,index)=>Number.isFinite(Number(target.price))&&Number(target.price)>0?[{
  orderId,index,price:Number(target.price),entryTime:d.entryTime,entryPrice:d.entryPrice,initialSl:d.initialSl,
  selected:d.selectedIndex===index,direction:d.direction,percent:shares[index],targetCount:d.targets.length,totalPercent,
  accountLabel:d.accountLabel,positionId:d.positionId,digits:d.digits,dirty:d.dirty,
  label:`TP ${index+1}${d.selectedIndex===index?' ausgewählt':''} · ${d.dirty?'Entwurf':'gespeichert'} · ${target.volume===''?'—':target.volume??'—'} Lot`,
 }]:[]);});
}
