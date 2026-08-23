// Pin-Kontext (Chat 2026-08-01, siehe supabase/migrations/20260801120000_laniakea_context.sql,
// 20260801130000_laniakea_context_ob_zones.sql): Dinge, die Philip per Rechtsklick (Trades-Tabelle/
// Chart-Marker/OB-Zonen-Box) "an Lana übergeben" hat — schlanker Supabase-Wrapper wie
// claudeAnnotationsStore.js, kein localStorage-Sync nötig (das hier sind Live-Daten, keine
// Einstellung). Reaktives Halten der Liste übernimmt der Aufrufer (Dashboard.vue) via
// usePolledFetch, wie bei fetchTrades.
//
// Polymorph seit der zweiten bis sechsten Migration: kind = "trade_position" | "ob_zone" |
// "trade_setup" | "trade_confirmation" | "liquidity_level" | "m5_liquidity_level" |
// "rsi_divergence", genau eine der fünf *_id-Spalten (oder bei den beiden m5/rsi-Snapshot-Kinds die
// jeweiligen Rohdaten-Spalten) ist gesetzt (DB-CHECK-Constraint erzwingt das). ob_zones/
// trade_setups/trade_confirmations/liquidity_levels werden hier direkt mit eingebettet (anders als
// trade_position, das gegen Dashboard.vue's bereits geladene `trades` gekreuzt wird, siehe
// PinPanel.vue) — es gibt sonst keine reaktive Liste dieser Arten in Dashboard.vue, ein Zweit-Fetch
// für die paar Anzeige-Felder ist hier einfacher als eine. Seit Task "Chart-Objekte: OBs auf
// kanonische ob_zones-ID konsolidieren", Punkt 6 (Migration 20260823120000) läuft ein M5-OB-Pin
// über dasselbe kind="ob_zone" wie 1H/4H (find-or-create in ob_zones beim Pinnen, siehe
// addPinM5ObEntry unten) — kein eigener "m5_ob"-Kind mehr.
import { supabase } from "./supabaseClient.js";
import { findOrCreateObZoneId } from "./tradeIntake.js";

// kind -> DB-Spalte, gemeinsam für Upsert-onConflict UND das Zusammensetzen der Insert-Zeile.
// addPinM5ObEntry (unten) löst erst per find-or-create einen ob_zone_id auf und ruft dann ganz
// normal addPinEntry("ob_zone", ...) auf, statt hier eine eigene Zeile zu brauchen.
const REF_COLUMN = {
  trade_position: "trade_position_id",
  ob_zone: "ob_zone_id",
  trade_setup: "trade_setup_id",
  trade_confirmation: "trade_confirmation_id",
  liquidity_level: "liquidity_level_id",
};

const ROW_COLUMNS =
  "id, kind, trade_position_id, ob_zone_id, trade_setup_id, trade_confirmation_id, liquidity_level_id, " +
  "m5_liquidity_instrument, m5_liquidity_timeframe, m5_liquidity_direction, m5_liquidity_price, m5_liquidity_pivot_time, " +
  "rsi_divergence_instrument, rsi_divergence_type, rsi_divergence_from_time, rsi_divergence_to_time, " +
  "rsi_divergence_from_price, rsi_divergence_to_price, rsi_divergence_from_rsi, rsi_divergence_to_rsi, " +
  "note, created_at, " +
  // end_time (Chat 2026-08-18, siehe Task "Pin-Kontext: gepinnte Objekte direkt rendern") — für die
  // Direkt-Rendering-Fallback-Box/-Linie eines gepinnten ob_zone/liquidity_level (siehe
  // PriceChart.vue: refreshPoiZonesInternal/refreshLiquidityInternal), dieselbe Spalte, die
  // detectOrderBlocks()/poi-watcher schon für die Live-Zeichnung berechnen (siehe
  // 20260705240000_ob_zones_end_time.sql/20260717130000_liquidity_levels_end_time.sql) — bisher nur
  // für den mcp-server relevant (dessen getPinContext() `ob_zones(*)`/`liquidity_levels(*)` fetcht),
  // hier bisher nicht mit ausgewählt, weil ungenutzt.
  "ob_zones(id, instrument, direction, timeframe, top, bottom, start_time, end_time, touched, invalidated), " +
  "trade_setups(id, instrument, direction, ob_top, ob_bottom, ob_start_time, ls_touched_time), " +
  "trade_confirmations(id, kind, price, range_low, range_high, touched_time), " +
  "liquidity_levels(id, instrument, direction, timeframe, price, pivot_time, end_time, touched)";

