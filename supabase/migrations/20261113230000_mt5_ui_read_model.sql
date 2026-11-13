-- UI-Lebenszyklen getrennt vom Schutzworker: Discovery liest nur diese kleinen Änderungszähler.
create table public.mt5_ui_activity(
 id boolean primary key default true check(id),
 catalog bigint not null default 1,snapshots bigint not null default 1,orders bigint not null default 1,
 guards bigint not null default 1,balances bigint not null default 1,plans bigint not null default 1
);
insert into public.mt5_ui_activity(id) values(true);
alter table public.mt5_ui_activity enable row level security;
revoke all on public.mt5_ui_activity from public,anon,authenticated;
grant select on public.mt5_ui_activity to service_role;

create function public.mt5_ui_position_key(s jsonb) returns jsonb language sql immutable set search_path=public as $$
 select jsonb_build_object('account_login',s->'account_login','account_server',s->'account_server','mode',s->'mode','pending_orders',s->'pending_orders',
 'positions',coalesce((select jsonb_agg(jsonb_build_array(p->'ticket',p->'identifier',p->'symbol',p->'type',p->'magic',p->'volume',p->'sl',p->'tp',p->'price_open',p->'opened_at_sec') order by p->>'ticket') from jsonb_array_elements(coalesce(s->'positions','[]'::jsonb)) p),'[]'::jsonb))
