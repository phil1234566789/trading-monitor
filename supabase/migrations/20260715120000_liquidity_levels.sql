-- 1H Fractal-Liquiditäts-Level (siehe src/liquidity.js / tv-indikator/src/liquidity.pine)
-- für GBPUSD/EURUSD — Telegram-Alarm im poi-watcher, sobald ein Level zum ersten Mal
-- angetestet/geswept wird. Analog zu ob_zones, aber ohne end_time (kein Chart-Rendering
-- aus dieser Tabelle, nur Alarm-Bookkeeping).

create table liquidity_levels (
  id bigint generated always as identity primary key,
  instrument text not null,
  timeframe text not null check (timeframe in ('1H')),
  direction text not null check (direction in ('high', 'low')),
  price numeric not null,
  pivot_time timestamptz not null,
  touched boolean not null default false,
  notified boolean not null default false,
  notified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (instrument, timeframe, direction, pivot_time)
);

create index liquidity_levels_instrument_untouched_idx
  on liquidity_levels (instrument)
  where not touched;

create trigger liquidity_levels_set_updated_at
  before update on liquidity_levels
  for each row
  execute function set_updated_at();

alter table liquidity_levels enable row level security;

create policy "liquidity_levels read-only for anon"
  on liquidity_levels for select
  to anon
  using (true);
