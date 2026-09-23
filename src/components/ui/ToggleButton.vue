<script setup>
// An/Aus-Umschalter der Chart-Toolbar, der Untermenüs und der Kopfleiste. Der aktive Zustand
// kommt weiterhin als durchgereichte class="active" vom Aufrufer — so bleibt :class="{ active: … }"
// an den ~50 Fundstellen unverändert.
// variant trägt nur die Geometrie (Padding/Schriftgröße/Ausrichtung), das Farbschema ist für alle
// Varianten dasselbe; ohne diese Varianten stünde dieselbe Optik wieder viermal in Dashboard.vue.
defineProps({
  // plain = Toolbar, menu = Dropdown-Eintrag, caret = ▾-Anhängsel, bordered = Kopfleiste
  variant: { type: String, default: "plain" },
});
</script>

<template>
  <button type="button" class="ui-toggle-btn" :data-variant="variant">
    <slot />
  </button>
</template>

<style scoped>
.ui-toggle-btn {
  background: transparent;
  border: none;
  color: #787b86;
  border-radius: 4px;
  cursor: pointer;
  padding: 4px 10px;
  font-size: 13px;
  white-space: nowrap;
}

.ui-toggle-btn:hover {
  background: #2a2e39;
  color: #d1d4dc;
}

/* "open" = aufgeklapptes Untermenü am Caret, sieht bewusst aus wie Hover statt wie aktiv — das
   Untermenü ist offen, der Toggle daneben deshalb noch lange nicht an. */
.ui-toggle-btn.open {
  background: #2a2e39;
  color: #d1d4dc;
}

.ui-toggle-btn.active {
  background: #2962ff;
  color: #fff;
}

.ui-toggle-btn:disabled,
.ui-toggle-btn:disabled:hover {
  background: transparent;
  color: #787b86;
  opacity: 0.35;
  cursor: not-allowed;
}

.ui-toggle-btn[data-variant="menu"] {
  padding: 5px 10px;
  text-align: left;
}

.ui-toggle-btn[data-variant="caret"] {
  padding: 4px 5px;
  font-size: 11px;
}

/* Kopfleiste: gerahmt statt flächig, Hover färbt nur den Rahmen — flächiger Hover würde auf der
   ohnehin dunklen Leiste mit den Statusfeldern daneben verschwimmen. */
.ui-toggle-btn[data-variant="bordered"] {
  border: 1px solid #2a2e39;
  padding: 3px 8px;
  font-size: 12px;
}

.ui-toggle-btn[data-variant="bordered"]:hover {
  background: transparent;
  border-color: #2962ff;
  color: #d1d4dc;
}

.ui-toggle-btn[data-variant="bordered"].active {
  background: #2962ff;
  border-color: #2962ff;
  color: #fff;
}
</style>
