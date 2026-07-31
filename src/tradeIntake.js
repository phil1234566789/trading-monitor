import { supabase } from "./supabaseClient.js";

// "Setup als Trade übernehmen" (Chat 2026-07-27, Trade-Modus) — verbindet einen im Chart
// angeklickten Trade-Setup (dir/label/pathType/obTop/obBottom/ls/fractal, siehe
// computeTradeSetups in PriceChart.vue) mit einer neuen `dealing_ranges`-Idee + ihrer ersten
// `trade_positions`-Ausführung (Chat 2026-07-31: Idee/Ausführung aufgeteilt, siehe CLAUDE.md
// Trade-Journal-Umbau).

// dir=1 -> Short (bärisches OB), dir=-1 -> Long (bullisches OB), siehe computeTradeSetups
// (detectTradeSetups(1, ...) = shorts, detectTradeSetups(-1, ...) = longs).
export function directionForSetup(setup) {
  return setup.dir === 1 ? "short" : "long";
}

// These-Ebene (Soll): "setupEntry ist bärische M5-OB-Unterkante, invalidation ist Oberkante"
// (Chat 2026-07-27, Philips eigene Definition, bewusst nicht die "Standard"-OB-Lesart) — beim
// Long spiegelbildlich (Oberkante = Entry, Unterkante = Invalidation). Seit dem Idee/Ausführung-
// Split (2026-07-31) landen die zwei Werte an verschiedenen Stellen: invalidation auf der
// dealing_range (gilt für die ganze Idee), setupEntry als Bestätigung auf der jeweiligen
// trade_position (siehe createTradeFromSetup) — die Funktion selbst bleibt unverändert.
export function deriveSetupEntryInvalidation(setup) {
  return setup.dir === 1
    ? { setupEntry: setup.obBottom, invalidation: setup.obTop }
    : { setupEntry: setup.obTop, invalidation: setup.obBottom };
}

// Verknüpfung zum poi-watcher-persistierten trade_setups-Datensatz über den natürlichen Schlüssel
// (instrument, direction, fractal_pivot_time) — broker-/datenquellen-unabhängig, weil trade_setups
// bereits ein fertiger Snapshot ist (siehe CLAUDE.md: Frontend erkennt live, Backend persistiert
// unabhängig davon dieselbe Erkennung für die Alarmierung). poi-watcher läuft nur alle 5 Minuten —
// bei einem ganz frisch entstandenen Setup kann die Zeile noch fehlen, dann bleibt null (kein Retry
// hier, das müsste man bei Bedarf später nachtragen).
async function findMatchingTradeSetupId(instrument, direction, fractalPivotTimeSec) {
  const { data, error } = await supabase
    .from("trade_setups")
    .select("id")
    .eq("instrument", instrument)
    .eq("direction", direction)
    .eq("fractal_pivot_time", new Date(fractalPivotTimeSec * 1000).toISOString())
    .maybeSingle();
  if (error) {
    console.error("Trade-Setup-Match fehlgeschlagen:", error);
    return null;
  }
  return data?.id ?? null;
}

// Für den Klick auf eine Zeile in TradesTable.vue (Chat 2026-07-27: TSC-Fokus auch für einen
// bereits geloggten Trade, nicht nur für einen frisch im Trade-Modus angeklickten Live-Setup) —
// baut aus dem persistierten trade_setups-Datensatz dasselbe Format, das computeCockpitState von
// einem Live-Setup erwartet (siehe CockpitState.m5Setup in tradeSetupCockpit.ts). pathType steht
// in trade_setups nicht direkt drin, lässt sich aber aus fractal_price===ls_price ableiten (Path B
// ist per Definition "fractal===ls", siehe pathType-Kommentare in tradeSetup.js/PriceChart.vue).
// setupNumber bleibt null — die Historie-Nummerierung existiert nur für die Live-Erkennung.
export async function fetchTradeSetupForCockpit(tradeSetupId) {
  const { data, error } = await supabase.from("trade_setups").select("*").eq("id", tradeSetupId).maybeSingle();
  if (error) {
    console.error("Verknüpftes Trade-Setup laden fehlgeschlagen:", error);
    return null;
  }
  if (!data) return null;
  return {
    dir: data.direction === "short" ? 1 : -1,
    label: data.direction === "short" ? "Short" : "Long",
    pathType: data.fractal_price === data.ls_price ? "B" : "A",
    setupNumber: null,
    ls: {
      price: data.ls_price,
      pivotTime: Math.floor(new Date(data.ls_pivot_time).getTime() / 1000),
      touchedTime: Math.floor(new Date(data.ls_touched_time).getTime() / 1000),
    },
    obTop: data.ob_top,
    obBottom: data.ob_bottom,
    tradeSetupId: data.id,
  };
}

