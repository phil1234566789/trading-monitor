-- Ein DOB-Pin gehört einem Paar, nicht einem einzelnen, möglicherweise geteilten OB.
alter table public.pin_context add column dob_pin_key text unique, add column dob_context jsonb;

create function public.valid_double_order_block_pin(snapshot jsonb) returns boolean
language plpgsql immutable set search_path=public as $$
declare p jsonb; a jsonb; b jsonb; ob jsonb; field text; bounds jsonb; value numeric; sign integer; symbol text; expected text;
begin
 if snapshot is null or jsonb_typeof(snapshot)<>'object' or octet_length(snapshot::text)>65536
  or coalesce(snapshot->>'contextVersion','')<>'double-order-block-pin-v1' then return false; end if;
 p:=snapshot->'pair'; a:=p->'firstOrderBlock'; b:=p->'secondOrderBlock'; symbol:=p->>'instrument';
 sign:=case p->>'direction' when 'long' then 1 when 'short' then -1 else 0 end;
 if sign=0 or symbol not in ('XAUUSD','GBPUSD','EURUSD') or symbol is null
  or jsonb_typeof(a) is distinct from 'object' or jsonb_typeof(b) is distinct from 'object'
  or jsonb_typeof(p->'entries') is distinct from 'object'
  or jsonb_typeof(snapshot->'coverage'->'m5') is distinct from 'object'
  or jsonb_typeof(snapshot->'coverage'->'m1') is distinct from 'object'
  or jsonb_typeof(snapshot->'engineVersion') is distinct from 'string'
  or jsonb_typeof(snapshot->'view'->'bar') is distinct from 'string'
  or snapshot->'view'->>'symbol' is distinct from symbol
  or length(coalesce(snapshot->'view'->>'bar','')) not between 1 and 8
  or length(coalesce(snapshot->>'engineVersion','')) not between 1 and 128 then return false; end if;
 foreach ob in array array[a,b] loop
  foreach field in array array['dir','obZoneId','startTime','top','bottom'] loop
   if jsonb_typeof(ob->field) is distinct from 'number' then return false; end if;
  end loop;
  foreach field in array array['obZoneId','startTime'] loop
   value:=(ob->>field)::numeric;
   if value<=0 or value<>trunc(value) or value>9007199254740991 then return false; end if;
  end loop;
  if ob->>'timeframe' is distinct from '5M' or (ob->>'top')::numeric>1.7976931348623157e308 then return false; end if;
 end loop;
 if jsonb_typeof(p->'recognizedAt') is distinct from 'number'
  or jsonb_typeof(snapshot->'evaluatedAt') is distinct from 'number' then return false; end if;
 foreach value in array array[(p->>'recognizedAt')::numeric,(snapshot->>'evaluatedAt')::numeric] loop
  if value<=0 or value<>trunc(value) or value>9007199254740991 then return false; end if;
 end loop;
 foreach bounds in array array[snapshot->'coverage'->'m5',snapshot->'coverage'->'m1'] loop
  foreach field in array array['from','through','count'] loop
   if jsonb_typeof(bounds->field) is distinct from 'number' then return false; end if;
   value:=(bounds->>field)::numeric;
   if value<=0 or value<>trunc(value) or value>9007199254740991 then return false; end if;
  end loop;
  if (bounds->>'through')::numeric<(bounds->>'from')::numeric
   or (bounds->>'through')::numeric>(snapshot->>'evaluatedAt')::numeric then return false; end if;
 end loop;
 if not coalesce((a->>'dir')::numeric=sign and (b->>'dir')::numeric=sign
  and (a->>'obZoneId')::bigint>0 and (b->>'obZoneId')::bigint>0
  and (a->>'startTime')::numeric>0 and (a->>'startTime')::numeric<(b->>'startTime')::numeric
  and (a->>'top')::numeric>(a->>'bottom')::numeric and (a->>'bottom')::numeric>0
  and (b->>'top')::numeric>(b->>'bottom')::numeric and (b->>'bottom')::numeric>0
  and ((b->>'top')::numeric-(a->>'top')::numeric)*sign>0
  and ((b->>'bottom')::numeric-(a->>'bottom')::numeric)*sign>0
  and (p->>'recognizedAt')::numeric>(b->>'startTime')::numeric and (snapshot->>'evaluatedAt')::numeric>=(p->>'recognizedAt')::numeric,false)
  then return false; end if;
 expected:='dob:'||symbol||':'||sign||':'||(a->>'startTime')||':'||(b->>'startTime');
 return coalesce(p->>'id'=expected,false);
exception when others then return false;
end $$;

-- Die bestehenden FK-/Simulations-Branches bleiben unverändert erhalten.
do $$
declare old_rule text;
begin
 select pg_get_expr(conbin,conrelid) into strict old_rule from pg_constraint
  where conrelid='public.pin_context'::regclass and conname='laniakea_context_kind_check';
 alter table public.pin_context drop constraint laniakea_context_kind_check;
 execute format($check$
  alter table public.pin_context add constraint laniakea_context_kind_check check (
   ((%s) and dob_pin_key is null and dob_context is null)
   or (kind='double_order_block' and dob_pin_key is not null
    and dob_pin_key=dob_context->'pair'->>'id' and public.valid_double_order_block_pin(dob_context)
    and trade_position_id is null and ob_zone_id is null and trade_setup_id is null
    and trade_confirmation_id is null and liquidity_level_id is null
    and m5_liquidity_instrument is null and rsi_divergence_instrument is null
    and simulation_run_id is null and simulation_snapshot_id is null and simulation_entry_snapshot_id is null
    and simulation_checkpoint_key is null and simulation_variant is null and simulation_pin_key is null
    and simulation_context is null and live_event_id is null and live_snapshot_id is null)
  )
 $check$,old_rule);
end $$;
