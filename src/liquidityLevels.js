import { supabase } from "./supabaseClient.js";

// Task "Chart-Objekte: OBs auf kanonische ob_zones-ID konsolidieren", Punkt 12 — analog zu
// obZones.js, aber für liquidity_levels (nur 1H, siehe poi-watcher). Anders als bei OBs gibt es
// hier keine 1H/4H/M5-Toggle-Trias — Liquidity-Level werden sonst immer nur live auf dem gerade
// angezeigten Chart-Timeframe erkannt (refreshLiquidityInternal in PriceChart.vue). Der neue,
// unabhängige "1H-Level"-Toggle (Philip 2026-08-22, statt eines impliziten currentBar===1H-Sonderfalls)
// zeigt 1H-Level IMMER zusätzlich an, unabhängig vom gerade gewählten Chart-Timeframe — genau wie
// showObs1h bei den Order Blocks.
export async function fetchLiquidityLevels1h() {
  const { data, error } = await supabase
    .from("liquidity_levels")
    .select("instrument, direction, price, touched, pivot_time, end_time")
    .eq("timeframe", "1H")
    .order("pivot_time", { ascending: true });
  if (error) {
    console.error("liquidity_levels laden fehlgeschlagen:", error);
    return [];
  }
  // Zurück in dieselbe Level-Form wie detectLiquidityLevels() (dir numerisch statt direction-Text
  // "high"/"low", Zeiten in Unix-Sekunden statt ISO) — filterRelevantLevels/Rendering/Klick-
  // Erkennung erwarten dieses Format einheitlich, egal ob live erkannt oder aus der DB gelesen.
  return data.map((row) => ({
    instrument: row.instrument,
    dir: row.direction === "high" ? 1 : -1,
    price: row.price,
    touched: row.touched,
    pivotTime: Math.floor(new Date(row.pivot_time).getTime() / 1000),
    touchedTime: row.touched && row.end_time != null ? Math.floor(new Date(row.end_time).getTime() / 1000) : null,
    endTime: row.end_time != null ? Math.floor(new Date(row.end_time).getTime() / 1000) : null,
  }));
}
