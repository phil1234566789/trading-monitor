<script setup>
// Geteiltes Invalidierungs-Feld (Chat 2026-08-27, TSC: "genau wie im trade-edit-modal ... am
// besten reused Code") — aus TradeEditModal.vue extrahiert, jetzt auch in TradeSetupCockpit.vue
// genutzt. Reine Präsentation wie CrudListSection.vue: Wert-Sync (v-model), Speichern-Klick und
// Chart-Klick-Anfrage bleiben beim Aufrufer, diese Komponente kennt nur das Formular selbst.
defineProps({
  modelValue: { type: [Number, String], required: true },
  saving: { type: Boolean, default: false },
  justSaved: { type: Boolean, default: false },
});
const emit = defineEmits(["update:modelValue", "save", "request-chart-click"]);
</script>

<template>
  <section class="ivf-section">
    <h4 class="ivf-section-title">Invalidierung</h4>
    <form class="ivf-inline-form" @submit.prevent="emit('save')">
      <input
        :value="modelValue"
        type="number"
        step="any"
        placeholder="kein Wert gesetzt"
        @input="emit('update:modelValue', $event.target.value)"
      />
      <button type="submit" class="ivf-small-save-btn" :disabled="saving">Speichern</button>
      <button
        type="button"
        class="ivf-icon-btn"
        title="Invalidierung im Chart anklicken (Trade-Modus, dann Pivot/OB anklicken)"
        @click="emit('request-chart-click')"
      >
        🚫
      </button>
      <span v-if="justSaved" class="ivf-saved-feedback">✓ übernommen</span>
    </form>
  </section>
</template>

<style scoped>
.ivf-section {
  background: #1a1e28;
  border: 1px solid #2a2e39;
  border-radius: 8px;
  padding: 10px 12px;
  margin-bottom: 10px;
}

.ivf-section:last-child {
  margin-bottom: 0;
}

.ivf-section-title {
  margin: 0 0 8px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #565a64;
}

.ivf-inline-form {
  display: flex;
  gap: 6px;
  align-items: center;
}

.ivf-inline-form input {
  flex: 1;
  min-width: 0;
  background: #131722;
  border: 1px solid #2a2e39;
  border-radius: 4px;
  color: #d1d4dc;
  font-size: 13px;
  padding: 5px 8px;
  color-scheme: dark;
}

.ivf-small-save-btn {
  flex-shrink: 0;
  background: transparent;
  border: 1px solid #2962ff;
  color: #7ea6ff;
  padding: 5px 10px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
}

.ivf-small-save-btn:hover:not(:disabled) {
  background: rgba(41, 98, 255, 0.12);
}

.ivf-small-save-btn:disabled {
  opacity: 0.5;
  cursor: default;
}

.ivf-icon-btn {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  background: transparent;
  border: 1px solid #2a2e39;
  color: #9aa0ac;
  border-radius: 6px;
  cursor: pointer;
  font-size: 16px;
}

.ivf-icon-btn:hover {
  border-color: #2962ff;
  color: #d1d4dc;
}

/* Kurzes Aufblitzen nach erfolgreichem Speichern (Chat 2026-07-31, dritte Runde: "ich sehe nicht,
   ob das erfolgreich übernommen worden ist") — dieselbe Grün-Semantik wie .trade-pl.positive. */
.ivf-saved-feedback {
  color: #26a69a;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  flex-shrink: 0;
}
</style>
