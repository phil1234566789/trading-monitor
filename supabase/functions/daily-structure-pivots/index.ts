// Task "Market-Structure-Startpunkt: 1D-Periode-4-Pivots" — eigene, von poi-watcher entkoppelte
// Cron-Funktion (läuft nur 1x/Tag, kein Tick-Gating wie poi-watcher nötig): holt/persistiert
// 1D-Kerzen für GBPUSD/EURUSD, erkennt darauf Periode-4-Fraktal-Pivots (Williams-Fractal, siehe
// _shared/liquidityDetection.ts) und persistiert neue Pivots in daily_structure_pivots — der
// fundierte Default-Startpunkt für den 1H-Market-Structure-Algo (siehe CLAUDE.md,
// src/marketStructureAnalysis.notes.md), statt eines rollierenden Lookback-Fensters.
//
// Idempotenz = Feiertags-/Wochenend-Verhalten: kein neuer D1-Close -> Upsert/Pivot-Erkennung ist
// ein No-Op (kein separates Feiertags-/Kalender-Konzept nötig, siehe Migration
// 20260830092000_daily_structure_pivots_cron.sql für die Cron-Zeit-Herleitung).
import { createClient } from "npm:@supabase/supabase-js@2";
import { fetchTrendbarsBatch } from "../_shared/ctrader/client.ts";
import { loadCtraderCreds } from "../_shared/ctraderCreds.ts";
import { persistClosedCandles, readForexCandlesArchiveFrom } from "../_shared/forexCandlesArchive.ts";
import { detectLiquidityLevels } from "../_shared/liquidityDetection.ts";
import { resolveStructureStartTime } from "../_shared/resolveStructureStartTime.ts";

// Gleiche Instrumentenliste wie poi-watcher (siehe dortiges INSTRUMENTS) — beide Forex-Paare, die
// diese App überhaupt trackt.
const INSTRUMENTS = ["GBPUSD", "EURUSD"];

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CTRADER_CLIENT_ID = Deno.env.get("CTRADER_CLIENT_ID")!;
const CTRADER_CLIENT_SECRET = Deno.env.get("CTRADER_CLIENT_SECRET")!;
const CTRADER_ACCESS_TOKEN_FALLBACK = Deno.env.get("CTRADER_ACCESS_TOKEN") ?? "";
const CTRADER_REFRESH_TOKEN_FALLBACK = Deno.env.get("CTRADER_REFRESH_TOKEN") ?? "";

// Periode-4-Fraktal auf 1D-Kerzen (Philips Vorgabe, siehe Task-Titel) — bewusst eigene Periode,
// unabhängig von LIQUIDITY_FRACTAL_PERIOD (5, für 1H/4H) oder den Ranges-Perioden 5/2
// (marketStructureAnalysis.ts) — detectLiquidityLevels ist periodenagnostisch, siehe
// _shared/liquidityDetection.ts.
const DAILY_PIVOT_PERIOD = 4;
// ~2 Jahre 1D-Historie (Handelstage, keine Wochenenden) — reichlich Puffer für die
// Kaskaden-Fraktal-Logik (braucht period+4 Kerzen davor/danach) und für einen manuellen ersten
// Backfill-Lauf, weit unter cTraders 14.000-Bars-Hardlimit (siehe CLAUDE.md).
const DAILY_CANDLE_FETCH_COUNT = 600;

const CORS_HEADERS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };

interface ExistingPivotRow {
  instrument: string;
  direction: string;
  pivot_time: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { accessToken, refreshToken, onTokenRefresh } = await loadCtraderCreds(
      supabase,
      { accessToken: CTRADER_ACCESS_TOKEN_FALLBACK, refreshToken: CTRADER_REFRESH_TOKEN_FALLBACK },
      "daily-structure-pivots",
    );

    const results = await fetchTrendbarsBatch({
      clientId: CTRADER_CLIENT_ID,
      clientSecret: CTRADER_CLIENT_SECRET,
      accessToken,
      refreshToken,
      onTokenRefresh,
      requests: INSTRUMENTS.map((symbolName) => ({ symbolName, period: "D1", count: DAILY_CANDLE_FETCH_COUNT })),
    });

