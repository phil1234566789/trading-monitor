<script setup>
import {ref,watch} from 'vue';
import ActionButton from './ui/ActionButton.vue';
import {privateJournalApi,privateJournalAvailable,loadPrivateJournalPages} from '../privateJournal.js';
import {fmtDateTime} from '../format.js';
const props=defineProps({positionId:{type:Number,required:true},api:{type:Function,default:privateJournalApi}});
const rows=ref([]),error=ref(''),busy=ref(false),editing=ref(null),body=ref(''),source=ref('MMT-Journal · Philip'),kind=ref('statement');
const labels={statement:'Aussage',observation:'Beobachtung',hypothesis:'Vermutung'};
let epoch=0;
async function refresh(){
 const current=++epoch;
 if(props.api===privateJournalApi&&!privateJournalAvailable()){rows.value=[];return;}
 try{const data=await loadPrivateJournalPages('journal_comments',{position_id:props.positionId},props.api);if(current===epoch){rows.value=data.sort((a,b)=>Date.parse(a.created_at)-Date.parse(b.created_at)||a.id.localeCompare(b.id));error.value='';}}
 catch{if(current===epoch)error.value='Private Kommentare konnten nicht geladen werden. MMT-Zugriff prüfen.';}
}
function reset(){editing.value=null;body.value='';source.value='MMT-Journal · Philip';kind.value='statement';}
watch(()=>props.positionId,()=>{reset();rows.value=[];void refresh();},{immediate:true});
function edit(row){editing.value=row;body.value=row.body;source.value=row.source;kind.value=row.kind;}
async function save(){
 busy.value=true;
 // Eine UUID auch nach einem Timeout behalten: erneutes Speichern korrigiert denselben Kommentar.
 if(!editing.value)editing.value={id:crypto.randomUUID(),occurred_at:new Date().toISOString()};
 try{await props.api('journal_comment_save',{id:editing.value.id,position_id:props.positionId,body:body.value,source:source.value,kind:kind.value,occurred_at:editing.value.occurred_at});reset();await refresh();}
 catch{error.value='Kommentar konnte nicht gespeichert werden. Erneutes Speichern verwendet dieselbe ID.';}
 finally{busy.value=false;}
}
</script>
<template><section class="journal-comments" aria-label="Gemeinsame private Trade-Kommentare">
 <h4>Gemeinsame Kommentare · privat</h4>
 <p v-if="!privateJournalAvailable()&&api===privateJournalApi">Zum Lesen und Korrigieren den MMT-Zugriff auf der MMT-Seite entsperren.</p>
 <template v-else>
  <p v-if="error" role="alert">{{error}}</p>
  <p v-if="!rows.length&&!error">Noch keine Kommentare.</p>
  <article v-for="row in rows" :key="row.id"><strong>{{labels[row.kind]}}</strong><p class="journal-comment-body">{{row.body}}</p>
   <small>{{row.source}} · {{fmtDateTime(row.occurred_at,{timeZone:'Europe/Berlin'})}} · Berlin<span v-if="row.updated_at!==row.created_at"> · korrigiert {{fmtDateTime(row.updated_at,{timeZone:'Europe/Berlin'})}}</span></small>
   <ActionButton :disabled="busy" @click="edit(row)">Korrigieren</ActionButton>
  </article>
  <form @submit.prevent="save">
   <label>Einordnung<select v-model="kind" :disabled="busy"><option v-for="(label,key) in labels" :key="key" :value="key">{{label}}</option></select></label>
   <label>Kommentar<textarea v-model="body" required maxlength="6000" rows="3" :disabled="busy" /></label>
   <label>Quelle<input v-model="source" required maxlength="300" :disabled="busy"></label>
   <ActionButton type="submit" :disabled="busy||!body.trim()||!source.trim()">{{editing?'Korrektur speichern':'Kommentar hinzufügen'}}</ActionButton>
   <ActionButton v-if="editing" :disabled="busy" @click="reset">Abbrechen</ActionButton>
  </form>
 </template>
</section></template>
<style scoped>
.journal-comments{padding:12px;border:1px solid #2a2e39;border-radius:8px;margin:10px 0}.journal-comments h4{margin:0 0 8px}.journal-comments article{padding:10px 0;border-bottom:1px solid #2a2e39}.journal-comment-body{white-space:pre-wrap;overflow-wrap:anywhere}.journal-comments small{display:block;color:#9aa0ac}.journal-comments form,.journal-comments label{display:flex;flex-direction:column;gap:6px}.journal-comments form{margin-top:10px}.journal-comments input,.journal-comments textarea,.journal-comments select{background:#131722;color:#d1d4dc;border:1px solid #2a2e39;border-radius:4px;padding:6px;font:inherit}
</style>
