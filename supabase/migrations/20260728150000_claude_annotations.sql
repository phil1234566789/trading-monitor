-- Persistenter Speicher für Claude-Chart-Annotationen (siehe src/claudeAnnotations.js,
-- ClaudeAnnotationsModal.vue) — vorher nur ein In-Memory-Singleton (useClaudeAnnotations.js), der
-- beim Modal-Schließen/Neuöffnen den zuletzt gepasteten Text verlor (Chat 2026-07-28: "wenn claude
-- mir durch einen chat-verlauf mehrere unterschiedliche zeichnungen gibt, dann verliere ich in
-- claude-notizen immer die letzte zeichnung"). Jede "Zeichnen"-Aktion legt jetzt eine EIGENE Zeile
-- an (annotations = das komplette geparste Array dieses einen Imports), statt die vorherige
-- Zeichnung zu überschreiben — mehrere Zeichnungen desselben Tages akkumulieren sich so über einen
-- ganzen Chat-Verlauf hinweg, statt sich gegenseitig zu ersetzen.
--
-- date ist der Berlin-Kalendertag, den trading-monitor beim Klick auf "Zeichnen" gerade anzeigt
-- (Replay-Tag, falls Replay aktiv, sonst heute — siehe berlinDateStrFor/useClaudeAnnotations.js),
-- NICHT zwingend das Datum, auf das sich einzelne Annotationen per "YYYY-MM-DD HH:mm" im time-Feld
-- beziehen (siehe backtest-instructions.md) — das sind zwei unabhängige Konzepte: date hier ist nur
-- der Zuordnungs-/Filter-Schlüssel fürs Laden (welche Zeichnungen zeigt trading-monitor gerade an).
--
-- Kein editieren (CRUD ohne "U") — Philip: "in diesem CRUD Fall brauch ich editieren nicht, da es
-- ja von Claude kommt", nur anlegen/löschen.
create table claude_annotations (
  id bigint generated always as identity primary key,
  instrument text not null,
  date date not null,
  annotations jsonb not null,
  created_at timestamptz not null default now()
);

create index claude_annotations_instrument_date on claude_annotations (instrument, date);

-- Schreibzugriff für anon (wie sessions/chart_colors/trading_schedules), weil das Dashboard direkt
-- aus dem Browser speichert — unkritisch, single-user App.
alter table claude_annotations enable row level security;

create policy "claude_annotations read for anon"
  on claude_annotations for select
  to anon
  using (true);

create policy "claude_annotations write for anon"
  on claude_annotations for all
  to anon
  using (true)
  with check (true);
