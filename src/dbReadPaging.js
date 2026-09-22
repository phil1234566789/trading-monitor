// Frontend-Zwilling von supabase/functions/_shared/fetchAllRows.ts — Browser-Bundle und Deno
// teilen keinen Build, deshalb bewusst zwei Kopien; eine Änderung hier gehört auch dorthin.
//
// PostgREST deckelt jede Antwort server-seitig bei ~1000 Zeilen, ohne Fehler und ohne Log
// (CLAUDE.md-Gotcha). `data.length < DB_READ_PAGE_SIZE` ist deshalb KEIN verlässliches
// "letzte Seite"-Signal — es kann genauso gut der Deckel sein. Der Cursor wandert um die
// TATSÄCHLICH gelieferte Zeilenzahl weiter, und nur eine wirklich leere Seite beendet die Schleife.
export const DB_READ_PAGE_SIZE = 1000;

// buildQuery(from, to) muss eine Supabase-Kette mit .range(from, to) und stabiler Sortierung
// liefern — ohne `order` ist die physische Reihenfolge nicht seitenübergreifend stabil.
export async function fetchAllRows(buildQuery) {
  const rows = [];
  for (;;) {
    const { data, error } = await buildQuery(rows.length, rows.length + DB_READ_PAGE_SIZE - 1);
    if (error) return { data: null, error };
    if (!data?.length) return { data: rows, error: null };
    rows.push(...data);
  }
}
