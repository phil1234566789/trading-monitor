// Persistenter Speicher für Chart-Zeichnungen (siehe supabase/migrations/
// 20260728150000_claude_annotations.sql, useDrawings.js) — je Insert/Delete direkt
// gegen die Tabelle, kein lokales Mutieren + Full-Resync (analog zu newsEvents.js), weil sonst
// zwei parallel offene Tabs sich beim Speichern gegenseitig überschreiben könnten.
// Tabelle und MCP-Tool heißen weiterhin claude_annotations/post_chart_annotations: das ist der
// Draht zu Lana (Tool-Name steht in den Trading-Steps im trading-Repo), der beim Umbenennen des
// UI-Begriffs "Claude-Notizen" -> "Zeichnungen" am 23.09.2026 bewusst unangetastet blieb.
import { supabase } from "./supabaseClient.js";

const ROW_COLUMNS = "id, instrument, date, title, annotations, visible, created_at";

export async function fetchDrawings(instrument, dateStr) {
  const { data, error } = await supabase
    .from("claude_annotations")
    .select(ROW_COLUMNS)
    .eq("instrument", instrument)
    .eq("date", dateStr)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("Claude-Annotationen laden fehlgeschlagen:", error);
    return [];
  }
  return data ?? [];
}

export async function addDrawing(instrument, dateStr, annotations, title) {
  const { data, error } = await supabase
    .from("claude_annotations")
    .insert({ instrument, date: dateStr, annotations, title })
    .select(ROW_COLUMNS)
    .single();
  if (error) {
    console.error("Claude-Annotation anlegen fehlgeschlagen:", error);
    return null;
  }
  return data;
}

export async function removeDrawing(id) {
  const { error } = await supabase.from("claude_annotations").delete().eq("id", id);
  if (error) {
    console.error("Claude-Annotation löschen fehlgeschlagen:", error);
    return false;
  }
  return true;
}

// Pro-Zeichnung-Toggle (Feature 2026-07-30) — zusätzlich zum bestehenden globalen Sichtbarkeits-
// Toggle in App.vue, der alle Zeichnungen auf einmal aus-/einblendet.
export async function updateDrawingVisible(id, visible) {
  const { error } = await supabase.from("claude_annotations").update({ visible }).eq("id", id);
  if (error) {
    console.error("Claude-Annotation Sichtbarkeit ändern fehlgeschlagen:", error);
    return false;
  }
  return true;
}
