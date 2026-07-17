<script setup>
import { ref, computed } from "vue";

// Rekursiver, einklappbarer JSON-Viewer fürs Metadaten-Panel (siehe PriceChart.vue) — Objekte/
// Arrays lassen sich per Klick auf den Pfeil ein-/ausklappen, damit man große State-Bäume (z.B.
// die previous-Kette mit ihren pivotHighs/pivotLows-Arrays) schneller überfliegen kann, statt
// durch einen einzigen Textblock zu scrollen. Selbstreferenz (<JsonTree> im eigenen Template)
// funktioniert automatisch über den Dateinamen (Vue-SFC-Konvention ab 3.2), kein Extra-Import.
const props = defineProps({
  value: { default: undefined },
  keyLabel: { type: String, default: null }, // null = Root-Knoten, kein "key:"-Präfix
});

const isObject = computed(() => props.value !== null && typeof props.value === "object");
const isArray = computed(() => Array.isArray(props.value));
const entries = computed(() => {
  if (!isObject.value) return [];
  return isArray.value ? props.value.map((v, i) => [String(i), v]) : Object.entries(props.value);
});

const expanded = ref(true);

function primitiveDisplay(v) {
  if (v === null || v === undefined) return "null";
  if (typeof v === "string") return `"${v}"`;
  return String(v);
}
function primitiveClass(v) {
  if (v === null || v === undefined) return "json-null";
  return `json-${typeof v}`;
}
</script>

<template>
  <div class="json-node">
    <span v-if="keyLabel !== null" class="json-key">"{{ keyLabel }}"</span><span v-if="keyLabel !== null">: </span>
    <template v-if="!isObject">
      <span :class="primitiveClass(value)">{{ primitiveDisplay(value) }}</span>
    </template>
    <template v-else>
      <span class="json-toggle" @click="expanded = !expanded">{{ expanded ? "▾" : "▸" }}</span>
      <span class="json-bracket">{{ isArray ? "[" : "{" }}</span>
      <span v-if="!expanded" class="json-collapsed" @click="expanded = true">
        {{ entries.length }} {{ isArray ? "Einträge" : "Felder" }} {{ isArray ? "]" : "}" }}
      </span>
      <div v-if="expanded" class="json-children">
        <div v-for="[k, v] in entries" :key="k" class="json-child-row">
          <JsonTree :value="v" :key-label="isArray ? null : k" />
        </div>
      </div>
      <span v-if="expanded" class="json-bracket">{{ isArray ? "]" : "}" }}</span>
    </template>
  </div>
</template>

<style scoped>
.json-node {
  font-family: "Courier New", monospace;
  font-size: 12px;
  line-height: 1.6;
  color: #d1d4dc;
}

.json-children {
  padding-left: 16px;
  border-left: 1px solid #2a2e39;
  margin-left: 3px;
}

.json-toggle {
  display: inline-block;
  width: 12px;
  cursor: pointer;
  color: #787b86;
  user-select: none;
}

.json-key {
  color: #7ea6ff;
}

.json-bracket {
  color: #787b86;
}

.json-collapsed {
  cursor: pointer;
  color: #565a64;
  font-style: italic;
}

.json-collapsed:hover {
  color: #787b86;
}

.json-string {
  color: #ce9178;
}

.json-number {
  color: #4fc1ff;
}

.json-boolean {
  color: #c586c0;
}

.json-null {
  color: #787b86;
}
</style>
