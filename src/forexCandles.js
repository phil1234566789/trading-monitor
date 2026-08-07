// Forex-Kerzen (GBPUSD/EURUSD) über die `forex-candles`-Edge-Function. Backend war Twelve Data
// (Nachfolger von ctraderCandles.js, siehe Chat 2026-07-22), seit 2026-08-03 wieder cTrader
// (neues Pepperstone-Demokonto statt der zuvor deaktivierten Prop-Firm-Challenge, siehe
// forex-candles/index.ts und _shared/ctrader/client.ts) — die Response-Form/das Bar-Label-Mapping
// hier am Frontend blieb dabei unverändert, deshalb hat sich an diesem File selbst kaum was
// geändert. Antwortform {time,open,high,low,close,volume}, oldest-first — unverändert ggü. den
// OKX-Fetch-Funktionen in PriceChart.vue, damit sich beide Datenquellen dort gleich behandeln lassen.
const FOREX_FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/forex-candles`;
// Die Edge Function baut pro Request eine frische cTrader-TLS-Verbindung inkl. Auth-Handshake auf
// (_shared/ctrader/client.ts) — ein großzügiger Client-Timeout schadet trotzdem nicht (siehe Chat:
// HTTP-Aktivitäts-Indikator blieb bei einem hängenden Fetch dauerhaft "an").
const REQUEST_TIMEOUT_MS = 20_000;

// Netzwerkfehler (TypeError "Failed to fetch") und ein abgelaufener AbortSignal.timeout (DOMException
// "TimeoutError") sind IMMER einen Retry wert. Eine reguläre HTTP-Fehlerantwort dagegen nur, wenn
// die Edge Function selbst mit 502 antwortet (forex-candles/index.ts nutzt 502 als Catch-All für
// alles, was beim cTrader-Handshake schiefgeht — inkl. des eigenen Connect-Timeouts in
// _shared/ctrader/client.ts, siehe Bug-Report Philip 2026-08-07 im M1-Live-Test: genau DAS ist der
// häufigste, transiente Fall, ein 400 bei z.B. einem unbekannten Timeframe-Label wäre dagegen beim
// Retry identisch nochmal falsch). status wird unten am Error mitgegeben, um das zu unterscheiden.
function isRetryable(err) {
  if (err instanceof TypeError || err?.name === "TimeoutError" || err?.name === "AbortError") return true;
  return err?.status === 502;
}

async function fetchCandlesOnce(symbol, bar, { count, to } = {}) {
  const params = new URLSearchParams({ symbol, period: bar, count: String(count) });
  if (to) params.set("to", String(to));
  const res = await fetch(`${FOREX_FN_URL}?${params}`, {
    headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const json = await res.json();
  if (!res.ok) {
    const err = new Error(json.error || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return json; // oldest zuerst
}

async function fetchCandlesBatchOnce(items) {
  const res = await fetch(FOREX_FN_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      requests: items.map((it) => ({ symbol: it.symbol, period: it.bar, count: it.count, to: it.to })),
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const json = await res.json();
  if (!res.ok) {
    const err = new Error(json.error || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return json.results; // Array von Kerzen-Arrays, gleiche Reihenfolge wie `items`
}

// Bug-Report Philip 2026-08-07: seit dem Umstieg auf cTrader kommt "signal timed out"/eine 502
// ständig, vor allem im Live-Modus — die Edge Function baut PRO Request eine frische cTrader-TLS-
// Verbindung + Auth-Handshake auf (kein Pooling, siehe _shared/ctrader/client.ts). Ein einmaliger
// Retry bei transienten Fehlern (siehe isRetryable) fängt vereinzelte Handshake-Hänger/-Ausreißer
// ab, ohne dauerhaft kaputte Requests (z.B. ein 400) endlos zu wiederholen.
async function fetchSingleWithRetry(symbol, bar, opts) {
  try {
    return await fetchCandlesOnce(symbol, bar, opts);
  } catch (err) {
    if (!isRetryable(err)) throw err;
    return await fetchCandlesOnce(symbol, bar, opts);
  }
}

// Der eigentliche Grund für die gehäuften Timeouts: PriceChart.vue feuert beim Mount mehrere
// unabhängige Forex-Fetches gleichzeitig (Haupt-Kerzen/M5-Trade-Setups/1H-Ranges/4H-OBs) — ohne
// Bündelung öffnet jeder davon SEINE EIGENE cTrader-Verbindung, mehrere gleichzeitige Handshakes
// gegen denselben Account begünstigen Kollisionen/Hänger. `poi-watcher` hat genau dafür schon
// `fetchTrendbarsBatch` (eine Verbindung, mehrere Trendbar-Requests) — dasselbe Muster hier auf
// Transport-Ebene: Calls, die innerhalb von BATCH_WINDOW_MS ankommen, werden zu einem POST-Request
// zusammengefasst statt N GETs parallel zu feuern. Bewusst HIER (statt PriceChart.vue umzubauen) —
// loadInitial/loadTradeSetupM5/loadRangesCandles/loadObs4hCandles behalten ihre eigene Sequenz-
// Guard-/Replay-/Cache-Logik unverändert, das Bündeln passiert transparent darunter. Ein einzelner,
// isoliert ankommender Call (z.B. ein Poll auf Kerzenschluss) bekommt nach BATCH_WINDOW_MS ganz
// normal seinen eigenen GET-Request — kein Batch-Overhead für den häufigsten Fall.
const BATCH_WINDOW_MS = 50;
let pendingBatch = null; // { items: [{symbol,bar,count,to,resolve,reject}] }

function flushBatch(batch) {
  const { items } = batch;
  if (items.length === 1) {
    const it = items[0];
    fetchSingleWithRetry(it.symbol, it.bar, { count: it.count, to: it.to }).then(it.resolve, it.reject);
    return;
  }
  (async () => {
    try {
      let results;
      try {
        results = await fetchCandlesBatchOnce(items);
      } catch (err) {
        if (!isRetryable(err)) throw err;
        results = await fetchCandlesBatchOnce(items);
      }
      items.forEach((it, i) => it.resolve(results[i]));
    } catch (err) {
      items.forEach((it) => it.reject(err));
    }
  })();
}

function fetchCandles(symbol, bar, { count, to } = {}) {
  return new Promise((resolve, reject) => {
    if (!pendingBatch) {
      pendingBatch = { items: [] };
      setTimeout(() => {
        const batch = pendingBatch;
        pendingBatch = null;
        flushBatch(batch);
      }, BATCH_WINDOW_MS);
    }
    pendingBatch.items.push({ symbol, bar, count, to, resolve, reject });
  });
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
