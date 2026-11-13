import {createApp,h,shallowRef,watch,watchEffect,onScopeDispose} from 'vue';
import {LiquidityLinePrimitive} from '../liquidity.js';
import {targetDraftLines,stopEntryDraftLines,addStopDraft,moveTargetDraft,selectTargetDraft,splitTargetDraft,changeTargetShare} from '../mmtTargetDrafts.js';
import {exitForecastLabel} from '../mmtExitPresentation.js';
import {barSecondsFor} from '../timeframes.js';
import {cssColor} from '../chartColors.js';
import MmtTargetChartControls from '../components/MmtTargetChartControls.vue';
import {targetSaveState,saveTargetDraft,cancelTargetDraft} from '../mmtTargetSave.js';
import {suspendChartScrolling} from '../chartScrollSuspension.js';
import {chartMode} from '../chartModes.js';
export function useMmtTargetDrawing(){
 let chart,series,element,drag=null,activeTarget=null,restoreScrolling,overlay,app,frame,windowTarget;
 const context=shallowRef(null),controls=shallowRef([]),dragging=shallowRef(false),guide=shallowRef(null),cancellation=shallowRef(null),primitives=[];
 function clear(){if(series)for(const {primitive} of primitives)series.detachPrimitive(primitive);primitives.length=0;}
 const stop=watchEffect(()=>{
  const c=context.value;if(!series||!c)return;
  const lines=targetDraftLines(c.symbol);
  if(drag&&!lines.some(line=>line.orderId===drag.orderId&&line.index===drag.index&&line.kind===drag.kind))up();
  clear();const candles=c.candles;if(!candles.length)return;
  const last=candles[candles.length-1].time,bar=barSecondsFor(c.currentBar);
  for(const line of lines.sort((a,b)=>Number(a.selected)-Number(b.selected))){
   const primitive=new LiquidityLinePrimitive({price:line.price,pivotTime:line.entryTime??last,endTime:last+bar*12},
    {color:cssColor(line.kind==='stop'?'candleDown':'candleUp'),lineWidth:line.selected?3:2,label:`${line.label} · ${line.price} · ${exitForecastLabel(line.forecast)}`,labelSide:'end-above',lenientLabels:true,forceLabel:line.selected,futureBarSeconds:bar,extendToRight:true},candles);
   series.attachPrimitive(primitive);primitives.push({primitive,line});
  }
 });
 function hitAt(x,y){
  const hits=primitives.filter(p=>p.primitive.distanceTo(x,y)<=7),selected=hits.filter(p=>p.line.selected);
  return selected.length===1?selected[0]:hits.length===1?hits[0]:null;
 }
 function cursorAt(x,y){return drag||(chartMode.value==='navigate'&&hitAt(x,y))?'ns-resize':null;}
 function updateGuide(){
  if(!drag||!series||!chart){guide.value=null;return;}
  const line=targetDraftLines(context.value?.symbol).find(line=>line.orderId===drag.orderId&&line.index===drag.index&&line.kind===drag.kind);
  const y=line&&series.priceToCoordinate(line.price),height=chart.panes?.()[0]?.getHeight?.()??element.clientHeight-30;
  guide.value=y!=null&&y>=0&&y<=height?{y,left:chart.priceScale?.('left')?.width?.()??0,width:chart.timeScale().width()}:null;
 }
 function cancel(line){
  if(drag?.orderId===line.orderId)up();
  const cancelled=cancelTargetDraft(line.orderId);
  if(cancelled){cancellation.value={orderId:line.orderId};if(activeTarget?.orderId===line.orderId)activeTarget=null;}
  return cancelled;
 }
 function leave(event){if(event.target!==document.body&&event.target!==document.documentElement&&!element?.contains?.(event.target))activeTarget=null;}
 function escape(event){
  if(event.key!=='Escape'||!activeTarget)return;
  if(!drag&&event.target?.closest?.('[data-tp-key]'))return;
  const tag=event.target?.tagName;
  if(!drag&&((tag&&['INPUT','TEXTAREA','SELECT'].includes(tag))||event.target?.isContentEditable||document.querySelector?.('dialog[open],[role="dialog"][aria-modal="true"]')))return;
  if(!drag&&event.target&&![document.body,document.documentElement].includes(event.target)&&!element?.contains?.(event.target))return;
  cancel(drag??activeTarget);event.preventDefault();event.stopPropagation();
 }
 function start(line,event){
  if(drag)up();activeTarget=line;
  selectTargetDraft(line.orderId,line.index,line.kind);
  if(!event)return;
  drag={...line,startY:event.clientY,startPrice:line.price};dragging.value=true;restoreScrolling=suspendChartScrolling(chart);
  updateGuide();element.style.cursor='ns-resize';event.preventDefault();event.stopPropagation();
 }
 function split(line,event){const index=splitTargetDraft(line.orderId,line.index,line.kind);if(index!=null)start({...line,index},event);}
 function addStop(line,mode){if(addStopDraft(line.orderId,mode))activeTarget={...line,index:0,kind:'stop'};}
 function nudge(line,direction){activeTarget=line;moveTargetDraft(line.orderId,line.index,line.price+direction*10**-(line.digits??2),line.kind);}
 function tick(){
  if(!chart||!element)return;
  updateGuide();
  const height=chart.panes?.()[0]?.getHeight?.()??element.clientHeight-30,right=Math.max(0,element.clientWidth-chart.timeScale().width());
  const rows=[...primitives.map(({line})=>line),...stopEntryDraftLines(context.value?.symbol)].map(line=>{
   const lineY=series.priceToCoordinate(line.price),inside=lineY!=null&&lineY>=0&&lineY<=height;
   // Auch Sidebar-Entwürfe brauchen Speichern/Abbrechen außerhalb der Preisansicht; Linienpreise bleiben echt.
   return {...line,y:inside?lineY:(line.selected||line.dirty)?Math.min(height,Math.max(0,lineY??height)):null,lineY,right,offscreen:!inside,saveState:targetSaveState(line.orderId)};
  }).filter(row=>row.y!=null).sort((a,b)=>a.y-b.y);
  const saveRows=new Map();for(const row of rows)if(row.kind!=='entry'&&(!saveRows.has(row.orderId)||row.selected))saveRows.set(row.orderId,row);
  for(const row of rows)row.showSave=saveRows.get(row.orderId)===row;
  const sizes=new Map([...(overlay?.querySelectorAll?.('[data-tp-key]')??[])].map(node=>[node.dataset.tpKey,{half:Math.max(14,node.offsetHeight/2),save:node.querySelector('.tp-savebar')?.offsetHeight??0}]));
  let bottom=0;
  for(const row of rows){const size=sizes.get(`${row.orderId}:${row.kind??'target'}:${row.index}`)??{half:14,save:row.showSave?32:0};row.y=Math.max(size.half,row.y,bottom+size.half+4);bottom=row.y+size.half+(row.showSave?size.save:0);}
  if(bottom>height){const overflow=bottom-height;for(const row of rows)row.y-=overflow;}
  if(JSON.stringify(rows)!==JSON.stringify(controls.value))controls.value=rows;
  frame=requestAnimationFrame(tick);
 }
 function point(event){const rect=element.getBoundingClientRect();return {x:event.clientX-rect.left,y:event.clientY-rect.top};}
 function down(event){
  if(chartMode.value!=='navigate'||event.button!==0||event.target.tagName!=='CANVAS')return;
  const p=point(event),hit=hitAt(p.x,p.y);
  if(!hit)return;
  start(hit.line,event);
 }
 function move(event){
  if(!drag||!series)return;
  const initial=series.priceToCoordinate(drag.startPrice),price=series.coordinateToPrice(initial+event.clientY-drag.startY);
  moveTargetDraft(drag.orderId,drag.index,price,drag.kind);updateGuide();event.preventDefault();event.stopPropagation();
 }
 function up(){restoreScrolling?.();restoreScrolling=null;drag=null;dragging.value=false;guide.value=null;if(element)element.style.cursor='';}
 function blur(){up();activeTarget=null;}
 watch(chartMode,blur,{flush:'sync'});
 function create(nextChart,nextSeries,nextElement){
  chart=nextChart;series=nextSeries;element=nextElement;
  windowTarget=element.ownerDocument?.defaultView;windowTarget?.addEventListener('blur',blur);
  element.addEventListener('pointerdown',down,true);document.addEventListener('pointermove',move,true);document.addEventListener('pointerup',up,true);document.addEventListener('pointercancel',up,true);document.addEventListener('lostpointercapture',up,true);document.addEventListener('keydown',escape,true);document.addEventListener('pointerdown',leave,true);document.addEventListener('focusin',leave,true);
  overlay=document.createElement('div');element.appendChild(overlay);
  app=createApp({render:()=>h(MmtTargetChartControls,{rows:controls.value,dragging:dragging.value,guide:guide.value,cancellation:cancellation.value,onCancel:cancel,onMove:start,onSplit:split,onNudge:nudge,onShare:(line,value)=>{activeTarget=line;changeTargetShare(line.orderId,line.index,value,line.kind);},onAddStop:addStop,onSave:line=>saveTargetDraft(line.orderId)})});app.mount(overlay);
  frame=requestAnimationFrame(tick);
 }
 function refresh(value){context.value=value;}
 function dispose(){up();clear();cancelAnimationFrame(frame);app?.unmount();overlay?.remove();app=null;overlay=null;controls.value=[];windowTarget?.removeEventListener('blur',blur);windowTarget=null;element?.removeEventListener('pointerdown',down,true);document.removeEventListener('pointermove',move,true);document.removeEventListener('pointerup',up,true);document.removeEventListener('pointercancel',up,true);document.removeEventListener('lostpointercapture',up,true);document.removeEventListener('keydown',escape,true);document.removeEventListener('pointerdown',leave,true);document.removeEventListener('focusin',leave,true);activeTarget=null;chart=null;series=null;element=null;context.value=null;}
 onScopeDispose(()=>{stop();dispose();});
 return {create,refresh,dispose,cursorAt};
}
