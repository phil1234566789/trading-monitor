<script setup>
import {computed} from 'vue';
import {runDerivation,rangeDerivationLabel} from '../simulationRunDerivation.js';
const props=defineProps({run:Object,setupKey:String});
const derivation=computed(()=>runDerivation(props.run));
</script>
<template>
 <p v-if="derivation" class="derivation" role="note">
  <template v-if="setupKey">{{ rangeDerivationLabel(run,setupKey) }}</template>
  <template v-else><strong>Teilweise neu berechnet:</strong> {{ derivation.inheritedSetupKeys.length }} DRs mit unveränderten Originalbelegen übernommen · {{ derivation.recomputedSetupKeys.length }} DRs neu berechnet. Alte Versionsfelder bleiben erhalten.</template>
  <a :href="`#/statistik?run=${encodeURIComponent(derivation.parentRunId)}`">Ursprungslauf</a>
 </p>
</template>
<style scoped>.derivation{font-size:12px;line-height:1.6;color:#b1b7c5;border-left:2px solid #626b7f;padding-left:10px}a{color:#91b8ff;margin-left:8px}</style>
