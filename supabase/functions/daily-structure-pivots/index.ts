// Stündlich idempotent: bestätigte D1-Periode-4-Pivots aus dem FXCM-Archiv.
// Native New-York-Schlusszeiten variieren saisonal; neue Pivots entstehen nur nach D1-Schluss.
import { createClient } from "npm:@supabase/supabase-js@2";
import { readForexCandlesArchiveFrom } from "../_shared/forexCandlesArchive.ts";
import { detectLiquidityLevels } from "../_shared/liquidityDetection.ts";
import { resolveStructureStartTime } from "../_shared/resolveStructureStartTime.ts";

// Gleiche Instrumentenliste wie poi-watcher (siehe dortiges INSTRUMENTS) — beide Forex-Paare, die
// diese App überhaupt trackt.
const INSTRUMENTS = ["GBPUSD", "EURUSD"];

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// Periode-4-Fraktal auf 1D-Kerzen (Philips Vorgabe, siehe Task-Titel) — bewusst eigene Periode,
// unabhängig von LIQUIDITY_FRACTAL_PERIOD (5, für 1H/4H) oder den Ranges-Perioden 5/2
// (marketStructureAnalysis.ts) — detectLiquidityLevels ist periodenagnostisch, siehe
// _shared/liquidityDetection.ts.
const DAILY_PIVOT_PERIOD = 4;
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
    const summary: Record<string, unknown> = {};

    for (let i = 0; i < INSTRUMENTS.length; i++) {
      const instrument = INSTRUMENTS[i];
      // Vollständige geschlossene FXCM-Historie aus dem Archiv.
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
      //
      // Nur ab dem ÄLTESTEN gerade erkannten Pivot gefragt, nicht der ganze Bestand: PostgREST
      // deckelt eine Antwort bei ~1000 Zeilen, ohne Fehler (CLAUDE.md). Die Tabelle wächst ~2
      // Zeilen/Tag/Instrument — ein Voll-Select hätte nach gut einem Jahr still Schlüssel verloren
      // und dieselben Pivots endlos neu verarbeitet.
      if (detectedPivots.length === 0) {
        summary[instrument] = { newPivots: 0 };
        continue;
      }
      const aeltesterErkannter = Math.min(...detectedPivots.map((p) => p.pivotTime));
      const { data: existingRows, error: existingError } = await supabase
        .from("daily_structure_pivots")
        .select("instrument, direction, pivot_time")
        .eq("instrument", instrument)
        .gte("pivot_time", new Date(aeltesterErkannter * 1000).toISOString())
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
