import { supabase } from "./supabaseClient.js";

// Task "Chart-Objekte: OBs auf kanonische ob_zones-ID konsolidieren", Punkt 12 (analog zu
// obZones.js) — persistierte HTF-Liquiditäts-Level, unabhängig vom gerade gewählten Chart-
// Timeframe. Seit der 2026-08-23-Nachbesserung 1H UND 4H (vorher nur 1H, siehe Git-Historie
// dieser Datei) — poi-watcher erkennt/persistiert beide jetzt über dieselbe TIMEFRAMES-Schleife
// wie ob_zones. Alle Instrumente ungefiltert geholt, client-seitig gefiltert (gleiches Muster wie
// fetchObZones) — bei den hier vorliegenden Zeilenzahlen unproblematisch.
export async function fetchLiquidityLevelsHtf() {
  const { data, error } = await supabase
    .from("liquidity_levels")
    .select("instrument, timeframe, direction, price, touched, pivot_time, end_time")
    .in("timeframe", ["1H", "4H"])
    .order("pivot_time", { ascending: true });
  if (error) {
    console.error("liquidity_levels laden fehlgeschlagen:", error);
    return [];
  }
  // Zurück in dieselbe Level-Form wie detectLiquidityLevels() (dir numerisch statt direction-Text
  // "high"/"low", Zeiten in Unix-Sekunden statt ISO) — selectRelevantHtfLevels/Rendering/Klick-
  // Erkennung erwarten dieses Format einheitlich, egal ob live erkannt oder aus der DB gelesen.
  return data.map((row) => ({
    instrument: row.instrument,
    timeframe: row.timeframe,
    dir: row.direction === "high" ? 1 : -1,
    price: row.price,
    touched: row.touched,
    pivotTime: Math.floor(new Date(row.pivot_time).getTime() / 1000),
    touchedTime: row.touched && row.end_time != null ? Math.floor(new Date(row.end_time).getTime() / 1000) : null,
    endTime: row.end_time != null ? Math.floor(new Date(row.end_time).getTime() / 1000) : null,
  }));
}
