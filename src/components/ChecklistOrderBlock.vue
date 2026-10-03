<script setup>
import { computed } from 'vue';
import { fmtPrice, pricePrecisionForInstrument } from '../format.js';
import { formatDatedTime, formatBerlinTime } from '../berlinTime.js';
import { cssColorScaled } from '../chartColors.js';

const props = defineProps({
  preview: { type: Object, required: true },
  instrument: { type: String, required: true },
});
const bearish = computed(() => props.preview.ob.dir === -1);
const title = computed(() => `${bearish.value ? 'bärische' : 'bullische'} M5 OB${Number.isFinite(props.preview.recognizedAt) ? ` (${formatBerlinTime(props.preview.recognizedAt)} erkannt)` : ''}`);
const price = value => fmtPrice(value, pricePrecisionForInstrument(props.instrument));
const hint = computed(() => props.preview.linked ? `Dem Sweep zugeordnet${Number.isFinite(props.preview.assignedAt) ? ` um ${formatBerlinTime(props.preview.assignedAt)}` : ''}.`
  : `Erster von ${props.preview.candidateCount} zeitlich folgenden M5-OB-Kandidaten. Zuordnung zur Sweep-Bewegung ungeklärt.`);
const colors = computed(() => {
  const token = bearish.value ? 'obBearM5' : 'obBullM5';
  return { backgroundColor: cssColorScaled(token, 1), borderColor: cssColorScaled(token, 5) };
});
</script>

<template>
  <figure class="checklist-ob" :aria-label="`${title}: Oberkante ${price(preview.ob.top)}, Unterkante ${price(preview.ob.bottom)}. ${hint}`">
    <figcaption class="checklist-ob-zone" :style="colors" :title="`${hint} Ursprung: ${formatDatedTime(preview.ob.startTime)} · Berlin`">
      <span class="checklist-ob-top" aria-hidden="true">{{ price(preview.ob.top) }}</span>
      {{ title }}<span v-if="!preview.linked" class="checklist-ob-candidate"> · Kandidat</span>
      <span class="checklist-ob-bottom" aria-hidden="true">{{ price(preview.ob.bottom) }}</span>
    </figcaption>
  </figure>
</template>

<style scoped>
.checklist-ob { margin: 12px 0 8px; font-size: 12px; }
.checklist-ob-candidate { color: #a5aab5; font-size: 11px; }
.checklist-ob-zone { width: fit-content; max-width: 100%; min-width: 90px; padding: 12px 8px; border: 1px solid; position: relative; line-height: 1.5; }
.checklist-ob-top, .checklist-ob-bottom { position: absolute; right: 8px; padding: 0 4px; background: #131722; font-variant-numeric: tabular-nums; }
.checklist-ob-top { top: 0; transform: translateY(-50%); }
.checklist-ob-bottom { bottom: 0; transform: translateY(50%); }
</style>
