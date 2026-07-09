// CVD (Cumulative Volume Delta) aus Binance-USDⓈ-M-Futures-Klines (BTCUSDT-Perpetual) —
// deutlich mehr Volumen als Spot, damit näher an dem, was Order-Flow-Tools wie Bookmap
// üblicherweise zeigen (die i.d.R. an Futures/Perps hängen, nicht an Spot-Märkten).
// Klines liefern "Taker buy base asset volume" direkt mit (Index 9), daraus lässt sich der
// Delta pro Kerze ohne Einzel-Trade-Aggregation berechnen:
//   delta = takerBuyVolume - takerSellVolume = 2 * takerBuyVolume - totalVolume

const BINANCE_FUTURES_BASE_URL = "https://fapi.binance.com";
const BINANCE_SYMBOL = "BTCUSDT";
export const BINANCE_PAGE_SIZE = 1000;

const INTERVAL_MAP = { "1m": "1m", "3m": "3m", "5m": "5m", "15m": "15m", "1h": "1h", "4h": "4h", "1D": "1d" };

export function binanceIntervalFor(label) {
  return INTERVAL_MAP[label];
}

function rowToDelta(row) {
  const time = Math.floor(Number(row[0]) / 1000);
  const volume = Number(row[5]);
  const takerBuyVolume = Number(row[9]);
  return { time, delta: 2 * takerBuyVolume - volume };
}

// Binance liefert Klines aufsteigend sortiert (ältste zuerst) — anders als OKX.
async function fetchDeltaPage(interval, { startTime, endTime, limit } = {}) {
  const params = new URLSearchParams({ symbol: BINANCE_SYMBOL, interval, limit: String(limit) });
  if (startTime) params.set("startTime", String(startTime));
  if (endTime) params.set("endTime", String(endTime));
  const res = await fetch(`${BINANCE_FUTURES_BASE_URL}/fapi/v1/klines?${params}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const rows = await res.json();
  return rows.map(rowToDelta);
}

// Kumulatives Delta seit 00:00 UTC — 5m-Auflösung reicht für einen ganzen Tag (288 Kerzen)
// bequem in einen einzigen Call, unabhängig vom Chart-Timeframe.
export async function fetchDailyDeltas() {
  const now = new Date();
  const dayStartUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return fetchDeltaPage("5m", { startTime: dayStartUtc, limit: BINANCE_PAGE_SIZE });
}

export async function fetchInitialDeltas(interval, count) {
  let all = [];
  let endTime;
  while (all.length < count) {
    const page = await fetchDeltaPage(interval, { endTime, limit: BINANCE_PAGE_SIZE });
    if (page.length === 0) break;
    all = page.concat(all);
    endTime = page[0].time * 1000 - 1;
    if (page.length < BINANCE_PAGE_SIZE) break;
  }
  return all;
}

export async function fetchOlderDeltas(interval, oldestLoadedTime) {
  const page = await fetchDeltaPage(interval, { endTime: oldestLoadedTime * 1000 - 1, limit: BINANCE_PAGE_SIZE });
  return page.filter((d) => d.time < oldestLoadedTime);
}

export function mergeRecentDeltas(existing, freshRecent) {
  if (existing.length === 0 || freshRecent.length === 0) return freshRecent;
  const freshStart = freshRecent[0].time;
  const olderPrefix = existing.filter((d) => d.time < freshStart);
  return olderPrefix.concat(freshRecent);
}

export function cumulativeFromDeltas(deltas) {
  let running = 0;
  return deltas.map((d) => {
    running += d.delta;
    return { time: d.time, value: running };
  });
}
