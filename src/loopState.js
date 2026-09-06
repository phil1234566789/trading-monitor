import { supabase } from "./supabaseClient.js";
import { berlinDateStrFor } from "./dataExport.js";

// Frontend-Lese-Store für trading_loop_state (state-machine-v1-ui, siehe docs/state-machine.md) —
// bewusst reines Lesen, kein Schreiben: die Zeilen werden ausschließlich von den
// trading-monitor-mcp-Tools (check_pretrade_gates/run_bias_check/run_dealing_range_loop, siehe
// state-machine-v1) geschrieben, nie vom Dashboard selbst.
export const LOOP_INSTRUMENTS = ["GBPUSD", "EURUSD"];

function rowToLoopState(row) {
  return {
    id: row.id,
    instrument: row.instrument,
    dateStr: row.date_str,
    status: row.status,
    direction: row.direction,
    currentStep: row.current_step,
    currentCase: row.current_case,
    // State-Machine V2 (siehe tradingMachineGraph.js) — Dot-Pfad des aktuellen Blatt-Knotens, z.B.
    // "s45.fallClassification", fürs Live-Highlighting im Entscheidungsbaum-Graphen.
    currentNode: row.current_node,
    dealingRangeId: row.dealing_range_id,
    trendTarget: row.trend_target,
    countertrendTarget: row.countertrend_target,
    intermediateLevel: row.intermediate_level,
    invalidation: row.invalidation,
    watchLevelAbove: row.watch_level_above,
    watchLevelBelow: row.watch_level_below,
    biasComputedAt: row.bias_computed_at,
    lastAnalysisTimeSec: row.last_analysis_time_sec,
    replayUntilSec: row.replay_until_sec,
    heartbeatLog: row.heartbeat_log ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Der permanente State eines Tages (default heute) je Instrument (Philip, 06.09.2026: "der state
// soll dauerhaft bleiben ... egal welcher Schritt ... nur wenn ich den state löschen lasse, geht er
// weg") — seit der Pro-Tag-Identität (instrument, date_str, siehe Migration
// 20260906140000_trading_loop_state_permanent_per_day.sql) NICHT mehr über status='active'
// gefiltert (jeder Status bleibt dauerhaft sichtbar), sondern über das gewählte Berlin-Datum. Map
// instrument -> loopState, fehlt ein Instrument im Ergebnis, wurde an dem Tag noch nichts
// initialisiert. dateStr optional für einen Backtest/Replay-Tag (TradingFlow.vue-Datumsauswahl,
// 06.09.2026: "dann muss ich in der UI den Tag einstellen" — ein Replay-Lauf mit replayUntilSec
// schreibt auf das Replay-Datum, nicht auf heute, und war sonst in der UI unsichtbar).
export async function fetchLoopStatesForDate(dateStr = berlinDateStrFor(Math.floor(Date.now() / 1000))) {
  const { data, error } = await supabase.from("trading_loop_state").select("*").eq("date_str", dateStr);
  if (error) throw error;
  const map = new Map();
  for (const row of data ?? []) map.set(row.instrument, rowToLoopState(row)); // (instrument, date_str) ist eindeutig, höchstens eine Zeile pro Instrument
  return map;
}

// Historie für ein Instrument (frühere Tage), neueste zuerst — Ersatz fürs Durchklicken von
// trading-runs/[Instrument]/[Datum]/*.md (siehe docs/state-machine.md "Reporting").
export async function fetchLoopStateHistory(instrument, limit = 15) {
  const { data, error } = await supabase.from("trading_loop_state").select("*").eq("instrument", instrument).order("date_str", { ascending: false }).limit(limit);
  if (error) throw error;
  return (data ?? []).map(rowToLoopState);
}
