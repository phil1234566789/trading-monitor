<script setup>
import { fmtPrice, fmtDateTime, fmtR, pricePrecisionForInstrument } from "../format.js";
import { kindLabel, isTargetReached } from "../tradeTargets";

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

// Kompakte Form für die Tabelle (Art + Preis, Chat 2026-07-28: "Target gefällt mir besser als
// Ziele") — Tier/Alter passen hier nicht mehr rein, die stehen ausführlich im Bearbeiten-Panel
// (siehe TradeEditModal.vue: formatTargetLabel).
function targetLabel(t, target) {
  return `${kindLabel(target.kind)} ${fmtPrice(target.price, pricePrecisionForInstrument(t.instrument))}`;
}
// Grün+Haken/Rot+X, sobald der Exit-Preis eine Beurteilung zulässt (Chat 2026-07-28: "brauchen wir
// später mal für die Statistik") — kein Icon ohne Exit-Preis (noch offener Trade, siehe
// isTargetReached: null bleibt neutral, keine Farbe).
function targetReachedClass(t, target) {
  const reached = isTargetReached(t.direction, t.exitPrice, target.price);
  return reached == null ? "" : reached ? "target-reached" : "target-missed";
}
function targetReachedMark(t, target) {
  const reached = isTargetReached(t.direction, t.exitPrice, target.price);
  return reached == null ? "" : reached ? " ✓" : " ✗";
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
        <th>Targets</th>
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
        <td class="trade-targets-cell">
          <span v-if="!t.targets || t.targets.length === 0">–</span>
          <span v-for="target in t.targets" :key="target.id" class="trade-target-item" :class="targetReachedClass(t, target)">
            {{ targetLabel(t, target) }}{{ targetReachedMark(t, target) }}
          </span>
        </td>
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
