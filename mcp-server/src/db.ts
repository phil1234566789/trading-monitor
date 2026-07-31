import { supabase } from "./supabaseClient.js";

// Dünne Supabase-Query-Helfer, von den Tools in ./tools/*.ts genutzt. Tabellenformen siehe
// supabase/migrations/*.sql (ob_zones, liquidity_levels, trade_setups, dealing_ranges,
// trade_positions, trade_targets, trade_partial_exits, news_events, trading_schedules,
// claude_annotations) — alle mit anon-select-RLS, siehe CLAUDE.md "MCP-Server".

export async function getObZones(instrument: string, timeframe?: string, includeAll = false) {
  let query = supabase.from("ob_zones").select("*").eq("instrument", instrument).order("start_time", { ascending: true });
  if (timeframe) query = query.eq("timeframe", timeframe);
  if (!includeAll) query = query.eq("invalidated", false).eq("touched", false);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

const LIQUIDITY_MAX_RELEVANT = 10; // siehe src/liquidity.js LIQUIDITY_MAX_RELEVANT
const RECENT_SWEEP_COUNT = 2; // siehe src/liquidity.js RECENT_SWEEP_COUNT

// Port von filterRelevantLevels (src/liquidity.js) auf DB-Zeilen statt In-Memory-Detektions-
// objekten — gleiche Auswahl-Logik (neuestes Level, unberührte Level, RECENT_SWEEP_COUNT zuletzt
// gesweepte, insgesamt max. maxRelevant), damit "relevant" hier dasselbe bedeutet wie im Live-Chart.
// rows müssen chronologisch aufsteigend (älteste zuerst) sortiert sein, wie levels in liquidity.js.
function filterRelevantRows<T extends { touched: boolean; end_time: string | null }>(rows: T[], maxRelevant: number): T[] {
  const n = rows.length;
  if (n === 0) return [];
  const newestActive = !rows[n - 1].touched;

  const recentSweepIdx = new Set<number>();
  rows
    .map((r, i) => ({ i, t: r.touched ? r.end_time : null }))
    .filter((x): x is { i: number; t: string } => x.t != null)
    .sort((a, b) => (a.t < b.t ? 1 : -1))
    .slice(0, RECENT_SWEEP_COUNT)
    .forEach((x) => recentSweepIdx.add(x.i));

  const result: T[] = [];
  let relevantCount = 0;
  for (let i = n - 1; i >= 0; i--) {
    const row = rows[i];
    const isNewest = newestActive && i === n - 1;
    const isRecentSweep = recentSweepIdx.has(i);
    if (isNewest || !row.touched || isRecentSweep) {
      if (relevantCount < maxRelevant) result.push(row);
      relevantCount += 1;
    }
  }
  return result;
}

export async function getLiquidityLevels(instrument: string, timeframe?: string, includeAll = false) {
  let query = supabase
    .from("liquidity_levels")
    .select("*")
    .eq("instrument", instrument)
    .order("pivot_time", { ascending: true });
  if (timeframe) query = query.eq("timeframe", timeframe);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  if (includeAll) return rows;
  const highs = filterRelevantRows(rows.filter((r) => r.direction === "high"), LIQUIDITY_MAX_RELEVANT);
  const lows = filterRelevantRows(rows.filter((r) => r.direction === "low"), LIQUIDITY_MAX_RELEVANT);
  return [...highs, ...lows];
}

export async function getTradeSetups(instrument: string) {
  const { data, error } = await supabase
    .from("trade_setups")
    .select("*")
    .eq("instrument", instrument)
    .order("fractal_pivot_time", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

// Trade-Journal: seit 2026-07-31 aufgeteilt in dealing_ranges (die Idee: instrument/direction/
// invalidation/trade_setup_id, gilt für 1-n Ausführungen) und trade_positions (die einzelne
// Ausführung: entry/exit/outcome/reasoning) — siehe CLAUDE.md-Abschnitt zum Trade-Journal.
// instrument/direction sitzen jetzt auf dealing_ranges, deshalb !inner (sonst kann PostgREST auf
// dem eingebetteten Feld nicht filtern) plus trade_targets gleich mit eingebettet, weil die
// ebenfalls an dealing_ranges statt an der Ausführung hängen.
export async function getJournal(instrument?: string, source?: string, limit = 50) {
  let query = supabase
    .from("trade_positions")
    .select("*, dealing_ranges!inner(instrument, direction, invalidation, trade_setup_id, trade_targets(price)), trade_partial_exits(price, exit_time, portion_pct)")
    .order("triggered_at", { ascending: false })
    .limit(limit);
  if (instrument) query = query.eq("dealing_ranges.instrument", instrument);
  if (source) query = query.eq("source", source);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getNewsEvents(fromTime?: string, toTime?: string) {
  let query = supabase.from("news_events").select("*").order("event_time", { ascending: true });
  if (fromTime) query = query.gte("event_time", fromTime);
  if (toTime) query = query.lte("event_time", toTime);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getTradingSchedule(instrument: string) {
  const { data, error } = await supabase.from("trading_schedules").select("*").eq("instrument", instrument).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

// Insert-Form exakt wie src/claudeAnnotationsStore.js:23-34 (addClaudeAnnotationDrawing) —
// dieselbe Tabelle/Spalten, damit eine per MCP geschriebene Zeichnung sich für den Rest der App
// (Chart, ClaudeAnnotationsModal) nicht von einer manuell gepasteten unterscheidet.
export async function postChartAnnotations(instrument: string, date: string, annotations: unknown[], title?: string) {
  const { data, error } = await supabase
    .from("claude_annotations")
    .insert({ instrument, date, annotations, title })
    .select("id, instrument, date, title, annotations, visible, created_at")
    .single();
  if (error) throw new Error(error.message);
  return data;
}
