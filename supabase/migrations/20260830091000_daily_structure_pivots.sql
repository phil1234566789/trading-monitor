-- Task "Market-Structure-Startpunkt: 1D-Periode-4-Pivots" — persistiert die zuletzt gebildeten
-- 1D-Periode-4-Fraktal-Pivots (Williams-Fractal, siehe _shared/liquidityDetection.ts) für
-- GBPUSD/EURUSD. Dient als fundierter Default-Startpunkt für den 1H-Market-Structure-Algo
-- (marketStructureAnalysis.ts) statt eines rollierenden Lookback-Fensters — siehe CLAUDE.md/
-- src/marketStructureAnalysis.notes.md. Schema-Vorbild: liquidity_levels
-- (20260715120000_liquidity_levels.sql).
--
-- structure_start_time: die tatsächliche 1H-Kerze, deren High/Low dem 1D-Pivot-Preis entspricht
-- (aufgelöst von der neuen daily-structure-pivots-Funktion über resolveStructureStartTime, siehe
-- _shared/resolveStructureStartTime.ts) — eine 1D-Kerze hat selbst keinen Intraday-Zeitpunkt,
-- den der 1H-Algo als Cutoff brauchen kann. Nullable: bleibt vorübergehend leer, falls die
-- zugehörige 1H-Historie zum Zeitpunkt der Erkennung noch nicht (vollständig) archiviert ist.
--
-- touched: wie liquidity_levels.touched (wird von der Fraktal-Erkennung selbst mitgeliefert,
-- siehe buildLevel), aktuell reine Bookkeeping-Spalte ohne aktive Nutzung im Default-Startpunkt-
-- Auswahlpfad — für spätere Chart-/Dashboard-Auswertung vorgehalten (Parität zu liquidity_levels).
create table daily_structure_pivots (
  id bigint generated always as identity primary key,
  instrument text not null,
  direction text not null check (direction in ('high', 'low')),
  price numeric not null,
  pivot_time timestamptz not null,
  structure_start_time timestamptz,
  touched boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (instrument, direction, pivot_time)
);

create trigger daily_structure_pivots_set_updated_at
  before update on daily_structure_pivots
  for each row
  execute function set_updated_at();

alter table daily_structure_pivots enable row level security;

create policy "daily_structure_pivots read-only for anon"
  on daily_structure_pivots for select
  to anon
  using (true);
