-- Session-Indikator (Chart-Hintergrundbänder, siehe src/sessions.js) geräteübergreifend
-- synchron statt nur pro Browser in localStorage — analog zu chart_colors (Chat 2026-07-23:
-- "leider war der session indikator leer, den ich auf meinem haupt pc schon eingestellt
-- hab"). Anders als chart_colors (fester Key-Satz) ist das hier eine dynamische LISTE mit
-- Hinzufügen/Löschen, daher `id` als Primärschlüssel statt eines festen Key-Schemas.
create table sessions (
  id text primary key,
  label text not null,
  from_minutes int not null,
  to_minutes int not null,
  hex text not null,
  alpha double precision not null default 0.08,
  high_low_relevant boolean not null default true,
  updated_at timestamptz not null default now()
);

create trigger sessions_set_updated_at
  before update on sessions
  for each row
  execute function set_updated_at();

-- Schreibzugriff für anon (wie chart_colors/alarm_settings), weil das Dashboard direkt aus
-- dem Browser speichert — unkritisch, reine Darstellungs-Präferenz ohne sensible Daten.
alter table sessions enable row level security;

create policy "sessions read for anon"
  on sessions for select
  to anon
  using (true);

create policy "sessions write for anon"
  on sessions for all
  to anon
  using (true)
  with check (true);
