import { supabase } from "./supabaseClient.js";

export function computeTradeStats(trades) {
  const closed = trades.filter((t) => t.outcome === "win" || t.outcome === "loss");
  const wins = closed.filter((t) => t.outcome === "win").length;
  const losses = closed.filter((t) => t.outcome === "loss").length;
  const totalR = closed.reduce((sum, t) => sum + (t.rMultiple ?? 0), 0);
  const winrate = closed.length > 0 ? (wins / closed.length) * 100 : null;
  const avgR = closed.length > 0 ? totalR / closed.length : null;

  return { total: trades.length, closed: closed.length, wins, losses, totalR, winrate, avgR };
}

// signal_id -> Zeilen aus trade_targets/trade_partial_exits gruppieren (beide 1:n zu signals).
function groupBySignalId(rows) {
  const result = {};
  for (const row of rows) {
    (result[row.signal_id] ??= []).push(row);
  }
  return result;
}

export async function fetchTrades(instrument) {
  // trade_setups(ob_start_time) eingebettet (PostgREST-Embedding über die trade_setup_id-FK) —
  // fürs Chart-Rendering der verlinkten M5-OB-Box gebraucht (siehe PriceChart.vue:
  // refreshTradeSetupLinksInternal), ohne dafür pro Trade eine eigene Zusatz-Query zu brauchen.
  const { data, error } = await supabase
    .from("signals")
    .select("*, trade_setups(ob_start_time)")
    .eq("instrument", instrument)
    .order("triggered_at", { ascending: false });

  if (error) throw error;
  if (data.length === 0) return [];

  // These (trade_targets) und Ausführung (trade_partial_exits) sind je 1:n zu signals — in zwei
  // Sammel-Queries statt pro Trade einzeln, um bei vielen Trades nicht N+1 Requests zu erzeugen.
  const ids = data.map((row) => row.id);
  const [{ data: targets, error: targetsError }, { data: partials, error: partialsError }] = await Promise.all([
    supabase.from("trade_targets").select("id, signal_id, price").in("signal_id", ids),
    supabase.from("trade_partial_exits").select("signal_id, price, exit_time, portion_pct").in("signal_id", ids),
  ]);
  if (targetsError) throw targetsError;
  if (partialsError) throw partialsError;

  const targetsBySignal = groupBySignalId(targets);
  const partialsBySignal = groupBySignalId(partials);

  return data.map((row) => ({
    id: row.id,
    instrument: row.instrument,
    direction: row.direction,
    entryTime: Math.floor(new Date(row.triggered_at).getTime() / 1000),
    entryPrice: row.entry_price,
    setupEntry: row.setup_entry,
    stopLoss: row.stop_loss,
    invalidation: row.invalidation,
    tradeSetupId: row.trade_setup_id,
    tradeSetupObStartTime: row.trade_setups?.ob_start_time ? Math.floor(new Date(row.trade_setups.ob_start_time).getTime() / 1000) : null,
    // {id, price} statt nur des Preises (Chat 2026-07-28: "kann ich das bearbeiten?") — die id
    // wird für den Entfernen-Button in TradesTable.vue gebraucht (removeTargetFromTrade).
    targets: (targetsBySignal[row.id] ?? []).map((t) => ({ id: t.id, price: t.price })),
    partialExits: (partialsBySignal[row.id] ?? []).map((p) => ({
      price: p.price,
      time: Math.floor(new Date(p.exit_time).getTime() / 1000),
      portionPct: p.portion_pct,
    })),
    exitTime: row.exit_time ? Math.floor(new Date(row.exit_time).getTime() / 1000) : null,
    exitPrice: row.exit_price,
    outcome: row.outcome,
    rMultiple: row.r_multiple,
    reasoning: row.reasoning,
    source: row.source,
  }));
}
