<script setup>
import {formatDatedTime} from '../berlinTime.js';
defineProps({snapshot:Object,source:Object,observation:Object});
const partial=snapshot=>{
 const observation=snapshot?.priceObservation;
 if(!snapshot?.liveCoverage?.missingBeforeCapture || !observation)return '';
 return `Teilverlauf ab Erstbeleg: ${{target1:'T1 beobachtet',invalidation:'Invalidierung beobachtet',open:'bis zum Auswertungsstand kein Preisende belegt',unknown:'Preisverlauf unbekannt',ambiguous:'Reihenfolge uneindeutig'}[observation.stage1] ?? 'nicht gespeichert'}${observation.stage2?` / ${{target2:'T2 beobachtet',returned:'Rückkehr beobachtet',open:'weitere Beobachtung offen',noTarget2:'kein T2 gespeichert',unknown:'T2-Verlauf unbekannt',ambiguous:'T2-Reihenfolge uneindeutig'}[observation.stage2] ?? observation.stage2}`:''}`;
};
const date=value=>Number.isFinite(value)?formatDatedTime(value):formatDatedTime(Date.parse(value)/1000);
</script>
<template>
  <small v-if="source?.recordId || snapshot?.evidenceRecordId" class="evidence-provenance">
    {{ (source?.evaluationMode ?? snapshot?.evaluationMode)==='catchup'?'Nachholerkennung':'Original-Liveprüfung' }} · gespeichert {{ date(source?.capturedAt ?? snapshot.evidenceCapturedAt) }} · ausgewertet bis {{ date(source?.evaluatedThrough ?? snapshot.evidenceEvaluatedThrough) }} (Europe/Berlin)
    <span v-if="snapshot?.observationCapturedAt && snapshot.observationCapturedAt!==snapshot.evidenceCapturedAt"> · späterer Verlauf gespeichert {{ date(snapshot.observationCapturedAt) }} · Verlauf bis {{ date(snapshot.observationEvaluatedThrough ?? snapshot.liveObservedThrough) }}</span>
    <span v-if="observation?.recordId"> · späterer Verlauf gespeichert {{ date(observation.capturedAt) }} · ausgewertet bis {{ date(observation.evaluatedThrough) }}</span>
    <span v-if="snapshot?.liveCoverage?.missingBeforeCapture || observation?.coverage?.missingBeforeCapture"> · Verlauf vor dem ersten gespeicherten Prüfstand nicht belegt</span>
    <span v-if="partial(snapshot)"> · {{ partial(snapshot) }}</span>
  </small>
</template>
<style scoped>.evidence-provenance{display:block;color:#b1b7c5;font-size:12px;line-height:1.6;overflow-wrap:anywhere}</style>
