// HTTP wrapper around the Twelve Data time_series fetch (see `_shared/twelvedata/client.ts`)
// — Nachfolger von `ctrader-candles` (siehe Chat 2026-07-22: Volumetrica/IQ Capital haben
// kein cTrader, nur MT5/ATAS/Quantower). Gleiche Form wie vorher ({time,open,high,low,close,
// volume}, oldest-first), damit sich am Frontend (src/forexCandles.js) nichts sonst ändert.
import { fetchCandles, SUPPORTED_PERIODS } from "../_shared/twelvedata/client.ts";

const TWELVEDATA_API_KEY = Deno.env.get("TWELVEDATA_API_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
};
const MAX_COUNT = 1000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  const url = new URL(req.url);
  const symbol = url.searchParams.get("symbol") ?? "GBPUSD";
  const period = url.searchParams.get("period") ?? "1h";
  const count = Math.min(Number(url.searchParams.get("count") ?? "300"), MAX_COUNT);
  const toParam = url.searchParams.get("to"); // ms epoch, exclusive upper bound — for "load older"

  if (!SUPPORTED_PERIODS.includes(period)) {
    return new Response(JSON.stringify({ error: `Unknown period: ${period}` }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  try {
    const candles = await fetchCandles({
      apiKey: TWELVEDATA_API_KEY,
      symbolName: symbol,
      period,
      count,
      toTimestampMs: toParam ? Number(toParam) : undefined,
    });
    return new Response(JSON.stringify(candles), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("forex-candles error:", err);
    return new Response(JSON.stringify({ error: String(err instanceof Error ? err.message : err) }), {
      status: 502,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
