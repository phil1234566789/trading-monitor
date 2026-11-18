-- Leerlauf ohne Polling: Der VPS-Worker schläft bis zu einer Stunde und wird per Realtime-Broadcast geweckt
-- (sichtbarer MMT-Tab, neues Entry-Gesuch, Zielplan, Historienanfrage). Das Topic ist geheim und nur dem Worker bekannt.
create table public.mt5_worker_wake(
  id boolean primary key default true check(id),
  topic text not null default 'mt5-wake-'||encode(extensions.gen_random_bytes(16),'hex'),
  ui_seen_at timestamptz
);
insert into public.mt5_worker_wake(id) values(true);
alter table public.mt5_worker_wake enable row level security;
revoke all on public.mt5_worker_wake from public,anon,authenticated;
grant select,update on public.mt5_worker_wake to service_role;

alter table public.mt5_bridge_state add column poll_mode text not null default 'active' check(poll_mode in ('active','idle'));

-- Ein Realtime-Fehler darf nie eine Order- oder Planänderung blockieren; der Worker hat Fallback-Polls.
create function public.mt5_send_wake() returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  perform realtime.send('{}'::jsonb,'wake',(select topic from mt5_worker_wake where id),false);
exception when others then null;
end $$;
revoke all on function public.mt5_send_wake() from public,anon,authenticated;

-- Nur bei frisch geöffnetem Tab wecken; bei offenem Tab höchstens alle 20 s ein Schreibzugriff.
create function public.mt5_touch_presence() returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare previous timestamptz;
begin
  select ui_seen_at into previous from mt5_worker_wake where id;
  if previous is not null and previous>=now()-interval '20 seconds' then return; end if;
  update mt5_worker_wake set ui_seen_at=now() where id;
  if previous is null or previous<now()-interval '60 seconds' then perform mt5_send_wake(); end if;
end $$;
revoke all on function public.mt5_touch_presence() from public,anon,authenticated;
grant execute on function public.mt5_touch_presence() to service_role;

create function public.mt5_wake_trigger() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin perform mt5_send_wake(); return null; end $$;
revoke all on function public.mt5_wake_trigger() from public,anon,authenticated;

create trigger mt5_wake_on_order after insert on public.mt5_execution_orders
  for each row execute function public.mt5_wake_trigger();
create trigger mt5_wake_on_plan_insert after insert on public.mt5_target_plans
  for each row execute function public.mt5_wake_trigger();
create trigger mt5_wake_on_plan_pending after update of state on public.mt5_target_plans
  for each row when (new.state='pending' and old.state is distinct from 'pending') execute function public.mt5_wake_trigger();
create trigger mt5_wake_on_history_request after update of history_requested_at on public.mt5_accounts
  for each row when (new.history_requested_at is distinct from old.history_requested_at) execute function public.mt5_wake_trigger();

-- Übergangsbremse für den alten 1-s-Worker: eine RPC statt vieler Einzelabfragen entscheidet "nichts zu tun".
create function public.mt5_worker_idle(p_account text,p_login text,p_server text) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select coalesce((select jsonb_array_length(snapshot->'positions')=0 and coalesce((snapshot->>'pending_orders')::int,1)=0
                         and coalesce(snapshot->'worker_error','null'::jsonb)='null'::jsonb
                  from mt5_bridge_state where id=p_account),false)
  and not exists(select 1 from mt5_execution_orders where intent->>'account_login'=p_login and intent->>'account_server'=p_server
                 and (status in ('searching','sending','unknown') or (status='executed' and result->'position_lifecycle'->>'closed_at_sec' is null)))
  and not exists(select 1 from mt5_target_plans where plan->>'account_login'=p_login and plan->>'account_server'=p_server
                 and state in ('pending','active','sending','unknown'))
  and not exists(select 1 from mt5_guard_commands where account_id::text=p_account and status in ('pending','sending','unknown'))
  and not exists(select 1 from mt5_worker_wake where ui_seen_at>now()-interval '90 seconds');
$$;
revoke all on function public.mt5_worker_idle(text,text,text) from public,anon,authenticated;
grant execute on function public.mt5_worker_idle(text,text,text) to service_role;
