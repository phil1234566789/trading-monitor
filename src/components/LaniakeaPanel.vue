<script setup>
import { computed } from "vue";
import { fmtPrice, pricePrecisionForInstrument } from "../format.js";

// Laniakea-Kontext-Modal (Chat 2026-08-01) — "genau wie bei Metadaten" (Philip), daher derselbe
// MetadataPanel.vue-Rahmen (Drag/Resize/Close) wie beim Debug-Metadaten-Panel. kind="trade_position"
// wird gegen die in Dashboard.vue bereits geladenen `trades` gekreuzt (kein Zweit-Fetch nötig,
// siehe dort); kind="ob_zone" bringt seine Anzeige-Felder schon über den Eintrag selbst mit
// (laniakeaContext.js embedded ob_zones direkt in fetchLaniakeaContext, da es dafür in Dashboard.vue
// keine bereits geladene reaktive Liste gibt wie bei trades).
const props = defineProps({
  entries: { type: Array, required: true },
  trades: { type: Array, required: true },
});
const emit = defineEmits(["remove", "update-note"]);

const OUTCOME_LABEL = { win: "Win", loss: "Loss", open: "Offen" };

const rows = computed(() =>
  props.entries.map((entry) => ({
    entry,
    trade: entry.kind === "trade_position" ? props.trades.find((t) => t.id === entry.tradePositionId) : null,
  })),
);

let noteSaveTimers = {};
function onNoteInput(entryId, value) {
  clearTimeout(noteSaveTimers[entryId]);
  noteSaveTimers[entryId] = setTimeout(() => emit("update-note", entryId, value), 500);
}
</script>

<template>
  <div v-if="rows.length === 0" class="laniakea-panel-empty">
    Noch nichts an Lana übergeben — Rechtsklick auf eine Trades-Zeile, einen Chart-Marker oder eine
    OB-Zone → "Laniakea zeigen".
  </div>
  <div v-else class="laniakea-panel-list">
    <div v-for="row in rows" :key="row.entry.id" class="laniakea-panel-entry">
      <template v-if="row.entry.kind === 'ob_zone'">
        <div class="laniakea-panel-entry-header">
          <span class="trade-direction" :class="row.entry.obZone?.direction">{{ row.entry.obZone?.direction === "short" ? "Short" : "Long" }}</span>
          {{ row.entry.obZone?.timeframe }}-OB ({{ row.entry.obZone?.instrument }})
          <button class="laniakea-panel-remove" title="Aus Laniakea-Kontext entfernen" @click="emit('remove', row.entry.id)">🗑</button>
        </div>
        <div v-if="row.entry.obZone" class="laniakea-panel-entry-prices">
          {{ fmtPrice(row.entry.obZone.bottom, pricePrecisionForInstrument(row.entry.obZone.instrument)) }}
          – {{ fmtPrice(row.entry.obZone.top, pricePrecisionForInstrument(row.entry.obZone.instrument)) }}
          · {{ row.entry.obZone.invalidated ? "Invalidiert" : row.entry.obZone.touched ? "Touched" : "Aktiv" }}
        </div>
      </template>
      <template v-else-if="row.entry.kind === 'trade_setup'">
        <div class="laniakea-panel-entry-header">
          <span class="trade-direction" :class="row.entry.tradeSetup?.direction">{{ row.entry.tradeSetup?.direction === "short" ? "Short" : "Long" }}</span>
          Setup #{{ row.entry.tradeSetupId }} ({{ row.entry.tradeSetup?.instrument }})
          <button class="laniakea-panel-remove" title="Aus Laniakea-Kontext entfernen" @click="emit('remove', row.entry.id)">🗑</button>
        </div>
        <div v-if="row.entry.tradeSetup" class="laniakea-panel-entry-prices">
          M5-OB {{ fmtPrice(row.entry.tradeSetup.obBottom, pricePrecisionForInstrument(row.entry.tradeSetup.instrument)) }}
          – {{ fmtPrice(row.entry.tradeSetup.obTop, pricePrecisionForInstrument(row.entry.tradeSetup.instrument)) }}
        </div>
      </template>
      <template v-else-if="row.entry.kind === 'trade_confirmation'">
        <div class="laniakea-panel-entry-header">
          ✔ Bestätigung #{{ row.entry.tradeConfirmationId }}
          <button class="laniakea-panel-remove" title="Aus Laniakea-Kontext entfernen" @click="emit('remove', row.entry.id)">🗑</button>
        </div>
        <div v-if="row.entry.tradeConfirmation" class="laniakea-panel-entry-prices">
          {{ fmtPrice(row.entry.tradeConfirmation.rangeLow, 5) }} – {{ fmtPrice(row.entry.tradeConfirmation.rangeHigh, 5) }}
          · {{ row.entry.tradeConfirmation.touchedTime ? "Touched" : "Aktiv" }}
        </div>
      </template>
      <template v-else-if="row.trade">
        <div class="laniakea-panel-entry-header">
          <span class="trade-direction" :class="row.trade.direction">{{ row.trade.direction === "short" ? "Short" : "Long" }}</span>
          #{{ row.trade.dealingRangeId }} ({{ row.trade.instrument }})
          <button class="laniakea-panel-remove" title="Aus Laniakea-Kontext entfernen" @click="emit('remove', row.entry.id)">🗑</button>
        </div>
        <div class="laniakea-panel-entry-prices">
          Entry {{ row.trade.entryPrice != null ? fmtPrice(row.trade.entryPrice, pricePrecisionForInstrument(row.trade.instrument)) : "–" }}
          · Exit {{ row.trade.exitPrice != null ? fmtPrice(row.trade.exitPrice, pricePrecisionForInstrument(row.trade.instrument)) : "–" }}
          · {{ row.trade.outcome ? (OUTCOME_LABEL[row.trade.outcome] ?? row.trade.outcome) : "Offen" }}
        </div>
      </template>
      <div v-else class="laniakea-panel-entry-header">
        Trade #{{ row.entry.tradePositionId }} (nicht geladen)
        <button class="laniakea-panel-remove" title="Aus Laniakea-Kontext entfernen" @click="emit('remove', row.entry.id)">🗑</button>
      </div>
      <textarea
        class="laniakea-panel-note"
        placeholder="Notiz (optional)"
        rows="2"
        :value="row.entry.note ?? ''"
        @input="onNoteInput(row.entry.id, $event.target.value)"
      />
    </div>
  </div>
</template>

<style scoped>
.laniakea-panel-empty {
  color: #787b86;
  font-size: 12px;
  padding: 8px 2px;
}

.laniakea-panel-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.laniakea-panel-entry {
  border: 1px solid #2a2e39;
  border-radius: 6px;
  padding: 8px;
}

.laniakea-panel-entry-header {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #d1d4dc;
  font-size: 13px;
  font-weight: 600;
}

.laniakea-panel-entry-prices {
  color: #787b86;
  font-size: 12px;
  margin-top: 4px;
}

.laniakea-panel-remove {
  margin-left: auto;
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 13px;
  padding: 2px 4px;
}

.laniakea-panel-note {
  width: 100%;
  margin-top: 6px;
  resize: vertical;
  background: #131722;
  border: 1px solid #2a2e39;
  border-radius: 4px;
  color: #d1d4dc;
  font-size: 12px;
  padding: 5px 7px;
  font-family: inherit;
  box-sizing: border-box;
}

.trade-direction.long {
  color: #26a69a;
}
.trade-direction.short {
  color: #ef5350;
}
</style>
