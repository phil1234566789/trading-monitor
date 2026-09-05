import { supabase } from "./supabaseClient.ts";

// Dünne Query-Helfer für trading_loop_state (siehe Migration
// 20260831150000_trading_loop_state.sql, docs/state-machine.md) — Stil wie db.ts: kein ORM, jede
// Funktion ein einzelner, klar benannter Zweck. Persistenter Loop-State statt Lanas Chat-Gedächtnis,
// damit Schritt 3-5 auch über einen neuen Chat/eine neue Session hinweg mechanisch fortsetzbar
// bleiben (siehe Vorfall in docs/state-machine.md "Problem").

export type LoopStatus =
  | "active"
  | "fall1_handoff"
  | "fall4_pending_bias"
  | "stopped_market_close"
  | "stopped_news_pause"
  | "superseded"
  | "completed";

// Ein einzelnes Level (Target/Zwischen-Level/Watch-Level) — price ist immer Pflicht, die übrigen
// Felder sind best-effort Herkunftsangaben (für Anzeige/Pin-Aufräumen), keine strikte FK.
export interface LoopLevel {
  price: number;
  kind?: string | null;
  refId?: number | null;
  timeframe?: string | null;
  context?: string | null;
  // Pivot-/OB-Startzeit (Unix-Sekunden) der Quelle — Pflichtangabe für add_trade_target/
  // add_trade_confirmation (sourceTime), siehe tools/dealingRangeLoop.ts Fall-1-Target-Anhängen.
  sourceTimeSec?: number | null;
  // Nur bei kind='ob': Zonen-Kanten für die find-or-create-Auflösung in ob_zones.
  rangeLow?: number | null;
  rangeHigh?: number | null;
}

export interface HeartbeatEntry {
  atSec: number;
  at: string;
  message: string;
}

export interface TradingLoopStateRow {
  id: number;
  instrument: string;
  dateStr: string;
  status: LoopStatus;
  currentStep: 3 | 4 | 5 | 6 | 7 | 8;
  currentCase: number | null;
  direction: "long" | "short";
  dealingRangeId: number | null;
  trendTarget: LoopLevel | null;
  countertrendTarget: LoopLevel | null;
  intermediateLevel: LoopLevel | null;
  invalidation: number | null;
  watchLevelAbove: LoopLevel | null;
  watchLevelBelow: LoopLevel | null;
  biasComputedAt: string | null;
  lastAnalysisTimeSec: number | null;
  replayUntilSec: number | null;
  heartbeatLog: HeartbeatEntry[];
  // State-Machine V2 (siehe tradingMachine.ts/machineState.ts) — machineSnapshot ist die
  // XState-Rehydrierungsquelle, currentNode der daraus abgeleitete Dot-Pfad (z.B.
  // "s45.fallClassification") fürs UI-Highlighting ohne Snapshot-Deserialisierung.
  machineSnapshot: unknown;
  currentNode: string | null;
  createdAt: string;
  updatedAt: string;
}