$$;
create function public.mt5_ui_guard_key(s jsonb) returns jsonb language sql immutable set search_path=public as $$
 select jsonb_build_array(s#>'{risk,day}',s#>'{risk,latched}',s->'risk_error',s#>'{worker_error,code}',s->'risk_guards_ready',s->'execution_ready',s->'trade_allowed')
$$;
create function public.mt5_bump_ui_activity() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare before jsonb:=case when tg_op='INSERT' then '{}'::jsonb else to_jsonb(old) end;
 after jsonb:=case when tg_op='DELETE' then '{}'::jsonb else to_jsonb(new) end;
 c boolean:=false;s boolean:=false;o boolean:=false;g boolean:=false;b boolean:=false;p boolean:=false;
begin
 case tg_table_name
 when 'mt5_accounts' then c:=(before-'credentials') is distinct from (after-'credentials');
 when 'mt5_execution_settings' then c:=before->'active_account_id' is distinct from after->'active_account_id';
 when 'mt5_risk_policies' then c:=before is distinct from after;g:=c;
 when 'mt5_bridge_state' then
  -- Der ausgewählte Worker schreibt zusätzlich den Legacy-Alias; dessen identischer Stand zählt nicht doppelt.
  if coalesce(after->>'id',before->>'id')='primary' and exists(select 1 from mt5_accounts a join mt5_bridge_state own on own.id=a.id::text
   where a.login::text=coalesce(after#>>'{snapshot,account_login}',before#>>'{snapshot,account_login}') and a.server=coalesce(after#>>'{snapshot,account_server}',before#>>'{snapshot,account_server}')
    and own.snapshot->>'account_login'=a.login::text and own.snapshot->>'account_server'=a.server and own.snapshot->>'mode'=a.mode
    and own.heartbeat_at>=coalesce((after->>'heartbeat_at')::timestamptz,(before->>'heartbeat_at')::timestamptz)) then return null;end if;
  s:=mt5_ui_position_key(before->'snapshot') is distinct from mt5_ui_position_key(after->'snapshot');
  g:=mt5_ui_guard_key(before->'snapshot') is distinct from mt5_ui_guard_key(after->'snapshot');
  c:=before#>'{snapshot,risk,day}' is distinct from after#>'{snapshot,risk,day}';
 when 'mt5_execution_orders' then o:=(before-array['updated_at']) is distinct from (after-array['updated_at']);
 when 'mt5_daily_stops' then g:=true;
 when 'mt5_guard_commands' then g:=(before-array['updated_at']) is distinct from (after-array['updated_at']);
 when 'mt5_target_plans' then p:=(before-array['updated_at']) is distinct from (after-array['updated_at']);
 when 'mt5_account_balances' then b:=(before-array['equity','balance_at']) is distinct from (after-array['equity','balance_at']);
 end case;
 if c or s or o or g or b or p then
  update mt5_ui_activity set catalog=catalog+c::integer,snapshots=snapshots+s::integer,orders=orders+o::integer,guards=guards+g::integer,balances=balances+b::integer,plans=plans+p::integer where id;
 end if;
 return null;
end $$;
create trigger mt5_ui_account_activity after insert or update or delete on public.mt5_accounts for each row execute function public.mt5_bump_ui_activity();
create trigger mt5_ui_settings_activity after insert or update or delete on public.mt5_execution_settings for each row execute function public.mt5_bump_ui_activity();
create trigger mt5_ui_policy_activity after insert or update or delete on public.mt5_risk_policies for each row execute function public.mt5_bump_ui_activity();
create trigger mt5_ui_snapshot_activity after insert or update or delete on public.mt5_bridge_state for each row execute function public.mt5_bump_ui_activity();
create trigger mt5_ui_order_activity after insert or update or delete on public.mt5_execution_orders for each row execute function public.mt5_bump_ui_activity();
create trigger mt5_ui_stop_activity after insert or update or delete on public.mt5_daily_stops for each row execute function public.mt5_bump_ui_activity();
create trigger mt5_ui_guard_activity after insert or update or delete on public.mt5_guard_commands for each row execute function public.mt5_bump_ui_activity();
create trigger mt5_ui_balance_activity after insert or update or delete on public.mt5_account_balances for each row execute function public.mt5_bump_ui_activity();
create trigger mt5_ui_plan_activity after insert or update or delete on public.mt5_target_plans for each row execute function public.mt5_bump_ui_activity();

-- Neue native Gebühren können erst nach dem ersten Planabruf eintreffen; identische Historien-Upserts sind still.
create function public.mt5_ui_cost_activity() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare changed boolean;
begin
 if tg_op='INSERT' then changed:=exists(select 1 from new_rows);
 elsif tg_op='DELETE' then changed:=exists(select 1 from old_rows);
 else changed:=exists(select 1 from new_rows n full join old_rows o using(id) where to_jsonb(n) is distinct from to_jsonb(o));end if;
 if changed then update mt5_ui_activity set plans=plans+1 where id;end if;
 return null;
end $$;
create trigger mt5_ui_cost_insert after insert on public.mt5_broker_deals referencing new table as new_rows for each statement execute function public.mt5_ui_cost_activity();
create trigger mt5_ui_cost_update after update on public.mt5_broker_deals referencing new table as new_rows old table as old_rows for each statement execute function public.mt5_ui_cost_activity();
create trigger mt5_ui_cost_delete after delete on public.mt5_broker_deals referencing old table as old_rows for each statement execute function public.mt5_ui_cost_activity();

create function public.mt5_read_ui_state(p_sections text[] default '{}'::text[]) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare result jsonb;statuses jsonb:='{}';a record;br jsonb;pol jsonb;stop jsonb;commands jsonb;unresolved boolean;context jsonb;
 today date:=(now() at time zone 'Europe/Berlin')::date;
begin
 if p_sections is null or not p_sections<@array['catalog','snapshots','orders','guards','health','balances']::text[] then raise exception 'invalid_ui_sections';end if;
 select jsonb_build_object('revisions',to_jsonb(r)-'id') into result from mt5_ui_activity r where id;
 if 'catalog'=any(p_sections) then
  result:=result||jsonb_build_object('accounts',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'login',login,'server',server,'mode',mode,'archived',archived,'created_at',created_at,'trade_role',trade_role,'archive_details',archive_details) order by created_at,id) from mt5_accounts),'[]'),
   'active_account_id',(select active_account_id from mt5_execution_settings where id='primary'));
 end if;
 if p_sections&&array['catalog','snapshots','guards'] then
  for a in select id,login,server,mode,archived from mt5_accounts loop
   context:='{}';br:=null;
   if ('snapshots'=any(p_sections) or 'guards'=any(p_sections)) then
    select to_jsonb(bridge) into br from mt5_bridge_state bridge
     where (bridge.id=a.id::text or bridge.id='primary') and bridge.snapshot->>'account_login'=a.login::text and bridge.snapshot->>'account_server'=a.server and bridge.snapshot->>'mode'=a.mode
     order by heartbeat_at desc,(bridge.id=a.id::text) desc limit 1;
   end if;
   if 'catalog'=any(p_sections) then
    select to_jsonb(p) into pol from mt5_risk_policies p where account_id=a.id;
    context:=context||jsonb_build_object('risk_policy',pol);
   end if;
   if 'snapshots'=any(p_sections) and (not a.archived or jsonb_array_length(coalesce(br#>'{snapshot,positions}','[]'))>0) then
    context:=context||jsonb_build_object('bridge',br,'inactive',a.archived,'online',not a.archived and br is not null and (br->>'heartbeat_at')::timestamptz>now()-interval '15 seconds');
   end if;
   if 'guards'=any(p_sections) and not a.archived then
    select to_jsonb(d)-'snapshot' into stop from mt5_daily_stops d where account_id=a.id and day=today;
    select exists(select 1 from mt5_guard_commands where account_id=a.id and status in('pending','sending','unknown')) into unresolved;
    select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at),'[]') into commands from
     (select * from mt5_guard_commands where account_id=a.id and (status in('pending','sending','unknown') or id in(select id from mt5_guard_commands where account_id=a.id order by created_at desc limit 20))) q;
    context:=context||jsonb_build_object('_guard_bridge',br,'daily_stop',jsonb_build_object('day',today,'latched',stop is not null or unresolved,'day_latched',stop is not null,'daily_loss_limit',1000,'stop',stop,'reason',stop->>'reason','commands',commands));
   end if;
   if context<>'{}' then statuses:=statuses||jsonb_build_object(a.id,context);end if;
  end loop;
  result:=result||jsonb_build_object('account_statuses',statuses);
 end if;
 if 'orders'=any(p_sections) then
  result:=result||jsonb_build_object('orders',coalesce((select jsonb_agg(to_jsonb(q) order by q.created_at desc) from
   (select * from mt5_execution_orders where status in('searching','sending','unknown') or id in(select id from mt5_execution_orders order by created_at desc limit 20))q),'[]'));
 end if;
 if 'health'=any(p_sections) then
  result:=result||jsonb_build_object('health',jsonb_build_object('checked_at',(select health_checked_at from mt5_execution_settings where id='primary'),
   'incident',(select to_jsonb(i) from mt5_health_incidents i where resolved_at is null),
   'deliveries',coalesce((select jsonb_agg(jsonb_build_object('channel',d.channel,'status',d.status,'error',d.error,'accepted_at',d.accepted_at)) from mt5_health_deliveries d join mt5_health_incidents i on i.id=d.incident_id where i.resolved_at is null),'[]')));
 end if;
 if 'balances'=any(p_sections) then result:=result||jsonb_build_object('account_balances',coalesce((select jsonb_agg(to_jsonb(b) order by account_id) from mt5_account_balances b),'[]'));end if;
 return result;
end $$;
revoke all on function public.mt5_ui_position_key(jsonb),public.mt5_ui_guard_key(jsonb),public.mt5_bump_ui_activity(),public.mt5_ui_cost_activity(),public.mt5_read_ui_state(text[]) from public,anon,authenticated;
grant execute on function public.mt5_read_ui_state(text[]) to service_role;
