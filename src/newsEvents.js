import { reactive } from "vue";
import { supabase } from "./supabaseClient.js";
import { fetchAllRows } from "./dbReadPaging.js";
export { NEWS_NOGO_WINDOW_MINUTES, newsEventsForInstrument, currentNewsNoGo } from "./newsEventRules.js";

// Wirtschafts-News als No-Go fürs Trade-Setup-Cockpit (Chat 2026-07-26) — normalerweise trägt
// Claude die Termine per Daten-Migration ein (siehe supabase/migrations/20260726120000_news_events.sql),
// aus einem ForexFactory-Screenshot. Seit 20260726150000_news_events_anon_write.sql gibt es
// zusätzlich einen manuellen Weg über NewsModal.vue (Chat: "wo kann ich manuell die News eintragen,
// wenn mir mal die claude tokens ausgehen") — addNewsEvent/removeNewsEvent unten schreiben direkt,
// pro Zeile, NICHT als "alles löschen und neu schreiben" wie sessions.js: Migration- und
// Browser-Einträge leben nebeneinander in derselben Tabelle, ein Full-Resync würde die per
// Migration eingetragenen Zeilen beim nächsten Browser-Save zerstören.
export const newsEvents = reactive([]);

// Nur einmal beim Laden synchronisiert, kein periodisches Re-Poll (wie sessions.js/chartColors.js
// — dort unkritisch, weil der Browser selbst die Quelle für Änderungen ist; hier ist das
// akzeptiert, weil Termine i.d.R. Tage im Voraus eingetragen werden, lange bevor ein offener Tab
// sie bräuchte. Ein einfacher Reload holt neu eingetragene Termine).
export async function syncNewsEvents() {
  try {
    // KEIN "event_time >= vor kurzem"-Filter (erste Version hatte einen, siehe Git-Historie) — die
    // Chart-Marker (newsMarkers.js) wollen auch länger zurückliegende Termine noch anzeigen können
    // (rückblickend nachvollziehen, ob ein Preis-Sprung mit einer News zusammenhing), nicht nur der
    // No-Go-Check braucht die Daten. Die Tabelle bleibt klein genug (ein paar Termine/Woche, von
    // Philip per Screenshot eingetragen), dass "alles laden" unproblematisch ist.
    // Paginiert, weil hier absichtlich ALLES geholt wird: ein paar Termine pro Woche erreichen den
    // PostgREST-Deckel von ~1000 Zeilen in gut zwei Jahren, und dann fehlten ohne Fehlermeldung
    // die jüngsten — also genau die, die der No-Go-Check braucht.
    const { data, error } = await fetchAllRows((from, to) => supabase
      .from("news_events").select("id, event_time, currency, title").order("event_time").range(from, to));
    if (error) throw error;
    newsEvents.splice(
      0,
      newsEvents.length,
      ...(data ?? []).map((r) => ({ id: r.id, eventTime: Math.floor(new Date(r.event_time).getTime() / 1000), currency: r.currency, title: r.title })),
    );
    return true;
  } catch (err) {
    console.error("News-Events aus DB laden fehlgeschlagen:", err);
    return false;
  }
}
syncNewsEvents();

// Für NewsModal.vue (manueller Eintragungsweg) — je ein direkter Insert/Delete statt lokalem
// Mutieren + Full-Resync (siehe Kommentar oben), danach einfach neu laden statt den lokalen Stand
// von Hand nachzuführen (die Tabelle ist klein, ein Re-Fetch ist billig).
export async function addNewsEvent({ eventTime, currency, title }) {
  const { error } = await supabase.from("news_events").insert({ event_time: new Date(eventTime * 1000).toISOString(), currency, title });
  if (error) {
    console.error("News-Event anlegen fehlgeschlagen:", error);
    return false;
  }
  await syncNewsEvents();
  return true;
}

export async function removeNewsEvent(id) {
  const { error } = await supabase.from("news_events").delete().eq("id", id);
  if (error) {
    console.error("News-Event löschen fehlgeschlagen:", error);
    return false;
  }
  await syncNewsEvents();
  return true;
}
