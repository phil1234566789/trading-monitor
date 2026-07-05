import { supabase } from "./supabaseClient.js";

// Wandelt eine ob_zones-Zeile in das Zonen-Format um, das die Chart-Primitives
// (orderBlocks.js) erwarten. `endTime` ist nicht in der DB gespeichert — wird hier aus
// touched/invalidated-Status hergeleitet (aehnlich zur Live-Erkennung: waechst, bis die
// Zone touched/invalidated ist, dann eingefroren).
function toChartZone(row, nowSec) {
  const startTime = Math.floor(new Date(row.start_time).getTime() / 1000);
  let endTime;
  if (row.invalidated) endTime = Math.floor(new Date(row.invalidated_at ?? row.updated_at).getTime() / 1000);
  else if (row.touched) endTime = Math.floor(new Date(row.touched_at ?? row.updated_at).getTime() / 1000);
  else endTime = nowSec;

  return {
    top: row.top,
    bottom: row.bottom,
    dir: row.direction === "long" ? 1 : -1,
    weak: row.weak,
    touched: row.touched,
    invalidated: row.invalidated,
    startTime,
    endTime,
    timeframe: row.timeframe,
  };
}

export async function fetchPoiZones(instrument) {
  const { data, error } = await supabase
    .from("ob_zones")
    .select("*")
    .eq("instrument", instrument)
    .order("start_time", { ascending: true });

  if (error) throw error;

  const nowSec = Math.floor(Date.now() / 1000);
  return data.map((row) => toChartZone(row, nowSec));
}