// entryPrice/stopLoss optional (Chat 2026-07-27: "kann sein, dass mein Trade nicht abgeholt wird
// ... es gibt ein setupEntry, aber kein entryPrice") — outcome bleibt dann null (weder offen noch
// gewonnen/verloren, siehe trade_positions.outcome-Check: NULL ist erlaubt), erst mit echtem
// entryPrice wird der Trade als 'open' geführt.
// tradingAccountId (Chat 2026-07-30): das im Trades-Panel gerade ausgewählte Konto — ein neu
// übernommener Trade landet direkt in dessen Konto, statt erst nachträglich im Bearbeiten-Modal
// zugeordnet werden zu müssen. Bewusst optional (default null), damit ein Aufruf ohne Konten-
// Kontext (z.B. vor dem ersten fetchAccounts()) nicht hart fehlschlägt.
//
// Legt IMMER beides zusammen an: die dealing_ranges-Idee (instrument/direction/invalidation/
// trade_setup_id — teilt sich künftige Re-Entries) und ihre erste trade_positions-Ausführung.
// setupEntry (Entry-Kriterium DIESER Ausführung) landet nicht mehr als eigenes Feld, sondern als
// ganz normale Bestätigung (kind='ob') auf der neuen Position — Philip 2026-07-31: "die
// confirmations und das setup für den Entry sind so ziemlich das gleiche".
export async function createTradeFromSetup({ instrument, setup, entryPrice = null, stopLoss = null, reasoning = null, tradingAccountId = null }) {
  const direction = directionForSetup(setup);
  const { setupEntry, invalidation } = deriveSetupEntryInvalidation(setup);
  const tradeSetupId = await findMatchingTradeSetupId(instrument, direction, setup.fractal.pivotTime);

  const { data: range, error: rangeError } = await supabase
    .from("dealing_ranges")
    .insert({ instrument, direction, invalidation, trade_setup_id: tradeSetupId })
    .select()
    .single();
  if (rangeError) {
    console.error("Dealing-Range aus Setup anlegen fehlgeschlagen:", rangeError);
    return { ok: false, error: rangeError };
  }

  const { data: position, error } = await supabase
    .from("trade_positions")
    .insert({
      dealing_range_id: range.id,
      source: "live",
      triggered_at: new Date().toISOString(),
      entry_price: entryPrice,
      stop_loss: stopLoss,
      outcome: entryPrice != null ? "open" : null,
      reasoning,
      trading_account_id: tradingAccountId,
    })
    .select()
    .single();
  if (error) {
    console.error("Trade-Ausführung anlegen fehlgeschlagen:", error);
    return { ok: false, error };
  }

  if (setupEntry != null) {
    const { error: confirmError } = await supabase
      .from("trade_confirmations")
      .insert({ trade_position_id: position.id, price: setupEntry, kind: "ob" });
    if (confirmError) console.error("Entry-Bestätigung anlegen fehlgeschlagen:", confirmError);
  }

  return { ok: true, dealingRange: range, position };
}

