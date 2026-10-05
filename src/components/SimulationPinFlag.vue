<script setup>
import {ref,onBeforeUnmount} from 'vue';
defineProps({note:String});
const flag=ref(null),tooltip=ref(null);
let closeTimer;
function place() {
  const anchor=flag.value.getBoundingClientRect(),box=tooltip.value;
  const margin=8,gap=4,below=window.innerHeight-anchor.bottom-gap-margin,above=anchor.top-gap-margin;
  const bottomSide=below>=above;
  box.style.maxHeight=`${Math.max(0,bottomSide?below:above)}px`;
  const rect=box.getBoundingClientRect();
  box.style.left=`${Math.max(margin,Math.min(anchor.left,window.innerWidth-rect.width-margin))}px`;
  box.style.top=`${bottomSide?anchor.bottom+gap:Math.max(margin,anchor.top-gap-rect.height)}px`;
}
function hide() {
  clearTimeout(closeTimer);
  tooltip.value?.hidePopover();
  window.removeEventListener('scroll',place,true);
  window.removeEventListener('resize',place);
}
function show() {
  clearTimeout(closeTimer);
  // Die Top-Layer entkommt auch transformierten Karten und overflow-Scrollcontainern.
  tooltip.value.showPopover();place();
  window.addEventListener('scroll',place,true);
  window.addEventListener('resize',place);
}
function leave() {
  clearTimeout(closeTimer);
  closeTimer=setTimeout(()=>{
    if(!flag.value?.matches(':hover')&&!flag.value?.contains(document.activeElement))hide();
  },100);
}
onBeforeUnmount(hide);
</script>
<template>
  <span ref="flag" class="pin-flag" tabindex="0" :aria-label="note?.trim() || 'Angepinnt · keine Notiz gespeichert'"
    @mouseenter="show" @mouseleave="leave" @focusin="show" @focusout="leave" @keydown.esc="hide">⚑
    <span ref="tooltip" class="pin-tooltip" popover="manual" role="tooltip" tabindex="0"
      @mouseenter="show" @mouseleave="leave">{{ note?.trim() || 'Keine Notiz gespeichert.' }}</span>
  </span>
</template>
<style scoped>
.pin-flag{position:relative;display:inline-block;color:var(--pin-color);margin-right:4px}.pin-tooltip{position:fixed;inset:auto;margin:0;box-sizing:border-box;width:max-content;max-width:min(360px,calc(100vw - 16px));overflow:auto;padding:8px;border:1px solid #596172;border-radius:4px;background:#1e222d;color:#d1d4dc;font-size:12px;line-height:1.4;font-weight:400;white-space:pre-wrap;overflow-wrap:anywhere;text-align:left}.pin-flag:focus-visible{outline:2px solid #91b8ff;outline-offset:2px}
</style>
