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
        <td>{{ r.detail }}</td>
        <td>{{ r.price }}</td>
        <td>{{ r.deliveryLabel ?? (r.notifiedAt ? "TG ✅" : "–") }}</td>
      </tr>
    </tbody>
  </table>
</template>