function toEntry(row) {
  return {
    id: row.id,
    kind: row.kind,
    tradePositionId: row.trade_position_id,
    obZoneId: row.ob_zone_id,
    tradeSetupId: row.trade_setup_id,
    tradeConfirmationId: row.trade_confirmation_id,
    liquidityLevelId: row.liquidity_level_id,
    liquidityLevel: row.liquidity_levels
      ? {
          id: row.liquidity_levels.id,
          instrument: row.liquidity_levels.instrument,
          direction: row.liquidity_levels.direction,
          timeframe: row.liquidity_levels.timeframe,
          price: row.liquidity_levels.price,
          pivotTime: row.liquidity_levels.pivot_time,
          touched: row.liquidity_levels.touched,
          endTime: row.liquidity_levels.end_time,
        }
      : null,
    // Rohdaten-Snapshot, kein Embed — nur bei kind='m5_liquidity_level' gesetzt (Liquiditäts-Level
    // auf einem Nicht-1h-Chart-Timeframe, siehe 20260802130000_laniakea_context_m5_liquidity.sql).
    m5Liquidity:
      row.m5_liquidity_instrument != null
        ? {
            instrument: row.m5_liquidity_instrument,
            timeframe: row.m5_liquidity_timeframe,
            direction: row.m5_liquidity_direction,
            price: row.m5_liquidity_price,
            pivotTime: row.m5_liquidity_pivot_time,
          }
        : null,
    // Rohdaten-Snapshot, kein Embed — nur bei kind='rsi_divergence' gesetzt (Divergenzen werden nie
    // persistiert, siehe 20260811170000_laniakea_context_rsi_divergence.sql).
    rsiDivergence:
      row.rsi_divergence_instrument != null
        ? {
            instrument: row.rsi_divergence_instrument,
            type: row.rsi_divergence_type,
            fromTime: row.rsi_divergence_from_time,
            toTime: row.rsi_divergence_to_time,
            fromPrice: row.rsi_divergence_from_price,
            toPrice: row.rsi_divergence_to_price,
            fromRsi: row.rsi_divergence_from_rsi,
            toRsi: row.rsi_divergence_to_rsi,
          }
        : null,
    obZone: row.ob_zones
      ? {
          id: row.ob_zones.id,
          instrument: row.ob_zones.instrument,
          direction: row.ob_zones.direction,
          timeframe: row.ob_zones.timeframe,
          top: row.ob_zones.top,
          bottom: row.ob_zones.bottom,
          startTime: row.ob_zones.start_time,
          endTime: row.ob_zones.end_time,
          touched: row.ob_zones.touched,
          invalidated: row.ob_zones.invalidated,
        }
      : null,
    tradeSetup: row.trade_setups
      ? {
          id: row.trade_setups.id,
          instrument: row.trade_setups.instrument,
          direction: row.trade_setups.direction,
          obTop: row.trade_setups.ob_top,
          obBottom: row.trade_setups.ob_bottom,
          obStartTime: row.trade_setups.ob_start_time,
          lsTouchedTime: row.trade_setups.ls_touched_time,
        }
      : null,
    tradeConfirmation: row.trade_confirmations
      ? {
          id: row.trade_confirmations.id,
          kind: row.trade_confirmations.kind,
          price: row.trade_confirmations.price,
          rangeLow: row.trade_confirmations.range_low,
          rangeHigh: row.trade_confirmations.range_high,
          touchedTime: row.trade_confirmations.touched_time,
        }
      : null,
    note: row.note,
    createdAt: row.created_at,
  };
}

export async function fetchPinContext() {
  const { data, error } = await supabase.from("pin_context").select(ROW_COLUMNS).order("created_at", { ascending: true });
  if (error) {
    console.error("Pin-Kontext laden fehlgeschlagen:", error);
    return [];
  }
  return (data ?? []).map(toEntry);
}

