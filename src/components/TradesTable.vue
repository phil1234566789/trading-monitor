<script setup>
import { fmtPrice, fmtDateTime, fmtR, pricePrecisionForInstrument } from "../format.js";

defineProps({
  trades: { type: Array, required: true },
});

// Seit Chat 2026-07-28 nur noch EIN Aktions-Button pro Zeile ("edit-request", öffnet
// TradeEditModal.vue) — vorher gab's hier 🔗/+/× einzeln inline, was Philip als "too much,
// Klickrisiko" zurückgemeldet hat (siehe Memory feedback_trade_editing_ui.md).
const emit = defineEmits(["select", "edit-request"]);

const OUTCOME_LABEL = {
  win: "Win",
  loss: "Loss",
  open: "Offen",
  invalid: "Ungültig",
};

function outcomeLabel(t) {
  return t.outcome ? (OUTCOME_LABEL[t.outcome] ?? t.outcome) : "Offen";
}

function targetsLabel(t) {
  if (!t.targets || t.targets.length === 0) return "–";
  return t.targets.map((target) => fmtPrice(target.price, pricePrecisionForInstrument(t.instrument))).join(" / ");
}
</script>

<template>
  <div v-if="trades.length === 0" class="trades-empty">Noch keine Trades.</div>
  <table v-else class="trades-table">
    <thead>
      <tr>
        <th>Richtung</th>
        <th>Setup</th>
        <th>Entry</th>
        <th>SL</th>
        <th>Ziele</th>
        <th>Exit</th>
        <th>Ergebnis</th>
        <th>Begründung</th>
        <th></th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="t in trades" :key="t.id" class="trade-row" @click="emit('select', t)">
        <td>
          <span class="trade-direction" :class="t.direction">{{ t.direction === "short" ? "Short" : "Long" }}</span>
        </td>
        <td class="trade-setup-cell">
          <!-- Matcht 1:1 das "#<id>"-Label der verlinkten M5-OB-Box im Chart (siehe PriceChart.vue:
               refreshTradeSetupLinksInternal) — so lässt sich Tabellenzeile und Chart-Box eindeutig
               zuordnen (Chat 2026-07-27: "damit ich das 1:1 zuordnen kann"). -->
          {{ t.tradeSetupId != null ? `#${t.tradeSetupId}` : "–" }}
        </td>
        <td>
          {{ fmtPrice(t.entryPrice, pricePrecisionForInstrument(t.instrument)) }}<br />
          <span class="trade-time">{{ fmtDateTime(t.entryTime) }}</span>
        </td>
        <td>{{ fmtPrice(t.stopLoss, pricePrecisionForInstrument(t.instrument)) }}</td>
        <td>{{ targetsLabel(t) }}</td>
        <td v-if="t.exitPrice != null">
          {{ fmtPrice(t.exitPrice, pricePrecisionForInstrument(t.instrument)) }}<br />
          <span class="trade-time">{{ fmtDateTime(t.exitTime) }}</span>
        </td>
        <td v-else>–</td>
        <td>
          <span class="trade-outcome" :class="t.outcome ?? 'open'">{{ outcomeLabel(t) }}</span> · {{ fmtR(t.rMultiple) }}
        </td>
        <td class="trade-reasoning-cell">{{ t.reasoning ?? "" }}</td>
        <td>
          <button class="trade-link-btn" title="Trade bearbeiten" @click.stop="emit('edit-request', t)">✏️</button>
        </td>
      </tr>
    </tbody>
  </table>
</template>
