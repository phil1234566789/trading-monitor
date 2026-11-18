<script setup>
import {computed,ref} from 'vue';
import {useLocalStorageRef} from '../composables/useLocalStorageRef.js';
import {formatBerlinTime} from '../berlinTime.js';
import {DOB_WATCHER_SHORT} from '../dobWatcherStatus.js';
import ChecklistOrderBlock from './ChecklistOrderBlock.vue';

// DOB-Watcher-Panel nach Philips abgenommener Vorschau: Kopf mit Herzschlag, „Aktuell“ (Retest und frischer Entry aller Assets) und
// aufklappbares „Protokoll“ des Tages mit Asset-Filtern. Jede Zeile ist ein Button und klappt Details, die OB-Rahmen (OB1, OB2,
// TS1.1-OB wie in der Checkliste) sowie Chart- und Pin-Link auf. Vorn steht der Status-Satz mit Grund, nach den Rahmen der POI.
const props=defineProps({status:Object,candidates:Array,deliveryIssues:Array});
const emit=defineEmits(['open-chart','open-pin']);
const STATUS_TEXT={retest:'Retest',entry:'Entry',running:'läuft',win:'Win',loss:'Loss',dropped:'verworfen'};
const ASSETS=['XAU','GBP','EUR'];

const openKey=ref(null);
const logOpen=useLocalStorageRef('dobWatcherLogOpen',true);
const assetFilter=useLocalStorageRef('dobWatcherAssets',ASSETS);
const toggleAsset=a=>{assetFilter.value=assetFilter.value.includes(a)?assetFilter.value.filter(x=>x!==a):[...assetFilter.value,a];};

const rows=computed(()=>(props.candidates??[]).map(c=>({...c,asset:DOB_WATCHER_SHORT[c.instrument]??c.instrument,
 statusText:c.status==='blocked'?`⛔ ${c.blockLabel}`:STATUS_TEXT[c.status],clock:formatBerlinTime(c.time)})));
const current=computed(()=>rows.value.filter(r=>r.status==='retest'||r.status==='entry'));
const log=computed(()=>rows.value.filter(r=>r.status!=='retest'&&r.status!=='entry'));
const visibleLog=computed(()=>log.value.filter(r=>assetFilter.value.includes(r.asset)));
const toggleRow=key=>{openKey.value=openKey.value===key?null:key;};
</script>

