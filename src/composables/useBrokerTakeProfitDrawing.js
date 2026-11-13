import {onScopeDispose,watch} from 'vue';
import {cssColor} from '../chartColors.js';

export function useBrokerTakeProfitDrawing(lines,symbol){
 let series;const drawn=[];
 function clear(){if(series)for(const line of drawn)series.removePriceLine(line);drawn.length=0;}
 function refresh(){
  clear();if(!series)return;
  // Manuelle Positionen haben keinen MMT-Auftrag: native TPs nur anzeigen, nie als editierbaren Entwurf ausgeben.
  for(const line of lines().filter(line=>line.instrument===symbol()))drawn.push(series.createPriceLine({
   price:line.price,color:cssColor('candleUp'),lineWidth:1,lineStyle:2,axisLabelVisible:true,title:line.title,
  }));
 }
 function create(value){clear();series=value;refresh();}
 function dispose(){clear();series=null;}
 const stop=watch([lines,symbol],refresh);
 onScopeDispose(()=>{stop();dispose();});
 return {create,dispose};
}
