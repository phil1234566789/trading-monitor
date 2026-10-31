import {computed,ref,watch,onScopeDispose} from 'vue';
import {chartMode,chartHint} from '../chartModes.js';
import {makeTradeIdea} from '../tradeIdeas.js';
export function useTradeIdeaDrawing({pointAt,save,refresh,context}) {
 const points=ref([]),error=ref('');
 const active=computed(()=>['idea-long','idea-short'].includes(chartMode.value));
 const draft=ref(null);
 const saving=ref(false);
 function reset(){points.value=[];draft.value=null;error.value='';refresh();}
 if(context)watch(context,reset);
 watch(chartMode,()=>{reset();chartHint.value=null;});
 watch(points,()=>{if(active.value)chartHint.value=points.value.length===0?'Ideen-Anker anklicken (kein Broker-Entry)':points.value.length===1?'Stop-Loss anklicken':'Optionales Ziel anklicken oder ohne TP abschließen';});
 async function finish(target=null) {
  if(saving.value)return;
  saving.value=true;
  try {
   const drawing=makeTradeIdea(chartMode.value==='idea-long'?'long':'short',points.value[0],points.value[1],target);
   if(!await save(drawing))throw new Error('Idee konnte nicht gespeichert werden. Bitte erneut versuchen.');
   chartMode.value='navigate';reset();chartHint.value=null;
  }catch(e){error.value=e.message;}finally{saving.value=false;}
 }
 function click(param) {
  if(!active.value)return false;
  if(saving.value)return true;
  const point=pointAt(param.point.x,param.point.y);if(!point)return true;
  error.value='';
  if(points.value.length<2){
   if(points.value.length===1){try{makeTradeIdea(chartMode.value==='idea-long'?'long':'short',points.value[0],point,null);}catch(e){error.value=e.message;return true;}}
   points.value=[...points.value,point];
  }else void finish(point);
  move(param.point);return true;
 }
 function move(point) {
  if(!active.value||!point||!points.value.length)return;
  const hover=pointAt(point.x,point.y);if(!hover)return;
  try{draft.value=makeTradeIdea(chartMode.value==='idea-long'?'long':'short',points.value[0],points.value[1]??hover,points.value.length===2?hover:null).annotations[0];}
  catch{draft.value=points.value.length===2?makeTradeIdea(chartMode.value==='idea-long'?'long':'short',points.value[0],points.value[1],null).annotations[0]:null;}
  refresh();
 }
 onScopeDispose(()=>{chartHint.value=null;});
 return {active,points,draft,error,click,move,finish,reset};
}
