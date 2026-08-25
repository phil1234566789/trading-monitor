import { supabase } from "./supabaseClient.js";
import { ALL_ACCOUNTS_ID } from "./tradingAccounts.js";

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
// ALL_ACCOUNTS_ID (Bug-Report Philip 2026-07-31: eine kontolose Lana-Idee war strukturell
// unsichtbar, egal welches Konto gewählt war) ist eine EXPLIZITE "zeig alles"-Wahl im Switcher,
// wird hier genau wie null behandelt (kein Filter) statt als echte Konto-Id.
export async function fetchTrades(instrument, accountId = null) {
  // Seit 2026-07-31: eine Zeile hier ist eine trade_positions-AUSFÜHRUNG, mit ihrer dealing_ranges-
  // IDEE eingebettet (!inner, weil wir unten auf dealing_ranges.instrument filtern — ohne !inner
  // kann PostgREST nicht auf einem eingebetteten Feld filtern) plus deren trade_setups(ob_start_time)
  // fürs Chart-Rendering der verlinkten M5-OB-Box (siehe PriceChart.vue: refreshTradeSetupLinksInternal).
  let query = supabase
    .from("trade_positions")
    .select("*, dealing_ranges!inner(id, instrument, direction, invalidation, trade_setup_id, lesson_dealing_range_id, setup_type, trade_setups(ob_start_time, ob_top, ob_bottom))")
    .eq("dealing_ranges.instrument", instrument);
  if (accountId != null && accountId !== ALL_ACCOUNTS_ID) query = query.eq("trading_account_id", accountId);
  const { data, error } = await query.order("triggered_at", { ascending: false });

  if (error) throw error;
  if (data.length === 0) return [];

  // targets/confirmations hängen an der dealing_range (der IDEE, gilt für alle Ausführungen
  // darunter), partialExits und Position-Bestätigungen an der einzelnen trade_position — vier
  // Sammel-Queries statt pro Trade einzeln, um bei vielen Trades nicht N+1 Requests zu erzeugen.
  const positionIds = data.map((row) => row.id);
  const rangeIds = [...new Set(data.map((row) => row.dealing_ranges.id))];
  // "Lesson"-Link (Chat 2026-07-31, vierte Runde, siehe Migration
  // 20260731230000_dealing_ranges_lesson_link.sql): lesson_dealing_range_id ist bereits über den
  // dealing_ranges-Join oben mit drin, hier zwei Zusatz-Queries für die ANZEIGE — einmal die Ziel-
  // Range selbst auflösen (Richtung/Instrument fürs Label "Lesson: Long#24"), einmal die
  // Rückrichtung ("welche ANDERE Range verweist auf MICH als Lesson", damit Long#24 in seinem
  // eigenen Modal/in der Tabelle auch als Ziel sichtbar ist, obwohl die FK bei Short#23 sitzt).
  // Bewusst nicht auf `instrument` eingeschränkt — die Lesson-Range kann in seltenen Fällen ein
  // anderes Instrument sein, das Label zeigt das dann einfach mit an.
  const lessonTargetIds = [...new Set(data.map((row) => row.dealing_ranges.lesson_dealing_range_id).filter((id) => id != null))];
  const [
    { data: targets, error: targetsError },
    { data: partials, error: partialsError },
    { data: rangeConfirmations, error: rangeConfirmationsError },
    { data: positionConfirmations, error: positionConfirmationsError },
    { data: lessonTargets, error: lessonTargetsError },
    { data: lessonSources, error: lessonSourcesError },
  ] = await Promise.all([
    supabase
      .from("trade_targets")
      .select("id, dealing_range_id, price, kind, source_time, touched_time, range_low, range_high, timeframe, liquidity_level_id, liquidity_levels(price, direction, timeframe, pivot_time, touched, end_time)")
      .in("dealing_range_id", rangeIds),
    supabase.from("trade_partial_exits").select("trade_position_id, price, exit_time, portion_pct").in("trade_position_id", positionIds),
    supabase
      .from("trade_confirmations")
      .select(
        "id, dealing_range_id, price, kind, source_time, touched_time, range_low, range_high, timeframe, divergence_type, from_price, from_rsi, to_rsi, liquidity_level_id, liquidity_levels(price, direction, timeframe, pivot_time, touched, end_time)",
      )
      .in("dealing_range_id", rangeIds),
    supabase
      .from("trade_confirmations")
      .select(
        "id, trade_position_id, price, kind, source_time, touched_time, range_low, range_high, timeframe, divergence_type, from_price, from_rsi, to_rsi, liquidity_level_id, liquidity_levels(price, direction, timeframe, pivot_time, touched, end_time)",
      )
      .in("trade_position_id", positionIds),
    lessonTargetIds.length > 0
      ? supabase.from("dealing_ranges").select("id, instrument, direction").in("id", lessonTargetIds)
      : Promise.resolve({ data: [], error: null }),
    supabase.from("dealing_ranges").select("id, instrument, direction, lesson_dealing_range_id").in("lesson_dealing_range_id", rangeIds),
  ]);
  if (targetsError) throw targetsError;
  if (partialsError) throw partialsError;
  if (rangeConfirmationsError) throw rangeConfirmationsError;
  if (positionConfirmationsError) throw positionConfirmationsError;
  if (lessonTargetsError) throw lessonTargetsError;
  if (lessonSourcesError) throw lessonSourcesError;

  const targetsByRange = groupBy(targets, "dealing_range_id");
  const partialsByPosition = groupBy(partials, "trade_position_id");
  const rangeConfirmationsByRange = groupBy(rangeConfirmations, "dealing_range_id");
  const positionConfirmationsByPosition = groupBy(positionConfirmations, "trade_position_id");
  const lessonTargetById = Object.fromEntries((lessonTargets ?? []).map((r) => [r.id, { id: r.id, instrument: r.instrument, direction: r.direction }]));
  const lessonSourcesByTargetId = groupBy(
    (lessonSources ?? []).map((r) => ({ id: r.id, instrument: r.instrument, direction: r.direction, dealing_range_id: r.lesson_dealing_range_id })),
    "dealing_range_id",
  );

  // Bringt eine per liquidity_level_id eingebettete liquidity_levels-Zeile (Task
  // "1H-Struktur-Pivots auf kanonische liquidity_levels-ID konsolidieren", 2026-08-24/25) in genau
  // die Form, die Dashboard.vue für pinnedLiquidityLevels/renderLiquidityLevels erwartet (dir als
  // 1/-1 statt "high"/"low", Unix-Sekunden statt ISO) — so kann ein Target/eine Bestätigung mit
  // liquidity_level_id im Chart über denselben nativen Pin-Highlight-Mechanismus gerendert werden
  // statt über einen eigenen Zeichenpfad (siehe PriceChart.vue: refreshTradeTargetLinksInternal).
  function toLiquidityLevel(row) {
    if (!row?.liquidity_levels) return null;
    const lvl = row.liquidity_levels;
    return {
      price: lvl.price,
      dir: lvl.direction === "high" ? 1 : -1,
      pivotTime: Math.floor(new Date(lvl.pivot_time).getTime() / 1000),
      touched: lvl.touched,
      endTime: lvl.end_time ? Math.floor(new Date(lvl.end_time).getTime() / 1000) : null,
      timeframe: lvl.timeframe,
    };
  }

  // level unterscheidet die zwei Ebenen aus trade_confirmations (siehe Migration
  // 20260731120000: dealing_range_id ODER trade_position_id) — TradeEditModal.vue braucht das,
  // um "GO für die Idee" von "GO für diesen Entry" in der Liste sichtbar zu trennen.
  function toConfirmation(c, level) {
    return {
      id: c.id,
      level,
      price: c.price,
      kind: c.kind,
      sourceTime: c.source_time ? Math.floor(new Date(c.source_time).getTime() / 1000) : null,
      touchedTime: c.touched_time ? Math.floor(new Date(c.touched_time).getTime() / 1000) : null,
      liquidityLevel: toLiquidityLevel(c),
      // Nur bei kind='fib' gesetzt (siehe tradeConfirmations.ts) — die zwei Ankerpreise des
      // gespeicherten Fib-Werts, sonst null.
      rangeLow: c.range_low ?? null,
      rangeHigh: c.range_high ?? null,
      // Nur bei kind='ob' gesetzt — Zeitebene der Zone, siehe PriceChart.vue: refreshTradeTargetLinksInternal.
      timeframe: c.timeframe ?? null,
      // Nur bei kind='rsi_divergence' gesetzt (siehe tradeConfirmations.ts) — price/sourceTime/
      // touchedTime tragen bereits toPrice/fromTime/toTime, diese drei zusätzlich, damit sich die
      // Divergenz als vollständiger Zwei-Bein-Konnektor nachzeichnen lässt.
      fromPrice: c.from_price ?? null,
      fromRsi: c.from_rsi ?? null,
      toRsi: c.to_rsi ?? null,
      divergenceType: c.divergence_type ?? null,
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
      // "Lesson"-Link (siehe oben): lessonDealingRangeId ist die eigene FK (diese Range zeigt auf
      // eine andere als "das wäre richtig gewesen"), lessonOfDealingRanges die Rückrichtung (andere
      // Ranges, die AUF DIESE hier als ihre Lesson zeigen).
      lessonDealingRangeId: range.lesson_dealing_range_id ?? null,
      lessonDealingRange: range.lesson_dealing_range_id != null ? (lessonTargetById[range.lesson_dealing_range_id] ?? null) : null,
      lessonOfDealingRanges: (lessonSourcesByTargetId[range.id] ?? []).map(({ id, instrument, direction }) => ({ id, instrument, direction })),
      // "Favorit"-Markierung (Chat 2026-08-13, siehe Migration 20260813120000_dealing_ranges_setup_type.sql)
      // — aktuell nur ein Wert ('10/10-Trade'), null = nicht markiert.
      setupType: range.setup_type ?? null,
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
        // Nur bei kind='ob' gesetzt (siehe PriceChart.vue: findClickedOBZone) — die zwei Kanten der
        // Zone, damit refreshTradeTargetLinksInternal eine Box statt nur eine Linie zeichnen kann.
        rangeLow: t.range_low ?? null,
        rangeHigh: t.range_high ?? null,
        // Nur bei kind='ob' gesetzt — Zeitebene der Zone (1H/4H/5M), damit die Box live per
        // detectOrderBlocks nachvollzogen werden kann statt nur einen Snapshot zu zeigen.
        timeframe: t.timeframe ?? null,
        liquidityLevel: toLiquidityLevel(t),
      })),
      // Bestätigungen fürs GO der ganzen Idee (dealing_range) und fürs GO dieses einen Entries
      // (trade_position, ex-setup_entry) zusammen — beide teilen dieselbe Tabelle/Rohform (siehe
      // tradeConfirmations.ts), level (siehe toConfirmation) hält auseinander, welche welche ist.
      confirmations: [
        ...(rangeConfirmationsByRange[range.id] ?? []).map((c) => toConfirmation(c, "range")),
        ...(positionConfirmationsByPosition[row.id] ?? []).map((c) => toConfirmation(c, "position")),
      ],
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
      // Broker-Ausführungsdetails (Chat 2026-07-31), siehe Migration
      // 20260731210000_trade_positions_size_pl_commission.sql.
      size: row.size,
      netPl: row.net_pl,
      commission: row.commission,
    };
  });
}
