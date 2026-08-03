// HTTP wrapper around the cTrader Open API trendbars fetch (see `_shared/ctrader/client.ts`)
// — Nachfolger von Twelve Data (siehe Chat 2026-08-03: die zweite cTrader-Challenge-Konto-
// Deaktivierung führte zum Umstieg auf Twelve Data, dessen 60+-Liquiditätsprovider-Aggregat
// aber die Docht-Extreme glättet, auf denen die FVG/OB-Erkennung aufbaut — Bug-Report
// 2026-07-27 "Setups auf FOREXCOM sichtbar, auf Twelve Data nicht"). Zurück zu cTrader, jetzt
// auf einem regulären Pepperstone-Razor-Demokonto statt einer Prop-Firm-Challenge (siehe
// PLAN-notifications.md "Status: cTrader Open API"). Gleiche Form wie vorher ({time,open,
// high,low,close,volume}, oldest-first), damit sich am Frontend (src/forexCandles.js) nichts
// ändert — inkl. derselben timeframes.js-Labels ("1m".."1D") als `period`-Query-Param, hier
// nur intern auf cTraders TRENDBAR_PERIOD-Namen ("M1".."D1") gemappt.
import { createClient } from "npm:@supabase/supabase-js@2";
import { fetchTrendbars, type RefreshedTokens } from "../_shared/ctrader/client.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CTRADER_CLIENT_ID = Deno.env.get("CTRADER_CLIENT_ID")!;
const CTRADER_CLIENT_SECRET = Deno.env.get("CTRADER_CLIENT_SECRET")!;
// Fallback fürs allererste Deployment vor der ersten `ctrader_oauth_tokens`-Zeile — siehe
// selbes Muster in poi-watcher/index.ts.
const CTRADER_ACCESS_TOKEN_FALLBACK = Deno.env.get("CTRADER_ACCESS_TOKEN") ?? "";
const CTRADER_REFRESH_TOKEN_FALLBACK = Deno.env.get("CTRADER_REFRESH_TOKEN") ?? "";

// timeframes.js-Label -> cTrader-TRENDBAR_PERIOD-Key. cTrader kennt M3 nativ (anders als
// Twelve Data, das dafür 1min-Kerzen resamplen musste) — keine Resample-Logik mehr nötig.
const PERIOD_MAP: Record<string, string> = {
  "1m": "M1",
  "3m": "M3",
  "5m": "M5",
  "15m": "M15",
  "1h": "H1",
  "4h": "H4",
  "1D": "D1",
};

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

  const ctraderPeriod = PERIOD_MAP[period];
  if (!ctraderPeriod) {
    return new Response(JSON.stringify({ error: `Unknown period: ${period}` }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: tokenRow, error: tokenSelectError } = await supabase
      .from("ctrader_oauth_tokens")
      .select("access_token, refresh_token")
      .eq("id", 1)
      .maybeSingle();
    if (tokenSelectError) throw tokenSelectError;
    const accessToken = tokenRow?.access_token ?? CTRADER_ACCESS_TOKEN_FALLBACK;
    const refreshToken = tokenRow?.refresh_token ?? CTRADER_REFRESH_TOKEN_FALLBACK;

    const candles = await fetchTrendbars({
      clientId: CTRADER_CLIENT_ID,
      clientSecret: CTRADER_CLIENT_SECRET,
      accessToken,
      refreshToken,
      onTokenRefresh: async (fresh: RefreshedTokens) => {
        const { error } = await supabase
          .from("ctrader_oauth_tokens")
          .upsert({ id: 1, access_token: fresh.accessToken, refresh_token: fresh.refreshToken });
        if (error) console.error("forex-candles: failed to persist refreshed token:", error);
      },
      symbolName: symbol,
      period: ctraderPeriod,
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
