<script setup>
import {ref,watch} from 'vue';
import ActionButton from './ui/ActionButton.vue';
import MetadataPanel from './MetadataPanel.vue';
import TradeJournalComments from './TradeJournalComments.vue';
import {fmtDateTime,fmtPrice} from '../format.js';
const props=defineProps({trade:{type:Object,required:true},api:{type:Function,required:true}});
const emit=defineEmits(['close']);
const link=ref(null),loading=ref(false),error=ref('');
let epoch=0;
watch(()=>props.trade.id,async()=>{
 const current=++epoch;loading.value=true;link.value=null;error.value='';
 try{const data=await props.api('journal_context',{account_id:props.trade.account_id,broker_position_id:props.trade.position_id});if(epoch===current)link.value=data.link;}
 catch{if(epoch===current)error.value='Journalzuordnung konnte nicht geladen werden.';}
 finally{if(epoch===current)loading.value=false;}
},{immediate:true});
</script>
<template><MetadataPanel :title="`Brokerposition #${trade.position_id}`" :width="560" :height="700" position="bottom-right" @close="emit('close')">
 <p v-if="error" role="alert">{{error}}</p><p v-if="loading">Zuordnung wird geladen …</p>
 <p>{{trade.symbol}} · {{trade.direction==='long'?'Long':'Short'}} · {{fmtPrice(trade.volume,4)}} Lot</p>
 <p>Entry {{fmtPrice(trade.entry,5)}} · {{fmtDateTime(trade.opened_at/1000,{timeZone:'Europe/Berlin'})}} Berlin<br>Exit {{fmtPrice(trade.exit,5)}} · {{fmtDateTime(trade.closed_at/1000,{timeZone:'Europe/Berlin'})}} Berlin</p>
 <p>Netto {{fmtPrice(trade.net,2)}} {{trade.currency}} · Commission {{fmtPrice(trade.commission,2)}} {{trade.currency}}<br>Historischer SL / TP: unbekannt · R: unbekannt</p>
 <template v-if="link"><p>DR #{{link.trade_positions.dealing_range_id}} · Trade #{{link.trade_position_id}}</p>
  <RouterLink :to="{path:'/',query:{journalTrade:link.trade_position_id,instrument:link.trade_positions.dealing_ranges.instrument}}">Im bestehenden Journal / Chart öffnen</RouterLink>
  <TradeJournalComments :position-id="link.trade_position_id" :api="api" />
 </template>
 <p v-else-if="!loading&&!error">Noch nicht mit einer Dealing Range verbunden. Im Chat DR-Nummer, Konto und diese Brokerpositions-ID nennen. Vorhandene manuelle Journalpositionen dabei angeben.</p>
 <ActionButton @click="emit('close')">Schließen</ActionButton>
</MetadataPanel></template>
