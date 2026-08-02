// Laniakea-Kontext (Chat 2026-08-01, siehe supabase/migrations/20260801120000_laniakea_context.sql,
// 20260801130000_laniakea_context_ob_zones.sql): Dinge, die Philip per Rechtsklick (Trades-Tabelle/
// Chart-Marker/OB-Zonen-Box) "an Lana übergeben" hat — schlanker Supabase-Wrapper wie
// claudeAnnotationsStore.js, kein localStorage-Sync nötig (das hier sind Live-Daten, keine
// Einstellung). Reaktives Halten der Liste übernimmt der Aufrufer (Dashboard.vue) via
// usePolledFetch, wie bei fetchTrades.
//
// Polymorph seit der zweiten bis sechsten Migration: kind = "trade_position" | "ob_zone" |
// "trade_setup" | "trade_confirmation" | "liquidity_level" | "m5_ob", genau eine der fünf *_id-
// Spalten (oder bei "m5_ob" die m5_ob_*-Rohdaten-Spalten) ist gesetzt (DB-CHECK-Constraint erzwingt
// das). ob_zones/trade_setups/trade_confirmations/liquidity_levels werden hier direkt mit
// eingebettet (anders als trade_position, das gegen Dashboard.vue's bereits geladene `trades`
// gekreuzt wird, siehe LaniakeaPanel.vue) — es gibt sonst keine reaktive Liste dieser Arten in
// Dashboard.vue, ein Zweit-Fetch für die paar Anzeige-Felder ist hier einfacher als eine. "m5_ob"
// braucht kein Embed — M5-OBs werden nie persistiert (siehe resolveObZoneId-Kommentar unten),
// deshalb liegt hier ein Rohdaten-Snapshot direkt auf der laniakea_context-Zeile selbst (siehe
// 20260802120100_laniakea_context_m5_obs.sql).
import { supabase } from "./supabaseClient.js";

// kind -> DB-Spalte, gemeinsam für Upsert-onConflict UND das Zusammensetzen der Insert-Zeile.
// "m5_ob" fehlt hier bewusst (kein einzelner refId, siehe addLaniakeaM5ObEntry unten).
const REF_COLUMN = {
  trade_position: "trade_position_id",
  ob_zone: "ob_zone_id",
  trade_setup: "trade_setup_id",
  trade_confirmation: "trade_confirmation_id",
  liquidity_level: "liquidity_level_id",
};

