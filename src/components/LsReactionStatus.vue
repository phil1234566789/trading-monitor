<script setup>
defineProps({status:String,details:String});
</script>
<template><div class="trade-setup11-status" role="status">{{status}}<div v-if="details">{{details}}</div></div></template>
<style scoped>
.trade-setup11-status{position:absolute;bottom:40px;left:40px;z-index:2;max-width:calc(100% - 95px);font-size:11px;pointer-events:none;color:var(--text-secondary,#aaa);background:var(--bg-panel,#161b22);padding:3px 6px;border-radius:4px;}
</style>
