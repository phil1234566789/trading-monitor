import { supabase } from "./supabaseClient.js";

// Frontend-Lese-Store für state_machine_log (state-machine-decision-log, siehe
// docs/state-machine.md) — analog zu loopState.js: reines Lesen, geschrieben wird ausschließlich
// von logDecision() in den trading-monitor-mcp-Tools. Granularer als trading_loop_state.heartbeat_log
// (Batch-Zusammenfassung) — hier landet JEDER einzelne Entscheidungspunkt, auch ohne Loop (z.B. ein
// durch das News-Gate geblockter run_bias_check-Versuch).

function rowToDecision(row) {
  return {
    id: row.id,
    instrument: row.instrument,
    dateStr: row.date_str,
    sec: row.sec,
    step: row.step,
    tool: row.tool,
    decision: row.decision,
    result: row.result,
    message: row.message,
    loopStateId: row.loop_state_id,
    createdAt: row.created_at,
  };
}

// Neueste zuerst, per Instrument — deckt sowohl Einträge mit als auch ohne loop_state_id ab (kein
// Filter auf einen einzelnen Loop), damit ein geblockter Gate-Versuch OHNE entstandenen Loop hier
// trotzdem auftaucht (genau der Auslöser-Fall vom 01.09.2026).
export async function fetchStateMachineLog(instrument, limit = 150) {
  const { data, error } = await supabase
    .from("state_machine_log")
    .select("*")
    .eq("instrument", instrument)
    .order("sec", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(rowToDecision);
}
