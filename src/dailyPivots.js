import { supabase } from "./supabaseClient.js";

// Task "Market-Structure-Startpunkt: 1D-Periode-4-Pivots" — persistierte 1D-Periode-4-Fraktal-
// Pivots (siehe daily-structure-pivots-Edge-Function/daily_structure_pivots-Tabelle), analog zu
// src/liquidityLevels.js' fetchLiquidityLevelsHtf: alle Instrumente ungefiltert geholt,
// client-seitig gefiltert (usePriceChartDailyPivots.js). Zurück in numerisches dir/Unix-Sekunden-
// Format wie jedes andere Level in dieser App.
export async function fetchDailyStructurePivots() {
  const { data, error } = await supabase
    .from("daily_structure_pivots")
    .select("instrument, direction, price, pivot_time, structure_start_time, touched")
    .order("pivot_time", { ascending: true });
  if (error) {
    console.error("daily_structure_pivots laden fehlgeschlagen:", error);
    return [];
  }
  return data.map((row) => ({
    instrument: row.instrument,
    dir: row.direction === "high" ? 1 : -1,
    price: row.price,
    pivotTime: Math.floor(new Date(row.pivot_time).getTime() / 1000),
    structureStartTime: row.structure_start_time != null ? Math.floor(new Date(row.structure_start_time).getTime() / 1000) : null,
    touched: row.touched,
  }));
}
