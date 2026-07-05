import { fetchInitialDeltas, fetchDailyDeltas } from "./cvd.js";

const POLL_MS = 12_000;
const SCALE_HISTORY_SIZE = 100; // ~20min bei 12s-Takt, fürs Auto-Scaling des Maximalausschlags
const MIN_SCALE = 20; // Mindest-Ausschlag, damit der Zeiger bei ruhigem Markt nicht überempfindlich wirkt
const WINDOW_BARS = 15; // letzte 15 Binance-1m-Kerzen für das rollierende Fenster

function createGauge(needleId, valueId) {
  const needle = document.getElementById(needleId);
  const valueEl = document.getElementById(valueId);
  let scaleHistory = [];

  return {
    render(value) {
      scaleHistory.push(Math.abs(value));
      if (scaleHistory.length > SCALE_HISTORY_SIZE) scaleHistory.shift();
      const max = Math.max(MIN_SCALE, ...scaleHistory);
      const clamped = Math.max(-max, Math.min(max, value));
      const angle = (clamped / max) * 90;

      needle.style.transform = `rotate(${angle}deg)`;
      valueEl.textContent = value >= 0 ? `+${value.toFixed(1)}` : value.toFixed(1);
      valueEl.style.color = value >= 0 ? "#26a69a" : "#ef5350";
    },
  };
}

// Zwei parallele Deltas, um empirisch zu vergleichen, welches näher an Bookmaps
// Anzeige liegt: ein schnelles rollierendes 15-Minuten-Fenster und ein seit
// Tagesbeginn (UTC) kumulativer Wert.
export function initGauges() {
  const windowGauge = createGauge("gauge-needle-window", "gauge-value-window");
  const dailyGauge = createGauge("gauge-needle-daily", "gauge-value-daily");

  async function updateWindow() {
    try {
      const deltas = await fetchInitialDeltas("1m", WINDOW_BARS);
      windowGauge.render(deltas.reduce((sum, d) => sum + d.delta, 0));
    } catch (err) {
      console.error("Gauge (15m) fehlgeschlagen:", err);
    }
  }

  async function updateDaily() {
    try {
      const deltas = await fetchDailyDeltas();
      dailyGauge.render(deltas.reduce((sum, d) => sum + d.delta, 0));
    } catch (err) {
      console.error("Gauge (Tag) fehlgeschlagen:", err);
    }
  }

  updateWindow();
  updateDaily();
  setInterval(updateWindow, POLL_MS);
  setInterval(updateDaily, POLL_MS);
}
