-- Trading-Konten (Chat 2026-07-30: "Sieh es wie eine Trennung zwischen Demo-Account und
-- Live-Account ... Trades OPTIONAL per FK verbinden") — Philip will testweise BTC-Trades von
-- seinen echten Forex-Trades (10k-Challenge-Konto) trennen können, ohne dafür eine komplett
-- eigene Trades-Tabelle zu pflegen. trading_account_id ist bewusst NULLABLE statt eine Migration
-- zu erzwingen, die für jeden Alt-Trade irgendein Konto raten müsste — die Backfill-Zuordnung
-- unten ist reine Best-Effort-Historie (siehe Begründung je UPDATE), kein Beweis, dass jeder Trade
-- wirklich zu genau diesem Konto gehört.
create table trading_accounts (
  id bigint generated always as identity primary key,
  name text not null,
  notes text,
  created_at timestamptz not null default now()
);

alter table trading_accounts enable row level security;

-- Gleiches permissives anon-Modell wie sessions/chart_colors/trading_schedules (Single-User-App,
-- RLS gated nur auf die Rolle, siehe CLAUDE.md) — die neue "Konten"-Seite braucht volles CRUD
-- direkt aus dem Browser.
create policy "trading_accounts anon all"
  on trading_accounts for all
  to anon
  using (true)
  with check (true);

alter table signals
  add column trading_account_id bigint references trading_accounts (id) on delete set null;

-- Seed + Backfill: Philip handelt GBPUSD/EURUSD auf seiner echten 10k-Challenge, BTC-USDT bisher
-- nur testweise (Chat 2026-07-30) — alle bisherigen Trades lassen sich also rein über das
-- Instrument eindeutig zuordnen, ohne Rückfrage nötig.
insert into trading_accounts (name, notes) values
  ('10k Challenge', 'Echtes Forex-Challenge-Konto (GBPUSD/EURUSD).'),
  ('Test-Konto', 'BTC-USDT — bisher nur testweise, kein echtes Konto dahinter.');

update signals
set trading_account_id = (select id from trading_accounts where name = '10k Challenge')
where instrument in ('GBPUSD', 'EURUSD');

update signals
set trading_account_id = (select id from trading_accounts where name = 'Test-Konto')
where instrument = 'BTC-USDT';
