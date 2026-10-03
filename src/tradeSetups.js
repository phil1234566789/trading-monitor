import { supabase } from "./supabaseClient.js";
import { tradeSetupFromRow } from "./tradeSetupRow.js";
export { tradeSetupFromRow } from "./tradeSetupRow.js";

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
        // ob_fvg seit 2026-09-23 mit: der Bewertungs-Bereich ordnet die Dealing Range über ihre
        // FVG-Größe ein, und die steht NUR hier — die OB-Bestätigung im TSC trägt nur ihre Kanten.
        "ob_top, ob_bottom, ob_start_time, ob_fvg, created_at, invalidation, trade_setup_sweeps(price, pivot_time, touched_time, timeframe, is_primary)",
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