// Upsert auf trade_position_id/ob_zone_id/trade_setup_id (siehe Unique-Indizes in den Migrationen)
// — ein zweiter Rechtsklick auf dasselbe Objekt legt keinen Zweiteintrag an, sondern aktualisiert
// nur dessen Notiz.
export async function addPinEntry(kind, refId, note) {
  const column = REF_COLUMN[kind];
  const { data, error } = await supabase
    .from("pin_context")
    .upsert(
      {
        kind,
        trade_position_id: null,
        ob_zone_id: null,
        trade_setup_id: null,
        trade_confirmation_id: null,
        liquidity_level_id: null,
        [column]: refId,
        note: note || null,
      },
      { onConflict: column },
    )
    .select(ROW_COLUMNS)
    .single();
  if (error) {
    console.error("Pin-Eintrag anlegen fehlgeschlagen:", error);
    return null;
  }
  return toEntry(data);
}

// Seit Task "Chart-Objekte: OBs auf kanonische ob_zones-ID konsolidieren", Punkt 6 (2026-08-23):
// M5-OBs werden beim Pinnen per find-or-create in ob_zones geschrieben (dieselbe Funktion, die
// tradeIntake.js für trade_setups/trade_confirmations nutzt) und landen danach als ganz normaler
// kind="ob_zone"-Eintrag — kein eigener "m5_ob"-Snapshot-Kind mehr. Name/Signatur bleiben
// unverändert (zone: { instrument, dirNum: 1|-1, top, bottom, startTime (Unix-Sekunden) }), damit
// Dashboard.vue/die MCP-Tools nicht angepasst werden müssen.
export async function addPinM5ObEntry(zone, note) {
  const obZoneId = await findOrCreateObZoneId({
    instrument: zone.instrument,
    timeframe: "5M",
    direction: zone.dirNum === 1 ? "long" : "short",
    top: zone.top,
    bottom: zone.bottom,
    startTimeSec: zone.startTime,
  });
  if (obZoneId == null) return null;
  return addPinEntry("ob_zone", obZoneId, note);
}

// Analog zu addPinM5ObEntry, für ein Liquiditäts-Level auf einem Nicht-1h-Chart-Timeframe
// (siehe 20260802130000_laniakea_context_m5_liquidity.sql — der 1h-Fall läuft weiter über
// kind='liquidity_level' + resolveLiquidityLevelId, echte FK). level: { instrument, timeframe
// (props.currentBar, z.B. "5m"), dirNum: 1 (high) | -1 (low), price, pivotTime (Unix-Sekunden) }.
export async function addPinM5LiquidityEntry(level, note) {
  const { data, error } = await supabase
    .from("pin_context")
    .upsert(
      {
        kind: "m5_liquidity_level",
        trade_position_id: null,
        ob_zone_id: null,
        trade_setup_id: null,
        trade_confirmation_id: null,
        liquidity_level_id: null,
        m5_liquidity_instrument: level.instrument,
        m5_liquidity_timeframe: level.timeframe,
        m5_liquidity_direction: level.dirNum === 1 ? "high" : "low",
        m5_liquidity_price: level.price,
        m5_liquidity_pivot_time: new Date(level.pivotTime * 1000).toISOString(),
        note: note || null,
      },
      { onConflict: "m5_liquidity_instrument,m5_liquidity_timeframe,m5_liquidity_direction,m5_liquidity_pivot_time" },
    )
    .select(ROW_COLUMNS)
    .single();
  if (error) {
    console.error("Pin-M5-Liquidity-Eintrag anlegen fehlgeschlagen:", error);
    return null;
  }
  return toEntry(data);
}

