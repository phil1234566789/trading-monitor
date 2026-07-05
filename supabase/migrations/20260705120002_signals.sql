-- D1: signals — Log aller Entry-Signale (Backtest, Paper-Trading und spaeter Live)
-- 'source' erlaubt dieselbe Tabelle fuer Phase A/B (Backtest/Paper) und Phase D
-- (Live) zu nutzen, wie in Phase C (Dashboard-Visualisierung) vorgesehen.

create table signals (
  id bigint generated always as identity primary key,
  instrument text not null,
  source text not null check (source in ('backtest', 'paper', 'live')),
  zone_id bigint references ob_zones (id),
  triggered_at timestamptz not null default now(),
  direction text not null check (direction in ('long', 'short')),
  entry_price numeric not null,
  stop_loss numeric not null,
  take_profit numeric,
  reasoning text,
  outcome text check (outcome in ('win', 'loss', 'open', 'invalid')),
  r_multiple numeric,
  notified boolean not null default false,
  notified_at timestamptz,
  created_at timestamptz not null default now()
);

create index signals_instrument_source_idx on signals (instrument, source);

alter table signals enable row level security;

create policy "signals read-only for anon"
  on signals for select
  to anon
  using (true);
