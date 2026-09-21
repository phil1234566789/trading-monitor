import { supabase } from "./supabaseClient.js";

// Die von poi-watcher persistierten Trade-Setups aus der trade_setups-Tabelle — DB-Gegenstück zur
// Live-Erkennung in tradeSetup.js (Dateiname nach der Tabelle, wie obZones.js neben orderBlocks.js).
//
// Grund (Task "Chart zeichnet die persistierten Trade-Setups"): Alarm (Deno-Kopie
// _shared/tradeSetup.ts) und Chart (src/tradeSetup.js) sind zwei getrennt portierte Erkennungen mit
// unterschiedlichen Kerzenfenstern, und NICHTS prüft, ob sie dasselbe finden — sie stimmen überein,
// solange jemand beide Seiten nachzieht, eine Abmachung statt einer Garantie. Dazugemischt zeigt der
// Chart per Konstruktion, was alarmiert hat (Philip: "wenn Alarm, dann soll es auch aufm Chart
// sichtbar sein"). Gleiche Lösung wie bei den OB-Zonen, siehe dbObZones-Prop in PriceChart.vue.
//
// Anders als fetchObZones instrumentweise UND gedeckelt: trade_setups hat je Instrument schon ~930
// Zeilen und wächst ~4/Tag, ein ungefiltertes select() liefert ab ~1000 stillschweigend weniger
// (CLAUDE.md-Gotcha). 200 deckt jede sinnvolle Chart-Historie ab (tradeSetupHistoryCount liegt im
// einstelligen Bereich).
const MAX_ROWS = 200;

export async function fetchTradeSetups(instrument, replayUntilSec = null) {
  let query = supabase
    .from("trade_setups")
    .select(
      "id, instrument, direction, fractal_price, fractal_pivot_time, ls_price, ls_pivot_time, ls_touched_time, ls_timeframe, " +
        // Kindtabelle mit ALLEN abgeräumten Leveln (Migration 20260921210000) — eingebettet statt
        // zweiter Abfrage. 200 Setups x im Schnitt <2 Sweeps bleibt weit unter der ~1000er-Deckelung.
        "ob_top, ob_bottom, ob_start_time, trade_setup_sweeps(price, pivot_time, touched_time, timeframe, is_primary)",
    )
    .eq("instrument", instrument)
    .order("ob_start_time", { ascending: false })
    .limit(MAX_ROWS);
  // created_at, NICHT ob_start_time: im Replay darf nur auftauchen, was zum simulierten Zeitpunkt
  // auch schon erkannt WAR — sonst Zukunftswissen im Backtest (dieselbe Fehlerklasse hat bei
  // liquidity_levels und ob_zones je einmal zugeschlagen). Identischer Filter wie getTradeSetups in
  // trading-monitor-mcp/db.ts.
  if (replayUntilSec != null) query = query.lte("created_at", new Date(replayUntilSec * 1000).toISOString());
  const { data, error } = await query;
  if (error) {
    console.error("trade_setups laden fehlgeschlagen:", error);
    return [];
  }
  return data.map(tradeSetupFromRow);
}

const toSec = (iso) => Math.floor(new Date(iso).getTime() / 1000);

// Ein gesweeptes Level in der Form, die die Live-Erkennung liefert — sowohl für ls als auch für die
// Kind-Zeilen, damit die Zeichnung DB- und Live-Setups nicht unterscheiden muss.
function sweepLevel(price, pivotTimeIso, touchedTimeIso, dir) {
  const touchedTime = toSec(touchedTimeIso);
  return { price, dir, pivotTime: toSec(pivotTimeIso), touched: true, touchedTime, endTime: touchedTime };
}

// Zurück in dieselbe Form, die detectTradeSetups() (tradeSetup.js) liefert — Zeichnung, Hittest und
// TSC erwarten ein Setup einheitlich so, egal ob live erkannt oder aus der DB gelesen. Exportiert,
// weil fetchTradeSetupForCockpit (tradeIntake.js) dieselbe Umformung braucht.
export function tradeSetupFromRow(row) {
  const dir = row.direction === "short" ? 1 : -1;
  const ls = sweepLevel(row.ls_price, row.ls_pivot_time, row.ls_touched_time, dir);
  // sweeps[0] ist per Vertrag der entscheidende (älteste) Sweep — der steht autoritativ in ls_*,
  // die Kindtabelle liefert nur die übrigen dazu. Zeilen von vor dem 21.09.2026 haben gar keine
  // Kind-Zeilen, dort bleibt der eine Sweep die ganze Liste.
  const sweeps = [
    { level: ls, timeframe: row.ls_timeframe ?? "5M" },
    ...(row.trade_setup_sweeps ?? [])
      .filter((sw) => !sw.is_primary)
      .map((sw) => ({ level: sweepLevel(sw.price, sw.pivot_time, sw.touched_time, dir), timeframe: sw.timeframe })),
  ];
  // Ohne eigenes bestätigtes Fraktal steht in beiden Spalten dasselbe (Path B, siehe
  // detectTradeSetups: `fractal: fractal ?? ls`) — dann dieselbe OBJEKTREFERENZ statt nur derselbe
  // Preis: die Zeichnung entscheidet genau an `fractal !== ls`, ob sie ein zweites "PP"-Label an
  // dieselbe Stelle schreibt (usePriceChartTradeSetupDrawing.js).
  const eigenesFraktal = row.fractal_price !== row.ls_price || row.fractal_pivot_time !== row.ls_pivot_time;
  return {
    instrument: row.instrument,
    dir,
    label: dir === 1 ? "Short" : "Long",
    // Die Historie-Nummerierung existiert nur für die Live-Erkennung (siehe computeTradeSetups) —
    // für gemischte Setups setzt sie diese dort selbst neu.
    setupNumber: null,
    fractal: eigenesFraktal
      ? {
          price: row.fractal_price,
          dir,
          pivotTime: toSec(row.fractal_pivot_time),
          touched: false,
          touchedTime: null,
          // Wann das Fraktal gebrochen ist, steht nicht in der Tabelle -> bis zur letzten geladenen
          // Kerze zeichnen wie eine noch aktive OB-Zone (snapToBarTime deckelt auf das Kerzenende).
          endTime: Infinity,
        }
      : ls,
    ls,
    sweeps,
    obTop: row.ob_top,
    obBottom: row.ob_bottom,
    obStartTime: toSec(row.ob_start_time),
    tradeSetupId: row.id,
    // Nur-DB-Setup = die beiden Erkennungs-Kopien sind auseinandergelaufen. Steht im
    // Debug-Metadaten-Export (debugMetadata.js) und macht den Fall damit nachweisbar, statt ihn
    // still zu verschlucken.
    fromDb: true,
  };
}

// DB-Zeilen unter die live erkannten Setups mischen. Schlüssel ist der natürliche Schlüssel der
// Tabelle (direction + ob_start_time, unique seit 20260920140000). Bei Dubletten gewinnt LIVE: die
// Fassung kennt den aktuellen Kerzenstand, die DB-Zeile ist ein Snapshot vom Erkennungszeitpunkt.
// Rückgabe chronologisch wie detectTradeSetups, damit der Aufrufer weiter hinten abschneiden kann.
export function mergeDbTradeSetups(liveSetups, dbSetups) {
  const key = (s) => `${s.dir}|${s.obStartTime}`;
  const byKey = new Map(dbSetups.map((s) => [key(s), s]));
  for (const s of liveSetups) byKey.set(key(s), s);
  return [...byKey.values()].sort((a, b) => a.obStartTime - b.obStartTime);
}
