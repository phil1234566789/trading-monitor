<script setup>
import { computed } from 'vue';
import { fmtPrice, pricePrecisionForInstrument } from '../format.js';
import { formatDatedTime } from '../berlinTime.js';
import { cssColorScaled } from '../chartColors.js';

const props = defineProps({
  preview: { type: Object, required: true },
  instrument: { type: String, required: true },
});
const bearish = computed(() => props.preview.ob.dir === -1);
const title = computed(() => `${bearish.value ? 'bärische' : 'bullische'} M5 OB`);
const price = value => fmtPrice(value, pricePrecisionForInstrument(props.instrument));
const hint = computed(() => props.preview.linked ? 'Dem Sweep zugeordnet.'
  : `Erster von ${props.preview.candidateCount} zeitlich folgenden M5-OB-Kandidaten. Zuordnung zur Sweep-Bewegung ungeklärt.`);
const colors = computed(() => {
  const token = bearish.value ? 'obBearM5' : 'obBullM5';
  return { backgroundColor: cssColorScaled(token, 1), borderColor: cssColorScaled(token, 5) };
});
</script>

<template>
  <figure class="checklist-ob" :aria-label="`${title}: Oberkante ${price(preview.ob.top)}, Unterkante ${price(preview.ob.bottom)}. ${hint}`">
    <figcaption>{{ title }}<span v-if="!preview.linked" class="checklist-ob-candidate" :title="hint">Kandidat</span></figcaption>
    <div class="checklist-ob-zone" :style="colors" aria-hidden="true">
      <span class="checklist-ob-top">{{ price(preview.ob.top) }}</span>
      <span class="checklist-ob-bottom">{{ price(preview.ob.bottom) }}</span>
    </div>
    <span class="checklist-ob-time">{{ formatDatedTime(preview.ob.startTime) }} · Berlin</span>
  </figure>
</template>

<style scoped>
.checklist-ob { margin: 6px 0 0; font-size: 13px; }
figcaption { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
.checklist-ob-candidate, .checklist-ob-time { color: #a5aab5; font-size: 11px; }
.checklist-ob-zone { height: 48px; margin: 12px 0; border: 1px solid; position: relative; }
.checklist-ob-top, .checklist-ob-bottom { position: absolute; right: 8px; padding: 0 4px; background: #131722; font-variant-numeric: tabular-nums; }
.checklist-ob-top { top: 0; transform: translateY(-50%); }
.checklist-ob-bottom { bottom: 0; transform: translateY(50%); }
</style>
