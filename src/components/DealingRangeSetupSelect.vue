<script setup>
import {ref,watch} from 'vue';
import {STRATEGY_SETUP_KEYS,STRATEGY_SETUP_LABELS,normalizeStrategySetup} from '../strategySetupLabels.js';
import {updateDealingRange} from '../tradeIntake.js';
const props=defineProps({rangeId:{type:Number,required:true},modelValue:{type:String,default:null}});
const emit=defineEmits(['saved']);
const selected=ref(normalizeStrategySetup(props.modelValue) ?? 'unknown');
const saving=ref(false),error=ref(''),saved=ref(false);
watch(()=>[props.rangeId,props.modelValue],()=>{
 selected.value=normalizeStrategySetup(props.modelValue) ?? 'unknown';error.value='';saved.value=false;
});
async function save(event){
 const value=event.target.value,rangeId=props.rangeId;
 saving.value=true;error.value='';saved.value=false;
 try{
  if(!await updateDealingRange(rangeId,{strategySetup:value}))throw new Error('save');
  if(props.rangeId===rangeId){selected.value=value;saved.value=true;}
  emit('saved');
 }catch{
  if(props.rangeId===rangeId){event.target.value=selected.value;error.value='Setup konnte nicht gespeichert werden.';}
 }finally{saving.value=false;}
}
</script>
<template>
 <div class="dr-setup-field">
  <label>Setup<select :value="selected" :disabled="saving" @change="save"><option v-for="key in STRATEGY_SETUP_KEYS" :key="key" :value="key">{{ STRATEGY_SETUP_LABELS[key] }}</option></select></label>
  <span v-if="saving" role="status">Speichern…</span><span v-else-if="saved" role="status">Gespeichert</span>
  <span v-if="error" role="alert">{{ error }}</span>
 </div>
</template>
<style scoped>
.dr-setup-field{margin:12px 0;font-size:12px;color:#b1b7c5}.dr-setup-field label{display:flex;flex-direction:column;gap:6px;min-width:0}.dr-setup-field select{width:100%;min-height:36px;box-sizing:border-box;background:#1e222d;color:#d1d4dc;border:1px solid #434651;border-radius:4px;padding:7px;color-scheme:dark}.dr-setup-field select:focus-visible{outline:2px solid #91b8ff;outline-offset:2px}.dr-setup-field [role=alert]{color:#f28b82}
</style>