// Nachträgliche Verknüpfung (Chat 2026-07-27: "kannst du die Möglichkeit geben, das im Nachhinein
// zuzuordnen?") — für Trades, die vor diesem Feature oder ohne rechtzeitig existierenden
// trade_setups-Datensatz angelegt wurden (poi-watcher hinkt bis zu 5 Minuten hinterher). Schreibt
// trade_setup_id/invalidation auf die BESTEHENDE dealing_range (nicht mehr auf eine einzelne
// Ausführung, seit die beiden getrennt sind) — setupEntry wird hier bewusst NICHT mehr übernommen,
// das wäre jetzt eine Bestätigung auf einer konkreten Ausführung, keine Idee-Eigenschaft.
export async function linkTradeToSetup(dealingRangeId, instrument, setup) {
  const direction = directionForSetup(setup);
  const { invalidation } = deriveSetupEntryInvalidation(setup);
  const tradeSetupId = await findMatchingTradeSetupId(instrument, direction, setup.fractal.pivotTime);

  const { error } = await supabase
    .from("dealing_ranges")
    .update({ trade_setup_id: tradeSetupId, invalidation })
    .eq("id", dealingRangeId);

  if (error) {
    console.error("Trade nachträglich verknüpfen fehlgeschlagen:", error);
    return false;
  }
  return true;
}

// Target hinzufügen (Chat 2026-07-27/28: "einem Trade ein Target hinzuzufügen ... ein Pivot
// targetiere ich oder einen OB") — ein Target gilt für die ganze dealing_range (Chat 2026-07-31:
// "gehört auch alles zu derselben dealing range"), also 1:n zu dealing_ranges statt zur einzelnen
// Ausführung, deshalb einfacher Insert statt Upsert; Duplikate (zweimal derselbe Preis) werden
// bewusst nicht verhindert, das wäre eine eigene Entscheidung, keine hier vorweggenommene Regel.
// `target` kommt im TradeTarget-Rohformat (kind/price/sourceTime/touchedTime) direkt aus
// PriceChart.vue: findClickedTarget.
export async function addTargetToTrade(dealingRangeId, target) {
  const { error } = await supabase.from("trade_targets").insert({
    dealing_range_id: dealingRangeId,
    price: target.price,
    kind: target.kind,
    source_time: target.sourceTime != null ? new Date(target.sourceTime * 1000).toISOString() : null,
    touched_time: target.touchedTime != null ? new Date(target.touchedTime * 1000).toISOString() : null,
  });
  if (error) {
    console.error("Target hinzufügen fehlgeschlagen:", error);
    return false;
  }
  return true;
}

// Ziel entfernen (Chat 2026-07-28: "1,32992 kann ja jetzt raus", z.B. weil es nur automatisch aus
// dem alten take_profit-Feld übernommen wurde und nicht mehr zutrifft).
export async function removeTargetFromTrade(targetId) {
  const { error } = await supabase.from("trade_targets").delete().eq("id", targetId);
  if (error) {
    console.error("Ziel entfernen fehlgeschlagen:", error);
    return false;
  }
  return true;
}

// Trade-CRUD, "U" (Chat 2026-07-28: "lass die Entity 'trades' CRUD Funktionalität weitermachen") —
// generisches Partial-Update für TradeEditModal.vue. fields nutzt camelCase (wie das Objekt aus
// trades.js), wird hier auf die DB-Spaltennamen gemappt statt das dem Aufrufer zu überlassen.
// exitTime kommt als Unix-Sekunden (wie der Rest der App) oder null, nicht als ISO-String.
export async function updateTrade(positionId, fields) {
  const payload = {};
  if ("entryPrice" in fields) payload.entry_price = fields.entryPrice;
  if ("stopLoss" in fields) payload.stop_loss = fields.stopLoss;
  if ("exitPrice" in fields) payload.exit_price = fields.exitPrice;
  if ("exitTime" in fields) payload.exit_time = fields.exitTime != null ? new Date(fields.exitTime * 1000).toISOString() : null;
  if ("outcome" in fields) payload.outcome = fields.outcome;
  if ("reasoning" in fields) payload.reasoning = fields.reasoning;
  if ("tradingAccountId" in fields) payload.trading_account_id = fields.tradingAccountId;

  const { error } = await supabase.from("trade_positions").update(payload).eq("id", positionId);
  if (error) {
    console.error("Trade aktualisieren fehlgeschlagen:", error);
    return false;
  }
  return true;
}

