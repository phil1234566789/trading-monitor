<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { createChart, CandlestickSeries } from 'lightweight-charts';
import { cssColor } from '../chartColors.js';
import { fetchGoldPreview, fetchGoldPreviewObs, goldDisplayZone } from '../goldPreview.js';
import { OrderBlockPrimitive } from '../orderBlocks.js';
import { GOLD_PREVIEWS, GOLD_PRICE_FORMAT } from '../goldPreviewConfig.js';

const container = ref(null);
const loading = ref(true);
const error = ref(false);
const count = ref(0);
const obCount = ref(0);
const bar = ref('1h');
const config = computed(() => GOLD_PREVIEWS[bar.value]);
let chart;
let removed = false;
let requestId = 0;
const berlin = new Intl.DateTimeFormat('de-DE', {
  timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
});

async function load() {
  const request = ++requestId;
  const selected = config.value;
  loading.value = true;
  error.value = false;
  count.value = 0;
  obCount.value = 0;
  chart?.remove();
  chart = undefined;
  try {
    const [candles, zones] = await Promise.all([fetchGoldPreview(bar.value), fetchGoldPreviewObs(bar.value)]);
    // Schnelle H1/H4-Wechsel dürfen keine verspätete Antwort der vorigen Zeitebene zeichnen.
    if (removed || request !== requestId) return;
    if (!candles.length) throw new Error('Empty preview');
    chart?.remove();
    chart = createChart(container.value, {
      autoSize: true, layout: { background: { color: '#131722' }, textColor: '#d1d4dc' },
      grid: { vertLines: { visible: false }, horzLines: { visible: false } },
      localization: { timeFormatter: time => berlin.format(new Date(time * 1000)) },
      timeScale: { timeVisible: true, tickMarkFormatter: time => berlin.format(new Date(time * 1000)) },
    });
    const series = chart.addSeries(CandlestickSeries, {
      upColor: cssColor('candleUp'), downColor: cssColor('candleDown'), borderVisible: false,
      wickUpColor: cssColor('candleUp'), wickDownColor: cssColor('candleDown'),
      priceFormat: GOLD_PRICE_FORMAT,
    });
    series.setData(candles);
    // Auch später invalidierte Zonen zeigen, aber nur bis zum ersten Touch ausdehnen.
    for (const zone of zones) {
      const key = `${zone.dir === 1 ? 'obBull' : 'obBear'}${bar.value}`;
      series.attachPrimitive(new OrderBlockPrimitive(goldDisplayZone(zone, candles), {
        fillColor: cssColor(key), borderColor: cssColor(`${key}Border`),
        borderWidth: 1, textColor: '#d1d4dc', label: zone.invalidated ? `${selected.timeframe} · beendet` : selected.timeframe,
      }, candles));
    }
    obCount.value = zones.length;
    chart.timeScale().fitContent();
    const visible = candles.filter(c => c.time >= Date.parse(selected.visibleStart) / 1000);
    if (visible.length > 1) chart.timeScale().setVisibleRange({ from: visible[0].time, to: visible.at(-1).time });
    count.value = candles.length;
  } catch {
    if (!removed && request === requestId) error.value = true;
  } finally {
    if (!removed && request === requestId) loading.value = false;
  }
}
onMounted(load);
watch(bar, load);
onUnmounted(() => { removed = true; chart?.remove(); });
</script>

<template>
  <section class="gold-preview" :aria-label="`Gold ${config.label} Testchart`">
    <header>
      <strong>XAUUSD · Gold · {{ config.label }}</strong>
      <div class="gold-timeframes" role="group" aria-label="Gold Zeitebene">
        <button v-for="(option, value) in GOLD_PREVIEWS" :key="value" :aria-pressed="bar === value" @click="bar = value">{{ option.label }}</button>
      </div>
      <span>Historischer Datentest · {{ config.period }} · {{ count }} geschlossene Bid-Kerzen</span>
      <p>USD je Feinunze · Zeiten Europe/Berlin. Noch kein Live-Feed und keine Setup-Signale.</p>
      <p>{{ obCount }} {{ config.label }}-Order-Blöcke · Testschwelle: FVG ≥ {{ config.minFvg.toLocaleString('de-DE') }} USD · einschließlich historischer Blöcke</p>
    </header>
    <p v-if="loading" role="status">Gold-Kerzen werden geladen…</p>
    <p v-if="error" role="alert">Gold-Testdaten konnten nicht geladen werden. <button @click="load">Erneut laden</button></p>
    <div ref="container" class="gold-chart" />
  </section>
</template>

<style scoped>
.gold-preview { border: 1px solid #435065; border-radius: 8px; overflow: hidden; }
header { padding: 12px 16px; background: #1e2638; }
header strong, header span { display: block; }
header span, p { font-size: 13px; color: #b8c5d8; margin: 6px 0; }
.gold-chart { height: 65vh; min-height: 360px; }
button { color: inherit; background: #293447; border: 1px solid #718096; border-radius: 4px; padding: 5px 10px; cursor: pointer; }
.gold-timeframes { display: flex; gap: 6px; margin-top: 8px; }
button[aria-pressed="true"] { background: #315de6; border-color: #8aa5ff; color: white; }
</style>
