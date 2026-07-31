import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabaseClient.js";

// Node-Port von src/forexCandles.js — ruft dieselbe `forex-candles` Edge Function auf, mit dem
// anon-key als Bearer-Token (exakt das Pattern, das pg_cron laut
// supabase/migrations/20260705200000_poi_watcher_cron.sql schon für den JWT-Gate der Function nutzt).
const FOREX_FN_URL = `${SUPABASE_URL}/functions/v1/forex-candles`;
const REQUEST_TIMEOUT_MS = 20_000;

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export async function fetchForexCandles(
  symbol: string,
  bar: string,
  { count, toMs }: { count: number; toMs?: number },
): Promise<Candle[]> {
  const params = new URLSearchParams({ symbol, period: bar, count: String(count) });
  if (toMs) params.set("to", String(toMs));
  const res = await fetch(`${FOREX_FN_URL}?${params}`, {
    headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
  return json; // oldest zuerst
}