// Trade-CRUD, "D" — löscht nur DIESE Ausführung, nicht die dealing_range darunter (die kann noch
// weitere Ausführungen/Ziele haben). trade_partial_exits und Position-Bestätigungen haben `on
// delete cascade` von trade_positions (siehe 20260727180000_trade_thesis_and_partial_exits.sql/
// 20260731120000_dealing_ranges_trade_positions.sql), räumen sich also von selbst mit auf;
// trade_targets und dealing_range-Bestätigungen bleiben bewusst erhalten (gehören der Idee, nicht
// dieser einen Ausführung).
export async function deleteTrade(positionId) {
  const { error } = await supabase.from("trade_positions").delete().eq("id", positionId);
  if (error) {
    console.error("Trade löschen fehlgeschlagen:", error);
    return false;
  }
  return true;
}

// Setup-Verknüpfung wieder entfernen (Gegenstück zu linkTradeToSetup) — für einen versehentlichen
// oder falschen 🔗-Klick. Sitzt auf der dealing_range, seit trade_setup_id/invalidation dort statt
// auf der einzelnen Ausführung leben.
export async function unlinkTradeSetup(dealingRangeId) {
  const { error } = await supabase.from("dealing_ranges").update({ trade_setup_id: null, invalidation: null }).eq("id", dealingRangeId);
  if (error) {
    console.error("Setup-Verknüpfung entfernen fehlgeschlagen:", error);
    return false;
  }
  return true;
}

// Bestätigung hinzufügen (PLAN-trade-confluences.md #1: "von welchen Sweeps kam die Kraft ...
// auch OBs") — gleiches Rohformat wie addTargetToTrade (kind/price/sourceTime/touchedTime aus
// PriceChart.vue: findClickedTarget), eigene Tabelle (trade_confirmations), weil eine Bestätigung
// bereits passierte Evidenz ist statt einer zukünftigen Preis-Erwartung. Hängt bewusst an der
// einzelnen Ausführung (trade_position_id), nicht an der dealing_range — das GO für DIESEN Entry
// kann sich von anderen Re-Entries derselben Idee unterscheiden (Chat 2026-07-31). Eine
// range-weite Bestätigung (dealing_range_id statt trade_position_id) gibt's als Konzept schon in
// der DB, aber noch keinen UI-Weg, eine anzulegen — kommt mit dem TSC-Rework (siehe CLAUDE.md).
export async function addConfirmationToTrade(positionId, confirmation) {
  const { error } = await supabase.from("trade_confirmations").insert({
    trade_position_id: positionId,
    price: confirmation.price,
    kind: confirmation.kind,
    source_time: confirmation.sourceTime != null ? new Date(confirmation.sourceTime * 1000).toISOString() : null,
    touched_time: confirmation.touchedTime != null ? new Date(confirmation.touchedTime * 1000).toISOString() : null,
    // Nur bei kind='fib' gesetzt (siehe PriceChart.vue: findClickedFibLevel) — die zwei Ankerpreise
    // des Fib-Werts, sonst bleibt die Spalte null (Default).
    range_low: confirmation.rangeLow ?? null,
    range_high: confirmation.rangeHigh ?? null,
  });
  if (error) {
    console.error("Bestätigung hinzufügen fehlgeschlagen:", error);
    return false;
  }
  return true;
}

export async function removeConfirmationFromTrade(confirmationId) {
  const { error } = await supabase.from("trade_confirmations").delete().eq("id", confirmationId);
  if (error) {
    console.error("Bestätigung entfernen fehlgeschlagen:", error);
    return false;
  }
  return true;
}
