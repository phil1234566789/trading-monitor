<script setup>
import { ref, computed, watch } from "vue";

// Portiert aus gauge.js (createGauge): rollierendes Auto-Scaling des Zeiger-Ausschlags
// anhand der letzten SCALE_HISTORY_SIZE Werte — hat Gedaechtnis ueber Updates hinweg,
// deshalb watch() statt computed().
const MIN_SCALE = 20; // Mindest-Ausschlag, damit der Zeiger bei ruhigem Markt nicht überempfindlich wirkt
const SCALE_HISTORY_SIZE = 100; // ~20min bei 12s-Takt, fürs Auto-Scaling des Maximalausschlags

const props = defineProps({
  id: { type: String, required: true }, // eindeutige Gradient-ID (zwei Instanzen auf einer Seite)
  value: { type: Number, required: true },
  label: { type: String, required: true },
});

let scaleHistory = [];
const angle = ref(0);

watch(
  () => props.value,
  (value) => {
    scaleHistory.push(Math.abs(value));
    if (scaleHistory.length > SCALE_HISTORY_SIZE) scaleHistory.shift();
    const max = Math.max(MIN_SCALE, ...scaleHistory);
    const clamped = Math.max(-max, Math.min(max, value));
    angle.value = (clamped / max) * 90;
  },
  { immediate: true },
);

const formattedValue = computed(() => (props.value >= 0 ? `+${props.value.toFixed(1)}` : props.value.toFixed(1)));
const valueColor = computed(() => (props.value >= 0 ? "#26a69a" : "#ef5350"));
</script>

<template>
  <div class="cvd-gauge">
    <svg viewBox="0 0 200 110" class="gauge-svg">
      <defs>
        <linearGradient :id="`gaugeGradient-${id}`" x1="10" y1="0" x2="190" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#ef5350" />
          <stop offset="50%" stop-color="#5b5f6b" />
          <stop offset="100%" stop-color="#26a69a" />
        </linearGradient>
      </defs>
      <path
        d="M 10 100 A 90 90 0 0 1 190 100"
        fill="none"
        :stroke="`url(#gaugeGradient-${id})`"
        stroke-width="12"
        stroke-linecap="round"
      />
      <line
        class="gauge-needle"
        x1="100"
        y1="100"
        x2="100"
        y2="25"
        stroke="#d1d4dc"
        stroke-width="3"
        stroke-linecap="round"
        :style="{ transform: `rotate(${angle}deg)` }"
      />
      <circle cx="100" cy="100" r="5" fill="#d1d4dc" />
    </svg>
    <div class="gauge-value" :style="{ color: valueColor }">{{ formattedValue }}</div>
    <div class="gauge-label">{{ label }}</div>
  </div>
</template>

<style scoped>
.cvd-gauge {
  width: 130px;
  padding: 8px 10px 10px;
  background: rgba(30, 34, 45, 0.85);
  border: 1px solid #2a2e39;
  border-radius: 8px;
  text-align: center;
}

.gauge-svg {
  width: 100%;
  display: block;
}

.gauge-needle {
  transform-origin: 100px 100px;
  transition: transform 0.3s ease;
}

.gauge-value {
  font-size: 15px;
  font-weight: 600;
  margin-top: -6px;
}

.gauge-label {
  font-size: 10px;
  color: #787b86;
  margin-top: 2px;
}
</style>
