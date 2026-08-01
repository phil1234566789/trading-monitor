// Laniakea-Kontext (Chat 2026-08-01, siehe supabase/migrations/20260801120000_laniakea_context.sql):
// trade_positions, die Philip per Rechtsklick (Trades-Tabelle ODER Chart-Marker) "an Lana
// übergeben" hat — schlanker Supabase-Wrapper wie claudeAnnotationsStore.js, kein
// localStorage-Sync nötig (das hier sind Live-Daten, keine Einstellung). Reaktives Halten der
// Liste übernimmt der Aufrufer (Dashboard.vue) via usePolledFetch, wie bei fetchTrades.
import { supabase } from "./supabaseClient.js";

const ROW_COLUMNS = "id, trade_position_id, note, created_at";

// DB liefert snake_case-Spalten, der Rest von trading-monitor (siehe trades.js: fetchTrades)
// arbeitet mit camelCase JS-Feldern — hier gemappt statt an jeder Konsumstelle (LaniakeaPanel.vue,
// Dashboard.vue) mit trade_position_id hantieren zu müssen.
function toEntry(row) {
  return { id: row.id, tradePositionId: row.trade_position_id, note: row.note, createdAt: row.created_at };
}

export async function fetchLaniakeaContext() {
  const { data, error } = await supabase.from("laniakea_context").select(ROW_COLUMNS).order("created_at", { ascending: true });
  if (error) {
    console.error("Laniakea-Kontext laden fehlgeschlagen:", error);
    return [];
  }
  return (data ?? []).map(toEntry);
}

// Upsert auf trade_position_id (siehe Unique-Index in der Migration) — ein zweiter Rechtsklick
// auf einen bereits aufgenommenen Trade legt keinen Zweiteintrag an, sondern aktualisiert nur
// dessen Notiz.
export async function addLaniakeaEntry(tradePositionId, note) {
  const { data, error } = await supabase
    .from("laniakea_context")
    .upsert({ trade_position_id: tradePositionId, note: note || null }, { onConflict: "trade_position_id" })
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
