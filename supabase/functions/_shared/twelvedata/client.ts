// Forex-Kerzen über die Twelve Data REST API — Ersatz für den cTrader-Open-API-Client
// (_shared/ctrader/client.ts, siehe Chat 2026-07-22: Volumetrica/IQ Capital bieten kein
// cTrader an, nur MT5/ATAS/Quantower). Kein OAuth/Token-Refresh mehr nötig, nur ein
// statischer API-Key als Query-Parameter — deutlich einfacher als der TLS/Protobuf-Handshake.
const BASE_URL = "https://api.twelvedata.com/time_series";

export interface Candle {
  time: number; // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Twelve Data kennt kein "3min"-Intervall (siehe Doku-Recherche 2026-07-22) — für "3m" wird
// unten aus 1min-Kerzen serverseitig resampled, damit der 3m-Button im Dashboard (siehe
// timeframes.js TIMEFRAMES) für Forex genauso funktioniert wie für BTC/OKX.
const INTERVAL_MAP: Record<string, string> = {
  "1m": "1min",
  "5m": "5min",
  "15m": "15min",
  "1h": "1h",
  "4h": "4h",
  "1D": "1day",
};
const RESAMPLE_BUCKET_SEC: Record<string, number> = { "3m": 180 };
export const SUPPORTED_PERIODS = [...Object.keys(INTERVAL_MAP), ...Object.keys(RESAMPLE_BUCKET_SEC)];

interface TwelveDataValue {
  datetime: string; // "YYYY-MM-DD HH:mm:ss", UTC (wir fordern timezone=UTC an)
  open: string;
  high: string;
  low: string;
  close: string;
  volume?: string;
}

interface TwelveDataResponse {
  values?: TwelveDataValue[];
  code?: number;
  message?: string;
  status: string;
}

function toUnixSeconds(datetime: string): number {
  // "YYYY-MM-DD HH:mm:ss" ist kein von Date() zuverlässig parsbares Format ohne Zeitzone —
  // explizit als UTC interpretieren (passt zum angeforderten timezone=UTC-Parameter).
  return Math.floor(new Date(datetime.replace(" ", "T") + "Z").getTime() / 1000);
}

async function requestTimeSeries(
  apiKey: string,
  symbolName: string,
  interval: string,
  outputsize: number,
  toTimestampMs?: number,
): Promise<Candle[]> {
  const symbol = `${symbolName.slice(0, 3)}/${symbolName.slice(3)}`;
  const url = new URL(BASE_URL);
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("interval", interval);
  url.searchParams.set("outputsize", String(Math.min(outputsize, 5000)));
  url.searchParams.set("order", "asc");
  url.searchParams.set("timezone", "UTC");
  url.searchParams.set("apikey", apiKey);
  if (toTimestampMs) {
    url.searchParams.set("end_date", new Date(toTimestampMs).toISOString().slice(0, 19));
  }

  const res = await fetch(url);
  const body = (await res.json()) as TwelveDataResponse;
  if (!res.ok || body.status === "error") {
    throw new Error(`Twelve Data error ${body.code ?? res.status}: ${body.message ?? ""}`);
  }

  return (body.values ?? []).map((v) => ({
    time: toUnixSeconds(v.datetime),
    open: Number(v.open),
    high: Number(v.high),
    low: Number(v.low),
    close: Number(v.close),
    volume: Number(v.volume ?? 0),
  }));
}

// Fasst `bucketSec`-große, lückenlos aufeinanderfolgende 1min-Kerzen zu einer Kerze zusammen.
// Buckets werden auf Vielfache von bucketSec ausgerichtet (UTC-Epoch), nicht auf die erste
// Kerze im Array — sonst würde sich die Ausrichtung je nach `toTimestampMs`-Cursor verschieben
// und benachbarte Seiten (siehe fetchOlderCandles in ctraderCandles.js) würden nicht lückenlos
// aneinander anschließen.
function resample(oneMinCandles: Candle[], bucketSec: number): Candle[] {
  const buckets = new Map<number, Candle[]>();
  for (const c of oneMinCandles) {
    const bucketTime = Math.floor(c.time / bucketSec) * bucketSec;
    const bucket = buckets.get(bucketTime);
    if (bucket) bucket.push(c);
    else buckets.set(bucketTime, [c]);
  }
  return [...buckets.entries()]
    .map(([time, bars]) => ({
      time,
      open: bars[0].open,
      high: Math.max(...bars.map((b) => b.high)),
      low: Math.min(...bars.map((b) => b.low)),
      close: bars[bars.length - 1].close,
      volume: bars.reduce((sum, b) => sum + b.volume, 0),
    }))
    .sort((a, b) => a.time - b.time);
}

export interface FetchCandlesOptions {
  apiKey: string;
  symbolName: string; // z.B. "GBPUSD"
  period: string; // Label aus timeframes.js: "1m","3m","5m","15m","1h","4h","1D"
  count: number;
  toTimestampMs?: number;
}

export async function fetchCandles(opts: FetchCandlesOptions): Promise<Candle[]> {
  const bucketSec = RESAMPLE_BUCKET_SEC[opts.period];
  if (bucketSec) {
    // +10 Kerzen Puffer: der letzte Bucket kann unvollständig sein (weniger als 3 1min-Kerzen
    // vorhanden), außerdem deckt outputsize=count*3 exakt den Bedarf nicht immer ab, wenn der
    // erste Bucket im Ergebnis ebenfalls unvollständig ist (Cursor fällt nicht auf eine
    // Bucket-Grenze).
    const oneMin = await requestTimeSeries(opts.apiKey, opts.symbolName, "1min", opts.count * 3 + 10, opts.toTimestampMs);
    return resample(oneMin, bucketSec).slice(-opts.count);
  }
  const interval = INTERVAL_MAP[opts.period];
  if (!interval) throw new Error(`Unknown period: ${opts.period}`);
  return requestTimeSeries(opts.apiKey, opts.symbolName, interval, opts.count, opts.toTimestampMs);
}
