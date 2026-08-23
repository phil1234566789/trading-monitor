import { supabase } from "./supabaseClient.js";

// Task "Chart-Objekte: OBs auf kanonische ob_zones-ID konsolidieren", Punkt 7
// (PLAN-chart-objekte-forex.md Abschnitt 4a) — 1H/4H-Indikator-Overlay liest jetzt aus der von
// poi-watcher persistierten ob_zones-Tabelle statt live über ein fest begrenztes Kerzenfenster neu
// zu erkennen (Bug: eine Zone, die älter als das geladene Fenster war, wurde nie gefunden, egal wie
// nah am aktuellen Preis). M5 bleibt bewusst live (siehe dort) — diese Funktion liefert nur 1H/4H.
// Alle Instrumente ungefiltert geholt (gleiches Muster wie fetchPinContext in pinContext.js) und
// client-seitig nach Instrument gefiltert (siehe PriceChart.vue: filterDbObZones) — bei den hier
// vorliegenden Zeilenzahlen (ein paar hundert je Instrument+Timeframe) kein Problem, ungefiltert zu
// laden.
export async function fetchObZones() {
  const { data, error } = await supabase
    .from("ob_zones")
    .select("instrument, timeframe, direction, top, bottom, weak, touched, invalidated, start_time, end_time")
    .in("timeframe", ["1H", "4H"]);
  if (error) {
    console.error("ob_zones laden fehlgeschlagen:", error);
    return [];
  }
  // Zurück in dieselbe Zonen-Form wie detectOrderBlocks() (dir numerisch statt direction-Text, Zeiten
  // in Unix-Sekunden statt ISO) — Rendering/Klick-Erkennung/mergePinnedZones erwarten dieses Format
  // einheitlich, egal ob die Zone live erkannt oder aus der DB gelesen wurde.
  return data.map((row) => ({
    instrument: row.instrument,
    timeframe: row.timeframe,
    dir: row.direction === "long" ? 1 : -1,
    top: row.top,
    bottom: row.bottom,
    weak: row.weak,
    touched: row.touched,
    invalidated: row.invalidated,
    startTime: Math.floor(new Date(row.start_time).getTime() / 1000),
    endTime: Math.floor(new Date(row.end_time).getTime() / 1000),
  }));
}