function rowToState(row: Record<string, unknown>): TradingLoopStateRow {
  return {
    id: row.id as number,
    instrument: row.instrument as string,
    dateStr: row.date_str as string,
    status: row.status as LoopStatus,
    currentStep: row.current_step as 3 | 4 | 5,
    currentCase: (row.current_case as number | null) ?? null,
    direction: row.direction as "long" | "short",
    dealingRangeId: (row.dealing_range_id as number | null) ?? null,
    trendTarget: (row.trend_target as LoopLevel | null) ?? null,
    countertrendTarget: (row.countertrend_target as LoopLevel | null) ?? null,
    intermediateLevel: (row.intermediate_level as LoopLevel | null) ?? null,
    invalidation: (row.invalidation as number | null) ?? null,
    watchLevelAbove: (row.watch_level_above as LoopLevel | null) ?? null,
    watchLevelBelow: (row.watch_level_below as LoopLevel | null) ?? null,
    biasComputedAt: (row.bias_computed_at as string | null) ?? null,
    lastAnalysisTimeSec: (row.last_analysis_time_sec as number | null) ?? null,
    replayUntilSec: (row.replay_until_sec as number | null) ?? null,
    heartbeatLog: (row.heartbeat_log as HeartbeatEntry[] | null) ?? [],
    machineSnapshot: row.machine_snapshot ?? {},
    currentNode: (row.current_node as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// Der aktuell offene Loop für ein Instrument (siehe Partial-Unique-Index: höchstens einer je
// Instrument) — null, wenn gerade keiner läuft (frischer Tag, oder der letzte Loop wurde bereits
// per closeLoopState beendet).
export async function getActiveLoopState(instrument: string): Promise<TradingLoopStateRow | null> {
  const { data, error } = await supabase
    .from("trading_loop_state")
    .select("*")
    .eq("instrument", instrument)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowToState(data) : null;
}

export interface StartLoopStateArgs {
  instrument: string;
  dateStr: string;
  direction: "long" | "short";
  trendTarget: LoopLevel | null;
  countertrendTarget: LoopLevel | null;
  intermediateLevel: LoopLevel | null;
  invalidation: number | null;
  biasComputedAt: string;
  lastAnalysisTimeSec: number;
  replayUntilSec: number | null;
}

// run_bias_check (Schritt 3) ruft dies bei JEDEM Aufruf auf — ein Bias-Neudurchlauf ersetzt den
// bisherigen Loop immer komplett (der übergeordnete Trend kann sich geändert haben, siehe Fall 4 in
// 05-dealing-range-bestaetigen.md), nie nur einzelne Felder patchen. Ein evtl. noch 'active'er
// Vorgänger-Loop desselben Instruments wird zuerst auf 'superseded' gesetzt (Partial-Unique-Index
// lässt sonst keinen zweiten aktiven Loop zu).
export async function startLoopState(args: StartLoopStateArgs): Promise<TradingLoopStateRow> {
  const { error: supersedeError } = await supabase
    .from("trading_loop_state")
    .update({ status: "superseded" })
    .eq("instrument", args.instrument)
    .eq("status", "active");
  if (supersedeError) throw new Error(supersedeError.message);

  const { data, error } = await supabase
    .from("trading_loop_state")
    .insert({
      instrument: args.instrument,
      date_str: args.dateStr,
      status: "active",
      current_step: 4,
      current_case: null,
      direction: args.direction,
      dealing_range_id: null,
      trend_target: args.trendTarget,
      countertrend_target: args.countertrendTarget,
      intermediate_level: args.intermediateLevel,
      invalidation: args.invalidation,
      watch_level_above: null,
      watch_level_below: null,
      bias_computed_at: args.biasComputedAt,
      last_analysis_time_sec: args.lastAnalysisTimeSec,
      replay_until_sec: args.replayUntilSec,
      heartbeat_log: [],
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return rowToState(data);
}

export interface UpdateLoopStateArgs {
  currentCase?: number | null;
  dealingRangeId?: number | null;
  watchLevelAbove?: LoopLevel | null;
  watchLevelBelow?: LoopLevel | null;
  lastAnalysisTimeSec?: number;
  replayUntilSec?: number | null;
}

const UPDATE_FIELD_MAP: Record<keyof UpdateLoopStateArgs, string> = {
  currentCase: "current_case",
  dealingRangeId: "dealing_range_id",
  watchLevelAbove: "watch_level_above",
  watchLevelBelow: "watch_level_below",
  lastAnalysisTimeSec: "last_analysis_time_sec",
  replayUntilSec: "replay_until_sec",
};

// Schritt-5-Loop-Tick (Fall 2/3 bleibt derselbe Loop) — patcht nur die tatsächlich übergebenen
// Felder, analog zu updateTradePosition/updateDealingRange in db.ts.
export async function updateLoopState(id: number, fields: UpdateLoopStateArgs): Promise<TradingLoopStateRow> {
  const patch: Record<string, unknown> = { current_step: 5 };
  for (const key of Object.keys(fields) as (keyof UpdateLoopStateArgs)[]) {
    patch[UPDATE_FIELD_MAP[key]] = fields[key];
  }
  const { data, error } = await supabase.from("trading_loop_state").update(patch).eq("id", id).select("*").single();
  if (error) throw new Error(error.message);
  return rowToState(data);
}

// Serverseitiges Append (siehe Migrations-Kommentar: schließt die Lücke aus dem Vorfall, bei dem
// über eine Stunde Backtest-Vorspulen kein einziger Heartbeat ankam). Read-then-write statt eines
// Postgres-RPC — Einzelnutzer-App, kein konkurrierender Schreibzugriff auf denselben Loop zu
// erwarten (ein Lauf ist immer sequenziell, ein Batch nach dem anderen).
export async function appendHeartbeat(id: number, entry: HeartbeatEntry): Promise<HeartbeatEntry[]> {
  const { data: current, error: readError } = await supabase.from("trading_loop_state").select("heartbeat_log").eq("id", id).single();
  if (readError) throw new Error(readError.message);
  const log = [...((current.heartbeat_log as HeartbeatEntry[] | null) ?? []), entry];
  const { error: writeError } = await supabase.from("trading_loop_state").update({ heartbeat_log: log }).eq("id", id);
  if (writeError) throw new Error(writeError.message);
  return log;
}

// Beendet einen Loop (Fall 1 -> 'fall1_handoff', Fall 4 -> 'fall4_pending_bias', Handelsschluss ->
// 'stopped_market_close', News-Blackout ohne weiteren Fortschritt -> 'stopped_news_pause', normaler
// Abschluss -> 'completed') — status !='active' gibt das Instrument für den nächsten
// startLoopState-Aufruf frei (Partial-Unique-Index).
export async function closeLoopState(id: number, status: Exclude<LoopStatus, "active" | "superseded">, currentCase?: number | null): Promise<TradingLoopStateRow> {
  const patch: Record<string, unknown> = { status };
  if (currentCase !== undefined) patch.current_case = currentCase;
  const { data, error } = await supabase.from("trading_loop_state").update(patch).eq("id", id).select("*").single();
  if (error) throw new Error(error.message);
  return rowToState(data);
}
