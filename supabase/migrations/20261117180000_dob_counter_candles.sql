-- Konfig-Merkmale je Trade als jsonb (Philip: keine Spalte je Merkmal; Schlüssel in src/dobTradeFeatures.js), erstes Merkmal:
-- Gegenkerzen in den letzten 3/5 geschlossenen M5 vor dem Entry. Schalter je Instrument, Default aus; Philips XAUUSD-Zeile 3of3.
alter table public.dob_trade_setups add column if not exists features jsonb;
alter table public.dob_guardrails add column if not exists counter_candles_mode text not null default 'off'
  check (counter_candles_mode in ('off', '3of3', '3of5'));
update public.dob_guardrails set counter_candles_mode = '3of3', updated_at = now() where instrument = 'XAUUSD';
