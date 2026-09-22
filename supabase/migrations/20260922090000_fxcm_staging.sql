-- Der Vergleich braucht beide Feeds; bestehende cTrader-Zeilen dürfen nicht als FXCM etikettiert werden.
alter table public.forex_candles add column source text not null default 'ctrader';

create table public.fxcm_candles (
  instrument text not null check (instrument in ('GBPUSD', 'EURUSD')),
  bar text not null check (bar in ('1m', '3m', '5m', '15m', '1h', '4h', '1D')),
  time timestamptz not null,
  open numeric not null,
  high numeric not null,
  low numeric not null,
  close numeric not null,
  volume numeric not null check (volume >= 0),
  source text not null default 'fxcm' check (source = 'fxcm'),
  primary key (instrument, bar, time),
  check (low > 0 and low <= open and low <= close and high >= open and high >= close)
);
alter table public.fxcm_candles enable row level security;
create policy "fxcm_candles read" on public.fxcm_candles for select to anon, authenticated using (true);
-- Nur der authentifizierte Ingest-Dienst schreibt; kein öffentlicher Insert-Zugriff.
grant select on public.fxcm_candles to anon, authenticated;
grant all on public.fxcm_candles to service_role;
