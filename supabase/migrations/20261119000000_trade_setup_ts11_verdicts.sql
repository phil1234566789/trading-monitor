-- TS1.1-Urteil je trade_setups-Zeile (src/tradeSetup11Rows.js, dieselbe Policy wie der Chart). Das Urteil ändert sich nach der
-- Setup-Erkennung nicht mehr; der DOB-Watcher rechnet es deshalb einmal statt jede Minute (Edge-CPU). Neue Policy-Version = neue Zeilen;
-- unknown erst ab 1 h nach OB-Start (vorher kann der Kerzenstand noch nachlaufen).
create table public.trade_setup_ts11_verdicts (
  trade_setup_id bigint not null references public.trade_setups(id) on delete cascade,
  version text not null,
  status text not null check (status in ('passed','unmet','unknown')),
  reason text,
  evaluated_at timestamptz not null default now(),
  primary key (trade_setup_id, version)
);
alter table public.trade_setup_ts11_verdicts enable row level security;
create policy trade_setup_ts11_verdicts_read on public.trade_setup_ts11_verdicts for select to anon, authenticated using (true);
grant select on public.trade_setup_ts11_verdicts to anon, authenticated;
grant all on public.trade_setup_ts11_verdicts to service_role;
