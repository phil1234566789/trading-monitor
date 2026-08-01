-- Laniakea-Kontext (Chat 2026-08-01): Philip nimmt per Rechtsklick (Trades-Tabelle ODER Chart-
-- Marker) einzelne trade_positions in einen persistenten "das will ich Lana zeigen"-Kontext auf.
-- Der lokale MCP-Server exponiert diese Tabelle als get_laniakea_context-Tool, damit die
-- Trading-Sparringspartnerin-Persona (/l) genau die Trades fetchen kann, auf die Philip gerade
-- hinweisen will, statt Screenshots/Preise abzutippen (siehe PLAN "Laniakea-Kontext" 2026-08-01).
--
-- Nur eine Referenz (trade_position_id), kein Daten-Snapshot — Lana liest beim Fetch immer die
-- aktuellen trade_positions/dealing_ranges-Werte (wie get_journal es schon tut), keine
-- Divergenz-Gefahr durch nachträgliche Trade-Edits.
--
-- trade_position_id statt einer generischen kind/item_id-Polymorphie: v1 deckt nur trade_position
-- ab (Philip hat weitere Objekt-Arten wie OB-Zonen/LQ-Level/EMA für später angekündigt) — eine
-- echte FK mit Cascade-Delete ist einfacher/sicherer als eine Polymorphie ohne FK-Constraint;
-- wenn die zweite Art tatsächlich kommt, ist der Migrationsschritt "kind-Spalte ergänzen,
-- trade_position_id nullable machen" kein Rewrite dieser Tabelle.
create table laniakea_context (
  id bigint generated always as identity primary key,
  trade_position_id bigint not null references trade_positions (id) on delete cascade,
  note text,
  created_at timestamptz not null default now()
);

-- Ein Trade kann nicht doppelt im Kontext landen — ein zweiter Rechtsklick auf einen bereits
-- aufgenommenen Trade aktualisiert stattdessen den bestehenden Eintrag (siehe addLaniakeaEntry
-- in src/laniakeaContext.js: Upsert auf trade_position_id).
create unique index laniakea_context_trade_position_id_key on laniakea_context (trade_position_id);

-- Schreibzugriff für anon (wie claude_annotations/sessions/chart_colors), weil das Dashboard
-- direkt aus dem Browser speichert — unkritisch, single-user App.
alter table laniakea_context enable row level security;

create policy "laniakea_context read for anon"
  on laniakea_context for select
  to anon
  using (true);

create policy "laniakea_context write for anon"
  on laniakea_context for all
  to anon
  using (true)
  with check (true);
