import {shallowRef,watchEffect,onScopeDispose} from 'vue';
import {LiquidityLinePrimitive} from '../liquidity.js';
import {targetDraftLines,moveTargetDraft} from '../mmtTargetDrafts.js';
import {barSecondsFor} from '../timeframes.js';
import {cssColor} from '../chartColors.js';
export function useMmtTargetDrawing(){
 let chart,series,element,drag=null,scrollOptions;
 const context=shallowRef(null),primitives=[];
 function clear(){if(series)for(const {primitive} of primitives)series.detachPrimitive(primitive);primitives.length=0;}
 const stop=watchEffect(()=>{
  const c=context.value;if(!series||!c)return;
  clear();const candles=c.candles;if(!candles.length)return;
  const last=candles[candles.length-1].time,bar=barSecondsFor(c.currentBar);
  for(const line of targetDraftLines(c.symbol)){
   const risk=Math.abs(line.entryPrice-line.initialSl),rr=risk>0?(line.direction==='long'?line.price-line.entryPrice:line.entryPrice-line.price)/risk:null;
   const primitive=new LiquidityLinePrimitive({price:line.price,pivotTime:line.entryTime??last,endTime:last+bar*12},
    {color:cssColor('candleUp'),lineWidth:2,label:`${line.label} · ${line.price} · RR ${rr?.toFixed(2)??'—'} · ziehen`,labelSide:'end-above',lenientLabels:true,futureBarSeconds:bar},candles);
   series.attachPrimitive(primitive);primitives.push({primitive,line});
  }
 });
 function point(event){const rect=element.getBoundingClientRect();return {x:event.clientX-rect.left,y:event.clientY-rect.top};}
 function down(event){
  if(event.button!==0||event.target.tagName!=='CANVAS')return;
  const p=point(event),hits=primitives.filter(x=>x.primitive.distanceTo(p.x,p.y)<=7);
  if(hits.length!==1)return;
  drag=hits[0].line;scrollOptions=chart.options().handleScroll;chart.applyOptions({handleScroll:false});
  event.preventDefault();event.stopPropagation();
 }
 function move(event){
  if(!drag||!series)return;
  const p=point(event),price=series.coordinateToPrice(p.y);
  moveTargetDraft(drag.orderId,drag.index,price);event.preventDefault();event.stopPropagation();
 }
 function up(){if(drag&&chart)chart.applyOptions({handleScroll:scrollOptions});drag=null;}
 function create(nextChart,nextSeries,nextElement){
  chart=nextChart;series=nextSeries;element=nextElement;
  element.addEventListener('pointerdown',down,true);document.addEventListener('pointermove',move,true);document.addEventListener('pointerup',up,true);document.addEventListener('pointercancel',up,true);
 }
 function refresh(value){context.value=value;}
 function dispose(){up();clear();element?.removeEventListener('pointerdown',down,true);document.removeEventListener('pointermove',move,true);document.removeEventListener('pointerup',up,true);document.removeEventListener('pointercancel',up,true);chart=null;series=null;element=null;context.value=null;}
 onScopeDispose(()=>{stop();dispose();});
 return {create,refresh,dispose};
}
