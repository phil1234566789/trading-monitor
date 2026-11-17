<script setup>
import {fmtR,pnlClass} from '../format.js';
import {dobBreakEven} from '../dobTradeStatistics.js';

// Eine „Je …“-Tabelle der DOB-Statistik: je Route beide R-Ziele (Winrate + ΣR), optional in Abschnitten mit Zwischensumme.
// sections: [{title?, stats?, rows:[{key,label,stats}]}], stats = {A:{a,b},B:{a,b}} aus dobRouteStats.
defineProps({title:String,firstCol:String,sections:Array,targets:Array,open:Boolean});
const emit=defineEmits(['toggle']);
const ROUTES=['a','b'];
const pct=v=>v==null?'–':`${(v*100).toFixed(1)} %`;
const tone=(v,k)=>v==null?'':v>dobBreakEven(k)?'positive':v<dobBreakEven(k)?'negative':'';
const rLabel=k=>`${k.toLocaleString('de-DE')}R`;
const tip=c=>`${c.success} W / ${c.loss} L · offen ${c.open}`;
</script>
<template>
  <details class="stats-table" :open="open" @toggle="emit('toggle',$event.target.open)">
    <summary><h2>{{ title }}</h2></summary>
    <div class="scroll"><table>
      <thead><tr><th scope="col" rowspan="2">{{ firstCol }}</th><th v-for="r in ROUTES" :key="r" scope="colgroup" colspan="4">Route {{ r }}</th></tr>
        <tr><template v-for="r in ROUTES" :key="r"><template v-for="t in targets" :key="t.name"><th scope="col">{{ rLabel(t.k) }} Winrate</th><th scope="col">{{ rLabel(t.k) }} Σ R</th></template></template></tr></thead>
      <tbody v-for="(section,i) in sections" :key="section.title??i">
        <tr v-if="section.title" class="group"><th scope="rowgroup">{{ section.title }}</th>
          <template v-for="r in ROUTES" :key="r"><template v-for="t in targets" :key="t.name"><td :class="tone(section.stats[t.name][r].winrate,t.k)" :title="tip(section.stats[t.name][r])">{{ pct(section.stats[t.name][r].winrate) }}</td><td :class="pnlClass(section.stats[t.name][r].sumR)">{{ fmtR(section.stats[t.name][r].sumR) }}</td></template></template></tr>
        <tr v-for="row in section.rows" :key="row.key"><th scope="row" :class="{indent:section.title}">{{ row.label }}</th>
          <template v-for="r in ROUTES" :key="r"><template v-for="t in targets" :key="t.name"><td :class="tone(row.stats[t.name][r].winrate,t.k)" :title="tip(row.stats[t.name][r])">{{ pct(row.stats[t.name][r].winrate) }}</td><td :class="pnlClass(row.stats[t.name][r].sumR)">{{ fmtR(row.stats[t.name][r].sumR) }}</td></template></template></tr>
      </tbody>
    </table></div>
  </details>
</template>
<style scoped>
summary{cursor:pointer;list-style-position:inside}summary h2{display:inline;font-size:15px;font-weight:600}.stats-table{margin:24px 0 8px}.scroll{overflow-x:auto;margin-top:8px}table{border-collapse:collapse;font-size:13px;min-width:100%}th,td{padding:6px 10px;border-bottom:1px solid #2a2e39;text-align:right;white-space:nowrap}th[scope=row],th[scope=rowgroup],thead th:first-child{text-align:left}tr.group{background:#1e222d;font-weight:600}tr.group th{color:#d1d4dc}.indent{padding-left:24px;font-weight:400}.positive{color:var(--positive)}.negative{color:var(--negative)}summary:focus-visible{outline:2px solid #91b8ff;outline-offset:2px}
</style>
