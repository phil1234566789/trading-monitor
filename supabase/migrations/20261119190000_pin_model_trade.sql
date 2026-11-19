-- Mustertrade (pin_type model): Philips Referenz-Trade, den kein Neulauf verlieren darf (dobTradeSetupsFill.mjs prüft das).
alter table public.pin_context drop constraint pin_context_pin_type_check;
alter table public.pin_context add constraint pin_context_pin_type_check check (pin_type in ('observation','bug','model'));
alter table public.pin_context add column dealing_range_id bigint references public.dealing_ranges(id) on delete set null;

-- GBP Short 19.11. 15:24 (LQ-Sweep v1, Überlappung, 5R) als erster Mustertrade, verknüpft mit Philips DR #145.
insert into public.pin_context(kind,dob_trade_key,dob_trade_context,pin_type,dealing_range_id)
select 'dob_trade',k,jsonb_build_object('trade_key',k,'id',t.id,'run_id',t.run_id,'setup_id',t.setup_id,'instrument',t.instrument,
  'direction',t.direction,'route',t.route,'entry_time',t.entry_time,'entry_price',t.entry_price,'stop_price',t.stop_price,
  'target_price',t.target_price,'outcome',t.outcome,'exit_time',t.exit_time,'exit_price',t.exit_price),'model',145
from public.dob_trade_setups t,
 lateral (select t.instrument||':'||t.direction||':'||t.entry_time||':'||t.entry_price||':'||t.stop_price) as key(k)
where t.id='dob-lq-sweep-gbpusd-v1:dob:GBPUSD:-1:1795086900:1795088400:a'
on conflict do nothing;
