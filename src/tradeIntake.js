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

// Task "Chart-Objekte: OBs auf kanonische ob_zones-ID konsolidieren" — findet die ob_zones-Zeile
// für eine gegebene OB per Natural Key oder legt sie an, falls poi-watcher sie noch nicht erfasst
// hat (z.B. ein frisch entstandenes M5-OB, dessen Trade-Setup-Zeile noch nicht existiert). Normaler
// Upsert (kein ignoreDuplicates), damit .select() bei einem bereits vorhandenen Konflikt trotzdem
// die id liefert — touched/invalidated bleiben auf Default false, dieses Objekt wird nicht live
// nachverfolgt (das übernimmt weiterhin die Indikator-Overlay-Live-Erkennung im Chart). Exportiert,
// weil pinContext.js (addPinM5ObEntry, Punkt 6) dieselbe find-or-create-Logik braucht, statt sie
// ein zweites Mal zu bauen.
export async function findOrCreateObZoneId({ instrument, timeframe, direction, top, bottom, startTimeSec }) {
  const { data, error } = await supabase
    .from("ob_zones")
    .upsert(
      { instrument, timeframe, direction, top, bottom, start_time: new Date(startTimeSec * 1000).toISOString() },
      { onConflict: "instrument,timeframe,start_time,direction" },
    )
    .select("id")
    .single();
  if (error) {
    console.error("ob_zones-Referenz anlegen/finden fehlgeschlagen:", error);
    return null;
  }
  return data.id;
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
    // Alle Setup-OBs sind laut detectSetupObs() immer Timeframe "5m" -> ob_zones.timeframe '5M'
    // (dieselbe Konvention wie poi-watcher beim Persistieren neuer Trade-Setups).
    const obZoneId = await findOrCreateObZoneId({
      instrument,
      timeframe: "5M",
      direction,
      top: setup.obTop,
      bottom: setup.obBottom,
      startTimeSec: setup.obStartTime,
    });
    const { error: confirmError } = await supabase
      .from("trade_evidence")
      .insert({ trade_position_id: position.id, price: setupEntry, kind: "ob", category: "confirmation", ob_zone_id: obZoneId });
    if (confirmError) console.error("Entry-Bestätigung anlegen fehlgeschlagen:", confirmError);
  }

  return { ok: true, dealingRange: range, position };
}

// Nur die Idee, OHNE gleichzeitig eine trade_positions-Ausführung (anders als createTradeFromSetup
// oben) — für die TSC (Chat 2026-08-26: "ich nehme oft auch manuell über den TSC Dealing Ranges
// an"). direction kommt dort NICHT von einem erkannten Setup, sondern von der ersten OB-Bestätigung,
// die der Nutzer im Trade-Modus anklickt (Philip: "das entscheidet eine Bestätigung, welche einen
// OB enthält") — siehe Dashboard.vue: onSelectTarget, tscBootstrapArmed-Zweig.
export async function createDealingRange({ instrument, direction }) {
  const { data, error } = await supabase.from("dealing_ranges").insert({ instrument, direction }).select().single();
  if (error) {
    console.error("Dealing-Range anlegen fehlgeschlagen:", error);
    return null;
  }
  return data;
}

// TSC-Reset (Chat 2026-08-27, Philip: "jetzt einen reset button im TSC hinzufügen") — löscht die
// komplette Idee wieder, wenn eine Analyse verworfen wird. trade_evidence/trade_targets
// hängen mit `on delete cascade` an dealing_ranges (Migration 20260731120000), ein einziges
// DELETE hier reicht also. Nur sinnvoll, solange die Range noch keine trade_positions-Zeile hat —
// die TSC zeigt eine Range mit Ausführung ohnehin nicht mehr an (siehe fetchActiveTscRangeId).
export async function deleteDealingRange(dealingRangeId) {
  const { error } = await supabase.from("dealing_ranges").delete().eq("id", dealingRangeId);
  if (error) {
    console.error("Dealing-Range löschen fehlgeschlagen:", error);
    return false;
  }
  return true;
}

