<script setup>
defineProps({note:String});
</script>
<template>
  <span class="pin-flag" tabindex="0" :aria-label="note?.trim() || 'Angepinnt · keine Notiz gespeichert'">⚑
    <span class="pin-tooltip" aria-hidden="true">{{ note?.trim() || 'Keine Notiz gespeichert.' }}</span>
  </span>
</template>
<style scoped>
.pin-flag{position:relative;display:inline-block;color:var(--pin-color);margin-right:4px}.pin-tooltip{display:none;position:absolute;z-index:30;top:calc(100% + 4px);left:0;width:max-content;max-width:min(360px,70vw);padding:8px;border:1px solid #596172;border-radius:4px;background:#1e222d;color:#d1d4dc;font-size:12px;line-height:1.4;font-weight:400;white-space:pre-wrap;overflow-wrap:anywhere;text-align:left}.pin-flag:hover .pin-tooltip,.pin-flag:focus .pin-tooltip{display:block}.pin-flag:focus-visible{outline:2px solid #91b8ff;outline-offset:2px}
</style>
