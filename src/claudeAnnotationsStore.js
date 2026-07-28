// Persistenter Speicher für Claude-Chart-Annotationen (siehe supabase/migrations/
// 20260728150000_claude_annotations.sql, useClaudeAnnotations.js) — je Insert/Delete direkt
// gegen die Tabelle, kein lokales Mutieren + Full-Resync (analog zu newsEvents.js), weil sonst
// zwei parallel offene Tabs sich beim Speichern gegenseitig überschreiben könnten.
import { supabase } from "./supabaseClient.js";

export async function fetchClaudeAnnotations(instrument, dateStr) {
  const { data, error } = await supabase
    .from("claude_annotations")
    .select("id, instrument, date, annotations, created_at")
    .eq("instrument", instrument)
    .eq("date", dateStr)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("Claude-Annotationen laden fehlgeschlagen:", error);
    return [];
  }
  return data ?? [];
}

export async function addClaudeAnnotationDrawing(instrument, dateStr, annotations) {
  const { data, error } = await supabase
    .from("claude_annotations")
    .insert({ instrument, date: dateStr, annotations })
    .select("id, instrument, date, annotations, created_at")
    .single();
  if (error) {
    console.error("Claude-Annotation anlegen fehlgeschlagen:", error);
    return null;
  }
  return data;
}

export async function removeClaudeAnnotationDrawing(id) {
  const { error } = await supabase.from("claude_annotations").delete().eq("id", id);
  if (error) {
    console.error("Claude-Annotation löschen fehlgeschlagen:", error);
    return false;
  }
  return true;
}
