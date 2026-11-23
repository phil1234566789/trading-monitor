-- Kausale LS-Auswahl des LQ-Algos (src/liquiditySweepSelection.js) je DOB-Paar-Start für den dob-watcher: einmal rechnen und speichern statt
-- jede Minute 15000 M5 laden und den LQ-Algo bauen (Edge-CPU-Limit). result null = kein gültiger Sweep. Neue Tabelle, rein additiv.
create table public.dob_ls_selections (
  instrument text not null,
  version text not null,
  dir smallint not null check (dir in (1, -1)),
  before_time timestamptz not null,
  result jsonb,
  created_at timestamptz not null default now(),
  primary key (instrument, version, dir, before_time)
);

alter table public.dob_ls_selections enable row level security;
create policy dob_ls_selections_read on public.dob_ls_selections for select to anon, authenticated using (true);
grant select on public.dob_ls_selections to anon, authenticated;
grant all on public.dob_ls_selections to service_role;
