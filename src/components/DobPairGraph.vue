<script setup>
import {computed,ref,watch} from 'vue';
import {cssColor} from '../chartColors.js';

// Rendert das Modell aus dobPairGraph.js. Gate-Knoten (OB-Reaktion) klappen nichts auf, sie wechseln in die Reaktions-Ebene.
const props=defineProps({graph:{type:Object,required:true},expected:{type:String,default:''},matches:{type:Boolean,default:null},scope:{type:String,default:''}});
const emit=defineEmits(['reaction']);
const STATUS_TEXT={visited:'● bestanden',unknown:'◇ offen / unbekannt','not-visited':'○ nicht erreicht',rejected:'× abgelehnt'};
const selected=ref(null);
watch(()=>props.scope,()=>{selected.value=null;});
const detail=computed(()=>props.graph.nodes.find(n=>n.id===selected.value));
const click=node=>{if(node.gate)emit('reaction',node.gate);else selected.value=selected.value===node.id?null:node.id;};
const colors=computed(()=>({'--rejected':cssColor('tradeLoss')}));
</script>

<template>
 <section class="dpg" :style="colors">
  <h2>{{ graph.title }}</h2>
  <div class="current"><strong>Soll: {{ expected || 'kein Soll' }}</strong>
   <span v-if="matches!=null">Ist: {{ matches ? '✓ Produkt erfüllt das Soll' : '✗ Produkt weicht ab' }}</span></div>
  <ol class="flow" aria-label="DOB-Entscheidungsbaum">
   <li v-for="node in graph.nodes" :key="node.id">
    <button type="button" class="node" :data-node="node.id" :data-status="node.status" :data-gate="node.gate?'true':null"
     :aria-expanded="node.gate?null:selected===node.id" :aria-label="node.label+' · '+node.sub" @click="click(node)">
     <span>{{ node.label }}<em v-if="node.gate"> → Reaktions-Ebene</em></span>
     <small>{{ node.sub }}</small>
    </button>
   </li>
  </ol>
  <p class="legend">● bestanden · ◇ offen / unbekannt · ○ nicht erreicht · × abgelehnt · OB-Reaktion: Klick öffnet die Reaktions-Ebene dieses OB</p>
  <section v-if="detail" class="details" aria-label="Knotendetails">
   <header><strong>{{ detail.label }} · {{ STATUS_TEXT[detail.status] }}</strong><button aria-label="Knotendetails schließen" @click="selected=null">×</button></header>
   <p v-for="line in detail.detail" :key="line">{{ line }}</p>
  </section>
 </section>
</template>

<style scoped>
/* Gleiche Basistokens wie ObReactionGraph.vue, damit beide Ebenen gleich aussehen. */
.dpg{--surface:#1c2226;--line:#364147;--accent:#9cd5ef;--muted:#b3bec4;--text:#eff3f4;--edge:color-mix(in srgb,var(--muted) 45%,var(--surface));
 font-size:14px;line-height:1.5;color:var(--text)}
h2{font-size:17px;margin:4px 0}
.current{font-size:12px;display:grid;gap:4px;padding:8px;background:var(--surface)}
.flow{list-style:none;margin:8px 0 0;padding:0;display:flex;flex-direction:column;align-items:center}
.flow li{width:86%;display:flex;flex-direction:column;align-items:center}
.flow li+li::before{content:'';width:2px;height:14px;background:var(--edge)}
.node{width:100%;padding:6px 8px;font:12px/1.3 system-ui,sans-serif;text-align:left;color:var(--text);border:1px solid var(--edge);
 border-radius:4px;background:var(--surface);cursor:pointer}
.node small{display:block;margin-top:3px;font-size:11px;color:var(--muted);white-space:pre-line}
.node em{font-style:normal;font-size:10px;color:var(--accent)}
.node[data-gate="true"]{border-left:4px solid var(--accent)}
.node:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
.node[data-status="visited"]{border-color:color-mix(in srgb,var(--accent) 70%,white);background:color-mix(in srgb,var(--accent) 25%,var(--surface))}
.node[data-status="unknown"]{border-style:dashed;background:color-mix(in srgb,var(--muted) 15%,var(--surface))}
.node[data-status="not-visited"]{opacity:.45;background:color-mix(in srgb,var(--surface) 80%,black)}
.node[data-status="rejected"]{border-color:var(--rejected);background:color-mix(in srgb,var(--rejected) 25%,var(--surface));color:color-mix(in srgb,var(--rejected) 25%,white)}
.node[aria-expanded="true"]{outline:2px solid var(--accent);outline-offset:2px}
.legend{font-size:11px;color:var(--muted)}
.details{border:1px solid var(--line);padding:10px;margin:12px 0;overflow-wrap:anywhere}
.details header{display:flex;justify-content:space-between;align-items:center}
.details button{font-size:20px;min-width:44px;background:none;color:inherit;border:1px solid var(--line);border-radius:4px;cursor:pointer}
.details p{margin:8px 0;font-size:13px}
</style>
