-- M1-Pins nutzen dieselbe kanonische OB-ID wie M5; der bisherige CHECK verhinderte ihre Anlage.
begin;
alter table public.ob_zones drop constraint ob_zones_timeframe_check;
alter table public.ob_zones add constraint ob_zones_timeframe_check check (timeframe in ('1H', '4H', '5M', '1M'));
commit;
