// Forex-Kerzen (GBPUSD/EURUSD) über die `forex-candles`-Edge-Function (Twelve Data) — Nachfolger
// von ctraderCandles.js (siehe Chat 2026-07-22: Volumetrica/IQ Capital haben kein cTrader mehr,
// nur MT5/ATAS/Quantower). Kein Bar-Label-Mapping mehr nötig: die Edge Function nimmt dieselben
// Labels wie timeframes.js ("1m","3m","5m","15m","1h","4h","1D") direkt an. Antwortform weiterhin
// {time,open,high,low,close,volume}, oldest-first — unverändert ggü. den OKX-Fetch-Funktionen in
// PriceChart.vue, damit sich beide Datenquellen dort gleich behandeln lassen.
const FOREX_FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/forex-candles`;
// Kein eigener interner Timeout im Backend (anders als der cTrader-TLS-Handshake) — Twelve Data
// ist ein einzelner REST-Call, aber ein großzügiger Client-Timeout schadet nicht (siehe Chat:
// HTTP-Aktivitäts-Indikator blieb bei einem hängenden Fetch dauerhaft "an").
const REQUEST_TIMEOUT_MS = 20_000;

async function fetchCandles(symbol, bar, { count, to } = {}) {
  const params = new URLSearchParams({ symbol, period: bar, count: String(count) });
  if (to) params.set("to", String(to));
  const res = await fetch(`${FOREX_FN_URL}?${params}`, {
    headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
  return json; // oldest zuerst
}

// toMs (optional, ms-Epoch): ohne das die neuesten `count` Kerzen bis "jetzt" — für den
// Replay-Modus (siehe PriceChart.vue: clipReplay/loadRangesCandles/loadTradeSetupCandles) muss
// der initiale Fetch aber bis zum Replay-Zeitpunkt zurückreichen, nicht bis zur echten aktuellen
// Zeit, sonst deckt ein festes count/Lookback-Fenster den geclippten Bereich nicht ab.
export async function fetchInitialCandles(symbol, bar, count, toMs) {
  return fetchCandles(symbol, bar, { count, to: toMs });
}

export async function fetchRecentCandles(symbol, bar, count) {
  return fetchCandles(symbol, bar, { count });
}

// Für Scroll-Back: Kerzen strikt vor `oldestLoadedTime` (Sekunden).
export async function fetchOlderCandles(symbol, bar, oldestLoadedTime, count) {
  const page = await fetchCandles(symbol, bar, { count, to: oldestLoadedTime * 1000 });
  return page.filter((c) => c.time < oldestLoadedTime);
}
