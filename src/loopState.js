import { supabase } from "./supabaseClient.js";

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

// Der aktuell laufende Loop je Instrument (siehe Partial-Unique-Index in der Migration: höchstens
// einer je Instrument gleichzeitig) — Map instrument -> loopState, fehlt ein Instrument im
// Ergebnis, läuft dort gerade kein Loop.
export async function fetchActiveLoopStates() {
  const { data, error } = await supabase.from("trading_loop_state").select("*").eq("status", "active").order("created_at", { ascending: false });
  if (error) throw error;
  const map = new Map();
  for (const row of data ?? []) {
    const state = rowToLoopState(row);
    if (!map.has(state.instrument)) map.set(state.instrument, state); // pro Instrument nur einer moeglich, .find nicht noetig
  }
  return map;
}

// Historie (auch abgeschlossene/superseded Loops) für ein Instrument, neueste zuerst — Ersatz
// fürs Durchklicken von trading-runs/[Instrument]/[Datum]/*.md (siehe docs/state-machine.md
// "Reporting").
export async function fetchLoopStateHistory(instrument, limit = 15) {
  const { data, error } = await supabase.from("trading_loop_state").select("*").eq("instrument", instrument).order("created_at", { ascending: false }).limit(limit);
  if (error) throw error;
  return (data ?? []).map(rowToLoopState);
}