// "In die Trades-Liste überführen" (Chat 2026-08-27, TSC) — Gegenstück zu createTradeFromSetup,
// aber für eine BEREITS bestehende dealing_ranges-Zeile (die TSC hat sie schon vor dem Klick
// angelegt, siehe createDealingRange oben) statt beides auf einmal anzulegen. Leere Ausführung
// (entry_price/stop_loss null, outcome null wie bei createTradeFromSetup ohne entryPrice) — Philip
// füllt Entry/Stop-Loss/etc. danach ganz normal im sich öffnenden Trade-Edit-Modal aus, statt hier
// ein zweites Formular zu duplizieren. Erlaubt bewusst mehrere Aufrufe für dieselbe Range (Re-Entry,
// siehe CLAUDE.md: "1-n untergeordnete Ausführungen").
//
// triggeredAt (Bug-Report Philip 2026-08-27, Range #48/Position #76): "jetzt" ist bei einem
// Backtest-Setup falsch — die Range entstand historisch, nicht im Moment des Button-Klicks.
// Dashboard.vue: onTscTransferToTrades übergibt stattdessen das Datum der OB-Bestätigung (oder,
// falls keine OB dabei ist, der frühesten Bestätigung) — die genaue Uhrzeit ist hier bewusst
// unwichtig ("Uhrzeit brauch ma für ne DR nicht"), die bekommt erst die echte Ausführung im
// Trade-Edit-Modal. Fällt auf "jetzt" zurück, falls kein Anker übergeben wird.
export async function addPositionToDealingRange(dealingRangeId, { tradingAccountId = null, triggeredAt = null } = {}) {
  const { data, error } = await supabase
    .from("trade_positions")
    .insert({
      dealing_range_id: dealingRangeId,
      source: "live",
      triggered_at: (triggeredAt != null ? new Date(triggeredAt * 1000) : new Date()).toISOString(),
      trading_account_id: tradingAccountId,
    })
    .select()
    .single();
  if (error) {
    console.error("Trade-Position anlegen fehlgeschlagen:", error);
    return null;
  }
  return data;
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

// Analoges Gegenstück zu findOrCreateObZoneId, für kind='pivot' (Task "1H-Struktur-Pivots auf
// kanonische liquidity_levels-ID konsolidieren", 2026-08-24/25) — bisher nur serverseitig für
// Lanas MCP-Tools gebaut (supabase/functions/trading-monitor-mcp/db.ts: findOrCreateLiquidityLevelId,
// dieselbe Formel), nie für den Chart-Klick-Weg im Frontend. Bug-Report Philip 2026-08-27: eine
// TSC-Sweep-Bestätigung zeichnete dadurch bisher eine zweite, leicht dickere Linie statt das
// bestehende LQ-Chartobjekt zu highlighten — "soll einfach das LQ-Chartobjekt selbst sein, nur
// gehighlighted", genau der Zweck der liquidity_level_id-Verknüpfung (siehe
// refreshTradeTargetLinksInternal/-ConfirmationLinksInternal in PriceChart.vue). Philip
// ausdrücklich: "ich will echte Verknüpfungen, kein Snapshot-Feld auf trade_confirmations" — daher
// 1H/4H/5M statt eines Duplikats von direction auf trade_evidence/trade_targets, dieselbe
// Abkehr von "M5 wird nie persistiert" wie schon bei ob_zones (Migration
// 20260827120000_liquidity_levels_allow_5m.sql, siehe dort). direction hier ist 'high'/'low'
// (welche Seite geswept wurde), NICHT die daraus abgeleitete Long/Short-Bias (siehe
// PriceChart.vue: findClickedTarget). Feinere Timeframes (1m/3m/15m/1D) bleiben unverknüpfte
// Preis-Snapshots — für die Sweep-Erkennung dieser App nicht relevant, kein 5M-analoger Bedarf.
export async function findOrCreateLiquidityLevelId({ instrument, timeframe, direction, price, pivotTimeSec }) {
  if (timeframe !== "1H" && timeframe !== "4H" && timeframe !== "5M") return null;
  const { data, error } = await supabase
    .from("liquidity_levels")
    .upsert(
      { instrument, timeframe, direction, price, pivot_time: new Date(pivotTimeSec * 1000).toISOString() },
      { onConflict: "instrument,timeframe,direction,pivot_time" },
    )
    .select("id")
    .single();
  if (error) {
    console.error("Liquiditäts-Level-Referenz anlegen/finden fehlgeschlagen:", error);
    return null;
  }
  return data.id;
}

// Nur bei kind='pivot' mit vollständigem Kontext versucht (siehe findClickedTarget) — ein Alt-Klick-
// Pfad ohne instrument/timeframe/levelDirection (sollte praktisch nicht mehr vorkommen) liefert
// einfach null, bleibt dann wie bisher ein reiner Preis-Snapshot.
async function resolvePivotLiquidityLevelId(target) {
  if (target.kind !== "pivot" || target.instrument == null || target.levelDirection == null || target.timeframe == null || target.sourceTime == null) {
    return null;
  }
  return findOrCreateLiquidityLevelId({
    instrument: target.instrument,
    timeframe: target.timeframe,
    direction: target.levelDirection,
    price: target.price,
    pivotTimeSec: target.sourceTime,
  });
}

// Target hinzufügen (Chat 2026-07-27/28: "einem Trade ein Target hinzuzufügen ... ein Pivot
// targetiere ich oder einen OB") — ein Target gilt für die ganze dealing_range (Chat 2026-07-31:
// "gehört auch alles zu derselben dealing range"), also 1:n zu dealing_ranges statt zur einzelnen
// Ausführung, deshalb einfacher Insert statt Upsert; Duplikate (zweimal derselbe Preis) werden
// bewusst nicht verhindert, das wäre eine eigene Entscheidung, keine hier vorweggenommene Regel.
// `target` kommt im TradeTarget-Rohformat (kind/price/sourceTime/touchedTime) direkt aus
// PriceChart.vue: findClickedTarget.
export async function addTargetToTrade(dealingRangeId, target) {
  const liquidityLevelId = await resolvePivotLiquidityLevelId(target);
  const { error } = await supabase.from("trade_targets").insert({
    dealing_range_id: dealingRangeId,
    price: target.price,
    kind: target.kind,
    source_time: target.sourceTime != null ? new Date(target.sourceTime * 1000).toISOString() : null,
    touched_time: target.touchedTime != null ? new Date(target.touchedTime * 1000).toISOString() : null,
    // Nur bei kind='ob' gesetzt (siehe PriceChart.vue: findClickedOBZone) — die zwei Kanten der
    // Zone, damit sich daraus eine echte OB-Box statt nur einer Linie an der näheren Kante
    // zeichnen lässt (Bug-Report Philip 2026-07-31), plus die Zeitebene (1H/4H/5M bei OB, 1H/4H bei
    // pivot), damit die Box später live per detectOrderBlocks nachvollzogen werden kann statt nur
    // einen Snapshot zu zeigen.
    range_low: target.rangeLow ?? null,
    range_high: target.rangeHigh ?? null,
    timeframe: target.timeframe ?? null,
    liquidity_level_id: liquidityLevelId,
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
  // entryTime editiert bewusst triggered_at mit (nicht ein neues Feld) — das ist bereits die
  // Spalte, aus der trades.js:entryTime gelesen wird und die den Entry-Marker im Chart
  // positioniert (siehe PriceChart.vue: jumpToTrade/entryTime-Nutzung). Anders als exitTime NICHT
  // nullbar (triggered_at ist `not null` in der DB) — leeres Feld im Formular wird ignoriert statt
  // gesendet. Bug-Report Philip 2026-08-19: Entry-Preis war editierbar, Entry-Zeit nicht —
  // triggered_at blieb dann auf dem reinen DB-Insert-Zeitpunkt stehen statt dem tatsächlichen
  // Fill, der Marker saß am falschen Punkt im Chart.
  if ("entryTime" in fields && fields.entryTime != null) payload.triggered_at = new Date(fields.entryTime * 1000).toISOString();
  if ("stopLoss" in fields) payload.stop_loss = fields.stopLoss;
  if ("exitPrice" in fields) payload.exit_price = fields.exitPrice;
  if ("exitTime" in fields) payload.exit_time = fields.exitTime != null ? new Date(fields.exitTime * 1000).toISOString() : null;
  if ("outcome" in fields) payload.outcome = fields.outcome;
  if ("reasoning" in fields) payload.reasoning = fields.reasoning;
  if ("tradingAccountId" in fields) payload.trading_account_id = fields.tradingAccountId;
  // Broker-Ausführungsdetails (Chat 2026-07-31) — bisher zweckentfremdet im reasoning-Freitext
  // (siehe Migration 20260731210000_trade_positions_size_pl_commission.sql).
  if ("size" in fields) payload.size = fields.size;
  if ("netPl" in fields) payload.net_pl = fields.netPl;
  if ("commission" in fields) payload.commission = fields.commission;

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

// Dealing-Range-CRUD, "U" — invalidation ist per Formular ODER per Chart-Klick setzbar (Chat
// 2026-07-31, zweite Runde: "mach wieder so, dass ich es im Edit-Modal anklicken kann", siehe
// Dashboard.vue: onSetInvalidationRequest/onSelectTarget), beides läuft über dieselbe Funktion hier.
export async function updateDealingRange(dealingRangeId, fields) {
  const payload = {};
  if ("invalidation" in fields) payload.invalidation = fields.invalidation;
  // "Lesson"-Verknüpfung (Chat 2026-07-31, vierte Runde): "GBP Short#23 war ein dummer Fehler,
  // Long#24 wäre die Lesson daraus" — self-referencing FK auf eine ANDERE dealing_range, siehe
  // Migration 20260731230000_dealing_ranges_lesson_link.sql. null = Verknüpfung entfernen.
  if ("lessonDealingRangeId" in fields) payload.lesson_dealing_range_id = fields.lessonDealingRangeId;
  // "Favorit"-Markierung (Chat 2026-08-13, siehe Migration 20260813120000_dealing_ranges_setup_type.sql)
  // — null entfernt die Markierung wieder.
  if ("setupType" in fields) payload.setup_type = fields.setupType;

  const { error } = await supabase.from("dealing_ranges").update(payload).eq("id", dealingRangeId);
  if (error) {
    console.error("Dealing Range aktualisieren fehlgeschlagen:", error);
    return false;
  }
  return true;
}

// Bestätigung/Zusatzargument hinzufügen (PLAN-trade-confluences.md #1: "von welchen Sweeps kam die
// Kraft ... auch OBs") — gleiches Rohformat wie addTargetToTrade (kind/price/sourceTime/touchedTime
// aus PriceChart.vue: findClickedTarget), eigene Tabelle (trade_evidence), weil eine Bestätigung/
// ein Zusatzargument bereits passierte Evidenz ist statt einer zukünftigen Preis-Erwartung.
// category (confirmation/confluence/anti_confluence, siehe trade-from-poi.md#confirmation-
// confluence-und-anti-confluence--wie-eine-dealing-range-go-bekommt) lässt sich seit es
// Anti-Confluences gibt NICHT mehr rein aus kind ableiten (derselbe kind='ob' kann je nach
// Klick-Button Confirmation ODER Anti-Confluence sein, siehe Migration 20260828130000) — kommt
// darum als expliziter Parameter vom Aufrufer (Dashboard.vue kennt den gerade "scharfen"
// Arm-Zustand). trade_evidence ist zweigleisig (siehe Migration 20260731120000): eine Zeile hängt
// entweder an der einzelnen Ausführung (das GO/Argument für DIESEN Entry, kann sich von anderen
// Re-Entries unterscheiden) oder an der dealing_range (für die ganze Idee) — genau eine der beiden
// IDs wird gesetzt, der Rest bleibt null (DB-CHECK erzwingt das).
async function insertConfirmation({ tradePositionId = null, dealingRangeId = null, category, confirmation }) {
  // Nur bei kind='ob' gesetzt (siehe findClickedOBZone) — Natural-Key-Lookup/-Anlage der
  // referenzierten ob_zones-Zeile, damit die Bestätigung per FK statt nur per Preis-Snapshot auf
  // die OB verweist (Task "Chart-Objekte: OBs auf kanonische ob_zones-ID konsolidieren").
  const obZoneId =
    confirmation.kind === "ob" &&
    confirmation.instrument != null &&
    confirmation.direction != null &&
    confirmation.timeframe != null &&
    confirmation.rangeLow != null &&
    confirmation.rangeHigh != null &&
    confirmation.sourceTime != null
      ? await findOrCreateObZoneId({
          instrument: confirmation.instrument,
          timeframe: confirmation.timeframe,
          direction: confirmation.direction,
          top: confirmation.rangeHigh,
          bottom: confirmation.rangeLow,
          startTimeSec: confirmation.sourceTime,
        })
      : null;
  const liquidityLevelId = await resolvePivotLiquidityLevelId(confirmation);

  const { error } = await supabase.from("trade_evidence").insert({
    trade_position_id: tradePositionId,
    dealing_range_id: dealingRangeId,
    price: confirmation.price,
    kind: confirmation.kind,
    category,
    source_time: confirmation.sourceTime != null ? new Date(confirmation.sourceTime * 1000).toISOString() : null,
    touched_time: confirmation.touchedTime != null ? new Date(confirmation.touchedTime * 1000).toISOString() : null,
    // Nur bei kind='fib' gesetzt (siehe PriceChart.vue: findClickedFibLevel) — die zwei Ankerpreise
    // des Fib-Werts, sonst bleibt die Spalte null (Default).
    range_low: confirmation.rangeLow ?? null,
    range_high: confirmation.rangeHigh ?? null,
    // Bei kind='ob' die Zeitebene der Zone (1H/4H/5M), bei kind='pivot' die Chart-Zeitebene des
    // Klicks (siehe findClickedTarget) — nur bei 1H/4H führt Letzteres zu einer echten
    // liquidity_level_id (siehe resolvePivotLiquidityLevelId).
    timeframe: confirmation.timeframe ?? null,
    ob_zone_id: obZoneId,
    liquidity_level_id: liquidityLevelId,
    // Nur bei kind='rsi_divergence' gesetzt (siehe PriceChart.vue: findClickedDivergence) — price/
    // source_time/touched_time tragen bereits toPrice/fromTime/toTime, diese drei zusätzlichen
    // Felder machen die Divergenz später wieder als vollständigen Zwei-Bein-Konnektor zeichenbar.
    divergence_type: confirmation.divergenceType ?? null,
    from_price: confirmation.fromPrice ?? null,
    from_rsi: confirmation.fromRsi ?? null,
    to_rsi: confirmation.toRsi ?? null,
  });
  if (error) {
    console.error("Bestätigung hinzufügen fehlgeschlagen:", error);
    return false;
  }
  // Bug-Report Philip 2026-08-27: eine per Chart-Klick einzeln hinzugefügte OB-Bestätigung (nicht
  // über das ganze Trade-Setup, siehe onSelectSetupConfirmations/linkTradeToSetup in Dashboard.vue)
  // übernahm die Invalidierung bisher nicht, obwohl der Klick auf das ganze Setup das schon konnte
  // — Erwartung war "genauso wie vorhin". Dieselbe Fern-Kante-Regel wie deriveSetupEntryInvalidation
  // (Long: Unterkante, Short: Oberkante), nur auf Range-Ebene und NUR wenn noch keine Invalidierung
  // gesetzt ist (eine bereits vorhandene, evtl. manuell nachjustierte Invalidierung wird von einer
  // weiteren OB-Bestätigung nicht überschrieben).
  //
  // direction (Bug-Report Philip 2026-08-27: TSC bootstrappte über einen LQ-Sweep zuerst auf
  // "Long", eine danach hinzugefügte bärische OB-Bestätigung änderte daran nichts — "nicht die
  // erste Bestätigung soll die Richtung festlegen, sondern sobald ich eine OB auswähle, denn die
  // OB ist bärisch oder bullisch") — anders als invalidation wird direction hier IMMER überschrieben,
  // nicht nur wenn noch leer: eine OB ist laut Philip das eindeutigere Signal als ein bloßer Sweep
  // (der je nach Kontext Reversal oder Fortsetzung bedeuten kann), soll also auch eine beim
  // Bootstrap aus einem Sweep geratene Richtung nachträglich korrigieren dürfen.
  // category === "confirmation"-Guard (Chat 2026-08-28, Anti-Confluence-Einführung): ein
  // gegenläufiger OB, den Philip bewusst als Anti-Confluence anklickt (z.B. ein bullischer OB
  // gegen ein Short-Setup), darf die Range-Richtung NICHT umdrehen — nur eine echte Confirmation
  // ist das eindeutigere Signal, das laut Philip die Richtung überschreiben soll.
  if (
    dealingRangeId != null &&
    category === "confirmation" &&
    confirmation.kind === "ob" &&
    confirmation.rangeLow != null &&
    confirmation.rangeHigh != null &&
    confirmation.direction != null
  ) {
    const { data: range } = await supabase.from("dealing_ranges").select("invalidation, direction").eq("id", dealingRangeId).maybeSingle();
    if (range) {
      const updates = {};
      if (range.direction !== confirmation.direction) updates.direction = confirmation.direction;
      if (range.invalidation == null) updates.invalidation = confirmation.direction === "long" ? confirmation.rangeLow : confirmation.rangeHigh;
      if (Object.keys(updates).length > 0) await supabase.from("dealing_ranges").update(updates).eq("id", dealingRangeId);
    }
  }
  return true;
}

export async function addConfirmationToTrade(positionId, confirmation, category) {
  return insertConfirmation({ tradePositionId: positionId, category, confirmation });
}

// Range-weite Bestätigung (das GO für die ganze Idee, z.B. der ursprüngliche Sweep+OB, der die
// dealing_range ausgelöst hat) — bisher nur per Trade-Modus-Chart-Klick erreichbar war das
// Entry-GO auf der Ausführung; das hier ist der erste UI-Weg für die Range-Ebene selbst
// (Chat 2026-07-31: "ich kann nicht die confirmations ... für die dealing range setzen").
export async function addRangeConfirmation(dealingRangeId, confirmation, category) {
  return insertConfirmation({ dealingRangeId, category, confirmation });
}

export async function removeConfirmationFromTrade(confirmationId) {
  const { error } = await supabase.from("trade_evidence").delete().eq("id", confirmationId);
  if (error) {
    console.error("Bestätigung entfernen fehlgeschlagen:", error);
    return false;
  }
  return true;
}
