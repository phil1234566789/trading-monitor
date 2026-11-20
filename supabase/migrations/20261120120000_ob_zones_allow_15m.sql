-- M15-OBs pflegt poi-watcher wie 1H/4H. Der Touch-Alarm startet aus, damit GBPUSD nicht
-- unangekündigt M15-Telegramme bekommt (alarm_settings ist fail-open).
begin;
alter table public.ob_zones drop constraint ob_zones_timeframe_check;
alter table public.ob_zones add constraint ob_zones_timeframe_check check (timeframe in ('1H', '4H', '15M', '5M', '1M'));
alter table public.forex_h1_cache add column if not exists m15_last_time bigint;
insert into public.alarm_settings (key, enabled) values ('ob_zone_15m', false) on conflict (key) do nothing;
commit;
