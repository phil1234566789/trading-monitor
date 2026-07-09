// HTTP wrapper around the cTrader Open API trendbars fetch (see `_shared/ctrader/client.ts`)
// so the frontend can request forex candles the same way it already requests OKX candles —
// a plain cross-origin GET — without ever holding the client secret/access token itself.
// No persistence: this proxies live, it doesn't cache into a table (unlike poi-watcher/
// ob_zones, which is BTC-only for now — forex OB detection is still meant to come from a
// TradingView webhook per PLAN-notifications.md, not from this codebase).
import { fetchTrendbars, TRENDBAR_PERIOD } from "../_shared/ctrader/client.ts";

const CTRADER_CLIENT_ID = Deno.env.get("CTRADER_CLIENT_ID")!;
const CTRADER_CLIENT_SECRET = Deno.env.get("CTRADER_CLIENT_SECRET")!;
const CTRADER_ACCESS_TOKEN = Deno.env.get("CTRADER_ACCESS_TOKEN")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
};
const MAX_COUNT = 1000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  const url = new URL(req.url);
  const symbol = url.searchParams.get("symbol") ?? "GBPUSD";
  const period = url.searchParams.get("period") ?? "H1";
  const count = Math.min(Number(url.searchParams.get("count") ?? "300"), MAX_COUNT);
  const toParam = url.searchParams.get("to"); // ms epoch, exclusive upper bound — for "load older"

  if (!TRENDBAR_PERIOD[period]) {
    return new Response(JSON.stringify({ error: `Unknown period: ${period}` }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  try {
    const candles = await fetchTrendbars({
      clientId: CTRADER_CLIENT_ID,
      clientSecret: CTRADER_CLIENT_SECRET,
      accessToken: CTRADER_ACCESS_TOKEN,
      symbolName: symbol,
      period,
      count,
      toTimestampMs: toParam ? Number(toParam) : undefined,
    });
    return new Response(JSON.stringify(candles), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("ctrader-candles error:", err);
    return new Response(JSON.stringify({ error: String(err instanceof Error ? err.message : err) }), {
      status: 502,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
