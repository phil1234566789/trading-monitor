<script setup>
import { fmtDateTime } from "../format.js";

defineProps({
  rows: { type: Array, required: true },
});
</script>

<template>
  <div v-if="rows.length === 0" class="trades-empty">Noch keine Alarme.</div>
  <table v-else class="trades-table">
    <thead>
      <tr>
        <th>Signalzeit</th>
        <th>Erfasst / gesendet</th>
        <th>Typ</th>
        <th>Richtung</th>
        <th>Detail</th>
        <th>Preis</th>
        <th>Versand</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="r in rows" :key="r.id">
        <td>{{ fmtDateTime(r.signalAt ?? r.time, { timeZone: "Europe/Berlin" }) }}</td>
        <td>{{ fmtDateTime(r.detectedAt ?? r.notifiedAt, { timeZone: "Europe/Berlin" }) }}</td>
        <td>{{ r.typeLabel }}</td>
        <td>
          <span class="trade-direction" :class="r.direction">{{ r.directionLabel }}</span>
        </td>
        <td>{{ r.detail }}<a v-if="r.link" class="chart-link" :href="r.link" target="_blank" rel="noopener">Chart</a></td>
        <td>{{ r.price }}</td>
        <td>{{ r.deliveryLabel ?? (r.notifiedAt ? "TG ✅" : "–") }}</td>
      </tr>
    </tbody>
  </table>
</template>
<style scoped>
.chart-link{margin-left:8px;color:#91b8ff;cursor:pointer}
.chart-link:focus-visible{outline:2px solid #91b8ff;outline-offset:2px}
</style>
