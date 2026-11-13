import {ref,watch,onScopeDispose} from 'vue';
import {chartMode} from '../chartModes.js';
import {editTradeIdea} from '../tradeIdeas.js';
import {suspendChartScrolling} from '../chartScrollSuspension.js';

export function useTradeIdeaEditing({store,pointAt,refresh}) {
 const status=ref('');
 let chart,element,drag=null,original=null,preview=null,lines=[],restoreScrolling,saving=false;
 function point(event){const r=element.getBoundingClientRect();return {x:event.clientX-r.left,y:event.clientY-r.top};}
 function stop(){restoreScrolling?.();restoreScrolling=null;drag=null;}
 function cancel(){if(!drag)return;stop();preview=null;original=null;refresh();}
 function down(event){
  if(saving||chartMode.value!=='navigate'||event.button!==0||event.target.tagName!=='CANVAS')return;
  const p=point(event),hits=lines.map(l=>({...l,distance:l.primitive.distanceTo(p.x,p.y)})).filter(l=>l.distance<=7).sort((a,b)=>a.distance-b.distance);
  // Überlagerte Ideen bleiben eindeutig: kein willkürliches Bearbeiten einer anderen Zeichnung.
  if(!hits.length||(hits[1]&&Math.abs(hits[0].distance-hits[1].distance)<.5))return;
  const hit=hits[0],row=store.drawings.value.find(d=>d.visible&&d.annotations.includes(hit.annotation));
  const start=pointAt(p.x,p.y);if(!row||!start)return;
  drag={...hit,id:row.id,index:row.annotations.indexOf(hit.annotation),start};
  original=hit.annotation;preview=hit.annotation;status.value='Idee anpassen · Loslassen speichert · Esc verwirft';
  restoreScrolling=suspendChartScrolling(chart);
  event.preventDefault();event.stopImmediatePropagation();
 }
 function move(event){
  if(!drag)return;
  const p=point(event),next=pointAt(p.x,p.y);if(!next)return;
  const idea=drag.annotation.tradeIdea;
  const updated=editTradeIdea(drag.annotation,drag.level,{
   price:idea[drag.level]+next.price-drag.start.price,
   time:(drag.level==='entry'?idea.time:idea.endTime)+next.time-drag.start.time,
  });
  if(updated){preview=updated;refresh();}
  event.preventDefault();event.stopImmediatePropagation();
 }
 async function up(event){
  if(!drag)return;
  const savedDrag=drag,annotation=preview;stop();
  event?.preventDefault();event?.stopImmediatePropagation();
  if(annotation===savedDrag.annotation){preview=null;status.value='';refresh();return;}
  saving=true;status.value='Idee wird gespeichert…';
  try{
   const ok=await store.updateAnnotation(savedDrag.id,savedDrag.index,annotation);
   status.value=ok?'Idee gespeichert':'Speichern fehlgeschlagen. Bitte erneut ziehen.';
  }catch{status.value='Speichern fehlgeschlagen. Bitte erneut ziehen.';}
  finally{saving=false;preview=null;original=null;refresh();}
 }
 function key(event){if(event.key==='Escape'&&drag){cancel();status.value='Änderung verworfen';}}
 watch(chartMode,()=>{cancel();status.value='';});
 function create(nextChart,nextElement){
  chart=nextChart;element=nextElement;
  element.addEventListener('pointerdown',down,true);
  document.addEventListener('pointermove',move,true);document.addEventListener('pointerup',up,true);
  document.addEventListener('pointercancel',cancel,true);document.addEventListener('keydown',key,true);
 }
 function annotations(input){
  if(drag&&!input.includes(drag.annotation)){stop();preview=null;}
  return preview?input.map(a=>a===original?preview:a):input;
 }
 function setLines(next){lines=next;}
 function dispose(){
  stop();preview=null;lines=[];
  element?.removeEventListener('pointerdown',down,true);
  document.removeEventListener('pointermove',move,true);document.removeEventListener('pointerup',up,true);
  document.removeEventListener('pointercancel',cancel,true);document.removeEventListener('keydown',key,true);
  element=null;chart=null;
 }
 onScopeDispose(dispose);
 return {status,create,dispose,annotations,setLines};
}
