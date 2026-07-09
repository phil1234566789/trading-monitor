// Forex-Kerzen (aktuell nur GBPUSD) über die `ctrader-candles`-Edge-Function — die spricht
// das cTrader-Open-API-Protokoll (TLS-Socket, Protobuf), das im Browser nicht nutzbar ist,
// und braucht das Client-Secret/den Access-Token, die nie ins Frontend dürfen. Antwortform
// entspricht bewusst den OKX-Fetch-Funktionen in PriceChart.vue (oldest-first, {time,open,
// high,low,close}), damit sich beide Datenquellen dort gleich behandeln lassen.
const CTRADER_FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ctrader-candles`;
const PERIOD_MAP = { "1m": "M1", "5m": "M5", "15m": "M15", "1h": "H1", "4h": "H4", "1D": "D1" };

function ctraderPeriodFor(label) {
  return PERIOD_MAP[label];
}

async function fetchCandles(symbol, bar, { count, to } = {}) {
  const params = new URLSearchParams({ symbol, period: ctraderPeriodFor(bar), count: String(count) });
  if (to) params.set("to", String(to));
  const res = await fetch(`${CTRADER_FN_URL}?${params}`, {
    headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
  return json; // oldest zuerst
}

export async function fetchInitialCandles(symbol, bar, count) {
  return fetchCandles(symbol, bar, { count });
}

export async function fetchRecentCandles(symbol, bar, count) {
  return fetchCandles(symbol, bar, { count });
}

// Für Scroll-Back: Kerzen strikt vor `oldestLoadedTime` (Sekunden).
export async function fetchOlderCandles(symbol, bar, oldestLoadedTime, count) {
  const page = await fetchCandles(symbol, bar, { count, to: oldestLoadedTime * 1000 });
  return page.filter((c) => c.time < oldestLoadedTime);
}
