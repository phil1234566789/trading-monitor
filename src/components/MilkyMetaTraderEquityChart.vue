<script setup>
import {computed,onMounted,onUnmounted,ref} from 'vue';
import {fmtDateTime,fmtPrice} from '../format.js';
const props=defineProps({trades:{type:Array,required:true},currency:String});
const host=ref(null),width=ref(600);let observer;
onMounted(()=>{observer=new ResizeObserver(entries=>{width.value=Math.max(260,entries[0].contentRect.width);});observer.observe(host.value);});
onUnmounted(()=>observer?.disconnect());
const plot=computed(()=>{
 const w=width.value,h=220,left=65,right=w-12,top=12,bottom=178;
 let total=0,commission=0;
 const values=props.trades.map(t=>({x:t.closed_at,y:total+=t.net,c:commission+=t.commission??0}));
 if(!values.length)return null;
 values.unshift({x:values[0].x-1000,y:0,c:0});
 const minX=values[0].x,maxX=Math.max(minX+1000,values[values.length-1].x);
 let lo=0,hi=0;for(const v of values){lo=Math.min(lo,v.y,v.c);hi=Math.max(hi,v.y,v.c);}
 const pad=Math.max((hi-lo)*.08,.01);
 const minY=lo-pad,maxY=hi+pad,x=n=>left+(n-minX)/(maxX-minX)*(right-left),y=n=>bottom-(n-minY)/(maxY-minY)*(bottom-top);
 return {w,h,left,right,top,bottom,zero:y(0),path:values.map((v,i)=>(i?'L':'M')+x(v.x).toFixed(2)+','+y(v.y).toFixed(2)).join(' '),
  commissionPath:values.map((v,i)=>(i?'L':'M')+x(v.x).toFixed(2)+','+y(v.c).toFixed(2)).join(' '),
  ys:Array.from({length:4},(_,i)=>{const n=minY+(maxY-minY)*i/3;return {n,y:y(n)};}),
  xs:(w<480?[0,1]:[0,.5,1]).map(f=>({n:minX+(maxX-minX)*f,x:x(minX+(maxX-minX)*f),anchor:f===0?'start':f===1?'end':'middle'}))};
});
</script>
<template><div ref="host" class="mmt-equity-chart">
 <p v-if="plot" class="mmt-chart-legend"><span>━ Netto-PnL</span><span class="mmt-commission-legend">┄ Commission kumuliert (bereits im Netto enthalten)</span></p>
 <svg v-if="plot" :viewBox="`0 0 ${plot.w} ${plot.h}`" role="img" :aria-label="`Kumuliertes realisiertes Netto-PnL und Commission in ${currency} nach Abschlusszeit`">
  <text :x="plot.left" y="10" class="mmt-axis-title">PnL / Commission ({{currency}})</text>
  <g v-for="tick in plot.ys" :key="tick.n"><line :x1="plot.left" :x2="plot.right" :y1="tick.y" :y2="tick.y" class="mmt-chart-grid"/><text :x="plot.left-8" :y="tick.y+4" text-anchor="end">{{fmtPrice(tick.n,2)}}</text></g>
  <line :x1="plot.left" :x2="plot.right" :y1="plot.zero" :y2="plot.zero" class="mmt-chart-zero"/>
  <path :d="plot.path" class="mmt-equity-line"/><path :d="plot.commissionPath" class="mmt-commission-line"/>
  <text v-for="tick in plot.xs" :key="tick.x" :x="tick.x" y="194" :text-anchor="tick.anchor">{{fmtDateTime(tick.n/1000,{timeZone:'Europe/Berlin'})}}</text>
  <text :x="plot.right" y="216" text-anchor="end" class="mmt-axis-title">Abschlusszeit · Berlin</text>
 </svg><p v-else class="mmt-muted">Keine abgeschlossenen Trades für diese Auswahl.</p>
</div></template>