// Analog zu addPinM5ObEntry/addPinM5LiquidityEntry, für einen RSI-Divergenz-Konnektor
// (Chat 2026-08-11, siehe 20260811170000_laniakea_context_rsi_divergence.sql) — Divergenzen werden
// nie persistiert (detectRsiDivergence()/detectRsiDivergenceHistory() rechnen live), also wieder
// ein Rohdaten-Snapshot statt einer FK. divergence: das Objekt, wie es rsi.js zurückgibt
// ({type, fromTime, toTime, fromPrice, toPrice, fromRsi, toRsi}, Zeiten in Unix-Sekunden), plus
// instrument (props.symbol — steht selbst nicht auf dem Divergenz-Objekt).
export async function addPinRsiDivergenceEntry(instrument, divergence, note) {
  const { data, error } = await supabase
    .from("pin_context")
    .upsert(
      {
        kind: "rsi_divergence",
        trade_position_id: null,
        ob_zone_id: null,
        trade_setup_id: null,
        trade_confirmation_id: null,
        liquidity_level_id: null,
        rsi_divergence_instrument: instrument,
        rsi_divergence_type: divergence.type,
        rsi_divergence_from_time: new Date(divergence.fromTime * 1000).toISOString(),
        rsi_divergence_to_time: new Date(divergence.toTime * 1000).toISOString(),
        rsi_divergence_from_price: divergence.fromPrice,
        rsi_divergence_to_price: divergence.toPrice,
        rsi_divergence_from_rsi: divergence.fromRsi,
        rsi_divergence_to_rsi: divergence.toRsi,
        note: note || null,
      },
      { onConflict: "rsi_divergence_instrument,rsi_divergence_type,rsi_divergence_from_time,rsi_divergence_to_time" },
    )
    .select(ROW_COLUMNS)
    .single();
  if (error) {
    console.error("Pin-RSI-Divergenz-Eintrag anlegen fehlgeschlagen:", error);
    return null;
  }
  return toEntry(data);
}

export async function removePinEntry(id) {
  const { error } = await supabase.from("pin_context").delete().eq("id", id);
  if (error) {
    console.error("Pin-Eintrag löschen fehlgeschlagen:", error);
    return false;
  }
  return true;
}

export async function updatePinNote(id, note) {
  const { error } = await supabase.from("pin_context").update({ note: note || null }).eq("id", id);
  if (error) {
    console.error("Pin-Notiz speichern fehlgeschlagen:", error);
    return false;
  }
  return true;
}

// Löst eine LIVE erkannte OB-Zone (kein DB-id, siehe PriceChart.vue: collectObsZones/
// detectOrderBlocks für Forex — läuft immer live statt nur die ob_zones-Tabelle zu lesen) auf ihre
// persistierte ob_zones-Zeile auf, per Natural-Key (instrument, timeframe, direction, start_time —
// derselbe Schlüssel wie ob_zones' eigener Unique-Constraint). Liefert null, wenn poi-watcher diese
// Zone noch nicht (oder mit abweichendem start_time) gespeichert hat — z.B. weil sie gerade erst
// entstanden ist und der nächste 1H/4H-Refresh-Tick noch aussteht (siehe CLAUDE.md poi-watcher-
// Throttling). dirNum: 1 (long) | -1 (short), wie im lokalen Zone-Objekt (siehe orderBlocks.js).
export async function resolveObZoneId(instrument, timeframe, dirNum, startTimeUnixSec) {
  const { data, error } = await supabase
    .from("ob_zones")
    .select("id")
    .eq("instrument", instrument)
    .eq("timeframe", timeframe)
    .eq("direction", dirNum === 1 ? "long" : "short")
    .eq("start_time", new Date(startTimeUnixSec * 1000).toISOString())
    .maybeSingle();
  if (error) {
    console.error("OB-Zone auflösen fehlgeschlagen:", error);
    return null;
  }
  return data?.id ?? null;
}

// Analog zu resolveObZoneId, für Liquiditäts-Level: poi-watcher persistiert nur Timeframe '1H'
// (siehe supabase/functions/poi-watcher/index.ts), die live auf dem Chart gezeichnete Linie trägt
// selbst keine DB-id. Natural-Key (instrument, timeframe, direction, pivot_time) wie poi-watchers
// eigener Unique-Constraint. Liefert null, wenn (a) der Chart gerade NICHT im 1h-Timeframe ist (das
// filtert schon PriceChart.vue vor dem Aufruf raus, siehe findNearbyPinCandidates) oder
// (b) poi-watcher dieses Level noch nicht gespeichert hat (frisch entstanden, nächster stündlicher
// Refresh-Tick steht noch aus). dirNum: 1 (high) | -1 (low), wie im lokalen Level-Objekt (siehe
// liquidityDetection.js: buildLevel).
export async function resolveLiquidityLevelId(instrument, timeframe, dirNum, pivotTimeUnixSec) {
  const { data, error } = await supabase
    .from("liquidity_levels")
    .select("id")
    .eq("instrument", instrument)
    .eq("timeframe", timeframe)
    .eq("direction", dirNum === 1 ? "high" : "low")
    .eq("pivot_time", new Date(pivotTimeUnixSec * 1000).toISOString())
    .maybeSingle();
  if (error) {
    console.error("Liquiditäts-Level auflösen fehlgeschlagen:", error);
    return null;
  }
  return data?.id ?? null;
}

