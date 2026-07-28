<script setup>
import { ref, computed, watch } from "vue";
import { updateTrade, deleteTrade, unlinkTradeSetup, removeTargetFromTrade } from "../tradeIntake.js";
import { fmtPrice, fmtDateTime, pricePrecisionForInstrument } from "../format.js";
import MetadataPanel from "./MetadataPanel.vue";

// Ersetzt die vorherigen Inline-Buttons in TradesTable.vue (🔗 verknüpfen, + Ziel, × Ziel
// entfernen) — Chat 2026-07-27/28: "das war jetzt bissl too much, was ist wenn man versehentlich
// drauf klickt ... mir wär lieber, wenn man den Trade editieren kann". EIN Button pro Zeile öffnet
// jetzt dieses Panel, alle bisherigen Aktionen (inkl. neu: Preise/Ergebnis/Begründung bearbeiten,
// Trade löschen) leben hier. Bleibt bewusst offen, während man Setup/Ziel im Chart anklickt (siehe
// request-link/request-add-target) — MetadataPanel blockiert den Chart nicht (position: fixed,
// kein Backdrop), das Panel zeigt den aktualisierten Stand automatisch, weil `trade` von
// Dashboard.vue live aus der `trades`-Liste nachgereicht wird, nicht als einmalige Kopie.
const props = defineProps({
  trade: { type: Object, required: true },
});
const emit = defineEmits(["close", "saved", "deleted", "request-link", "request-add-target"]);

const precision = computed(() => pricePrecisionForInstrument(props.trade.instrument));

const entryPrice = ref("");
const stopLoss = ref("");
const exitPrice = ref("");
const exitTimeInput = ref("");
const outcome = ref("");
const reasoning = ref("");
const saving = ref(false);

