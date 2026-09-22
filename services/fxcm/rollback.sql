begin;
select cron.alter_job(jobid, active := false) from cron.job where jobname in ('poi-watcher-5min','daily-structure-pivots');
-- Vorher neue Journal-Einträge sichern. Diese Datei stellt den geprüften Altstand wieder her.
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
drop view public.forex_candles;
alter table fxcm_backup.forex_candles set schema public;
grant select,insert on public.forex_candles to anon;
grant all on public.forex_candles to service_role;
do $$ declare t text; columns_sql text; begin
 foreach t in array array['ob_zones','liquidity_levels','trade_setups','trade_setup_sweeps','dealing_ranges','trade_positions','trade_targets','trade_partial_exits','trade_evidence','pin_context','watch_state','trading_loop_state','claude_annotations','daily_structure_pivots','forex_h1_cache'] loop
  select string_agg(quote_ident(column_name),',' order by ordinal_position) into columns_sql
   from information_schema.columns c where table_schema='public' and table_name=t and is_generated='NEVER'
   and exists (select 1 from information_schema.columns b where b.table_schema='fxcm_backup' and b.table_name=t and b.column_name=c.column_name);
  execute format('insert into public.%I (%s) overriding system value select %s from fxcm_backup.%I on conflict do nothing',t,columns_sql,columns_sql,t);
 end loop;
end $$;
select cron.alter_job(jobid, schedule := '*/5 * * * *') from cron.job where jobname='poi-watcher-5min';
select cron.alter_job(jobid, schedule := '15 22 * * *') from cron.job where jobname='daily-structure-pivots';
notify pgrst, 'reload schema';
-- Erst nach Rückkehr zu den vorherigen Edge-Functions die beiden Cronjobs aktivieren.
commit;
