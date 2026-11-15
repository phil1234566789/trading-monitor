<script setup>
import {computed,ref,watch} from 'vue';
import {cssColor} from '../chartColors.js';

// Rendert nur das Graphmodell aus obReactionGraph.js; Layout und Kanten 1:1 aus dem alten Prototyp-Knotenplan.
const props=defineProps({graph:{type:Object,required:true},dir:{type:Number,required:true},scope:{type:String,default:''}});

const LAYOUT=[['start',50,8],['touch',50,73],['oldFvg',16,8],['internalOb',16,165],['fvg',50,150],['wait',16,350],
 ['reaction',83,235],['counter',83,315],['entryA',50,420],['entryB',83,420],['closed',16,515],['stop',50,515],['result',50,625]];
const PATHS={startTouch:'M200 52V73',touchFvg:'M200 127V150',touchOld:'M140 95H132V50H124',oldInner:'M64 140V165',
 fvgWait:'M200 212V320H64V350',fvgReaction:'M200 212V224H332V235',reactionCounter:'M332 292V315',reactionA:'M332 395V407H200V420',
 reactionB:'M332 395V420',bStop:'M332 475V500H200V515',touchReject:'M140 95H130V62H1V654H110',aStop:'M200 475V515',
 stopResult:'M200 595V625',bReject:'M332 475V654H290',waitClosed:'M64 405V515',closedResult:'M64 575V640H110'};
const SUPPORT=new Set(['touchOld','oldInner','reactionCounter']);
const STATUS_TEXT={visited:'● durchlaufen',unknown:'◇ offen / unbekannt','not-visited':'○ nicht besucht',alternative:'○ überholte Alternative',
 rejected:'× abgelehnt',info:'i Zusatzinfo · kein Gate'};
// Gegner-Knoten zeigt die Gegenrichtung, alles andere die Fallrichtung.
const nodeDir=id=>id==='counter'?-props.dir:props.dir;

const colors=computed(()=>({'--long':cssColor('candleUp'),'--short':cssColor('candleDown'),'--rejected':cssColor('tradeLoss'),
 '--fill':cssColor('tradeWin')}));
const selected=ref(null);
// Fallwechsel schließt die Details wie im Prototyp; ein Slider-Schritt lässt sie offen und aktualisiert sie.
watch(()=>props.scope,()=>{selected.value=null;});
const detail=computed(()=>selected.value&&props.graph.nodes[selected.value]);
const toggle=id=>{selected.value=selected.value===id?null:id;};
</script>

<template>
 <section class="obg" :style="colors" @keydown.esc="selected=null">
  <h2>OB Reaktion · Knotenplan</h2>
  <p class="goal">M5-Retest auch über 50 %: Trägt die interne M1-Struktur die Verteidigung? <strong>true / false / unknown</strong>, Entry separat. Bestehende Produktregeln bleiben unverändert.</p>
  <p class="muted">Knoten anklicken → Details (Enter / Leertaste).</p>
  <div class="current"><strong>{{ graph.head }}</strong><span>{{ graph.text }}</span></div>
  <div class="plan" aria-label="Kausaler Algorithmuspfad">
   <svg viewBox="0 0 400 710" preserveAspectRatio="none" aria-hidden="true">
    <defs><marker id="obg-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="context-stroke"/></marker></defs>
    <path v-for="(d,id) in PATHS" :key="id" class="edge" :d="d" marker-end="url(#obg-arrow)" :data-status="graph.edges[id]" :data-kind="SUPPORT.has(id)?'support':null"/>
   </svg>
   <button v-for="[id,x,y] in LAYOUT" :key="id" type="button" class="node" :class="'n-'+id" :style="{left:x+'%',top:y+'px'}"
    :data-status="graph.nodes[id].status" :data-info="graph.nodes[id].info||null" :data-direction="nodeDir(id)===1?'long':'short'"
    :aria-expanded="selected===id" :aria-label="graph.nodes[id].label+' · '+(graph.nodes[id].sub??STATUS_TEXT[graph.nodes[id].status])"
    @click="toggle(id)">
    <span>{{ graph.nodes[id].label }}</span>
    <small>{{ graph.nodes[id].sub ?? STATUS_TEXT[graph.nodes[id].status] }}</small>
    <span v-if="graph.nodes[id].info&&id!=='counter'" class="meter" :data-tone="graph.nodes[id].meter?.value==null?'unknown':null"
     role="img" :aria-label="graph.nodes[id].meter?.label??'Messung unbekannt'" :title="graph.nodes[id].meter?.label??'Messung unbekannt'">
     <template v-if="graph.nodes[id].meter?.value==null">{{ graph.nodes[id].meter?.label??'Messung unbekannt' }}</template>
     <template v-else><span v-for="s in graph.nodes[id].meter.segments" :key="s.word" class="seg" :style="{width:s.value+'%'}" :data-positive="s.positive"
      :title="Number(s.value.toFixed(2))+' % '+s.word">
      <span v-if="s.value>=25" class="seg-label"><b>{{ Number(s.value.toFixed(2)) }} %</b><span>{{ s.word }}</span></span>
     </span></template>
    </span>
    <span v-if="id==='counter'" class="meter" data-tone="unknown">Messung unbekannt</span>
   </button>
  </div>
  <p class="legend">● durchlaufen · ◇ offen / unbekannt · ○ nicht besucht · × abgelehnt · gestrichelte Seitenspur: Zusatzinfos, keine Gates</p>
  <section v-if="detail" class="details" aria-label="Knotendetails">
   <header><strong>{{ detail.label }} · {{ STATUS_TEXT[detail.status] }}</strong><button aria-label="Knotendetails schließen" @click="selected=null">×</button></header>
   <p v-for="line in detail.detail" :key="line">{{ line }}</p>
  </section>
  <details><summary>Historische Beurteilungen</summary>
   <ul><li v-for="h in graph.history" :key="h.at+h.text">{{ h.time }} · damals {{ h.text }}</li></ul>
  </details>
 </section>
