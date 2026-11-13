<script setup>
import {computed,onMounted,onUnmounted,ref} from 'vue';
import {fmtDateTime,fmtPrice} from '../format.js';
import {cssColor} from '../chartColors.js';
import {mmtEquityPlot} from '../mmtEquityPlot.js';
const props=defineProps({trades:{type:Array,required:true},accounts:{type:Array,default:()=>[]},currency:String});
const colors=['emaFast','emaSlow','candleUp','fvgCandle','rsi','candleDown','liquidityHighM5','tradeSetupProtected','rangeFib','pin'];
const color=index=>cssColor(colors[index%colors.length]);
const host=ref(null),width=ref(600);let observer;
onMounted(()=>{observer=new ResizeObserver(entries=>{width.value=Math.max(260,entries[0].contentRect.width);});observer.observe(host.value);});
onUnmounted(()=>observer?.disconnect());
const plot=computed(()=>mmtEquityPlot(props.trades,props.accounts,width.value));
</script>
<template><div ref="host" class="mmt-equity-chart">
 <template v-if="plot"><p class="mmt-chart-legend"><span v-for="s in plot.series" :key="s.id" :style="{color:color(s.colorIndex)}">━ {{s.name}}</span></p><p class="mmt-muted">Durchgezogen: Netto-PnL · Gestrichelt: Commission je Konto (bereits im Netto enthalten)</p></template>
 <svg v-if="plot" :viewBox="`0 0 ${plot.w} ${plot.h}`" role="img" :aria-label="`Kumuliertes realisiertes Netto-PnL und Commission je Konto in ${currency} nach Abschlusszeit`">
  <text :x="plot.left" y="10" class="mmt-axis-title">PnL / Commission ({{currency}})</text>
  <g v-for="tick in plot.ys" :key="tick.n"><line :x1="plot.left" :x2="plot.right" :y1="tick.y" :y2="tick.y" class="mmt-chart-grid"/><text :x="plot.left-8" :y="tick.y+4" text-anchor="end">{{fmtPrice(tick.n,2)}}</text></g>
  <line :x1="plot.left" :x2="plot.right" :y1="plot.zero" :y2="plot.zero" class="mmt-chart-zero"/>
  <g v-for="s in plot.series" :key="s.id" :style="{color:color(s.colorIndex)}"><path :d="s.path" class="mmt-equity-line"><title>{{s.name}} · Netto-PnL</title></path><path :d="s.commissionPath" class="mmt-commission-line"><title>{{s.name}} · Commission</title></path></g>
  <text v-for="tick in plot.xs" :key="tick.x" :x="tick.x" y="194" :text-anchor="tick.anchor">{{fmtDateTime(tick.n/1000,{timeZone:'Europe/Berlin'})}}</text>
  <text :x="plot.right" y="216" text-anchor="end" class="mmt-axis-title">Abschlusszeit · Berlin</text>
 </svg><p v-else class="mmt-muted">Keine abgeschlossenen Trades für diese Auswahl.</p>
</div></template>
