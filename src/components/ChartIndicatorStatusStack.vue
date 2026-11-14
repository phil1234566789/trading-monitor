<template><div class="chart-indicator-status-stack"><slot /></div></template>
<style scoped>
.chart-indicator-status-stack{position:absolute;bottom:40px;left:40px;z-index:2;max-width:calc(100% - 95px);display:flex;flex-direction:column;align-items:flex-start;gap:4px;pointer-events:none;}
/* Mehrzeilige Hinweise teilen sich den Platz, ohne den Chart beim Hover zu verschieben. */
.chart-indicator-status-stack :deep([role="status"]){position:static;max-width:100%;}
</style>
