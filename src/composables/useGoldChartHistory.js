import { onMounted, onScopeDispose, ref } from 'vue';
import { fetchInitialCandles } from '../forexCandles.js';
import { isGoldInstrument } from '../goldChartPolicy.js';

// Native H1/H4 statt aggregierter M5: Replay muss Touch/Invalidierung zum damaligen Stand rechnen.
export function useGoldChartHistory(symbol, refresh) {
  const candles = ref({});
  const error = ref(false);
  let timer, disposed = false, busy = false;
  async function load() {
    if (!isGoldInstrument(symbol()) || busy) return;
    busy = true;
    error.value = false;
    try {
      const count = candles.value['1H'] ? 24 : 10000;
      const [h1, h4] = await Promise.all(['1h','4h'].map(bar => fetchInitialCandles(symbol(), bar, count)));
      if (disposed) return;
      const merge = (tf, rows) => [...new Map([...(candles.value[tf] ?? []), ...rows].map(c=>[c.time,c])).values()].sort((a,b)=>a.time-b.time);
      candles.value = { '1H': merge('1H', h1), '4H': merge('4H', h4) };
      refresh();
    } catch { if (!disposed) error.value = true; }
    finally { busy = false; }
  }
  onMounted(() => { void load(); if (isGoldInstrument(symbol())) timer = setInterval(load, 60000); });
  onScopeDispose(() => { disposed = true; clearInterval(timer); });
  return { candles, error, load };
}
