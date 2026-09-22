-- Altbestand bleibt privat rückholbar; öffentlich wird nur noch FXCM gelesen.
do $$ begin
 if (select count(*) from fxcm_backup.dealing_ranges where instrument='GBPUSD') <> 18
 or (select count(*) from fxcm_backup.trade_positions where dealing_range_id in
   (select id from fxcm_backup.dealing_ranges where instrument='GBPUSD')) <> 38 then
  raise exception 'Verified GBP journal backup required before cutover';
 end if;
 if exists (select 1 from (values ('GBPUSD'),('EURUSD')) i(instrument)
 cross join (values ('5m'),('1h'),('4h')) b(bar)
 where not exists (select 1 from public.fxcm_candles c where c.instrument=i.instrument and c.bar=b.bar and c.time<'2026-01-06')) then
  raise exception 'FXCM history incomplete';
 end if;
end $$;

alter table public.forex_candles set schema fxcm_backup;
revoke all on fxcm_backup.forex_candles from public, anon, authenticated, service_role;
create view public.forex_candles with (security_invoker=true) as
 select instrument,bar,time,open,high,low,close,volume,source from public.fxcm_candles;
grant select on public.forex_candles to anon, authenticated, service_role;
revoke insert,update,delete on public.forex_candles from anon,authenticated,service_role;

-- Zuerst abhängige Ideen/Positionen entfernen, dann deren alte Erkennungsobjekte.
delete from public.trading_loop_state where instrument in ('GBPUSD','EURUSD');
delete from public.watch_state where instrument in ('GBPUSD','EURUSD');
delete from public.dealing_ranges where instrument in ('GBPUSD','EURUSD');
delete from public.trade_setups where instrument in ('GBPUSD','EURUSD');
delete from public.ob_zones where instrument in ('GBPUSD','EURUSD');
delete from public.liquidity_levels where instrument in ('GBPUSD','EURUSD');
delete from public.pin_context where m5_liquidity_instrument in ('GBPUSD','EURUSD') or rsi_divergence_instrument in ('GBPUSD','EURUSD');
delete from public.claude_annotations where instrument in ('GBPUSD','EURUSD');
delete from public.daily_structure_pivots where instrument in ('GBPUSD','EURUSD');
delete from public.forex_h1_cache where instrument in ('GBPUSD','EURUSD');
notify pgrst, 'reload schema';
