<script setup>
import { ref, computed } from "vue";
import { createTradeFromSetup, directionForSetup, deriveSetupEntryInvalidation } from "../tradeIntake.js";
import { fmtPrice, pricePrecisionForInstrument } from "../format.js";
import MetadataPanel from "./MetadataPanel.vue";

// Trade-Modus (Chat 2026-07-27): ein im Chart angeklicktes Trade-Setup als Trade übernehmen.
// setupEntry/invalidation kommen aus dem Setup selbst (siehe tradeIntake.js) — nur entryPrice/
// stopLoss sind hier editierbar, weil die tatsächliche Ausführung (oder das Ausbleiben davon,
// "es gibt ein setupEntry, aber kein entryPrice") erst beim Übernehmen feststeht.
const props = defineProps({
  instrument: { type: String, required: true },
  setup: { type: Object, required: true },
});
const emit = defineEmits(["close", "saved"]);

const direction = computed(() => directionForSetup(props.setup));
const levels = computed(() => deriveSetupEntryInvalidation(props.setup));
const precision = computed(() => pricePrecisionForInstrument(props.instrument));

const entryPrice = ref("");
const stopLoss = ref("");
const reasoning = ref("");
const saving = ref(false);
const errorMsg = ref("");

async function submit() {
  saving.value = true;
  errorMsg.value = "";
  const result = await createTradeFromSetup({
    instrument: props.instrument,
    setup: props.setup,
    entryPrice: entryPrice.value === "" ? null : Number(entryPrice.value),
    stopLoss: stopLoss.value === "" ? null : Number(stopLoss.value),
    reasoning: reasoning.value.trim() || null,
  });
  saving.value = false;
  if (!result.ok) {
    errorMsg.value = "Speichern fehlgeschlagen — siehe Konsole.";
    return;
  }
  emit("saved");
  emit("close");
}
</script>

<template>
  <MetadataPanel title="🎯 Setup als Trade übernehmen" @close="emit('close')">
    <div class="take-trade-summary">
      <span class="take-trade-direction" :class="direction">{{ direction === "short" ? "Short" : "Long" }}</span>
      <span>{{ setup.label }} Typ {{ setup.pathType }}</span>
    </div>
    <div class="take-trade-levels">
      <div><span class="take-trade-label">Setup-Entry (These)</span> {{ fmtPrice(levels.setupEntry, precision) }}</div>
      <div><span class="take-trade-label">Invalidierung (These)</span> {{ fmtPrice(levels.invalidation, precision) }}</div>
    </div>
    <form class="take-trade-form" @submit.prevent="submit">
      <label>
        Ist-Entry (leer lassen, falls noch nicht gefüllt)
        <input v-model="entryPrice" type="number" step="any" placeholder="z.B. 1.33146" />
      </label>
      <label>
        Ist-SL
        <input v-model="stopLoss" type="number" step="any" placeholder="optional" />
      </label>
      <label>
        Begründung
        <textarea v-model="reasoning" rows="2" placeholder="optional"></textarea>
      </label>
      <p v-if="errorMsg" class="take-trade-error">{{ errorMsg }}</p>
      <button type="submit" class="take-trade-submit" :disabled="saving">Als Trade speichern</button>
    </form>
  </MetadataPanel>
</template>

<style scoped>
.take-trade-summary {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #d1d4dc;
  margin-bottom: 10px;
}

.take-trade-direction {
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
}

.take-trade-direction.short {
  background: rgba(239, 83, 80, 0.2);
  color: #ef5350;
}

.take-trade-direction.long {
  background: rgba(38, 166, 154, 0.2);
  color: #26a69a;
}

.take-trade-levels {
  background: #1a1e28;
  border: 1px solid #2a2e39;
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 12px;
  color: #9aa0ac;
  margin-bottom: 12px;
}

.take-trade-label {
  color: #565a64;
  margin-right: 6px;
}

.take-trade-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.take-trade-form label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: #9aa0ac;
}

.take-trade-form input,
.take-trade-form textarea {
  background: #131722;
  border: 1px solid #2a2e39;
  border-radius: 4px;
  color: #d1d4dc;
  font-size: 13px;
  padding: 5px 8px;
  color-scheme: dark;
  resize: vertical;
}

.take-trade-error {
  color: #ef5350;
  font-size: 12px;
  margin: 0;
}

.take-trade-submit {
  background: transparent;
  border: 1px solid #2962ff;
  color: #7ea6ff;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
}

.take-trade-submit:hover {
  background: rgba(41, 98, 255, 0.12);
}

.take-trade-submit:disabled {
  opacity: 0.5;
  cursor: default;
}
</style>