    const summary: Record<string, unknown> = {};

    for (let i = 0; i < INSTRUMENTS.length; i++) {
      const instrument = INSTRUMENTS[i];
      const freshDailyCandles = results[i];

      // 1. Persistieren (idempotent, ignoreDuplicates — Wochenende/Feiertag liefert einfach keine
      // neue Zeile, siehe Kopfkommentar).
      await persistClosedCandles(supabase, instrument, "1D", freshDailyCandles, "daily-structure-pivots");

      // 2. Genug 1D-Historie aus dem Archiv lesen (nicht nur den frischen Live-Fetch — der deckt
      // nur DAILY_CANDLE_FETCH_COUNT Tage ab, das Archiv kann inzwischen weiter zurückreichen).
      // Ab Unix-Epoche starten ist unproblematisch: das Archiv enthält ohnehin nur, was diese
      // Funktion selbst je persistiert hat.
      const dailyCandles = await readForexCandlesArchiveFrom(supabase, instrument, "1D", new Date(0).toISOString());
      if (dailyCandles.length < DAILY_PIVOT_PERIOD * 2 + 4) {
        summary[instrument] = { skipped: "not enough 1D history yet", candlesInArchive: dailyCandles.length };
        continue;
      }

      // 3. Periode-4-Pivots erkennen.
      const { highs, lows } = detectLiquidityLevels(dailyCandles, DAILY_PIVOT_PERIOD);
      const detectedPivots = [
        ...highs.map((l) => ({ direction: "high" as const, price: l.price, pivotTime: l.pivotTime, touched: l.touched })),
        ...lows.map((l) => ({ direction: "low" as const, price: l.price, pivotTime: l.pivotTime, touched: l.touched })),
      ];

      // 4. Nur neue Pivots (noch nicht in daily_structure_pivots) verarbeiten — bereits
      // gespeicherte Pivots ändern sich nie wieder (Preis/Zeit eines Fraktal-Pivots stehen mit
      // seiner Bestätigung fest, siehe _shared/liquidityDetection.ts).
      const { data: existingRows, error: existingError } = await supabase
        .from("daily_structure_pivots")
        .select("instrument, direction, pivot_time")
        .eq("instrument", instrument)
        .returns<ExistingPivotRow[]>();
      if (existingError) throw existingError;
      const existingKeys = new Set(
        (existingRows ?? []).map((r) => `${r.direction}_${Math.floor(new Date(r.pivot_time).getTime() / 1000)}`),
      );
      const newPivots = detectedPivots.filter((p) => !existingKeys.has(`${p.direction}_${p.pivotTime}`));

      if (newPivots.length === 0) {
        summary[instrument] = { newPivots: 0 };
        continue;
      }

      // 5. structure_start_time auflösen: 1H-Kerzen des jeweiligen Pivot-Tages aus dem Archiv
      // lesen (kleine Fensterlesungen, ein Tag pro Pivot) und gegen den Pivot-Preis matchen.
      let insertedCount = 0;
      for (const pivot of newPivots) {
        const dayStartIso = new Date(pivot.pivotTime * 1000).toISOString();
        const dayEndIso = new Date((pivot.pivotTime + 86400) * 1000).toISOString();
        const h1CandlesForDay = await readForexCandlesArchiveFrom(supabase, instrument, "1h", dayStartIso, dayEndIso);
        const structureStartTime = resolveStructureStartTime(pivot, h1CandlesForDay);

        const { error: upsertError } = await supabase.from("daily_structure_pivots").upsert(
          {
            instrument,
            direction: pivot.direction,
            price: pivot.price,
            pivot_time: new Date(pivot.pivotTime * 1000).toISOString(),
            structure_start_time: structureStartTime != null ? new Date(structureStartTime * 1000).toISOString() : null,
            touched: pivot.touched,
          },
          { onConflict: "instrument,direction,pivot_time" },
        );
        if (upsertError) throw upsertError;
        insertedCount++;
      }

      summary[instrument] = { newPivots: insertedCount };
    }

    return new Response(JSON.stringify(summary), { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("daily-structure-pivots error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
