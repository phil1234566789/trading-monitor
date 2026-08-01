<script setup>
import { computed } from "vue";
import { fmtPrice, pricePrecisionForInstrument } from "../format.js";

// Laniakea-Kontext-Modal (Chat 2026-08-01) — "genau wie bei Metadaten" (Philip), daher derselbe
// MetadataPanel.vue-Rahmen (Drag/Resize/Close) wie beim Debug-Metadaten-Panel. Kreuzt die
// laniakea_context-Zeilen gegen die in Dashboard.vue bereits geladenen `trades` (kein Zweit-Fetch
// nötig) für Instrument/Richtung/Entry/Exit/Ergebnis.
const props = defineProps({
  entries: { type: Array, required: true }, // [{id, tradePositionId, note, createdAt}]
  trades: { type: Array, required: true },
});
const emit = defineEmits(["remove", "update-note"]);

const OUTCOME_LABEL = { win: "Win", loss: "Loss", open: "Offen" };

const rows = computed(() =>
  props.entries.map((entry) => ({ entry, trade: props.trades.find((t) => t.id === entry.tradePositionId) })),
);

let noteSaveTimers = {};
function onNoteInput(entryId, value) {
  clearTimeout(noteSaveTimers[entryId]);
  noteSaveTimers[entryId] = setTimeout(() => emit("update-note", entryId, value), 500);
}
</script>

<template>
  <div v-if="rows.length === 0" class="laniakea-panel-empty">
    Noch nichts an Lana übergeben — Rechtsklick auf eine Trades-Zeile oder einen Chart-Marker
    → "Laniakea zeigen".
  </div>
  <div v-else class="laniakea-panel-list">
    <div v-for="row in rows" :key="row.entry.id" class="laniakea-panel-entry">
      <div v-if="row.trade" class="laniakea-panel-entry-header">
        <span class="trade-direction" :class="row.trade.direction">{{ row.trade.direction === "short" ? "Short" : "Long" }}</span>
        #{{ row.trade.dealingRangeId }} ({{ row.trade.instrument }})
        <button class="laniakea-panel-remove" title="Aus Laniakea-Kontext entfernen" @click="emit('remove', row.entry.id)">🗑</button>
      </div>
      <div v-if="row.trade" class="laniakea-panel-entry-prices">
        Entry {{ row.trade.entryPrice != null ? fmtPrice(row.trade.entryPrice, pricePrecisionForInstrument(row.trade.instrument)) : "–" }}
        · Exit {{ row.trade.exitPrice != null ? fmtPrice(row.trade.exitPrice, pricePrecisionForInstrument(row.trade.instrument)) : "–" }}
        · {{ row.trade.outcome ? (OUTCOME_LABEL[row.trade.outcome] ?? row.trade.outcome) : "Offen" }}
      </div>
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
