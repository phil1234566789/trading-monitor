import { supabase } from "./supabaseClient.js";

// Rohe (nicht auf Chart-Zonen gemappte) Zeilen fürs POI-Protokoll — zeigt nur, was
// tatsächlich erreicht wurde, mit den DB-eigenen Spaltennamen.
export async function fetchTouchedZones(instrument) {
  const { data, error } = await supabase
    .from("ob_zones")
    .select("*")
    .eq("instrument", instrument)
    .eq("touched", true)
    .order("end_time", { ascending: false });

  if (error) throw error;
  return data;
}
