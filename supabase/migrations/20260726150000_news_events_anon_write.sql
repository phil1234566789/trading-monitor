-- Manueller Eintragungsweg als Fallback (Chat 2026-07-26: "wo kann ich manuell die News eintragen,
-- wenn mir mal die claude tokens ausgehen o.ä.") — die ursprüngliche Migration
-- (20260726120000_news_events.sql) hatte bewusst NUR eine anon-READ-Policy, weil Claude Termine
-- ausschließlich per Daten-Migration einträgt. Jetzt kommt ein zweiter Weg dazu: ein NewsModal.vue
-- im Dashboard (analog zu SessionsModal.vue), das direkt aus dem Browser schreibt — dafür braucht
-- anon jetzt auch insert/update/delete, wie bei sessions/chart_colors/trading_schedules. Beide Wege
-- (Migration UND Browser) schreiben dieselbe Tabelle nebeneinander, ohne Konflikt, weil jede Zeile
-- einzeln per id ge-inserted/gelöscht wird (kein "alles löschen und neu schreiben" wie bei
-- sessions.js — das würde die per Migration eingetragenen Zeilen beim nächsten Browser-Save
-- zerstören).
create policy "news_events write for anon"
  on news_events for all
  to anon
  using (true)
  with check (true);
