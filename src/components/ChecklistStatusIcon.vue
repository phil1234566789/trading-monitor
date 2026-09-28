<script setup>
defineProps({
  label: { type: String, required: true },
  symbol: { type: String, required: true },
});
</script>

<template>
  <span class="status-icon" role="img" tabindex="0" :aria-label="label" :title="label">
    <span aria-hidden="true">{{ symbol }}</span>
    <span class="status-tooltip" aria-hidden="true">{{ label }}</span>
  </span>
</template>

<style scoped>
.status-icon { position: relative; display: inline-flex; flex: none; align-items: center; justify-content: center; width: 24px; height: 24px; border: 1px solid currentColor; border-radius: 4px; font-size: 15px; line-height: 1; cursor: help; }
.status-icon:focus-visible { outline: 2px solid #90b4ff; outline-offset: 2px; }
.status-tooltip { display: none; position: absolute; z-index: 30; top: calc(100% + 4px); right: 0; width: max-content; max-width: 240px; padding: 6px 8px; border: 1px solid #596172; border-radius: 4px; background: #1e222d; color: #d1d4dc; font-size: 12px; line-height: 1.4; font-weight: 400; }
.status-icon:hover .status-tooltip, .status-icon:focus .status-tooltip { display: block; }
</style>