// <input type="datetime-local"> Roundtrip wie in NewsModal.vue/Dashboard.vue (replayInputValue) —
// Browser-Lokalzeit, kein eigenes Zeitzonen-Handling nötig.
function toDatetimeLocal(unixSeconds) {
  const d = new Date(unixSeconds * 1000);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Formular bei jedem Trade-Wechsel (anderer Trade geöffnet) ODER externem Update (Ziel/Setup über
// den Chart hinzugefügt, siehe oben) mit dem aktuellen DB-Stand neu befüllen — NICHT nur beim
// ersten Öffnen, sonst würde ein externes Update während offenem Panel nicht in den Feldern
// auftauchen (nur in den schreibgeschützten Ziele-/Setup-Listen unten).
watch(
  () => props.trade,
  (t) => {
    entryPrice.value = t.entryPrice ?? "";
    stopLoss.value = t.stopLoss ?? "";
    exitPrice.value = t.exitPrice ?? "";
    exitTimeInput.value = t.exitTime != null ? toDatetimeLocal(t.exitTime) : "";
    outcome.value = t.outcome ?? "";
    reasoning.value = t.reasoning ?? "";
  },
  { immediate: true },
);

async function save() {
  saving.value = true;
  const ok = await updateTrade(props.trade.id, {
    entryPrice: entryPrice.value === "" ? null : Number(entryPrice.value),
    stopLoss: stopLoss.value === "" ? null : Number(stopLoss.value),
    exitPrice: exitPrice.value === "" ? null : Number(exitPrice.value),
    exitTime: exitTimeInput.value ? Math.floor(new Date(exitTimeInput.value).getTime() / 1000) : null,
    outcome: outcome.value === "" ? null : outcome.value,
    reasoning: reasoning.value.trim() === "" ? null : reasoning.value.trim(),
  });
  saving.value = false;
  if (ok) emit("saved");
}

async function onDelete() {
  if (!confirm(`Trade #${props.trade.id} wirklich löschen?`)) return;
  const ok = await deleteTrade(props.trade.id);
  if (ok) emit("deleted");
}

async function onUnlinkSetup() {
  const ok = await unlinkTradeSetup(props.trade.id);
  if (ok) emit("saved");
}

async function onRemoveTarget(target) {
  const ok = await removeTargetFromTrade(target.id);
  if (ok) emit("saved");
}
</script>

<template>
  <MetadataPanel :title="`✏️ Trade #${trade.id} bearbeiten`" @close="emit('close')">
    <div class="tem-header">
      <span class="tem-direction" :class="trade.direction">{{ trade.direction === "short" ? "Short" : "Long" }}</span>
      <span>{{ trade.instrument }}</span>
      <span class="tem-muted">{{ fmtDateTime(trade.entryTime) }}</span>
    </div>

    <section class="tem-section">
      <h4 class="tem-section-title">Setup-Verknüpfung</h4>
      <div v-if="trade.tradeSetupId != null" class="tem-row">
        <span>#{{ trade.tradeSetupId }}</span>
        <button class="tem-small-btn" @click="onUnlinkSetup">entfernen</button>
      </div>
      <button v-else class="tem-action-btn" @click="emit('request-link')">🔗 Setup verknüpfen (Trade-Modus, dann OB anklicken)</button>
    </section>

    <section class="tem-section">
      <h4 class="tem-section-title">Ziele</h4>
      <div v-if="!trade.targets || trade.targets.length === 0" class="tem-muted">Noch keine Ziele.</div>
      <div v-for="target in trade.targets" :key="target.id" class="tem-row">
        <span>{{ fmtPrice(target.price, precision) }}</span>
        <button class="tem-small-btn" @click="onRemoveTarget(target)">entfernen</button>
      </div>
      <button class="tem-action-btn" @click="emit('request-add-target')">🎯 Ziel hinzufügen (Trade-Modus, dann LQ-Level anklicken)</button>
    </section>

    <section class="tem-section">
      <h4 class="tem-section-title">Ausführung</h4>
      <form class="tem-form" @submit.prevent="save">
        <label>
          Entry-Preis
          <input v-model="entryPrice" type="number" step="any" placeholder="leer = nicht gefüllt" />
        </label>
        <label>
          Stop-Loss
          <input v-model="stopLoss" type="number" step="any" placeholder="optional" />
        </label>
        <label>
          Exit-Preis
          <input v-model="exitPrice" type="number" step="any" placeholder="optional" />
        </label>
        <label>
          Exit-Zeit
          <input v-model="exitTimeInput" type="datetime-local" />
        </label>
        <label>
          Ergebnis
          <select v-model="outcome">
            <option value="">— (offen/kein Fill)</option>
            <option value="open">Offen</option>
            <option value="win">Win</option>
            <option value="loss">Loss</option>
            <option value="invalid">Ungültig</option>
          </select>
        </label>
        <label>
          Begründung
          <textarea v-model="reasoning" rows="3"></textarea>
        </label>
        <button type="submit" class="tem-save-btn" :disabled="saving">Speichern</button>
      </form>
    </section>

    <button class="tem-delete-btn" @click="onDelete">🗑 Trade löschen</button>
  </MetadataPanel>
</template>

<style scoped>
.tem-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #d1d4dc;
  margin-bottom: 12px;
}

.tem-direction {
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
}

.tem-direction.short {
  background: rgba(239, 83, 80, 0.2);
  color: #ef5350;
}

.tem-direction.long {
  background: rgba(38, 166, 154, 0.2);
  color: #26a69a;
}

.tem-muted {
  color: #787b86;
  font-size: 12px;
}

.tem-section {
  background: #1a1e28;
  border: 1px solid #2a2e39;
  border-radius: 8px;
  padding: 10px 12px;
  margin-bottom: 10px;
}

.tem-section-title {
  margin: 0 0 8px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #565a64;
}

.tem-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  color: #d1d4dc;
  padding: 3px 0;
}

.tem-small-btn {
  background: transparent;
  border: none;
  color: #787b86;
  cursor: pointer;
  font-size: 11px;
  padding: 2px 4px;
}

.tem-small-btn:hover {
  color: #ef5350;
}

.tem-action-btn {
  display: block;
  width: 100%;
  margin-top: 6px;
  background: transparent;
  border: 1px solid #2a2e39;
  color: #9aa0ac;
  padding: 6px 8px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  text-align: left;
}

.tem-action-btn:hover {
  border-color: #2962ff;
  color: #d1d4dc;
}

.tem-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tem-form label {
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: 12px;
  color: #9aa0ac;
}

.tem-form input,
.tem-form select,
.tem-form textarea {
  background: #131722;
  border: 1px solid #2a2e39;
  border-radius: 4px;
  color: #d1d4dc;
  font-size: 13px;
  padding: 5px 8px;
  color-scheme: dark;
  resize: vertical;
}

.tem-save-btn {
  background: transparent;
  border: 1px solid #2962ff;
  color: #7ea6ff;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  margin-top: 4px;
}

.tem-save-btn:hover {
  background: rgba(41, 98, 255, 0.12);
}

.tem-save-btn:disabled {
  opacity: 0.5;
  cursor: default;
}

.tem-delete-btn {
  display: block;
  width: 100%;
  background: transparent;
  border: 1px solid rgba(239, 83, 80, 0.4);
  color: #ef5350;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
}

.tem-delete-btn:hover {
  background: rgba(239, 83, 80, 0.12);
}
</style>
