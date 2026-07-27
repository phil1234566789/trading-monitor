import { supabase } from "./supabaseClient.js";

// "Setup als Trade übernehmen" (Chat 2026-07-27, Trade-Modus) — verbindet einen im Chart
// angeklickten Trade-Setup (dir/label/pathType/obTop/obBottom/ls/fractal, siehe
// computeTradeSetups in PriceChart.vue) mit einem neuen Eintrag in `signals`.

// dir=1 -> Short (bärisches OB), dir=-1 -> Long (bullisches OB), siehe computeTradeSetups
// (detectTradeSetups(1, ...) = shorts, detectTradeSetups(-1, ...) = longs).
export function directionForSetup(setup) {
  return setup.dir === 1 ? "short" : "long";
}

// These-Ebene (Soll): "setupEntry ist bärische M5-OB-Unterkante, invalidation ist Oberkante"
// (Chat 2026-07-27, Philips eigene Definition, bewusst nicht die "Standard"-OB-Lesart) — beim
// Long spiegelbildlich (Oberkante = Entry, Unterkante = Invalidation).
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
// gewonnen/verloren, siehe signals.outcome-Check: NULL ist erlaubt), erst mit echtem entryPrice
// wird der Trade als 'open' geführt.
export async function createTradeFromSetup({ instrument, setup, entryPrice = null, stopLoss = null, reasoning = null }) {
  const direction = directionForSetup(setup);
  const { setupEntry, invalidation } = deriveSetupEntryInvalidation(setup);
  const tradeSetupId = await findMatchingTradeSetupId(instrument, direction, setup.fractal.pivotTime);

  const { data, error } = await supabase
    .from("signals")
    .insert({
      instrument,
      source: "live",
      direction,
      triggered_at: new Date().toISOString(),
      setup_entry: setupEntry,
      invalidation,
      entry_price: entryPrice,
      stop_loss: stopLoss,
      outcome: entryPrice != null ? "open" : null,
      reasoning,
      trade_setup_id: tradeSetupId,
    })
    .select()
    .single();

  if (error) {
    console.error("Trade aus Setup anlegen fehlgeschlagen:", error);
    return { ok: false, error };
  }
  return { ok: true, signal: data };
}

// Nachträgliche Verknüpfung (Chat 2026-07-27: "kannst du die Möglichkeit geben, das im Nachhinein
// zuzuordnen?") — für Trades, die vor diesem Feature oder ohne rechtzeitig existierenden
// trade_setups-Datensatz angelegt wurden (poi-watcher hinkt bis zu 5 Minuten hinterher). Nimmt
// dieselbe Ableitung wie createTradeFromSetup, schreibt aber nur trade_setup_id/setup_entry/
// invalidation in eine BESTEHENDE Zeile statt eine neue anzulegen.
export async function linkTradeToSetup(signalId, instrument, setup) {
  const direction = directionForSetup(setup);
  const { setupEntry, invalidation } = deriveSetupEntryInvalidation(setup);
  const tradeSetupId = await findMatchingTradeSetupId(instrument, direction, setup.fractal.pivotTime);

  const { error } = await supabase
    .from("signals")
    .update({ trade_setup_id: tradeSetupId, setup_entry: setupEntry, invalidation })
    .eq("id", signalId);

  if (error) {
    console.error("Trade nachträglich verknüpfen fehlgeschlagen:", error);
    return false;
  }
  return true;
}
