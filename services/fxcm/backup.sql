begin;
select cron.alter_job(jobid, active := false) from cron.job where jobname in ('poi-watcher-5min','daily-structure-pivots');
create schema if not exists fxcm_backup;
revoke all on schema fxcm_backup from public, anon, authenticated, service_role;
do $$ declare t text; begin
 foreach t in array array['dealing_ranges','trade_positions','trade_targets','trade_partial_exits','trade_evidence','pin_context','watch_state','trading_loop_state','state_machine_log','claude_annotations','trade_setups','trade_setup_sweeps','ob_zones','liquidity_levels','daily_structure_pivots','forex_h1_cache'] loop
  execute format('create table fxcm_backup.%I as table public.%I',t,t);
  execute format('revoke all on fxcm_backup.%I from public, anon, authenticated, service_role',t);
 end loop;
end $$;
commit;
select count(*) as saved_gbp_ranges from fxcm_backup.dealing_ranges where instrument='GBPUSD';
