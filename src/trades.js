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

// signal_id -> Zeilen aus trade_targets/trade_partial_exits/trade_confirmations gruppieren (alle
// drei 1:n zu signals).
function groupBySignalId(rows) {
  const result = {};
  for (const row of rows) {
    (result[row.signal_id] ??= []).push(row);
  }
  return result;
}

// accountId (Chat 2026-07-30, Trading-Konten-Trennung): null/undefined = ungefiltert (z.B. bevor
// die Konten geladen sind) — Dashboard.vue übergibt hier IMMER das gerade ausgewählte Konto, sonst
// würde die Trades-Liste versehentlich alle Konten mischen, sobald mehrere existieren.
export async function fetchTrades(instrument, accountId = null) {
  // trade_setups(ob_start_time) eingebettet (PostgREST-Embedding über die trade_setup_id-FK) —
  // fürs Chart-Rendering der verlinkten M5-OB-Box gebraucht (siehe PriceChart.vue:
  // refreshTradeSetupLinksInternal), ohne dafür pro Trade eine eigene Zusatz-Query zu brauchen.
  let query = supabase
    .from("signals")
    .select("*, trade_setups(ob_start_time)")
    .eq("instrument", instrument);
  if (accountId != null) query = query.eq("trading_account_id", accountId);
  const { data, error } = await query.order("triggered_at", { ascending: false });

  if (error) throw error;
  if (data.length === 0) return [];

  // These (trade_targets), Ausführung (trade_partial_exits) und Bestätigungen (trade_confirmations,
  // PLAN-trade-confluences.md #1) sind je 1:n zu signals — in drei Sammel-Queries statt pro Trade
  // einzeln, um bei vielen Trades nicht N+1 Requests zu erzeugen.
  const ids = data.map((row) => row.id);
  const [
    { data: targets, error: targetsError },
    { data: partials, error: partialsError },
    { data: confirmations, error: confirmationsError },
  ] = await Promise.all([
    supabase.from("trade_targets").select("id, signal_id, price, kind, source_time, touched_time").in("signal_id", ids),
    supabase.from("trade_partial_exits").select("signal_id, price, exit_time, portion_pct").in("signal_id", ids),
    supabase.from("trade_confirmations").select("id, signal_id, price, kind, source_time, touched_time").in("signal_id", ids),
  ]);
  if (targetsError) throw targetsError;
  if (partialsError) throw partialsError;
  if (confirmationsError) throw confirmationsError;

  const targetsBySignal = groupBySignalId(targets);
  const partialsBySignal = groupBySignalId(partials);
  const confirmationsBySignal = groupBySignalId(confirmations);

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
    tradingAccountId: row.trading_account_id,
    // TradeTarget-Rohformat (siehe tradeTargets.ts) statt nur des Preises (Chat 2026-07-28: "kann
    // ich das bearbeiten?" / "wieso nur der Preis?") — kind/sourceTime/touchedTime fürs
    // Chart-Rendering (PriceChart.vue: refreshTradeTargetLinksInternal) und die Alters-Einstufung
    // in der Anzeige; bei Alt-Targets (vor Migration 20260728140000) sind source_time/touched_time
    // null, dann keine Linie/kein Alter, siehe tradeTargets.ts.
    targets: (targetsBySignal[row.id] ?? []).map((t) => ({
      id: t.id,
      price: t.price,
      kind: t.kind,
      sourceTime: t.source_time ? Math.floor(new Date(t.source_time).getTime() / 1000) : null,
      touchedTime: t.touched_time ? Math.floor(new Date(t.touched_time).getTime() / 1000) : null,
    })),
    // TradeConfirmation-Rohformat (siehe tradeConfirmations.ts) — strukturell identisch zu
    // targets oben, eigenes Array/eigene Tabelle (siehe tradeIntake.js: addConfirmationToTrade).
    confirmations: (confirmationsBySignal[row.id] ?? []).map((c) => ({
      id: c.id,
      price: c.price,
      kind: c.kind,
      sourceTime: c.source_time ? Math.floor(new Date(c.source_time).getTime() / 1000) : null,
      touchedTime: c.touched_time ? Math.floor(new Date(c.touched_time).getTime() / 1000) : null,
    })),
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
