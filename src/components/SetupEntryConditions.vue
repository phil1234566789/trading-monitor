<script setup>
import { computed } from 'vue';
import { setupEntryConditions, REVIEW_STATUS_LABELS } from '../tradeSetup2Review.js';
import { formatDatedTime } from '../berlinTime.js';
const props = defineProps({ snapshot: { type: Object, required: true } });
const review = computed(() => setupEntryConditions(props.snapshot));
</script>
<template>
  <div class="entry-conditions">
    <h3>Entry 1 · {{ snapshot.entry ? 'Entry-Stand' : 'Kandidatenstand' }} {{ formatDatedTime(snapshot.knownAt) }} Uhr</h3>
    <p v-if="!snapshot.entry">Dies ist der erste gespeicherte Kandidatenstand. Spätere M1-Prüfungen sind hier nicht gespeichert; unbekannt bedeutet nicht, dass die Bedingung im gesamten Lauf nie erfüllt war.</p>
    <p v-if="review.prerequisiteNote">{{ review.prerequisiteNote }}</p>
    <ol>
      <li v-for="condition in review.rows" :key="condition.key">
        <strong>{{ condition.label }}</strong> <span :class="condition.status">{{ REVIEW_STATUS_LABELS[condition.status] }}</span>
        <small v-if="condition.time != null">Belegt / geprüft am {{ formatDatedTime(condition.time) }} Uhr</small>
        <ul><li v-for="(detail, index) in condition.details" :key="index">{{ detail }}</li></ul>
      </li>
    </ol>
    <h4>Zusätzliche Strukturmerkmale · keine zwingenden Entry-1-Bedingungen</h4>
    <p v-for="item in review.observations" :key="item.label"><strong>{{ item.label }}:</strong> {{ item.text }}</p>
    <p>Die M1-Trendrichtung, CHoCH und BOS werden angezeigt, sind aber keine eigenen Pflichtsignale für Entry 1. Der Auslöser ist die bestätigte gleichgerichtete FVG nach dem OB-Retest im auswertbaren M1-Kontext. Ziele und Stopps stehen beim Entry in der Checklist bzw. im Chart.</p>
  </div>
</template>
<style scoped>
.entry-conditions { white-space: normal; min-width: 340px; max-width: 850px; padding: 12px 4px; line-height: 1.6; }
h3 { margin: 0 0 8px; font-size: 14px; } h4 { margin-bottom: 6px; }
p, small { color: #b1b7c5; } small { display: block; }
ol { padding-left: 22px; } ol>li { margin-bottom: 12px; } ul { padding-left: 18px; }
span { display: inline-block; margin-left: 8px; } .passed { color: #71c8b3; } .unmet { color: #ffb77c; } .unknown { color: #b1b7c5; }
</style>
