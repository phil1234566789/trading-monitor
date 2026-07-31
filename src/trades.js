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

// Gruppiert Zeilen nach einer FK-Spalte (trade_targets/trade_confirmations -> dealing_range_id,
// trade_partial_exits/trade_confirmations -> trade_position_id — seit 2026-07-31 aufgeteilt, siehe
// CLAUDE.md: Trade-Journal-Umbau).
function groupBy(rows, key) {
  const result = {};
  for (const row of rows) {
    (result[row[key]] ??= []).push(row);
  }
  return result;
}

// accountId (Chat 2026-07-30, Trading-Konten-Trennung): null/undefined = ungefiltert (z.B. bevor
// die Konten geladen sind) — Dashboard.vue übergibt hier IMMER das gerade ausgewählte Konto, sonst
// würde die Trades-Liste versehentlich alle Konten mischen, sobald mehrere existieren.
export async function fetchTrades(instrument, accountId = null) {
  // Seit 2026-07-31: eine Zeile hier ist eine trade_positions-AUSFÜHRUNG, mit ihrer dealing_ranges-
  // IDEE eingebettet (!inner, weil wir unten auf dealing_ranges.instrument filtern — ohne !inner
  // kann PostgREST nicht auf einem eingebetteten Feld filtern) plus deren trade_setups(ob_start_time)
  // fürs Chart-Rendering der verlinkten M5-OB-Box (siehe PriceChart.vue: refreshTradeSetupLinksInternal).
  let query = supabase
    .from("trade_positions")
    .select("*, dealing_ranges!inner(id, instrument, direction, invalidation, trade_setup_id, trade_setups(ob_start_time, ob_top, ob_bottom))")
    .eq("dealing_ranges.instrument", instrument);
  if (accountId != null) query = query.eq("trading_account_id", accountId);
  const { data, error } = await query.order("triggered_at", { ascending: false });

  if (error) throw error;
  if (data.length === 0) return [];

  // targets/confirmations hängen an der dealing_range (der IDEE, gilt für alle Ausführungen
  // darunter), partialExits und Position-Bestätigungen an der einzelnen trade_position — vier
  // Sammel-Queries statt pro Trade einzeln, um bei vielen Trades nicht N+1 Requests zu erzeugen.
  const positionIds = data.map((row) => row.id);
  const rangeIds = [...new Set(data.map((row) => row.dealing_ranges.id))];
  const [
    { data: targets, error: targetsError },
    { data: partials, error: partialsError },
    { data: rangeConfirmations, error: rangeConfirmationsError },
    { data: positionConfirmations, error: positionConfirmationsError },
  ] = await Promise.all([
    supabase.from("trade_targets").select("id, dealing_range_id, price, kind, source_time, touched_time").in("dealing_range_id", rangeIds),
    supabase.from("trade_partial_exits").select("trade_position_id, price, exit_time, portion_pct").in("trade_position_id", positionIds),
    supabase.from("trade_confirmations").select("id, dealing_range_id, price, kind, source_time, touched_time, range_low, range_high").in("dealing_range_id", rangeIds),
    supabase.from("trade_confirmations").select("id, trade_position_id, price, kind, source_time, touched_time, range_low, range_high").in("trade_position_id", positionIds),
  ]);
  if (targetsError) throw targetsError;
  if (partialsError) throw partialsError;
  if (rangeConfirmationsError) throw rangeConfirmationsError;
  if (positionConfirmationsError) throw positionConfirmationsError;

  const targetsByRange = groupBy(targets, "dealing_range_id");
  const partialsByPosition = groupBy(partials, "trade_position_id");
  const rangeConfirmationsByRange = groupBy(rangeConfirmations, "dealing_range_id");
  const positionConfirmationsByPosition = groupBy(positionConfirmations, "trade_position_id");

  function toConfirmation(c) {
    return {
      id: c.id,
      price: c.price,
      kind: c.kind,
      sourceTime: c.source_time ? Math.floor(new Date(c.source_time).getTime() / 1000) : null,
      touchedTime: c.touched_time ? Math.floor(new Date(c.touched_time).getTime() / 1000) : null,
      // Nur bei kind='fib' gesetzt (siehe tradeConfirmations.ts) — die zwei Ankerpreise des
      // gespeicherten Fib-Werts, sonst null.
      rangeLow: c.range_low ?? null,
      rangeHigh: c.range_high ?? null,
    };
  }

  return data.map((row) => {
    const range = row.dealing_ranges;
    return {
      id: row.id,
      dealingRangeId: range.id,
      instrument: range.instrument,
      direction: range.direction,
      entryTime: Math.floor(new Date(row.triggered_at).getTime() / 1000),
      entryPrice: row.entry_price,
      stopLoss: row.stop_loss,
      invalidation: range.invalidation,
      tradeSetupId: range.trade_setup_id,
      tradeSetupObStartTime: range.trade_setups?.ob_start_time ? Math.floor(new Date(range.trade_setups.ob_start_time).getTime() / 1000) : null,
      // ex setupEntry+invalidation-Rekonstruktion (Math.max/min je Richtung) — seit setup_entry
      // als eigene Spalte wegfiel (Chat 2026-07-31, jetzt Confirmation statt Feld) direkt die
      // echten OB-Grenzen aus trade_setups, die waren strukturell eh identisch damit.
      tradeSetupObTop: range.trade_setups?.ob_top ?? null,
      tradeSetupObBottom: range.trade_setups?.ob_bottom ?? null,
      tradingAccountId: row.trading_account_id,
      // TradeTarget-Rohformat (siehe tradeTargets.ts) statt nur des Preises (Chat 2026-07-28: "kann
      // ich das bearbeiten?" / "wieso nur der Preis?") — kind/sourceTime/touchedTime fürs
      // Chart-Rendering (PriceChart.vue: refreshTradeTargetLinksInternal) und die Alters-Einstufung
      // in der Anzeige; bei Alt-Targets (vor Migration 20260728140000) sind source_time/touched_time
      // null, dann keine Linie/kein Alter, siehe tradeTargets.ts.
      targets: (targetsByRange[range.id] ?? []).map((t) => ({
        id: t.id,
        price: t.price,
        kind: t.kind,
        sourceTime: t.source_time ? Math.floor(new Date(t.source_time).getTime() / 1000) : null,
        touchedTime: t.touched_time ? Math.floor(new Date(t.touched_time).getTime() / 1000) : null,
      })),
      // Bestätigungen fürs GO der ganzen Idee (dealing_range) und fürs GO dieses einen Entries
      // (trade_position, ex-setup_entry) zusammen — beide teilen dieselbe Tabelle/Rohform (siehe
      // tradeConfirmations.ts), die UI unterscheidet aktuell nicht zwischen den beiden Ebenen.
      confirmations: [...(rangeConfirmationsByRange[range.id] ?? []), ...(positionConfirmationsByPosition[row.id] ?? [])].map(toConfirmation),
      partialExits: (partialsByPosition[row.id] ?? []).map((p) => ({
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
    };
  });
}
