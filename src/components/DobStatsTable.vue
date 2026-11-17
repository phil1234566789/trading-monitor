<script setup>
import DobStatCell from './DobStatCell.vue';
import {dobPct,dobBreakEven} from '../dobTradeStatistics.js';

// Eine „Je …“-Tabelle der DOB-Statistik: je Route alle R-Ziele kompakt („Winrate · ΣR“), optional in Abschnitten mit Zwischensumme.
// sections: [{title?, stats?, rows:[{key,label,stats}]}], stats = {<Zielname>:{a,b}} aus dobRouteStats.
defineProps({title:String,firstCol:String,sections:Array,targets:Array,open:Boolean});
const emit=defineEmits(['toggle']);
const ROUTES=['a','b'];
</script>
<template>
  <details class="stats-table" :open="open" @toggle="emit('toggle',$event.target.open)">
    <summary><h2>{{ title }}</h2></summary>
    <!-- Steuerelemente, die nur diese Tabelle betreffen, klappen mit ihr ein und aus. -->
    <div v-if="$slots.controls" class="controls"><slot name="controls" /></div>
    <div class="scroll"><table>
      <thead><tr><th scope="col" rowspan="2">{{ firstCol }}</th><th v-for="r in ROUTES" :key="r" scope="colgroup" :colspan="targets.length" class="route">Route {{ r }}</th></tr>
        <tr><template v-for="r in ROUTES" :key="r"><th v-for="(t,i) in targets" :key="t.name" scope="col" :class="{route:i===0}" :title="`Break-even ${dobPct(dobBreakEven(t.k))}`">{{ t.k }}R · Σ R</th></template></tr></thead>
      <tbody v-for="(section,i) in sections" :key="section.title??i">
        <tr v-if="section.title" class="group"><th scope="rowgroup">{{ section.title }}</th>
          <template v-for="r in ROUTES" :key="r"><td v-for="(t,j) in targets" :key="t.name" :class="{route:j===0}"><DobStatCell :stats="section.stats[t.name][r]" :k="t.k" /></td></template></tr>
        <tr v-for="row in section.rows" :key="row.key"><th scope="row" :class="{indent:section.title}">{{ row.label }}</th>
          <template v-for="r in ROUTES" :key="r"><td v-for="(t,j) in targets" :key="t.name" :class="{route:j===0}"><DobStatCell :stats="row.stats[t.name][r]" :k="t.k" /></td></template></tr>
      </tbody>
    </table></div>
  </details>
</template>
<style scoped>
summary{cursor:pointer;list-style-position:inside}summary h2{display:inline;font-size:15px;font-weight:600}.stats-table{margin:24px 0 8px}.scroll{overflow-x:auto;margin-top:8px}table{border-collapse:collapse;font-size:13px;min-width:100%}th,td{padding:6px 10px;border-bottom:1px solid #2a2e39;text-align:right;white-space:nowrap}th[scope=row],th[scope=rowgroup],thead th:first-child{text-align:left}.route{border-left:1px solid #434651}tr.group{background:#1e222d;font-weight:600}tr.group th{color:#d1d4dc}.indent{padding-left:24px;font-weight:400}.controls{margin-top:8px;font-size:13px;color:#b1b7c5}.controls :deep(select){background:#1e222d;color:#d1d4dc;border:1px solid #434651;padding:6px 10px;border-radius:4px;margin-left:6px}summary:focus-visible{outline:2px solid #91b8ff;outline-offset:2px}
</style>
