<script setup>
import {computed,ref,watch} from 'vue';
import {cssColor} from '../chartColors.js';

// Rendert nur das Graphmodell aus obReactionGraph.js; Knoten = v7-Baum, Optik = alter Codex-Knotenplan.
const props=defineProps({graph:{type:Object,required:true},dir:{type:Number,required:true},scope:{type:String,default:''}});

// [id, x-Mitte %, top px, Breite %]; Kanten im viewBox 400×890 (x = 4 × Prozent).
const LAYOUT=[['detect',50,8,30],['touch',50,80,36],['closed',16,86,28],['broken',50,170,38],['false',16,186,28],
 ['reaction',50,280,36],['counter',62,370,52],['hold',16,470,28],['stop',62,470,52],['noDob',16,590,28],['routeA',46,590,30],['bCheck',81,590,34],
 ['entryB',81,700,30],['result',46,790,44]];
const SIDE=['fvgList','internalOb'];
const PATHS={detectTouch:'M200 66V80',touchClosed:'M128 109H120',touchBroken:'M200 138V170',brokenFalse:'M124 205H120',
 brokenReaction:'M200 242V280',reactionOb1:'M200 338V355H64V470',reactionCounter:'M200 338V355H248V370',counterStop:'M248 438V470',holdNoDob:'M64 540V590',
 stopA:'M248 525V570H184V590',stopB:'M248 525V570H324V590',bEntry:'M324 662V700',aResult:'M184 648V790',bResult:'M324 744V820H272',
 closedResult:'M8 114H4V860H96',falseResult:'M8 209H4V860H96',side:'M260 30H276'};
const STATUS_TEXT={visited:'● durchlaufen',unknown:'◇ offen / unbekannt','not-visited':'○ nicht besucht',alternative:'○ überholte Alternative',
 rejected:'× abgelehnt',info:'i Zusatzinfo · kein Gate'};

const colors=computed(()=>({'--long':cssColor('candleUp'),'--short':`color-mix(in srgb, ${cssColor('candleDown')} 65%, white)`,'--rejected':cssColor('tradeLoss'),
 '--fill':cssColor('tradeWin'),'--fvg':cssColor('fvgCandle')}));
const selected=ref(null);
// Fallwechsel schließt die Details wie im Prototyp; ein Slider-Schritt lässt sie offen und aktualisiert sie.
watch(()=>props.scope,()=>{selected.value=null;});
const detail=computed(()=>selected.value&&props.graph.nodes[selected.value]);
const toggle=id=>{selected.value=selected.value===id?null:id;};
const nodeText=node=>node.sub??STATUS_TEXT[node.status];
</script>

<template>
 <section class="obg" :style="colors" @keydown.esc="selected=null">
  <h2>OB Reaktion · Knotenplan</h2>
  <p class="goal">Entscheidungsbaum v7 (Default W1): <strong>true / false / pending / unknown</strong> für die Entry-Machbarkeit; strukturelle Reaktion separat. Zustände aus dem Produktergebnis zum Slider-Stand.</p>
  <p class="muted">Knoten anklicken → Details (Enter / Leertaste).</p>
  <div class="current"><strong>{{ graph.head }}</strong><span>{{ graph.text }}</span></div>
  <div class="plan" aria-label="Kausaler Algorithmuspfad" :data-direction="dir===1?'long':'short'">
   <svg viewBox="0 0 400 890" preserveAspectRatio="none" aria-hidden="true">
    <defs><marker id="obg-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="context-stroke"/></marker></defs>
    <path v-for="(d,id) in PATHS" :key="id" class="edge" :d="d" marker-end="url(#obg-arrow)" :data-status="graph.edges[id]" :data-kind="id==='side'?'support':null"/>
   </svg>
   <button v-for="[id,x,y,w] in LAYOUT" :key="id" type="button" class="node" :style="{left:x+'%',top:y+'px',width:w+'%'}"
    :data-status="graph.nodes[id].status" :data-direction="(id==='counter'?-dir:dir)===1?'long':'short'" :aria-expanded="selected===id" :aria-label="graph.nodes[id].label+' · '+nodeText(graph.nodes[id])"
    @click="toggle(id)">
    <span>{{ graph.nodes[id].label }}</span>
    <strong v-if="graph.nodes[id].headline" class="headline">{{ graph.nodes[id].headline }}</strong>
    <small>{{ nodeText(graph.nodes[id]) }}</small>
   </button>
   <div class="side">
    <button v-for="id in SIDE" :key="id" type="button" class="node" data-info="true" :data-status="graph.nodes[id].status"
     :aria-expanded="selected===id" :aria-label="graph.nodes[id].label+' · '+nodeText(graph.nodes[id])+' · Zusatzinformation, kein Pflicht-Gate'"
     @click="toggle(id)">
     <span>{{ graph.nodes[id].label }}</span>
     <small>{{ nodeText(graph.nodes[id]) }}</small>
     <span v-for="(m,i) in graph.nodes[id].meters" :key="i" class="meter" :data-tone="m.value==null?'unknown':null" role="img" :aria-label="m.label" :title="(m.range?m.range+' · ':'')+m.label">
      <template v-if="m.value==null">{{ m.label }}</template>
      <template v-else><span v-for="s in m.segments" :key="s.word" class="seg" :style="{width:s.value+'%'}" :data-positive="s.positive">
       <span v-if="s.value>=25" class="seg-label"><b>{{ Number(s.value.toFixed(2)) }} %</b><span>{{ s.word }}</span></span>
      </span></template>
     </span>
    </button>
   </div>
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
/* Basistokens des alten Knotenplans; alle Zustandsfarben werden daraus bzw. aus chartColors-Tokens gemischt. */
.obg{--surface:#1c2226;--line:#364147;--accent:#9cd5ef;--muted:#b3bec4;--text:#eff3f4;--edge:color-mix(in srgb,var(--muted) 45%,var(--surface));
 font-size:14px;line-height:1.5;color:var(--text)}
