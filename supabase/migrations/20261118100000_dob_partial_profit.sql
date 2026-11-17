-- Teilprofit als Konfig (DOB-LAB-TEILPROFIT): partial_pct % bei partial_at_r schließen (null = aus), partial_be = Rest-SL danach auf
-- Entry, Rest bis zum Konfig-TP. Rest-Verlauf je Trade steht in dob_trade_setups.features (be_3_*). Philips XAUUSD-Zeile: 3 / 50 / an.
alter table public.dob_guardrails add column if not exists partial_at_r real check (partial_at_r is null or partial_at_r > 0);
alter table public.dob_guardrails add column if not exists partial_pct integer not null default 50 check (partial_pct between 1 and 99);
alter table public.dob_guardrails add column if not exists partial_be boolean not null default true;
update public.dob_guardrails set partial_at_r = 3, partial_pct = 50, partial_be = true, updated_at = now() where instrument = 'XAUUSD';
