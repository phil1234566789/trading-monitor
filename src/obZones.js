import { supabase } from "./supabaseClient.js";
import { fetchAllRows } from "./dbReadPaging.js";
import { applyAsOfZones } from "../supabase/functions/trading-monitor-mcp/replayAsOf.ts";

import { reconstructObLifecycle } from "../supabase/functions/_shared/obReplayLifecycle.ts";

async function fetchReplayZones(instrument, asOfSec) {
  // Im Replay gelten weder der heutige Status noch der Live-Deckel der jüngsten 500 Touches.
  const { data, error } = await fetchAllRows((from, to) => supabase.from("ob_zones").select(SPALTEN)
    .eq("instrument", instrument).in("timeframe", ["1H", "4H"])
    .lte("start_time", new Date(asOfSec * 1000).toISOString())
    .order("id", { ascending: true }).range(from, to));
  if (error) throw error;
  const rows = applyAsOfZones(data, asOfSec);
  return reconstructZones(rows, instrument, asOfSec);
}

async function reconstructZones(rows, instrument, asOfSec) {
  const reconstructed = await reconstructObLifecycle(rows, asOfSec, async (bar, fromSec, untilSec) => {
    const result = await fetchAllRows((from, to) => supabase.from("forex_candles")
      .select("time, high, low").eq("instrument", instrument).eq("bar", bar)
      .gte("time", new Date(fromSec * 1000).toISOString())
      .lte("time", new Date(untilSec * 1000).toISOString())
      .order("time", { ascending: true }).range(from, to));
    if (result.error) throw result.error;
    return result.data.map(c => ({ ...c, time: Date.parse(c.time) / 1000 }));
  });
  return reconstructed.map(mapObZone);
}

// Task "Chart-Objekte: OBs auf kanonische ob_zones-ID konsolidieren", Punkt 7
// (PLAN-chart-objekte-forex.md Abschnitt 4a) — 1H/4H-Indikator-Overlay liest jetzt aus der von
// poi-watcher persistierten ob_zones-Tabelle statt live über ein fest begrenztes Kerzenfenster neu
// zu erkennen (Bug: eine Zone, die älter als das geladene Fenster war, wurde nie gefunden, egal wie
// nah am aktuellen Preis). M5 bleibt bewusst live (siehe dort) — diese Funktion liefert nur 1H/4H.
// Pro Instrument laden, damit Lebenszyklus und Kerzenarchiv denselben Feed verwenden.
//
// ZWEI Abfragen statt einer, Bug-Report Philip 2026-09-22 ("der 1h OB ist nicht im Chart zu sehen",
// Zone id=3344784 vom 21.09. 15:00): die Tabelle ist über den PostgREST-Deckel von ~1000 Zeilen
// gewachsen (2106 bei 1H+4H). Ein ungefiltertes select() lieferte genau 1000 davon, ohne Fehler und
// ohne `order` in physischer Reihenfolge — also die ÄLTESTEN. Abgeschnitten wurde damit ausgerechnet
// das Neueste: jede Zone ab id 3336980 war im Chart unsichtbar. Der CLAUDE.md-Gotcha, nur an einer
// Stelle, an der ihn nie jemand geprüft hat.
//
// Warum nicht einfach `order desc` + limit: eine UNBERÜHRTE Zone bleibt relevant, egal wie alt sie
// ist — ihre Box läuft bis zum aktuellen Kurs weiter, und genau das ist ein POI. Ein gemeinsames
// Limit würde die ältesten davon wegschneiden. Eine BERÜHRTE Zone endet dagegen bei ihrem Touch,
// da sind nur die jüngsten überhaupt am Chart sichtbar. Also: alle unberührten (Stand 22.09.2026
// 268 Stück, die Zahl wächst nicht unbegrenzt — jede wird irgendwann berührt) plus die jüngsten
// berührten.
const MAX_BERUEHRTE = 500;
const SPALTEN = "instrument, timeframe, direction, top, bottom, touched, invalidated, start_time, end_time";

// Auch invalidierte Zonen können touched=false sein: nach dem FXCM-Backfill waren es 1250 Zeilen.
function fetchUntouchedZones(instrument) {
  return fetchAllRows((from, to) => supabase.from("ob_zones").select(SPALTEN)
    .eq("instrument", instrument).in("timeframe", ["1H", "4H"]).eq("touched", false)
    .order("id", { ascending: true }).range(from, to));
}

export async function fetchObZones(instrument, asOfSec = null) {
  if (asOfSec != null) return fetchReplayZones(instrument, asOfSec);
  const [unberuehrt, beruehrt] = await Promise.all([
    fetchUntouchedZones(instrument),
    supabase.from("ob_zones").select(SPALTEN).eq("instrument", instrument).in("timeframe", ["1H", "4H"]).eq("touched", true)
      .order("start_time", { ascending: false }).limit(MAX_BERUEHRTE),
  ]);
  const error = unberuehrt.error ?? beruehrt.error;
  if (error) {
    console.error("ob_zones laden fehlgeschlagen:", error);
    return [];
  }
  const data = [...(unberuehrt.data ?? []), ...(beruehrt.data ?? [])];
  // Zurück in dieselbe Zonen-Form wie detectOrderBlocks() (dir numerisch statt direction-Text, Zeiten
  // in Unix-Sekunden statt ISO) — Rendering/Klick-Erkennung/mergePinnedZones erwarten dieses Format
  // einheitlich, egal ob die Zone live erkannt oder aus der DB gelesen wurde.
  return reconstructZones(data, instrument, Date.now() / 1000);
}

export function mapObZone(row) {
  return {
    instrument: row.instrument,
    timeframe: row.timeframe,
    dir: row.direction === "long" ? 1 : -1,
    top: row.top,
    bottom: row.bottom,
    touched: row.touched,
    invalidated: row.invalidated,
    startTime: Math.floor(new Date(row.start_time).getTime() / 1000),
    endTime: row.end_time == null ? null : Math.floor(new Date(row.end_time).getTime() / 1000),
  };
}