h2{font-size:17px;margin:4px 0}
.goal{font-size:12px;margin:8px 0}.muted{color:var(--muted);margin:8px 0}
.current{font-size:12px;display:grid;gap:4px;padding:8px;background:var(--surface)}
.plan{position:relative;width:100%;height:890px;margin-top:8px}
.plan>svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.edge{fill:none;stroke:var(--edge);stroke-width:1.5;opacity:.35;stroke-dasharray:4 4}
.edge[data-status="visited"]{stroke:var(--accent);stroke-width:3;opacity:1;stroke-dasharray:none}
.edge[data-status="unknown"]{opacity:.8}
.edge[data-status="rejected"]{stroke:var(--rejected);stroke-width:3;opacity:1;stroke-dasharray:none}
.edge[data-kind="support"]{stroke-dasharray:3 4;stroke-width:1.5;opacity:.8}
.node{position:absolute;transform:translateX(-50%);padding:5px 3px;min-height:44px;font:12px/1.2 system-ui,sans-serif;
 color:var(--text);border:1px solid var(--edge);border-radius:4px;background:var(--surface);z-index:1;cursor:pointer}
.node .headline{display:block;margin-top:3px;font-size:15px}
.node small{display:block;margin-top:3px;font-size:10px;color:var(--muted);white-space:pre-line}
.node:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
.node[data-status="visited"]{border:2px solid color-mix(in srgb,var(--accent) 70%,white);background:color-mix(in srgb,var(--accent) 25%,var(--surface))}
.node[data-status="unknown"]{border-style:dashed;background:color-mix(in srgb,var(--muted) 15%,var(--surface))}
.node[data-status="not-visited"],.node[data-status="alternative"]{opacity:.45;background:color-mix(in srgb,var(--surface) 80%,black)}
.node[data-status="rejected"]{border-color:var(--rejected);background:color-mix(in srgb,var(--rejected) 25%,var(--surface));color:color-mix(in srgb,var(--rejected) 25%,white)}
.node[aria-expanded="true"]{outline:2px solid var(--fvg);outline-offset:2px}
.plan[data-direction="long"] .side .node>span:first-child,.node[data-direction="long"]>span:first-child{color:var(--long)}
.plan[data-direction="short"] .side .node>span:first-child,.node[data-direction="short"]>span:first-child{color:var(--short)}
.side{position:absolute;left:68%;top:8px;width:30%;max-height:350px;overflow:auto;display:flex;flex-direction:column;gap:10px;z-index:1;
 border-left:1px dashed var(--edge);padding-left:4px}
.side .node{position:static;transform:none;width:100%;flex:none;font-size:11px;min-height:66px;border-style:dashed}
.side .node small{color:var(--text)}
.meter{display:flex;min-height:24px;margin:4px 0 0;overflow:hidden;border-radius:2px;color:white}
.meter[data-tone="unknown"]{align-items:center;justify-content:center;font-size:10px;background:color-mix(in srgb,var(--muted) 15%,var(--surface))}
.seg{display:flex;align-items:center;justify-content:center;flex:none;overflow:hidden;background:color-mix(in srgb,var(--fvg) 30%,var(--surface))}
.seg[data-positive="true"]{background:color-mix(in srgb,var(--fill) 45%,black)}
.seg-label{font:9px/1.2 system-ui;white-space:nowrap;display:flex;flex-direction:column}.seg-label b{font-size:10px}
.legend{font-size:11px;color:var(--muted)}
.details{border:1px solid var(--line);padding:10px;margin:12px 0;max-height:220px;overflow:auto;overflow-wrap:anywhere}
.details header{display:flex;justify-content:space-between;align-items:center}
.details button{font-size:20px;min-width:44px;background:none;color:inherit;border:1px solid var(--line);border-radius:4px;cursor:pointer}
.details p{margin:8px 0;font-size:13px}
details{margin-top:14px;font-size:13px}
</style>
