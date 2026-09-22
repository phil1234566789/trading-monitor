import { supabase } from "./supabaseClient.js";
import { fetchAllRows } from "./dbReadPaging.js";

// Task "Chart-Objekte: OBs auf kanonische ob_zones-ID konsolidieren", Punkt 12 (analog zu
// obZones.js) — persistierte HTF-Liquiditäts-Level, unabhängig vom gerade gewählten Chart-
// Timeframe. Seit der 2026-08-23-Nachbesserung 1H UND 4H (vorher nur 1H, siehe Git-Historie
// dieser Datei) — poi-watcher erkennt/persistiert beide jetzt über dieselbe TIMEFRAMES-Schleife
// wie ob_zones. Alle Instrumente ungefiltert geholt, client-seitig gefiltert (gleiches Muster wie
// fetchObZones).
const SPALTEN = "instrument, timeframe, direction, price, touched, pivot_time, end_time";
const MAX_BERUEHRTE = 500;

export async function fetchLiquidityLevelsHtf() {
  // Zwei Abfragen statt einer, aus demselben Grund wie in obZones.js (dort der ausführliche
  // Bug-Report vom 22.09.2026): ein unberührtes Level bleibt relevant, egal wie alt es ist — seine
  // Linie läuft bis zum aktuellen Kurs weiter. Ein gemeinsames Limit hätte ausgerechnet die
  // ältesten davon weggeschnitten, ein `order asc` ohne Limit stattdessen die jüngsten.
  const [unberuehrt, beruehrt] = await Promise.all([
    fetchAllRows((from, to) => supabase.from("liquidity_levels").select(SPALTEN)
      .in("timeframe", ["1H", "4H"]).eq("touched", false)
      .order("id", { ascending: true }).range(from, to)),
    supabase.from("liquidity_levels").select(SPALTEN)
      .in("timeframe", ["1H", "4H"]).eq("touched", true)
      .order("pivot_time", { ascending: false }).limit(MAX_BERUEHRTE),
  ]);
  const error = unberuehrt.error ?? beruehrt.error;
  if (error) {
    console.error("liquidity_levels laden fehlgeschlagen:", error);
    return [];
  }
  const data = [...(unberuehrt.data ?? []), ...(beruehrt.data ?? [])]
    .sort((a, b) => new Date(a.pivot_time) - new Date(b.pivot_time));
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
