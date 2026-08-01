// Laniakea-Kontext (Chat 2026-08-01, siehe supabase/migrations/20260801120000_laniakea_context.sql,
// 20260801130000_laniakea_context_ob_zones.sql): Dinge, die Philip per Rechtsklick (Trades-Tabelle/
// Chart-Marker/OB-Zonen-Box) "an Lana übergeben" hat — schlanker Supabase-Wrapper wie
// claudeAnnotationsStore.js, kein localStorage-Sync nötig (das hier sind Live-Daten, keine
// Einstellung). Reaktives Halten der Liste übernimmt der Aufrufer (Dashboard.vue) via
// usePolledFetch, wie bei fetchTrades.
//
// Polymorph seit der zweiten Migration: kind = "trade_position" | "ob_zone", genau eine der beiden
// *_id-Spalten ist gesetzt (DB-CHECK-Constraint erzwingt das). ob_zones wird hier direkt mit
// eingebettet (anders als trade_position, das gegen Dashboard.vue's bereits geladene `trades`
// gekreuzt wird, siehe LaniakeaPanel.vue) — es gibt sonst keine reaktive OB-Zonen-Liste in
// Dashboard.vue, ein Zweit-Fetch für die paar Anzeige-Felder ist hier einfacher als eine.
import { supabase } from "./supabaseClient.js";

const ROW_COLUMNS =
  "id, kind, trade_position_id, ob_zone_id, note, created_at, ob_zones(id, instrument, direction, timeframe, top, bottom, start_time, touched, invalidated)";

function toEntry(row) {
  return {
    id: row.id,
    kind: row.kind,
    tradePositionId: row.trade_position_id,
    obZoneId: row.ob_zone_id,
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

// Upsert auf trade_position_id/ob_zone_id (siehe Unique-Indizes in den Migrationen) — ein zweiter
// Rechtsklick auf dasselbe Objekt legt keinen Zweiteintrag an, sondern aktualisiert nur dessen Notiz.
export async function addLaniakeaEntry(kind, refId, note) {
  const isObZone = kind === "ob_zone";
  const { data, error } = await supabase
    .from("laniakea_context")
    .upsert(
      { kind, trade_position_id: isObZone ? null : refId, ob_zone_id: isObZone ? refId : null, note: note || null },
      { onConflict: isObZone ? "ob_zone_id" : "trade_position_id" },
    )
    .select(ROW_COLUMNS)
    .single();
  if (error) {
    console.error("Laniakea-Eintrag anlegen fehlgeschlagen:", error);
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

// Dieselbe Formel wie orderBlocks.js: obZoneNaturalKey, hier auf einer bereits geladenen
// laniakea_context-Zeile (row.obZone) statt einer live erkannten Zone — für den Abgleich "ist DIESE
// gerade gezeichnete Zone die gleiche wie dieser gespeicherte Eintrag" (siehe PriceChart.vue,
// renderPersistedZones' laniakeaKeys-Parameter). instrument bewusst NICHT Teil des Strings (der
// Chart zeigt immer nur ein Symbol gleichzeitig, siehe dort).
export function obZoneEntryNaturalKey(obZone) {
  const startTimeUnixSec = Math.floor(new Date(obZone.startTime).getTime() / 1000);
  return `${obZone.timeframe}|${obZone.direction}|${startTimeUnixSec}`;
}
