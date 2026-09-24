<script setup>
import { onMounted, onUnmounted, ref } from 'vue';
import { createChart, CandlestickSeries } from 'lightweight-charts';
import { cssColor } from '../chartColors.js';
import { fetchGoldH1Preview, fetchGoldH1PreviewObs, GOLD_H1_PREVIEW } from '../goldH1Preview.js';
import { OrderBlockPrimitive } from '../orderBlocks.js';
import { GOLD_H1_MIN_FVG_USD } from '../goldH1ObConfig.js';

const container = ref(null);
const loading = ref(true);
const error = ref(false);
const count = ref(0);
const obCount = ref(0);
let chart;
let removed = false;
const berlin = new Intl.DateTimeFormat('de-DE', {
  timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
});

async function load() {
  loading.value = true;
  error.value = false;
  try {
    const [candles, zones] = await Promise.all([fetchGoldH1Preview(), fetchGoldH1PreviewObs()]);
    if (removed) return;
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
      priceFormat: GOLD_H1_PREVIEW.priceFormat,
    });
    series.setData(candles);
    // Historischer Test: auch später invalidierte Zonen bis zu ihrem gespeicherten Ende zeigen.
    for (const zone of zones) {
      const key = zone.dir === 1 ? 'obBull1h' : 'obBear1h';
      series.attachPrimitive(new OrderBlockPrimitive(zone, {
        fillColor: cssColor(key), borderColor: cssColor(zone.dir === 1 ? 'obBull1hBorder' : 'obBear1hBorder'),
        borderWidth: 1, textColor: '#d1d4dc', label: zone.invalidated ? '1H · beendet' : '1H',
      }, candles));
    }
    obCount.value = zones.length;
    chart.timeScale().fitContent();
    count.value = candles.length;
  } catch {
    if (!removed) error.value = true;
  } finally {
    if (!removed) loading.value = false;
  }
}
onMounted(load);
onUnmounted(() => { removed = true; chart?.remove(); });
</script>

<template>
  <section class="gold-preview" aria-label="Gold H1 Testchart">
    <header>
      <strong>XAUUSD · Gold · H1</strong>
      <span>Historischer Datentest · 07.–18.09.2026 · {{ count }} geschlossene Bid-Kerzen</span>
      <p>USD je Feinunze · Zeiten Europe/Berlin. Noch kein Live-Feed und keine Setup-Signale.</p>
      <p>{{ obCount }} H1-Order-Blöcke · Testschwelle: FVG ≥ {{ GOLD_H1_MIN_FVG_USD.toLocaleString('de-DE') }} USD · einschließlich historischer Blöcke</p>
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
</style>
