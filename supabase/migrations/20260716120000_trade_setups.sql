-- Trade-Setups: Liquidity Sweep + Protected M5-Fraktal + bestätigendes M5-OB, in dieser
-- Reihenfolge (siehe tv-indikator/src/tradesetup.pine, portiert nach
-- supabase/functions/_shared/tradeSetup.ts). Ein Setup ist durch (instrument, direction,
-- fractal_pivot_time) eindeutig identifiziert — sobald das Fraktal bricht (touched=true),
-- taucht es nicht mehr auf, die Zeile bleibt als historischer Eintrag stehen. Telegram-Alarm
-- im poi-watcher, sobald ein neues Setup erkannt wird (analog zu ob_zones/liquidity_levels).
create table trade_setups (
  id bigint generated always as identity primary key,
  instrument text not null,
  direction text not null check (direction in ('short', 'long')),
  fractal_price numeric not null,
  fractal_pivot_time timestamptz not null,
  ls_price numeric not null,
  ls_pivot_time timestamptz not null,
  ls_touched_time timestamptz not null,
  ob_top numeric not null,
  ob_bottom numeric not null,
  ob_start_time timestamptz not null,
  notified boolean not null default false,
  notified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (instrument, direction, fractal_pivot_time)
);

create trigger trade_setups_set_updated_at
  before update on trade_setups
  for each row
  execute function set_updated_at();

alter table trade_setups enable row level security;

create policy "trade_setups read-only for anon"
  on trade_setups for select
  to anon
  using (true);
