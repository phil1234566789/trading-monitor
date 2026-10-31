-- Historischen RPC-Namen erhalten; UI und MCP nutzen dieselbe atomare Wechsel-Sperre.
create or replace function public.mt5_select_test_account(account_id uuid)
returns void language plpgsql security invoker set search_path=public as $$
declare previous_id uuid; broker public.mt5_bridge_state%rowtype;
begin
 perform pg_advisory_xact_lock(29092026,1);
 select active_account_id into previous_id from public.mt5_execution_settings where id='primary';
 if previous_id is not distinct from account_id then return; end if;
 if account_id is not null then
  if not exists(select 1 from public.mt5_accounts a where a.id=account_id) then raise exception 'account_not_found'; end if;
  if exists(select 1 from public.mt5_accounts a where a.id=account_id and a.archived) then raise exception 'archived_account'; end if;
 end if;
 if exists(select 1 from public.mt5_execution_orders where status in('searching','sending','unknown')) then
  raise exception 'active_orders_block_account_switch';
 end if;
 if exists(select 1 from public.mt5_execution_orders where status='executed'
  and result->'position_lifecycle'->>'state' is distinct from 'closed') then
  raise exception 'active_positions_block_account_switch';
 end if;
 if previous_id is not null then
  select * into broker from public.mt5_bridge_state where id='primary';
  if broker.id is null or broker.heartbeat_at<now()-interval '15 seconds'
   or broker.snapshot->>'worker_error' is not null
   or jsonb_typeof(broker.snapshot->'positions') is distinct from 'array'
   or jsonb_typeof(broker.snapshot->'pending_orders') is distinct from 'number'
   or not exists(select 1 from public.mt5_accounts a where a.id=previous_id
    and a.login::text=broker.snapshot->>'account_login' and a.server=broker.snapshot->>'account_server') then
   raise exception 'account_state_unavailable';
  end if;
  if jsonb_array_length(broker.snapshot->'positions')>0 or (broker.snapshot->>'pending_orders')::integer>0 then
   raise exception 'active_positions_block_account_switch';
  end if;
 end if;
 update public.mt5_execution_settings set active_account_id=account_id where id='primary';
 delete from public.mt5_bridge_state where id='primary';
end $$;
