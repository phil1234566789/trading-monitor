// Schreibzugriff auf trade_setup_sweeps (Migration 20260921210000) — die Kindtabelle mit ALLEN
// Leveln, die ein Setup abgeräumt hat. poi-watcher und backfillTradeSetups schreiben dieselbe
// Form; eigene Datei statt einer Kopie je Schreiber (CLAUDE.md "DRY within a single runtime") und
// statt eines Anbaus an tradeSetup.ts, das bewusst reine Erkennungslogik ohne DB-Zugriff bleibt.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import type { SetupSweep } from "./tradeSetup.ts";

export async function persistTradeSetupSweeps(
  supabase: SupabaseClient,
  tradeSetupId: number,
  sweeps: SetupSweep[],
) {
  const { error } = await supabase.from("trade_setup_sweeps").upsert(
    // sweeps ist nach Alter sortiert (siehe collectObSweeps) — der erste ist der entscheidende,
    // derselbe, der in trade_setups.ls_* steht.
    sweeps.map((sw, i) => ({
      trade_setup_id: tradeSetupId,
      timeframe: sw.timeframe,
      pivot_time: new Date(sw.level.pivotTime * 1000).toISOString(),
      price: sw.level.price,
      touched_time: new Date(sw.level.touchedTime! * 1000).toISOString(),
      is_primary: i === 0,
    })),
    { onConflict: "trade_setup_id,timeframe,pivot_time" },
  );
  if (error) throw error;
}
