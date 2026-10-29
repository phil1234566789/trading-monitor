<script setup>
import {fmtPrice,pnlClass} from '../format.js';
defineProps({title:String,rows:Array,currency:String});
</script>
<template><section class="mmt-breakdown"><h3>{{title}}</h3><table><thead><tr><th>Gruppe</th><th>N</th><th>Commission</th><th>Netto</th><th>Ø/Trade</th><th>Gewinn</th></tr></thead><tbody><tr v-for="row in rows" :key="row.label"><td>{{row.label}}</td><td>{{row.count}}</td><td :class="pnlClass(row.commission)">{{fmtPrice(row.commission,2)}}</td><td :class="pnlClass(row.net)">{{fmtPrice(row.net,2)}}</td><td :class="pnlClass(row.average)">{{fmtPrice(row.average,2)}}</td><td>{{fmtPrice(row.winrate,0)}} %</td></tr><tr v-if="!rows?.length"><td colspan="6">Keine Trades.</td></tr></tbody></table></section></template>
