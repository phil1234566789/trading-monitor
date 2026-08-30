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
//
// Zwei Request-Formen: GET (ein Request = ein `fetchTrendbars`-Aufruf, eigene cTrader-Verbindung)
// für einzelne/isolierte Fetches, und POST `{requests:[{symbol,period,count,to}]}` (ein
// `fetchTrendbarsBatch`-Aufruf, EINE gemeinsame Verbindung für mehrere Trendbar-Requests) für
// den Fall, dass mehrere Fetches gebündelt ankommen — siehe Bug-Report 2026-08-07 unten am
// POST-Zweig für den Hintergrund.
import { createClient } from "npm:@supabase/supabase-js@2";
import { fetchTrendbars, fetchTrendbarsBatch } from "../_shared/ctrader/client.ts";
import { loadCtraderCreds } from "../_shared/ctraderCreds.ts";
import { persistClosedCandles } from "../_shared/forexCandlesArchive.ts";

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
// Bug-Report Philip 2026-08-10: bei 1000 lieferte ein GBPUSD-M1-Replay-Fetch (targetCount 1000 +
// bis zu MAX_LOOKAHEAD_BARS=2500 Lookahead-Kerzen, siehe src/candleCache.js) mit angefragtem
// count=3500 hier nur die (gekappten) neuesten 1000 zurück — aus einem Fenster nah am
// (Lookahead-verschobenen) `to`, NICHT um den eigentlichen Replay-Zeitpunkt. clipReplay() im
// Frontend filterte das komplett weg -> leerer Chart, kein Fehler. 5000 deckt targetCount(2500,
// TRADE_SETUP_M5_CANDLE_COUNT) + MAX_LOOKAHEAD_BARS(2500) — den größten vorkommenden Fall — mit
// Puffer ab, bleibt weit unter cTraders eigenem 14.000-Bars-Limit (siehe CLAUDE.md).
const MAX_COUNT = 5000;
const MAX_BATCH_REQUESTS = 10; // großzügig über dem tatsächlichen Bedarf (aktuell max. 4 gleichzeitige Fetches je Chart-Mount, siehe PriceChart.vue)

