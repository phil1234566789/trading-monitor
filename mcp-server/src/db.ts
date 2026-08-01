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
    .select("*, dealing_ranges!inner(instrument, direction, invalidation, trade_setup_id, lesson_dealing_range_id, trade_targets(price)), trade_partial_exits(price, exit_time, portion_pct)")
    .order("triggered_at", { ascending: false })
    .limit(limit);
  if (instrument) query = query.eq("dealing_ranges.instrument", instrument);
  if (source) query = query.eq("source", source);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

// Laniakea-Kontext (Chat 2026-08-01, siehe supabase/migrations/20260801120000_laniakea_context.sql,
// 20260801130000_laniakea_context_ob_zones.sql, src/laniakeaContext.js): trade_positions ODER
// ob_zones, die Philip per Rechtsklick "an Lana übergeben" hat (kind unterscheidet, welches der
// beiden embeds befüllt ist — bei einer trade_position-Zeile ist ob_zones null und umgekehrt, kein
// zusätzlicher Filter nötig, PostgREST liefert einfach null fürs nicht zutreffende Embed). Kein
// Snapshot in der Tabelle selbst — derselbe Embed-Shape wie getJournal (trade_positions.* +
// dealing_ranges + trade_targets/trade_partial_exits) für trade_position, volle ob_zones-Zeile für
// ob_zone — damit Lana beim Fetch immer die aktuellen Werte sieht statt eines möglicherweise
// veralteten Stands.
export async function getLaniakeaContext() {
  const { data, error } = await supabase
    .from("laniakea_context")
    .select(
      "id, kind, note, created_at, " +
        "trade_positions(*, dealing_ranges!inner(instrument, direction, invalidation, trade_setup_id, lesson_dealing_range_id, trade_targets(price)), trade_partial_exits(price, exit_time, portion_pct)), " +
        "ob_zones(*)",
    )
    .order("created_at", { ascending: true });
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

// Nur zum Auflösen "welches Konto" beim Trade-Anlegen (Philip nennt einen Namen, kein rohes ID) —
// siehe trading_accounts (20260730130000_trading_accounts.sql), volles anon-CRUD dort.
export async function getTradingAccounts() {
  const { data, error } = await supabase.from("trading_accounts").select("id, name, notes").order("name");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export interface TradePositionInput {
  source: "backtest" | "paper" | "live";
  entryPrice?: number | null;
  stopLoss?: number | null;
  triggeredAt?: string | null;
  reasoning?: string | null;
  outcome?: "win" | "loss" | "open" | null;
  rMultiple?: number | null;
  exitPrice?: number | null;
  exitTime?: string | null;
  tradingAccountId?: number | null;
  zoneId?: number | null;
  // Broker-Ausführungsdetails (Chat 2026-07-31, siehe Migration
  // 20260731210000_trade_positions_size_pl_commission.sql) — vorher zweckentfremdet im
  // reasoning-Freitext eingetragen ("Menge 0,5, Netto P/L $27.00").
  size?: number | null;
  netPl?: number | null;
  commission?: number | null;
}

// Gemeinsamer Insert-Kern für create_trade (neue Idee + erste Ausführung) UND add_trade_position
// (eine WEITERE Ausführung auf eine bereits bestehende Idee, z.B. Re-Entry/nachgezogener Einstieg) —
// Philip 2026-07-31: "es gibt ja auch dealing ranges, wo ich keinen entry finde oder meine Limit
// Order nicht abgeholt wird" — kommt also oft genug vor, um ein eigenes Tool zu rechtfertigen, statt
// nur über create_trade (das würde fälschlich eine zweite, unabhängige Idee anlegen) zu gehen.
async function insertTradePosition(dealingRangeId: number, fields: TradePositionInput) {
  const { data, error } = await supabase
    .from("trade_positions")
    .insert({
      dealing_range_id: dealingRangeId,
      source: fields.source,
      entry_price: fields.entryPrice ?? null,
      stop_loss: fields.stopLoss ?? null,
      ...(fields.triggeredAt ? { triggered_at: fields.triggeredAt } : {}),
      reasoning: fields.reasoning ?? null,
      outcome: fields.outcome ?? null,
      r_multiple: fields.rMultiple ?? null,
      exit_price: fields.exitPrice ?? null,
      exit_time: fields.exitTime ?? null,
      trading_account_id: fields.tradingAccountId ?? null,
      zone_id: fields.zoneId ?? null,
      size: fields.size ?? null,
      net_pl: fields.netPl ?? null,
      commission: fields.commission ?? null,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

// Fügt eine weitere Ausführung zu einer BEREITS BESTEHENDEN dealing_range hinzu (Re-Entry, oder
// erster tatsächlicher Fill nach einer zunächst nicht abgeholten Limit-Order) — dealingRangeId
// referenziert die Idee, die im Chart/Journal z.B. als "Long#18" durchnummeriert auftaucht.
export async function addTradePosition(dealingRangeId: number, fields: TradePositionInput) {
  return insertTradePosition(dealingRangeId, fields);
}

export interface CreateTradeArgs extends TradePositionInput {
  instrument: string;
  direction: "long" | "short";
  invalidation?: number | null;
  tradeSetupId?: number | null;
  targets?: { price: number; rangeLow?: number | null; rangeHigh?: number | null }[];
}

// Legt die "Trade Entity" an, die Philip meint: EINE dealing_range (die Idee) + EINE trade_position
// (die erste Ausführung), optional + trade_targets — siehe supabase/migrations/
// 20260731120000_dealing_ranges_trade_positions.sql für die Aufteilungs-Begründung. Für eine
// WEITERE Ausführung auf dieselbe Idee siehe addTradePosition oben, nicht dieses Tool nochmal
// aufrufen (das würde eine zweite, unabhängige Idee anlegen). Kein echtes DB-Transaktions-RPC
// (Supabase-JS-Client kann das ohne eigene Postgres-Function nicht) — bei einem Fehler nach dem
// dealing_ranges-Insert wird die Zeile wieder gelöscht, damit keine verwaiste Idee ohne Ausführung
// übrig bleibt.
export async function createTrade(args: CreateTradeArgs) {
  const { data: dealingRange, error: drError } = await supabase
    .from("dealing_ranges")
    .insert({
      instrument: args.instrument,
      direction: args.direction,
      invalidation: args.invalidation ?? null,
      trade_setup_id: args.tradeSetupId ?? null,
    })
    .select("*")
    .single();
  if (drError) throw new Error(drError.message);

  let position;
  try {
    position = await insertTradePosition(dealingRange.id, args);
  } catch (err) {
    await supabase.from("dealing_ranges").delete().eq("id", dealingRange.id);
    throw err;
  }

  let targets: unknown[] = [];
  if (args.targets && args.targets.length > 0) {
    const { data: targetRows, error: targetError } = await supabase
      .from("trade_targets")
      .insert(
        args.targets.map((t) => ({
          dealing_range_id: dealingRange.id,
          price: t.price,
          range_low: t.rangeLow ?? null,
          range_high: t.rangeHigh ?? null,
        })),
      )
      .select("*");
    if (targetError) throw new Error(targetError.message);
    targets = targetRows ?? [];
  }

  return { dealingRange, tradePosition: position, targets };
}

export interface UpdateTradePositionArgs {
  entryPrice?: number | null;
  stopLoss?: number | null;
  triggeredAt?: string;
  reasoning?: string | null;
  outcome?: "win" | "loss" | "open" | null;
  rMultiple?: number | null;
  exitPrice?: number | null;
  exitTime?: string | null;
  tradingAccountId?: number | null;
  zoneId?: number | null;
  size?: number | null;
  netPl?: number | null;
  commission?: number | null;
}

const TRADE_POSITION_FIELD_MAP: Record<keyof UpdateTradePositionArgs, string> = {
  entryPrice: "entry_price",
  stopLoss: "stop_loss",
  triggeredAt: "triggered_at",
  reasoning: "reasoning",
  outcome: "outcome",
  rMultiple: "r_multiple",
  exitPrice: "exit_price",
  exitTime: "exit_time",
  tradingAccountId: "trading_account_id",
  zoneId: "zone_id",
  size: "size",
  netPl: "net_pl",
  commission: "commission",
};

// Nur die tatsächlich übergebenen Felder patchen (nicht übergeben != explizit auf null setzen) —
// deshalb Object.keys(fields) statt eines festen Feld-Sets.
export async function updateTradePosition(id: number, fields: UpdateTradePositionArgs) {
  const patch: Record<string, unknown> = {};
  for (const key of Object.keys(fields) as (keyof UpdateTradePositionArgs)[]) {
    patch[TRADE_POSITION_FIELD_MAP[key]] = fields[key];
  }
  const { data, error } = await supabase.from("trade_positions").update(patch).eq("id", id).select("*").single();
  if (error) throw new Error(error.message);
  return data;
}

export interface UpdateDealingRangeArgs {
  instrument?: string;
  direction?: "long" | "short";
  invalidation?: number | null;
  tradeSetupId?: number | null;
  // "Lesson"-Verknüpfung (Chat 2026-07-31, vierte Runde, siehe Migration
  // 20260731230000_dealing_ranges_lesson_link.sql) — self-referencing FK auf eine ANDERE
  // dealing_range, die "das wäre der richtige Trade gewesen" markiert.
  lessonDealingRangeId?: number | null;
}

const DEALING_RANGE_FIELD_MAP: Record<keyof UpdateDealingRangeArgs, string> = {
  instrument: "instrument",
  direction: "direction",
  invalidation: "invalidation",
  tradeSetupId: "trade_setup_id",
  lessonDealingRangeId: "lesson_dealing_range_id",
};

export async function updateDealingRange(id: number, fields: UpdateDealingRangeArgs) {
  const patch: Record<string, unknown> = {};
  for (const key of Object.keys(fields) as (keyof UpdateDealingRangeArgs)[]) {
    patch[DEALING_RANGE_FIELD_MAP[key]] = fields[key];
  }
  const { data, error } = await supabase.from("dealing_ranges").update(patch).eq("id", id).select("*").single();
  if (error) throw new Error(error.message);
  return data;
}
