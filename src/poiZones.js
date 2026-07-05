import { supabase } from "./supabaseClient.js";

// Wandelt eine ob_zones-Zeile in das Zonen-Format um, das die Chart-Primitives
// (orderBlocks.js) erwarten. `end_time` kommt direkt aus der Zonen-Erkennung im
// poi-watcher (Kerzen-Zeit der zuletzt gewachsenen Kerze, automatisch eingefroren sobald
// die Zone touched/invalidated ist) — keine eigene Herleitung noetig.
function toChartZone(row) {
  const startTime = Math.floor(new Date(row.start_time).getTime() / 1000);
  const endTime = Math.floor(new Date(row.end_time).getTime() / 1000);

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

  return data.map((row) => toChartZone(row));
}
