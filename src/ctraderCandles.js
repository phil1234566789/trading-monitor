// Forex-Kerzen (aktuell nur GBPUSD) über die `ctrader-candles`-Edge-Function — die spricht
// das cTrader-Open-API-Protokoll (TLS-Socket, Protobuf), das im Browser nicht nutzbar ist,
// und braucht das Client-Secret/den Access-Token, die nie ins Frontend dürfen. Antwortform
// entspricht bewusst den OKX-Fetch-Funktionen in PriceChart.vue (oldest-first, {time,open,
// high,low,close}), damit sich beide Datenquellen dort gleich behandeln lassen.
const CTRADER_FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ctrader-candles`;
const PERIOD_MAP = { "1m": "M1", "3m": "M3", "5m": "M5", "15m": "M15", "1h": "H1", "4h": "H4", "1D": "D1" };
// Deno.connectTls im Edge-Function-Client (siehe supabase/functions/_shared/ctrader/client.ts)
// hat selbst keinen Timeout — ohne einen hier würde ein hängender TCP-Connect/Handshake diesen
// fetch() für immer offen lassen (siehe Chat: HTTP-Aktivitäts-Indikator blieb dauerhaft "an").
// 20s statt 10s (der interne Timeout je einzelnem cTrader-Request), weil ein kalter Aufruf
// mehrere solcher Requests SEQUENTIELL braucht (App-/Account-Auth, ggf. Symbol-Liste, Trendbars).
const REQUEST_TIMEOUT_MS = 20_000;

function ctraderPeriodFor(label) {
  return PERIOD_MAP[label];
}

async function fetchCandles(symbol, bar, { count, to } = {}) {
  const params = new URLSearchParams({ symbol, period: ctraderPeriodFor(bar), count: String(count) });
  if (to) params.set("to", String(to));
  const res = await fetch(`${CTRADER_FN_URL}?${params}`, {
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
// Zeit, sonst deckt ein festes count/Lookback-Fenster den geclippten Bereich nicht ab (siehe Chat:
// "Ranges-Pivots gehen bei 12 Tagen Lookback + Replay nicht weit genug zurück").
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
