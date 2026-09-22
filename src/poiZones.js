import { supabase } from "./supabaseClient.js";

// Deckel je Alarm-Typ im Protokoll (auch in alarmLog.js): ob_zones steht bei ~17000 Zeilen,
// weit über dem stillen PostgREST-Deckel von ~1000. Hier ist ein Limit die richtige Antwort und
// keine Paginierung — das Protokoll ist eine absteigende Zeitleiste, was hinten abfällt, sieht
// ohnehin niemand an.
export const MAX_PROTOKOLL_ZEILEN = 300;

// Rohe (nicht auf Chart-Zonen gemappte) Zeilen fürs POI-Protokoll — zeigt nur, was
// tatsächlich erreicht wurde, mit den DB-eigenen Spaltennamen.
export async function fetchTouchedZones(instrument) {
  const { data, error } = await supabase
    .from("ob_zones")
    .select("*")
    .eq("instrument", instrument)
    .eq("touched", true)
    .order("end_time", { ascending: false })
    .limit(MAX_PROTOKOLL_ZEILEN);

  if (error) throw error;
  return data;
}
