import {computed,shallowReactive,toValue} from 'vue';
import {targetShares,splitTargetShares,redistributeTargetShares} from './mmtTargetShares.js';
import {targetDraftAllocation,positionRiskBasis} from '../supabase/functions/trading-monitor-mcp/targetPlanContract.js';
import {calcPositionLineForecast} from './mmtPositionForecast.js';
import {stopDraftAllocation} from '../supabase/functions/trading-monitor-mcp/stopPlanContract.js';
// Nur Entwürfe im Browser; weder Ziehen noch Tippen sendet einen Brokerauftrag.
const drafts=shallowReactive(new Map());
export function setTargetDraft(orderId,value){drafts.set(orderId,value);}
export function removeTargetDraft(orderId){drafts.delete(orderId);}
const listKey=kind=>kind==='stop'?'stops':'targets';
const dirtyLeg=(value,kind)=>({...value,dirty:true,...(kind==='stop'?{stopsDirty:true}:{})});
export function selectTargetDraft(orderId,index,kind='target'){
 const value=drafts.get(orderId);if(!value?.[listKey(kind)]?.[index])return;
 // Eine globale Auswahl löst auch gleichpreisige Ziele verschiedener Positionen eindeutig auf.
 for(const [id,draft] of drafts)drafts.set(id,{...draft,selectedIndex:id===orderId?index:null,...(id===orderId||draft.selectedKind!==undefined?{selectedKind:id===orderId?kind:null}:{})});
}
export function moveTargetDraft(orderId,index,price,kind='target'){
 const value=drafts.get(orderId),key=listKey(kind);if(!value?.[key]?.[index]||!Number.isFinite(price)||price<=0)return;
 const rounded=Number.isInteger(value.digits)?Number(price.toFixed(value.digits)):price;
 const levels=value[key].map((t,i)=>i===index?{...t,price:rounded}:t);
 drafts.set(orderId,{...dirtyLeg(value,kind),[key]:levels});
}
export function useTargetDraft(orderId){return computed(()=>drafts.get(toValue(orderId)));}
export function splitTargetDraft(orderId,index,kind='target'){
 const value=drafts.get(orderId),key=listKey(kind),levels=value&&splitTargetShares(value[key]??[],index,value.positionVolume);
 if(!levels)return null;
 if(kind==='stop'&&stopSplitReason(value,index))return null;
 drafts.set(orderId,{...dirtyLeg(value,kind),[key]:levels});selectTargetDraft(orderId,levels.length-1,kind);
 return levels.length-1;
}
export function stopSplitReason(value,index){
 if((value?.stops?.length??0)>=5)return 'Maximal fünf SL-Teilmengen.';
 const minimum=value?.quote?.minimum_volume;
 if(!(minimum>0))return 'Broker-Mindestlot fehlt.';
 const proposed=splitTargetShares(value.stops??[],index,value.positionVolume);
 if(!proposed)return 'SL-Teilmenge fehlt.';
 const allocation=stopDraftAllocation(proposed,value.positionVolume,value.quote,value.direction);
 return allocation.targets.every(s=>s.volume>=minimum-1e-9)?'':`Für zwei Teilmengen sind jeweils mindestens ${minimum} Lot nötig.`;
}
export function changeTargetShare(orderId,index,percent,kind='target'){
 const value=drafts.get(orderId),key=listKey(kind),levels=value&&redistributeTargetShares(value[key]??[],index,percent,value.positionVolume);
 if(!levels)return false;
 drafts.set(orderId,{...dirtyLeg(value,kind),[key]:levels});return true;
}
export function addStopDraft(orderId,mode){
 const value=drafts.get(orderId),preview=['risky','full'].includes(mode)&&value?.stopPreviews?.[mode];
 if(!value?.canAddStop||value.stops?.length||!Number.isFinite(preview?.price)||preview.price<=0)return false;
 drafts.set(orderId,{...value,stops:[{price:preview.price,percent:100,volume:''}],riskMode:mode,dirty:true,stopsDirty:true});
 selectTargetDraft(orderId,0,'stop');return true;
}
export function draftRiskBasis(draft){
 if(draft.basisSl??draft.initialSl)return draft.basisSl??draft.initialSl;
 const prices=draft.stopsDirty?(draft.stops??[]).map(s=>Number(s.price)).filter(p=>Number.isFinite(p)&&p>0):[];
 const outer=prices.length?(draft.direction==='long'?Math.min(...prices):Math.max(...prices)):null;
 return positionRiskBasis(draft.direction,draft.entryPrice,outer);
}
export function targetDraftLines(symbol){
 return [...drafts.entries()].filter(([,d])=>d.symbol===symbol).flatMap(([orderId,d])=>{
 return ['target','stop'].flatMap(kind=>{
 const levels=d[listKey(kind)]??[],shares=targetShares(levels,d.positionVolume),totalPercent=shares.reduce((sum,n)=>sum+n,0);
 const allocation=kind==='stop'?stopDraftAllocation(levels,d.positionVolume,d.quote,d.direction):targetDraftAllocation(levels,d.positionVolume,d.quote?.volume_step),side=d.direction==='long'?'long':'short',basisSl=draftRiskBasis(d);
 return levels.flatMap((target,index)=>Number.isFinite(Number(target.price))&&Number(target.price)>0?[{
  orderId,index,kind,price:Number(target.price),entryTime:d.entryTime,entryPrice:d.entryPrice,initialSl:d.initialSl,basisSl,
  selected:d.selectedIndex===index&&(d.selectedKind??'target')===kind,direction:d.direction,percent:shares[index],targetCount:levels.length,totalPercent,
  accountLabel:d.accountLabel,positionId:d.positionId,digits:d.digits,dirty:d.dirty,
  ...(kind==='stop'?{splitReason:stopSplitReason(d,index),actualPercent:allocation.targets[index]?.volume/d.positionVolume*100,roundedShare:Math.abs(allocation.targets[index]?.volume/d.positionVolume*100-shares[index])>1e-7}:{}),
  forecast:calcPositionLineForecast({direction:d.direction,entryPrice:d.entryPrice,price:Number(target.price),volume:allocation.targets[index]?.volume,positionVolume:d.positionVolume,basisSl,
   minimumVolume:d.quote?.minimum_volume,lossPerUnit:d.quote?.[`loss_per_unit_${side}`],profitPerUnit:d.quote?.[`profit_per_unit_${side}`],currency:d.currency,
   entryCosts:d.costs?.entry_costs,entryVolume:d.costs?.entry_volume,swap:d.swap,estimatedExitCostsPerLot:d.costs?.estimated_exit_costs_per_lot}),
  label:`${kind==='stop'?'SL':'TP'} ${index+1} · ${d.dirty?'Entwurf':'gespeichert'} · ${allocation.targets[index]?.volume??(target.volume===''?'—':target.volume??'—')} Lot`,
 }]:[]);});});
}
export function stopEntryDraftLines(symbol){
 return [...drafts.entries()].filter(([,d])=>d.symbol===symbol&&d.needsStop&&!d.stops?.length).map(([orderId,d])=>({
  orderId,index:-1,kind:'entry',price:d.entryPrice,entryTime:d.entryTime,entryPrice:d.entryPrice,accountLabel:d.accountLabel,positionId:d.positionId,
  canAddStop:d.canAddStop,stopPreviews:d.stopPreviews,stopReason:d.stopReason,dirty:d.dirty,direction:d.direction,
 }));
}