</template>

<style scoped>
.obg{--surface:#1c2226;--line:#364147;--accent:#9cd5ef;--muted:#b3bec4;font-size:14px;line-height:1.5;color:#eff3f4}
h2{font-size:17px;margin:4px 0}
.goal{font-size:12px;margin:8px 0}.muted{color:var(--muted);margin:8px 0}
.current{font-size:12px;display:grid;gap:4px;padding:8px;background:var(--surface)}
.plan{position:relative;width:100%;height:710px;margin-top:8px}
.plan>svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.edge{fill:none;stroke:#65747e;stroke-width:1.5;opacity:.35;stroke-dasharray:4 4}
.edge[data-status="visited"]{stroke:var(--accent);stroke-width:3;opacity:1;stroke-dasharray:none}
.edge[data-status="unknown"]{opacity:.8}
.edge[data-status="rejected"]{stroke:var(--rejected);stroke-width:3;opacity:1;stroke-dasharray:none}
.edge[data-kind="support"]{stroke-dasharray:3 4;stroke-width:1.5;opacity:.8}
.node{position:absolute;transform:translateX(-50%);width:30%;padding:5px 3px;min-height:44px;font:12px/1.2 system-ui,sans-serif;
 color:#eff3f4;border:1px solid #65747e;border-radius:4px;background:var(--surface);z-index:1;cursor:pointer}
.node small{display:block;margin-top:3px;font-size:10px;color:var(--muted);white-space:pre-line}
.node:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
.node[data-status="visited"]{border:2px solid #b3e5fc;background:#203f50}
.node[data-status="unknown"]{border-style:dashed;background:#303239}
.node[data-status="not-visited"],.node[data-status="alternative"]{opacity:.45;background:#191e22}
.node[data-status="rejected"]{border-color:var(--rejected);background:#50262c;color:#ffd9d7}
.node[aria-expanded="true"]{outline:2px solid #ffd54f;outline-offset:2px}
.node[data-direction="long"]>span:first-child{color:var(--long)}
.node[data-direction="short"]>span:first-child{color:var(--short)}
.node[data-info]{font-size:11px;min-height:66px}
.node[data-info] small{color:#eff3f4}
.n-fvg{width:36%;min-height:54px}.n-counter{width:34%;min-height:80px;font-size:11px}
.n-stop{width:40%;min-height:80px}.n-result{width:45%;min-height:80px}
.meter{display:flex;min-height:28px;margin:4px 0 0;overflow:hidden;border-radius:2px;color:#fff;border-top:1px dashed #88949c}
.meter[data-tone="unknown"]{align-items:center;justify-content:center;font-size:10px;background:#303239}
.seg{display:flex;align-items:center;justify-content:center;flex:none;overflow:hidden;background:#574738}
.seg[data-positive="true"]{background:color-mix(in srgb,var(--fill) 45%,#000)}
.seg-label{font:9px/1.2 system-ui;white-space:nowrap;display:flex;flex-direction:column}.seg-label b{font-size:10px}
.legend{font-size:11px;color:var(--muted)}
.details{border:1px solid var(--line);padding:10px;margin:12px 0;max-height:220px;overflow:auto;overflow-wrap:anywhere}
.details header{display:flex;justify-content:space-between;align-items:center}
.details button{font-size:20px;min-width:44px;background:none;color:inherit;border:1px solid var(--line);border-radius:4px;cursor:pointer}
.details p{margin:8px 0;font-size:13px}
details{margin-top:14px;font-size:13px}
</style>
