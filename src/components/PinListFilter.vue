<script setup>
import { ref } from "vue";
import ToggleButton from "./ui/ToggleButton.vue";
import DropdownMenu from "./ui/DropdownMenu.vue";
import DateTimeInput from "./ui/DateTimeInput.vue";

// Filterleiste der Pin-Liste. modelValue = gespeicherter Rohzustand { instruments: null = aktuelles Instrument,
// types: [] = alle, preset: "week"|"month"|null, from/to: Unix-Sekunden }. Auswerten tut pinListFilter.js.
const props = defineProps({
  modelValue: { type: Object, required: true },
  instruments: { type: Array, required: true }, // effektive Auswahl, [] = alle
  instrumentOptions: { type: Array, required: true },
  typeOptions: { type: Array, required: true }, // [{ key, name, count }]
  shown: { type: Number, required: true },
  total: { type: Number, required: true },
});
const emit = defineEmits(["update:modelValue"]);
const typeMenuOpen = ref(false);
const set = (patch) => emit("update:modelValue", { ...props.modelValue, ...patch });

function toggleInstrument(i) {
  const next = props.instruments.includes(i) ? props.instruments.filter((x) => x !== i) : [...props.instruments, i];
  set({ instruments: next });
}
function toggleType(key) {
  const types = props.modelValue.types ?? [];
  set({ types: types.includes(key) ? types.filter((x) => x !== key) : [...types, key] });
}
const typesLabel = () => {
  const types = props.modelValue.types ?? [];
  if (!types.length) return "alle";
  return types.length === 1 ? (props.typeOptions.find((o) => o.key === types[0])?.name ?? types[0]) : `${types.length} Arten`;
};
</script>

<template>
  <div class="pin-filter">
    <div class="pin-filter-row">
      <ToggleButton :class="{ active: !instruments.length }" @click="set({ instruments: [] })">Alle</ToggleButton>
      <ToggleButton v-for="i in instrumentOptions" :key="i" :class="{ active: instruments.includes(i) }" @click="toggleInstrument(i)">{{ i }}</ToggleButton>
    </div>
    <div class="pin-filter-row">
      <ToggleButton :class="{ active: modelValue.preset === 'week' }" @click="set({ preset: 'week' })">7 Tage</ToggleButton>
      <ToggleButton :class="{ active: modelValue.preset === 'month' }" @click="set({ preset: 'month' })">Dieser Monat</ToggleButton>
      <ToggleButton :class="{ active: !modelValue.preset && modelValue.from == null && modelValue.to == null }"
        @click="set({ preset: null, from: null, to: null })">Jede Zeit</ToggleButton>
    </div>
    <div class="pin-filter-row">
      <DateTimeInput class="pin-filter-date" aria-label="Objektzeit von" :model-value="modelValue.preset ? null : modelValue.from"
        @update:model-value="(v) => set({ preset: null, from: v })" />
      <span>–</span>
      <DateTimeInput class="pin-filter-date" aria-label="Objektzeit bis" :model-value="modelValue.preset ? null : modelValue.to"
        @update:model-value="(v) => set({ preset: null, to: v })" />
    </div>
    <div class="pin-filter-row">
      <DropdownMenu v-model:open="typeMenuOpen" label="Chart-Objekte wählen">
        <template #leading>
          <ToggleButton :class="{ active: modelValue.types?.length }" @click="typeMenuOpen = !typeMenuOpen">Objekt: {{ typesLabel() }}</ToggleButton>
        </template>
        <ToggleButton variant="menu" :class="{ active: !modelValue.types?.length }" @click="set({ types: [] })">Alle Arten</ToggleButton>
        <ToggleButton v-for="o in typeOptions" :key="o.key" variant="menu" :class="{ active: modelValue.types?.includes(o.key) }"
          @click="toggleType(o.key)">{{ o.name }} ({{ o.count }})</ToggleButton>
      </DropdownMenu>
      <span class="pin-filter-count" role="status">{{ shown }} von {{ total }} Pins</span>
    </div>
  </div>
</template>

<style scoped>
.pin-filter { display: flex; flex-direction: column; gap: 4px; padding-bottom: 8px; margin-bottom: 8px; border-bottom: 1px solid #2a2e39; }
.pin-filter-row { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; color: #787b86; font-size: 12px; }
.pin-filter-date { min-width: 0; flex: 1 1 140px; }
.pin-filter-count { margin-left: auto; }
</style>
