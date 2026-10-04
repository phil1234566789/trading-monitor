<script setup>
import {computed,ref} from 'vue';
import {formatBerlinTime,formatDatedTime} from '../berlinTime.js';
import {checklistHistoryAt,CHECKLIST_HISTORY_VERSION} from '../tradeSetup2ChecklistHistory.js';
import {checklistHistoryChanges} from '../checklistReplayView.js';
const props=defineProps({history:Object,asOf:Number});
defineEmits(['jump']);
const checkpoint=ref('');
const active=computed(()=>checklistHistoryAt(props.history,props.asOf));
const supported=computed(()=>props.history?.version===CHECKLIST_HISTORY_VERSION);
const entries=computed(()=>props.history?.entries.filter(e=>checklistHistoryChanges(e,checkpoint.value).length) ?? []);
const icon=value=>({passed:'✓',unmet:'✕',unknown:'?',observed:'~',validated:'✓',confirmed:'✓',disqualified:'✕',active:'✓',ended:'✕'})[value?.status ?? value?.main?.state ?? value] ?? '?';
</script>
<template>
  <section class="replay-history" aria-label="Gespeicherter Checklisten-Verlauf">
    <p v-if="!supported">kein Verlauf gespeichert</p>
    <template v-else>
      <p class="stand" role="status"><template v-if="active">Stand von {{ formatBerlinTime(active.knownAt) }} · {{ formatDatedTime(active.knownAt).slice(0,10) }} (Europe/Berlin)</template><template v-else>Diese DR war zu diesem Replay-Zeitpunkt noch nicht erkannt.</template></p>
      <dl v-if="active" class="history-checks"><template v-for="row in active.rows" :key="row.key"><dt>{{ icon(row.status) }} {{ row.label }}</dt><dd><p v-for="(detail,index) in row.details" :key="index">{{ detail }}</p></dd></template></dl>
      <details><summary>Checklisten-Verlauf · {{ history.entries.length }} Stände</summary>
        <label>Checkpoint <select v-model="checkpoint"><option value="">Alle</option><option v-for="letter in 'ABCDEFGH'" :key="letter">{{ letter }}</option></select></label>
        <p v-if="!entries.length">Keine Änderungen für diesen Filter.</p>
        <ol><li v-for="(entry,index) in entries" :key="`${entry.knownAt}:${index}`"><button type="button" :aria-current="entry===active?'true':undefined" @click="$emit('jump',entry.knownAt)"><strong>{{ formatDatedTime(entry.knownAt) }} · {{ entry.source }}</strong><span v-for="change in checklistHistoryChanges(entry,checkpoint)" :key="change.key" :title="change.old?.details?.join(' · ')">{{ change.label ?? change.key }}: {{ change.old==null?'?':icon(change.old) }} → {{ icon(change.new) }} · {{ change.text }}</span></button></li></ol>
      </details>
    </template>
  </section>
</template>
<style scoped>
.replay-history{font-size:12px;line-height:1.5;color:#d1d4dc}.stand{font-weight:600;color:#d1d4dc}.history-checks{margin:12px 0}.history-checks dt{padding-top:10px;border-top:1px solid #2a2e39;font-weight:600}.history-checks dd{margin:4px 0 10px;color:#a5a9b4}.history-checks p{margin:3px 0}summary{cursor:pointer;padding:8px 0}label{display:flex;align-items:center;gap:8px;margin:8px 0}select,button{background:#1e222d;color:inherit;border:1px solid #434651;border-radius:4px;padding:8px}ol{list-style:none;margin:0;padding:0}li{margin:6px 0}button{width:100%;text-align:left;cursor:pointer}button span{display:block;margin-top:4px;overflow-wrap:anywhere}button[aria-current]{border-color:#91b8ff;box-shadow:inset 3px 0 #91b8ff}:is(button,select,summary):focus-visible{outline:2px solid #91b8ff;outline-offset:2px}
</style>
