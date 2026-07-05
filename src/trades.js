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

export async function fetchTrades(instrument) {
  const { data, error } = await supabase
    .from("signals")
    .select("*")
    .eq("instrument", instrument)
    .order("triggered_at", { ascending: false });

  if (error) throw error;

  return data.map((row) => ({
    id: row.id,
    direction: row.direction,
    entryTime: Math.floor(new Date(row.triggered_at).getTime() / 1000),
    entryPrice: row.entry_price,
    stopLoss: row.stop_loss,
    takeProfit: row.take_profit,
    exitTime: row.exit_time ? Math.floor(new Date(row.exit_time).getTime() / 1000) : null,
    exitPrice: row.exit_price,
    outcome: row.outcome,
    rMultiple: row.r_multiple,
    reasoning: row.reasoning,
    source: row.source,
  }));
}