<template>
  <section class="dob-watcher" aria-label="DOB-Watcher">
    <div class="head">
      <span class="title">DOB-WATCHER</span>
      <span class="dot" :data-tone="status.tone"></span>
      <span class="state">{{ status.text }}</span>
    </div>

    <template v-if="deliveryIssues?.length">
      <div class="section-title issue-title" role="alert">Telegram-Zustellung gestört ({{ deliveryIssues.length }})</div>
      <div class="list">
        <div v-for="d in deliveryIssues" :key="d.key" class="issue">
          <span class="asset">{{ d.asset }}</span><span class="issue-head">{{ d.head }}</span><span class="chip" data-status="loss">{{ d.label }} · {{ d.clock }}</span>
        </div>
      </div>
    </template>

    <div class="section-title">Aktuell ({{ current.length }})</div>
    <div class="list">
      <div v-for="r in current" :key="r.key" class="item">
        <button type="button" class="row" :class="{ open: openKey === r.key }" :aria-expanded="openKey === r.key" :title="r.detail" @click="toggleRow(r.key)">
          <svg class="chevron" aria-hidden="true" width="10" height="10" viewBox="0 0 12 12"><path d="M4 2l4 4-4 4" fill="none" stroke="#9aa0ac" stroke-width="1.6" stroke-linecap="round"/></svg>
          <span class="asset">{{ r.asset }}</span>
          <span class="dir" :data-dir="r.direction">{{ r.direction === 'short' ? '↘ Short' : '↗ Long' }}</span>
          <span class="poi">{{ r.poi }}</span>
          <span class="chip" :data-status="r.status">
            <svg v-if="r.status === 'entry'" aria-hidden="true" width="11" height="11" viewBox="0 0 12 12"><path d="M2.5 6.5l2.3 2.3L9.5 3.8" fill="none" stroke="#5fd3b7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            <svg v-if="r.status === 'retest'" aria-hidden="true" width="11" height="11" viewBox="0 0 12 12"><path d="M6 1.5a3 3 0 0 0-3 3V7L2 8.5h8L9 7V4.5a3 3 0 0 0-3-3zM5 10a1 1 0 0 0 2 0" fill="none" stroke="#f5b94e" stroke-width="1.4" stroke-linejoin="round"/></svg>
            {{ r.statusText }} · {{ r.clock }}
          </span>
        </button>
        <div v-if="openKey === r.key" class="details">
          <span class="head-line">{{ r.head ?? r.detail }}</span>
          <ChecklistOrderBlock v-for="f in r.frames ?? []" :key="f.label" :preview="f" :instrument="r.instrument" :label="f.label" />
          <span v-if="r.poiText">{{ r.poiText }}</span>
          <span class="links">
            <a href="#" @click.prevent="emit('open-chart', r)">Chart öffnen</a>
            <a v-if="r.pinId" href="#" @click.prevent="emit('open-pin', r)">Pin #{{ r.pinId }}</a>
            <span v-else>Pin noch keiner</span>
          </span>
        </div>
      </div>
    </div>

    <div class="log">
      <button type="button" class="log-toggle" :aria-expanded="logOpen" @click="logOpen = !logOpen">
        <svg class="chevron" :class="{ open: logOpen }" aria-hidden="true" width="12" height="12" viewBox="0 0 12 12"><path d="M4 2l4 4-4 4" fill="none" stroke="#9aa0ac" stroke-width="1.5" stroke-linecap="round"/></svg>
        Protokoll ({{ log.length }})
      </button>
      <template v-if="logOpen">
        <div class="filters" role="group" aria-label="Protokoll nach Asset filtern">
          <button v-for="a in ASSETS" :key="a" type="button" class="filter" :class="{ active: assetFilter.includes(a) }" :aria-pressed="assetFilter.includes(a)" @click="toggleAsset(a)">{{ a }}</button>
        </div>
        <div class="list log-list">
          <div v-for="r in visibleLog" :key="r.key" class="item">
            <button type="button" class="row" :class="{ open: openKey === r.key }" :aria-expanded="openKey === r.key" :title="r.detail" @click="toggleRow(r.key)">
              <svg class="chevron" aria-hidden="true" width="10" height="10" viewBox="0 0 12 12"><path d="M4 2l4 4-4 4" fill="none" stroke="#9aa0ac" stroke-width="1.6" stroke-linecap="round"/></svg>
              <span class="asset">{{ r.asset }}</span>
              <span class="dir" :data-dir="r.direction">{{ r.direction === 'short' ? '↘ Short' : '↗ Long' }}</span>
              <span class="poi">{{ r.poi }}</span>
              <span class="chip" :data-status="r.status">{{ r.statusText }} · {{ r.clock }}</span>
            </button>
            <div v-if="openKey === r.key" class="details">
              <span class="head-line">{{ r.head ?? r.detail }}</span>
              <ChecklistOrderBlock v-for="f in r.frames ?? []" :key="f.label" :preview="f" :instrument="r.instrument" :label="f.label" />
              <span v-if="r.poiText">{{ r.poiText }}</span>
              <span class="links">
                <a href="#" @click.prevent="emit('open-chart', r)">Chart öffnen</a>
                <a v-if="r.pinId" href="#" @click.prevent="emit('open-pin', r)">Pin #{{ r.pinId }}</a>
                <span v-else>Pin noch keiner</span>
              </span>
            </div>
          </div>
        </div>
      </template>
    </div>
  </section>
</template>

