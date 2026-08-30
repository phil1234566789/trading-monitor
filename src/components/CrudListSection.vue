<script setup>
// Geteiltes CRUD-Listen-Muster (Chat 2026-08-26, TSC-Neuaufbau: "es gibt keinen Grund es nicht
// 1:1 genauso zu machen wie in trade-edit-modal ... schau ob du Code reusen kannst") — vorher
// dreimal fast identisch in TradeEditModal.vue (Range-Bestätigungen/Position-Bestätigungen/
// Targets), jetzt auch in TradeSetupCockpit.vue (Bestätigungen/Targets, später vermutlich auch
// Confluences/Anti-Confluences). "add" löst in BEIDEN Komponenten denselben Trade-Modus-
// Chart-Klick aus (TradeSetupCockpit: ggf. zusätzlich Dealing-Range-Bootstrap, siehe
// Dashboard.vue: onTscAddConfirmationRequest) — diese Komponente kennt nur Titel/Icon/Liste/
// Label/Leerzustand, nicht WIE ein Eintrag zustande kommt.
defineProps({
  title: { type: String, required: true },
  icon: { type: String, required: true },
  addTitle: { type: String, required: true },
  items: { type: Array, required: true },
  itemKey: { type: Function, required: true },
  itemLabel: { type: Function, required: true },
  emptyText: { type: String, required: true },
  // Sperrt den Add-Button (Chat 2026-08-26: TSC-Targets brauchen erst eine Richtung, siehe
  // TradeSetupCockpit.vue) — addTitle dient dann als Begründungs-Tooltip statt Aktions-Hinweis.
  disabled: { type: Boolean, default: false },
});
// "hover" (Chat 2026-08-30, Philip: "wenn ich im TSC über eine Bestätigung/ein Zusatzargument/
// Anti-Confluence/Target hovere, soll mir das Chart-Objekt gehighlighted werden ... du hast diese
// Funktionalität schon öfter gebaut") — emittiert das rohe item (oder null beim Verlassen), der
// Parent (TradeSetupCockpit.vue/TradeEditModal.vue) übersetzt das in den passenden Highlight-Key
// (dieselbe Pin-Halo-Infrastruktur wie PinPanel.vue-Zeilen-Hover, siehe PriceChart.vue:
// isSelectedPin). Hier bewusst KEINE eigene Übersetzung — diese Komponente kennt wie beim
// Add/Remove-Muster nur die Liste, nicht WAS ein Eintrag im Chart ist.
const emit = defineEmits(["add", "remove", "hover"]);
</script>

<template>
  <section class="cls-section">
    <div class="cls-section-header">
      <h4 class="cls-section-title">{{ title }}</h4>
      <div class="cls-header-actions">
        <!-- Optionaler Zweit-Button neben dem Add-Icon (Chat 2026-08-27: TSC-Targets brauchen einen
             eigenen "Vorschläge"-Button, siehe TradeSetupCockpit.vue) — leerer Slot überall sonst. -->
        <slot name="extra-action" />
        <button class="cls-icon-btn" :title="addTitle" :disabled="disabled" @click="emit('add')">{{ icon }}</button>
      </div>
    </div>
    <div v-if="items.length === 0" class="cls-muted">{{ emptyText }}</div>
    <div
      v-for="item in items"
      :key="itemKey(item)"
      class="cls-row"
      @mouseenter="emit('hover', item)"
      @mouseleave="emit('hover', null)"
    >
      <span>{{ itemLabel(item) }}</span>
      <button class="cls-remove-btn" title="entfernen" @click="emit('remove', item)">×</button>
    </div>
  </section>
</template>

<style scoped>
.cls-section {
  background: #1a1e28;
  border: 1px solid #2a2e39;
  border-radius: 8px;
  padding: 10px 12px;
  margin-bottom: 10px;
}

.cls-section:last-child {
  margin-bottom: 0;
}

.cls-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.cls-header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.cls-section-title {
  margin: 0;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #565a64;
}

.cls-muted {
  color: #787b86;
  font-size: 12px;
}

.cls-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  color: #d1d4dc;
  padding: 3px 4px;
  margin: 0 -4px;
  border-radius: 4px;
}

/* Spiegelt den Chart-Highlight-Halo (siehe hover-Emit oben) auch hier in der Liste, damit klar
   ist, welche Zeile gerade "das Chart-Objekt zeigen" auslöst. */
.cls-row:hover {
  background: rgba(255, 255, 255, 0.05);
}

/* Kleiner "×" statt Text-Button (Chat 2026-07-31: "da reicht auch nur ein kleines x", title=
   nativer Hover-Tooltip statt sichtbarem "entfernen"-Text). */
.cls-remove-btn {
  background: transparent;
  border: none;
  color: #787b86;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  padding: 2px 6px;
}

.cls-remove-btn:hover {
  color: #ef5350;
}

/* Icon-only statt Text-Button (Chat 2026-07-31: "Buttons ticken größer, nur mit Icon, Text als
   Hover") — title trägt den vorherigen Button-Text als nativen Tooltip. */
.cls-icon-btn {
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

.cls-icon-btn:hover:not(:disabled) {
  border-color: #2962ff;
  color: #d1d4dc;
}

.cls-icon-btn:disabled {
  opacity: 0.4;
  cursor: default;
}
</style>
