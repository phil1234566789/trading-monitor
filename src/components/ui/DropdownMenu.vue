<script setup>
import {onMounted,onUnmounted,ref} from 'vue';
import ToggleButton from './ToggleButton.vue';
const open=defineModel('open',{type:Boolean,default:false});
// Derselbe separate Pfeil wie im Trades-Menü; Aufrufer dürfen keine andere Buttonform einsetzen.
defineProps({label:{type:String,default:'Untermenü'},align:{type:String,default:'left'}});
const root=ref(null),trigger=ref(null);
function outside(event){if(!root.value?.contains(event.target))open.value=false;}
function escape(){open.value=false;trigger.value?.$el.focus();}
onMounted(()=>document.addEventListener('click',outside));
onUnmounted(()=>document.removeEventListener('click',outside));
</script>
<template>
 <div ref="root" class="ui-dropdown toggle-group" @keydown.esc.stop="escape">
  <slot name="leading" />
  <ToggleButton ref="trigger" variant="caret" :class="{open}" :aria-label="label" :aria-expanded="open" @click="open=!open">▾</ToggleButton>
  <div v-if="open" class="ui-dropdown-panel" :data-align="align"><slot :close="escape" /></div>
 </div>
</template>
<style scoped>
.ui-dropdown{position:relative;display:flex;gap:1px}
.ui-dropdown-panel{position:absolute;top:100%;left:0;margin-top:4px;z-index:20;background:#1e222d;border:1px solid #2a2e39;border-radius:6px;box-shadow:0 4px 16px rgba(0,0,0,.45);padding:4px;display:flex;flex-direction:column;gap:2px;min-width:160px;width:max-content;max-width:min(480px,calc(100vw - 32px));max-height:70vh;overflow:auto}
.ui-dropdown-panel[data-align="right"]{left:auto;right:0}
</style>
