import { supabase } from "./supabaseClient.ts";

// Granulare Entscheidungs-Ebene UNTER trading_loop_state.heartbeat_log (siehe Migration
// 20260901220000_state_machine_log.sql, milk-city Task state-machine-decision-log). heartbeat_log
// bleibt die Batch-Zusammenfassung fürs Chat-Kopieren, state_machine_log loggt JEDEN einzelnen
// Entscheidungspunkt aus allen 5 state-machine-Tools — auch dann, wenn (noch) gar kein Loop
// existiert (z.B. ein durch das News-Gate geblockter run_bias_check-Versuch, siehe Auslöser
// 01.09.2026 in der Task-Beschreibung).
//
// Fire-and-forget mit Fehler-Log statt throw: ein fehlgeschlagener Logging-Insert darf niemals den
// eigentlichen Tool-Aufruf zum Scheitern bringen — Beobachtbarkeit ist ein Zusatz, keine
// Voraussetzung für Schritt 1-6 selbst.

export interface LogDecisionArgs {
  instrument: string;
  dateStr: string;
  sec: number;
  step: 1 | 2 | 3 | 4 | 5 | 6;
  tool: string;
  decision: string;
  result?: unknown;
  message?: string | null;
  loopStateId?: number | null;
}

export async function logDecision(args: LogDecisionArgs): Promise<void> {
  const { error } = await supabase.from("state_machine_log").insert({
    instrument: args.instrument,
    date_str: args.dateStr,
    sec: args.sec,
    step: args.step,
    tool: args.tool,
    decision: args.decision,
    result: args.result ?? {},
    message: args.message ?? null,
    loop_state_id: args.loopStateId ?? null,
  });
  if (error) console.error(`state_machine_log insert fehlgeschlagen (${args.tool}/${args.decision}):`, error.message);
}
