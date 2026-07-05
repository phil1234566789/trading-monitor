<script setup>
import { fmtPrice, fmtDateTime } from "../format.js";

defineProps({
  zones: { type: Array, required: true },
});
</script>

<template>
  <div v-if="zones.length === 0" class="trades-empty">Noch keine erreichten POIs.</div>
  <table v-else class="trades-table">
    <thead>
      <tr>
        <th>Erreicht am</th>
        <th>Timeframe</th>
        <th>Richtung</th>
        <th>Zone</th>
        <th>TG gesendet</th>
        <th>Trade-Signal</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="z in zones" :key="z.id">
        <td>{{ fmtDateTime(z.end_time) }}</td>
        <td>{{ z.timeframe }}</td>
        <td>
          <span class="trade-direction" :class="z.direction">{{ z.direction === "long" ? "Long" : "Short" }}</span>
        </td>
        <td>{{ fmtPrice(z.bottom) }} – {{ fmtPrice(z.top) }}{{ z.weak ? " (schwach)" : "" }}</td>
        <td>{{ z.notified_at ? "✅" : "–" }}</td>
        <td class="trade-reasoning-cell">– <span class="trade-time">(folgt mit D3/Claude-Check)</span></td>
      </tr>
    </tbody>
  </table>
</template>