<style scoped>
.dob-watcher{border:1px solid #2a2e39;border-radius:8px;background:#1a1e29;overflow:hidden;color:#d1d4dc;flex-shrink:0}
.head{padding:10px 12px;display:flex;align-items:center;gap:10px;border-bottom:1px solid #2a2e39}
.title{font-size:13px;font-weight:700;color:#7aa2ff;letter-spacing:.04em}
.dot{width:8px;height:8px;border-radius:50%;background:#26a69a;box-shadow:0 0 0 3px rgba(38,166,154,.25)}
.dot[data-tone=gap]{background:#f5a623;box-shadow:0 0 0 3px rgba(245,166,35,.25)}
.dot[data-tone=down]{background:#ef5350;box-shadow:0 0 0 3px rgba(239,83,80,.25)}
.dot[data-tone=pause]{background:#787b86;box-shadow:0 0 0 3px rgba(120,123,134,.25)}
.state{font-size:12px}
.section-title{padding:10px 12px 4px;font-size:12px;font-weight:600}
.list{padding:4px 8px 10px;display:flex;flex-direction:column}
.log-list{padding:0 8px 10px;max-height:300px;overflow-y:auto}
/* Aufgeklappte Details dürfen Platz brauchen (Philip), die Liste wächst dann mit statt im Kasten zu scrollen. */
.log-list:has(.details){max-height:none}
.item{border-top:1px solid #232733}
.row{width:100%;min-height:36px;padding:6px 4px;border:none;background:transparent;cursor:pointer;display:grid;grid-template-columns:12px 34px 54px minmax(0,1fr) auto;column-gap:8px;align-items:center;font-size:12px;text-align:left;color:#d1d4dc;border-radius:4px}
.row:hover,.row.open{background:#222736}
.row .chevron{transition:transform .1s}
.row.open .chevron,.chevron.open{transform:rotate(90deg)}
.asset{color:#fff;font-weight:600}
.dir{font-size:12px;font-weight:500;color:#5fd3b7}
.dir[data-dir=short]{color:#ff8a87}
.poi{color:#9aa0ac;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.chip{display:inline-flex;align-items:center;gap:4px;font-size:11px;padding:2px 7px;border-radius:9px;white-space:nowrap;background:rgba(41,98,255,.12);color:#9fb6ff}
.chip[data-status=entry],.chip[data-status=win]{background:rgba(38,166,154,.18);color:#5fd3b7}
.chip[data-status=retest]{background:rgba(245,166,35,.16);color:#f5b94e}
.chip[data-status=loss],.chip[data-status=blocked]{background:rgba(239,83,80,.15);color:#ff8a87}
.chip[data-status=dropped]{background:#262a35;color:#9aa0ac}
.details{padding:2px 4px 8px 24px;display:flex;flex-direction:column;gap:4px;font-size:11px;color:#9aa0ac}
.head-line{color:#d1d4dc}
.issue-title{color:#ff8a87}
.issue{min-height:30px;padding:4px;display:grid;grid-template-columns:34px minmax(0,1fr) auto;column-gap:8px;align-items:center;font-size:12px;border-top:1px solid #232733}
.issue-head{color:#9aa0ac;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.links{display:flex;gap:12px}
.links a{color:#7aa2ff;cursor:pointer}.links a:hover{color:#a9c1ff}
.log{border-top:1px solid #2a2e39}
.log-toggle{width:100%;min-height:40px;padding:0 12px;display:flex;align-items:center;gap:8px;background:transparent;border:none;color:#d1d4dc;font-size:12px;font-weight:600;cursor:pointer;text-align:left}
.filters{padding:0 12px 8px;display:flex;gap:4px}
.filter{height:24px;min-width:44px;padding:0 10px;border-radius:4px;font-size:12px;font-weight:700;cursor:pointer;border:1px solid #2a2e39;background:#191c24;color:#5d6270}
.filter.active{border-color:#2962ff;background:#1e2433;color:#fff}
:is(.row,.log-toggle,.filter,.links a):focus-visible{outline:2px solid #91b8ff;outline-offset:2px}
</style>