function errorResponse(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

// Schreibt jeden Live-Fetch ins forex_candles-Archiv zurück (Chat 2026-08-23: Philip will nicht
// jedes Mal dieselben Kerzen erneut über cTrader ziehen). fetchOneTrendbar liefert laut eigenem
// Kommentar dort NIE die noch laufende Kerze mit (die API gibt count-1 abgeschlossene Bars
// zurück) — jede hier ankommende Candle ist also schon geschlossen, kein extra Filtern nötig.
// Nur 5m/1h/4h/1D persistieren (forex_candles' bar-CHECK-Constraint, siehe Migration
// 20260809120000, seit 20260830090000 auch '1D') — 1m/3m/15m-Fetches (z.B. Replay-Feintuning)
// bleiben reine Live-Reads. '1D' seit Task "Market-Structure-Startpunkt: 1D-Periode-4-Pivots"
// (2026-08-30), gebraucht von der neuen daily-structure-pivots-Funktion für die
// 1D-Periode-4-Fraktal-Erkennung. Chunked wie im Backfill-Script (backfillForexCandles.ts), da ein
// Single-Fetch bis zu MAX_COUNT=5000 Kerzen zurückgeben kann. Ein Archiv-Schreibfehler darf einen
// sonst erfolgreichen Live-Fetch nicht scheitern lassen — nur loggen, Response geht trotzdem raus.
const PERSISTABLE_BARS = new Set(["5m", "1h", "4h", "1D"]);

async function persistIfArchivable(
  supabase: ReturnType<typeof createClient>,
  instrument: string,
  period: string,
  candles: { time: number; open: number; high: number; low: number; close: number; volume: number }[],
) {
  if (!PERSISTABLE_BARS.has(period)) return;
  await persistClosedCandles(supabase, instrument, period, candles, "forex-candles");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Bug-Report Philip 2026-08-07 ("signal timed out" ständig, vor allem im Live-Modus): PriceChart.vue
  // feuert beim Mount mehrere unabhängige Forex-Fetches (Haupt-Kerzen/M5-Trade-Setups/1H-Ranges/
  // 4H-OBs) gleichzeitig ab. Ohne Batching baut JEDER davon seine eigene frische cTrader-TLS-
  // Verbindung + Auth-Handshake auf (`fetchTrendbars`) — mehrere gleichzeitige Handshakes gegen
  // denselben Account waren der plausibelste Grund für die gehäuften Timeouts. Dieser POST-Zweig
  // spiegelt exakt das Muster, das `poi-watcher` schon über `fetchTrendbarsBatch` nutzt (siehe
  // dort): EINE Verbindung/EIN Auth-Handshake für mehrere Trendbar-Requests. Der bestehende GET-
  // Einzelrequest-Pfad bleibt unverändert für Aufrufer, die (noch) nicht batchen — `src/forexCandles.js`
  // sammelt kurz gleichzeitig eingehende Fetches und schickt sie hier gebündelt rein, siehe dort.
  if (req.method === "POST") {
    let body: { requests?: { symbol: string; period: string; count: number; to?: number }[] };
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, "Invalid JSON body");
    }
    const requests = body.requests ?? [];
    if (requests.length === 0) return errorResponse(400, "requests must be a non-empty array");
    if (requests.length > MAX_BATCH_REQUESTS) return errorResponse(400, `Too many batched requests (max ${MAX_BATCH_REQUESTS})`);

    const mapped: { symbolName: string; period: string; count: number; toTimestampMs?: number }[] = [];
    for (const r of requests) {
      const ctraderPeriod = PERIOD_MAP[r.period];
      if (!ctraderPeriod) return errorResponse(400, `Unknown period: ${r.period}`);
      mapped.push({
        symbolName: r.symbol,
        period: ctraderPeriod,
        count: Math.min(r.count, MAX_COUNT),
        toTimestampMs: r.to,
      });
    }

    try {
      const { accessToken, refreshToken, onTokenRefresh } = await loadCtraderCreds(
        supabase,
        { accessToken: CTRADER_ACCESS_TOKEN_FALLBACK, refreshToken: CTRADER_REFRESH_TOKEN_FALLBACK },
        "forex-candles",
      );
      const results = await fetchTrendbarsBatch({
        clientId: CTRADER_CLIENT_ID,
        clientSecret: CTRADER_CLIENT_SECRET,
        accessToken,
        refreshToken,
        onTokenRefresh,
        requests: mapped,
      });
      await Promise.all(
        requests.map((r, i) => persistIfArchivable(supabase, r.symbol, r.period, results[i])),
      );
      return new Response(JSON.stringify({ results }), {
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    } catch (err) {
      console.error("forex-candles batch error:", err);
      return errorResponse(502, String(err instanceof Error ? err.message : err));
    }
  }

  const url = new URL(req.url);
  const symbol = url.searchParams.get("symbol") ?? "GBPUSD";
  const period = url.searchParams.get("period") ?? "1h";
  const count = Math.min(Number(url.searchParams.get("count") ?? "300"), MAX_COUNT);
  const toParam = url.searchParams.get("to"); // ms epoch, exclusive upper bound — for "load older"

  const ctraderPeriod = PERIOD_MAP[period];
  if (!ctraderPeriod) return errorResponse(400, `Unknown period: ${period}`);

  try {
    const { accessToken, refreshToken, onTokenRefresh } = await loadCtraderCreds(
      supabase,
      { accessToken: CTRADER_ACCESS_TOKEN_FALLBACK, refreshToken: CTRADER_REFRESH_TOKEN_FALLBACK },
      "forex-candles",
    );
    const candles = await fetchTrendbars({
      clientId: CTRADER_CLIENT_ID,
      clientSecret: CTRADER_CLIENT_SECRET,
      accessToken,
      refreshToken,
      onTokenRefresh,
      symbolName: symbol,
      period: ctraderPeriod,
      count,
      toTimestampMs: toParam ? Number(toParam) : undefined,
    });
    await persistIfArchivable(supabase, symbol, period, candles);
    return new Response(JSON.stringify(candles), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("forex-candles error:", err);
    return errorResponse(502, String(err instanceof Error ? err.message : err));
  }
});
