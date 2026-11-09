<script setup>
import {SIMULATION_ENTRY_PATTERN_LABELS} from '../simulationEntryPatterns.js';
defineProps({patterns:{type:Array,required:true}});
</script>
<template>
 <span class="entry-patterns" aria-label="Entry Patterns"><span v-for="pattern in patterns.length?patterns:['unknown']" :key="pattern" class="entry-pattern" :class="pattern">{{ SIMULATION_ENTRY_PATTERN_LABELS[pattern] }}</span></span>
</template>
<style scoped>
.entry-patterns{display:inline-flex;flex-wrap:wrap;gap:6px;vertical-align:middle}.entry-pattern{display:inline-block;padding:4px 8px;border:1px solid currentColor;border-radius:4px;font-size:12px;font-weight:700;line-height:1.4;white-space:normal}.pattern1{color:#91b8ff;background:#222a3a}.pattern2{color:var(--reference,#ffd54f);background:#302b1b}.unknown{color:#b1b7c5;background:#1e222d;font-weight:400}
</style>
