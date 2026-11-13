<script setup>
import {computed,ref} from 'vue';
import DropdownMenu from './ui/DropdownMenu.vue';
import ToggleButton from './ui/ToggleButton.vue';
import {ALL_HISTORY_ACCOUNTS,accountAvailability,accountArchiveLabel} from '../milkyMetaTraderAccountSelection.js';
import {fmtPrice} from '../format.js';
const account=defineModel('account',{type:String,default:''});
const props=defineProps({accounts:{type:Array,default:()=>[]}});
const archived=computed(()=>accountAvailability(props.accounts).inactive);
const open=ref(false);
const money=(value,currency)=>Number.isFinite(value)&&currency?`${fmtPrice(value,2)} ${currency}`:'unbekannt';
function gain(details){return Number.isFinite(details.peak_balance)&&Number.isFinite(details.initial_balance)?money(details.peak_balance-details.initial_balance,details.currency):'unbekannt';}
function select(id,close){account.value=id;close();}
</script>
<template>
 <DropdownMenu v-model:open="open" label="Inaktive Konten-Untermenü" align="right">
  <template #leading><ToggleButton :class="{active:account===ALL_HISTORY_ACCOUNTS||archived.some(a=>a.id===account)}" :aria-expanded="open" @click="open=!open">Inaktive Konten ({{archived.length}})</ToggleButton></template>
  <template #default="{close}">
  <ToggleButton variant="menu" :class="{active:account===ALL_HISTORY_ACCOUNTS}" :aria-pressed="account===ALL_HISTORY_ACCOUNTS" @click="select(ALL_HISTORY_ACCOUNTS,close)">Alle Konten inklusive inaktiver</ToggleButton>
  <p v-if="!archived.length" class="mmt-muted">Noch keine inaktiven Konten.</p>
  <ToggleButton v-for="a in archived" :key="a.id" variant="menu" class="mmt-archived-account" :class="{active:account===a.id}" :aria-pressed="account===a.id" @click="select(a.id,close)">
   <strong>#{{a.login}} · {{a.name}}</strong>
   <span>Status: {{accountArchiveLabel(a)}}</span>
   <span :title="a.archive_details?.peak_source">Höchster Kontostand: {{money(a.archive_details?.peak_balance,a.archive_details?.currency)}} · Plus: {{gain(a.archive_details??{})}}</span>
   <span>Grund: {{a.archive_details?.reason||'noch nicht bestätigt'}}</span>
  </ToggleButton>
  </template>
 </DropdownMenu>
</template>
<style scoped>
.mmt-archived-account{display:grid;gap:4px;white-space:normal;overflow-wrap:anywhere;min-width:min(310px,calc(100vw - 52px))}
.mmt-archived-account span{font-size:11px;line-height:1.4}
</style>