const ROW_COLUMNS =
  "id, kind, trade_position_id, ob_zone_id, trade_setup_id, trade_confirmation_id, liquidity_level_id, " +
  "m5_ob_instrument, m5_ob_direction, m5_ob_top, m5_ob_bottom, m5_ob_start_time, " +
  "m5_liquidity_instrument, m5_liquidity_timeframe, m5_liquidity_direction, m5_liquidity_price, m5_liquidity_pivot_time, " +
  "note, created_at, " +
  "ob_zones(id, instrument, direction, timeframe, top, bottom, start_time, touched, invalidated), " +
  "trade_setups(id, instrument, direction, ob_top, ob_bottom, ob_start_time, ls_touched_time), " +
  "trade_confirmations(id, kind, price, range_low, range_high, touched_time), " +
  "liquidity_levels(id, instrument, direction, timeframe, price, pivot_time, touched)";

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
        }
      : null,
    // Rohdaten-Snapshot, kein Embed (siehe ROW_COLUMNS-Kommentar) — nur bei kind='m5_ob' gesetzt.
    m5Ob:
      row.m5_ob_instrument != null
        ? {
            instrument: row.m5_ob_instrument,
            direction: row.m5_ob_direction,
            top: row.m5_ob_top,
            bottom: row.m5_ob_bottom,
            startTime: row.m5_ob_start_time,
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
    obZone: row.ob_zones
      ? {
          id: row.ob_zones.id,
          instrument: row.ob_zones.instrument,
          direction: row.ob_zones.direction,
          timeframe: row.ob_zones.timeframe,
          top: row.ob_zones.top,
          bottom: row.ob_zones.bottom,
          startTime: row.ob_zones.start_time,
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

export async function fetchLaniakeaContext() {
  const { data, error } = await supabase.from("laniakea_context").select(ROW_COLUMNS).order("created_at", { ascending: true });
  if (error) {
    console.error("Laniakea-Kontext laden fehlgeschlagen:", error);
    return [];
  }
  return (data ?? []).map(toEntry);
}

// Upsert auf trade_position_id/ob_zone_id/trade_setup_id (siehe Unique-Indizes in den Migrationen)
// — ein zweiter Rechtsklick auf dasselbe Objekt legt keinen Zweiteintrag an, sondern aktualisiert
// nur dessen Notiz.
export async function addLaniakeaEntry(kind, refId, note) {
  const column = REF_COLUMN[kind];
  const { data, error } = await supabase
    .from("laniakea_context")
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
    console.error("Laniakea-Eintrag anlegen fehlgeschlagen:", error);
    return null;
  }
  return toEntry(data);
}

// "m5_ob" passt nicht ins REF_COLUMN/addLaniakeaEntry-Schema (kein einzelner refId — M5-OBs werden
// nie persistiert, siehe 20260802120100_laniakea_context_m5_obs.sql), deshalb eigene Funktion mit
// Upsert auf den Natural-Key (instrument, direction, top, bottom, startTime) statt einer DB-id.
// zone: { instrument, dirNum: 1|-1, top, bottom, startTime (Unix-Sekunden) }.
export async function addLaniakeaM5ObEntry(zone, note) {
  const { data, error } = await supabase
    .from("laniakea_context")
    .upsert(
      {
        kind: "m5_ob",
        trade_position_id: null,
        ob_zone_id: null,
        trade_setup_id: null,
        trade_confirmation_id: null,
        liquidity_level_id: null,
        m5_ob_instrument: zone.instrument,
        m5_ob_direction: zone.dirNum === 1 ? "long" : "short",
        m5_ob_top: zone.top,
        m5_ob_bottom: zone.bottom,
        m5_ob_start_time: new Date(zone.startTime * 1000).toISOString(),
        note: note || null,
      },
      { onConflict: "m5_ob_instrument,m5_ob_direction,m5_ob_top,m5_ob_bottom,m5_ob_start_time" },
    )
    .select(ROW_COLUMNS)
    .single();
  if (error) {
    console.error("Laniakea-M5-OB-Eintrag anlegen fehlgeschlagen:", error);
    return null;
  }
  return toEntry(data);
}

// Analog zu addLaniakeaM5ObEntry, für ein Liquiditäts-Level auf einem Nicht-1h-Chart-Timeframe
// (siehe 20260802130000_laniakea_context_m5_liquidity.sql — der 1h-Fall läuft weiter über
// kind='liquidity_level' + resolveLiquidityLevelId, echte FK). level: { instrument, timeframe
// (props.currentBar, z.B. "5m"), dirNum: 1 (high) | -1 (low), price, pivotTime (Unix-Sekunden) }.
export async function addLaniakeaM5LiquidityEntry(level, note) {
  const { data, error } = await supabase
    .from("laniakea_context")
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
    console.error("Laniakea-M5-Liquidity-Eintrag anlegen fehlgeschlagen:", error);
    return null;
  }
  return toEntry(data);
}

export async function removeLaniakeaEntry(id) {
  const { error } = await supabase.from("laniakea_context").delete().eq("id", id);
  if (error) {
    console.error("Laniakea-Eintrag löschen fehlgeschlagen:", error);
    return false;
  }
  return true;
}

export async function updateLaniakeaNote(id, note) {
  const { error } = await supabase.from("laniakea_context").update({ note: note || null }).eq("id", id);
  if (error) {
    console.error("Laniakea-Notiz speichern fehlgeschlagen:", error);
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
// filtert schon PriceChart.vue vor dem Aufruf raus, siehe findNearbyLaniakeaCandidates) oder
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
// laniakea_context-Zeile (row.obZone) statt einer live erkannten Zone — für den Abgleich "ist DIESE
// gerade gezeichnete Zone die gleiche wie dieser gespeicherte Eintrag" (siehe PriceChart.vue,
// renderPersistedZones' laniakeaKeys-Parameter). instrument bewusst NICHT Teil des Strings (der
// Chart zeigt immer nur ein Symbol gleichzeitig, siehe dort).
export function obZoneEntryNaturalKey(obZone) {
  const startTimeUnixSec = Math.floor(new Date(obZone.startTime).getTime() / 1000);
  return `${obZone.timeframe}|${obZone.direction}|${startTimeUnixSec}`;
}
