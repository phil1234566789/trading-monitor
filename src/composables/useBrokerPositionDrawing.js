import {onScopeDispose,watch} from 'vue';
import {cssColor} from '../chartColors.js';
import {brokerPositionLines} from '../mmtBrokerPositions.js';
import {targetDraftLines} from '../mmtTargetDrafts.js';
import {nativeTargetKey} from '../mmtTargetSave.js';

export function useBrokerPositionDrawing(positions,symbol){
 let series;const drawn=[];
 function clear(){if(series)for(const line of drawn)series.removePriceLine(line);drawn.length=0;}
 function refresh(){
  clear();if(!series)return;
  const drafts=targetDraftLines(symbol());
  // Nur ein deckungsgleicher gespeicherter TP darf die native Linie ersetzen; abweichende Entwürfe verdecken keinen Brokerstand.
  for(const position of positions().filter(position=>position.instrument===symbol())){
   const key=position.managedOrderId??nativeTargetKey(position.accountId,position.ticket);
   const tpCovered=drafts.some(draft=>draft.orderId===key&&!draft.dirty&&draft.price===position.takeProfit);
   for(const line of brokerPositionLines(position,tpCovered))drawn.push(series.createPriceLine({
    price:line.price,color:cssColor(line.color),lineWidth:1,lineStyle:2,axisLabelVisible:true,title:line.title,
   }));
  }
 }
 function create(value){clear();series=value;refresh();}
 function dispose(){clear();series=null;}
 const stop=watch(()=>[positions(),symbol(),targetDraftLines(symbol())],refresh);
 onScopeDispose(()=>{stop();dispose();});
 return {create,dispose};
}
