<script setup>
import { fmtPrice, fmtDateTime, fmtR } from "../format.js";

defineProps({
  trades: { type: Array, required: true },
});

const OUTCOME_LABEL = {
  win: "Win",
  loss: "Loss",
  open: "Offen",
  invalid: "Ungültig",
};

function outcomeLabel(t) {
  return t.outcome ? (OUTCOME_LABEL[t.outcome] ?? t.outcome) : "Offen";
}
</script>

<template>
  <div v-if="trades.length === 0" class="trades-empty">Noch keine Trades.</div>
  <table v-else class="trades-table">
    <thead>
      <tr>
        <th>Richtung</th>
        <th>Entry</th>
        <th>SL</th>
        <th>TP</th>
        <th>Exit</th>
        <th>Ergebnis</th>
        <th>Begründung</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="t in trades" :key="t.id">
        <td>
          <span class="trade-direction" :class="t.direction">{{ t.direction === "short" ? "Short" : "Long" }}</span>
        </td>
        <td>
          {{ fmtPrice(t.entryPrice) }}<br />
          <span class="trade-time">{{ fmtDateTime(t.entryTime) }}</span>
        </td>
        <td>{{ fmtPrice(t.stopLoss) }}</td>
        <td>{{ fmtPrice(t.takeProfit) }}</td>
        <td v-if="t.exitPrice != null">
          {{ fmtPrice(t.exitPrice) }}<br />
          <span class="trade-time">{{ fmtDateTime(t.exitTime) }}</span>
        </td>
        <td v-else>–</td>
        <td>
          <span class="trade-outcome" :class="t.outcome ?? 'open'">{{ outcomeLabel(t) }}</span> · {{ fmtR(t.rMultiple) }}
        </td>
        <td class="trade-reasoning-cell">{{ t.reasoning ?? "" }}</td>
      </tr>
    </tbody>
  </table>
</template>