// Dieselbe Formel wie orderBlocks.js: obZoneNaturalKey, hier auf einer bereits geladenen
// pin_context-Zeile (row.obZone) statt einer live erkannten Zone — für den Abgleich "ist DIESE
// gerade gezeichnete Zone die gleiche wie dieser gespeicherte Eintrag" (siehe PriceChart.vue,
// renderPersistedZones' pinKeys-Parameter). instrument bewusst NICHT Teil des Strings (der
// Chart zeigt immer nur ein Symbol gleichzeitig, siehe dort).
export function obZoneEntryNaturalKey(obZone) {
  const startTimeUnixSec = Math.floor(new Date(obZone.startTime).getTime() / 1000);
  return `${obZone.timeframe}|${obZone.direction}|${startTimeUnixSec}`;
}

// Analog zu obZoneEntryNaturalKey, für ein 1H-Liquiditäts-Level (row.liquidityLevel, echte DB-
// Zeile) — dieselbe Formel wie liquidity.js: liquidityLevelNaturalKey, hier auf der Embed-Zeile
// statt dem live erkannten Level. timeframe bewusst NICHT Teil des Strings (siehe dortiger
// Kommentar) — Dashboard.vue filtert vorher nach currentBar==="1h", bevor diese Keys in die Menge
// gemischt werden, die an renderLiquidityLevels' pinKeys-Parameter geht.
export function liquidityLevelEntryNaturalKey(liquidityLevel) {
  const pivotTimeUnixSec = Math.floor(new Date(liquidityLevel.pivotTime).getTime() / 1000);
  return `${liquidityLevel.direction === "high" ? "high" : "low"}|${pivotTimeUnixSec}`;
}

// Analog zu liquidityLevelEntryNaturalKey, für ein Liquiditäts-Level auf einem Nicht-1h-Timeframe
// (row.m5Liquidity, reiner Rohdaten-Snapshot, siehe addPinM5LiquidityEntry) — derselbe
// timeframe-lose String-Schlüssel wie beim 1H-Fall, da Dashboard.vue schon vorher nach
// e.m5Liquidity.timeframe === currentBar filtert (immer nur EIN Timeframe gleichzeitig sichtbar).
export function m5LiquidityEntryNaturalKey(m5Liquidity) {
  const pivotTimeUnixSec = Math.floor(new Date(m5Liquidity.pivotTime).getTime() / 1000);
  return `${m5Liquidity.direction === "high" ? "high" : "low"}|${pivotTimeUnixSec}`;
}

// Für einen RSI-Divergenz-Konnektor (row.rsiDivergence, reiner Rohdaten-Snapshot, siehe
// addPinRsiDivergenceEntry) — derselbe Schlüssel-Aufbau wie PriceChart.vue's candidateKey für
// kind='rsi_divergence' (type|fromTime|toTime identifiziert eine Divergenz eindeutig, siehe
// findNearbyPinCandidates), hier auf ISO-Zeiten aus der DB statt den rohen Unix-Sekunden von
// rsi.js: detectRsiDivergence.
export function rsiDivergenceEntryNaturalKey(rsiDivergence) {
  const fromTimeUnixSec = Math.floor(new Date(rsiDivergence.fromTime).getTime() / 1000);
  const toTimeUnixSec = Math.floor(new Date(rsiDivergence.toTime).getTime() / 1000);
  return `${rsiDivergence.type}|${fromTimeUnixSec}|${toTimeUnixSec}`;
}
