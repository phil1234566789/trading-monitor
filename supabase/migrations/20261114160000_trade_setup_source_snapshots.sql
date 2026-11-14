-- Versionierte Quellen zusätzlich ablegen; historische TS1-Zeilen und ihre FKs bleiben erhalten.
create function public.valid_ts_source_time(value jsonb) returns boolean
language sql immutable set search_path=public as $$
 select coalesce(jsonb_typeof(value)='number' and (value::text)::numeric between 1 and 9007199254740991
   and trunc((value::text)::numeric)=(value::text)::numeric,false)
$$;

create function public.valid_ts_source_level(value jsonb, direction integer, as_of numeric, tf text)
returns boolean language plpgsql immutable set search_path=public as $$
declare price numeric; born numeric; touched numeric; fine numeric; kind text;
begin
 if jsonb_typeof(value) is distinct from 'object' or tf is null or tf not in ('5M','1H') or direction not in (1,-1) then return false; end if;
 if not coalesce(jsonb_typeof(value->'dir')='number' and value->'dir'=to_jsonb(direction)
   and jsonb_typeof(value->'price')='number' and public.valid_ts_source_time(value->'pivotTime')
   and public.valid_ts_source_time(value->'touchedTime') and value->'touched'='true'::jsonb,false) then return false; end if;
 price:=(value->>'price')::numeric; born:=(value->>'pivotTime')::numeric; touched:=(value->>'touchedTime')::numeric;
 if value->'fineTouchedTime' is not null and value->'fineTouchedTime'<>'null'::jsonb then
  if not public.valid_ts_source_time(value->'fineTouchedTime') then return false; end if;
  fine:=(value->>'fineTouchedTime')::numeric;
  if fine<touched or fine>=touched+(case when tf='1H' then 3600 else 300 end) then return false; end if;
 end if;
 if price<=0 or coalesce(fine,touched)<=born or coalesce(fine,touched)+(case when tf='1H' and fine is null then 3600 else 300 end)>as_of then return false; end if;
 if value->'recognizedAt' is not null and value->'recognizedAt'<>'null'::jsonb and
  (not public.valid_ts_source_time(value->'recognizedAt') or (value->>'recognizedAt')::numeric>as_of) then return false; end if;
 kind:=coalesce(value->>'sourceKind','liquidity');
 if kind='liquidity' then return true; end if;
 if kind<>'orderBlock' or tf<>'5M' then return false; end if;
 return coalesce(public.valid_ts_source_time(value->'sourceStartTime')
   and public.valid_ts_source_time(value->'sourceKnownAt')
   and value->'sourceStartTime'=value->'pivotTime'
   and (value->>'sourceKnownAt')::numeric>=born+600
   and (value->>'sourceKnownAt')::numeric<=touched
   and jsonb_typeof(value->'sourceDirection')='number' and value->'sourceDirection'=to_jsonb(-direction)
   and jsonb_typeof(value->'sourceTop')='number' and jsonb_typeof(value->'sourceBottom')='number'
   and (value->>'sourceBottom')::numeric>0 and (value->>'sourceTop')::numeric>(value->>'sourceBottom')::numeric
   and price=(value->>case when direction=1 then 'sourceTop' else 'sourceBottom' end)::numeric,false);
exception when others then return false;
end $$;

create function public.ts_source_key(value jsonb, tf text) returns text
language sql immutable set search_path=public as $$
 select coalesce(value->>'sourceKind','liquidity')||':'||tf||':'||(value->>'dir')||':'||
  (value->>'pivotTime')||':'||((value->>'price')::double precision)::text||':'||(value->>'touchedTime')
$$;

create function public.same_ts_source(a jsonb,b jsonb) returns boolean
language sql immutable set search_path=public as $$
 select coalesce(a->>'sourceKind','liquidity')=coalesce(b->>'sourceKind','liquidity') and not exists(
  select 1 from unnest(array['dir','price','pivotTime','touchedTime','fineTouchedTime','recognizedAt',
   'sourceStartTime','sourceKnownAt','sourceDirection','sourceTop','sourceBottom']) k
  where coalesce(a->k,'null'::jsonb)<>coalesce(b->k,'null'::jsonb))
$$;

create function public.valid_ts_owner(proof jsonb,d integer,known numeric,source jsonb) returns boolean
language plpgsql immutable set search_path=public as $$
declare r jsonb; p jsonb;
begin
 r:=coalesce(proof->'range',proof);
 if not coalesce(jsonb_typeof(proof)='object' and public.valid_ts_source_time(proof->'knownAt')
  and (proof->>'knownAt')::numeric<=known and public.valid_ts_source_time(proof->'depth')
  and r->>'trend'=case when d=1 then 'downtrend' else 'uptrend' end,false) then return false; end if;
 if proof ? 'range' then
  if not coalesce(proof->>'status'='ready' and proof->>'basis' in ('deepestRangeAtLevelBirth','rangeBoundaryBeforeSweep','protectedPivotBeforeSweep')
   and jsonb_typeof(proof->'pivot')='object' and jsonb_typeof(proof->'pivot'->'price')='number'
   and (proof->'pivot'->>'price')::numeric>0 and public.valid_ts_source_time(proof->'pivot'->'pivotTime')
   and (proof->'pivot'->>'pivotTime')::numeric<=(proof->>'knownAt')::numeric,false) then return false; end if;
  if proof->'pivot'->'price' is distinct from source->'price' then return false; end if;
  if source->>'sourceKind'='orderBlock' then
   if proof->>'sourceKind' is distinct from 'orderBlock' or proof->'sourceStartTime' is distinct from source->'sourceStartTime' then return false; end if;
  elsif proof->'pivot'->'pivotTime' is distinct from source->'pivotTime' then return false; end if;
 elsif not coalesce(proof->>'basis' in ('confirmedNestedRange','existingCloseReactionChoch'),false) then return false; end if;
 for p in select r->'low' union all select r->'high' loop
  if not coalesce(jsonb_typeof(p)='object' and jsonb_typeof(p->'price')='number' and (p->>'price')::numeric>0
   and public.valid_ts_source_time(p->'pivotTime') and (p->>'pivotTime')::numeric<=known,false) then return false; end if;
 end loop;
 if (r->'low'->>'price')::numeric>=(r->'high'->>'price')::numeric then return false; end if;
 if proof->'confirmation' is not null and proof->'confirmation'<>'null'::jsonb and
  not coalesce(public.valid_ts_source_time(proof->'confirmation'->'recognizedAt')
   and (proof->'confirmation'->>'recognizedAt')::numeric<=(proof->>'knownAt')::numeric,false) then return false; end if;
 return true;
exception when others then return false;
end $$;

create function public.valid_ts_source_snapshot(value jsonb) returns boolean
language plpgsql immutable set search_path=public as $$
declare setup jsonb; sw jsonb; item jsonb; next_source jsonb; fractal jsonb; witness jsonb;
 prior_sw jsonb; proofs jsonb:='[]'::jsonb;
 d integer; known numeric; evaluated numeric; ftf text; keys text[]:=array[]::text[];
begin
 if jsonb_typeof(value) is distinct from 'object' or octet_length(value::text)>131072 then return false; end if;
 if not coalesce(value->>'schemaVersion'='trade-setup-source-snapshot-v1'
  and value->>'sourceProfile'='ts11-ob-edge-p5-supersession-v1'
  and value->>'instrument' in ('XAUUSD','GBPUSD','EURUSD')
  and jsonb_typeof(value->'settingsHash')='string' and value->>'settingsHash' ~ '^[a-f0-9]{64}$'
  and jsonb_typeof(value->'engineVersion')='string' and length(value->>'engineVersion') between 1 and 128
  and public.valid_ts_source_time(value->'canonicalSetupKnownAt')
  and public.valid_ts_source_time(value->'evaluationAsOf') and value->'frozenAt'=value->'evaluationAsOf',false) then return false; end if;
 known:=(value->>'canonicalSetupKnownAt')::numeric; evaluated:=(value->>'evaluationAsOf')::numeric;
 if known>evaluated then return false; end if;
 setup:=value->'setup';
 if not coalesce(jsonb_typeof(setup)='object' and setup->'dir' in ('1'::jsonb,'-1'::jsonb)
  and public.valid_ts_source_time(setup->'obStartTime')
  and jsonb_typeof(setup->'obTop')='number' and jsonb_typeof(setup->'obBottom')='number'
  and jsonb_typeof(setup->'obFvg')='number'
  and coalesce(setup->>'trendEvaluationSourceProfile',setup->>'sweepSourceProfile')=value->>'sourceProfile'
  and setup->>'trendEvaluationVersion'=value->>'engineVersion'
  and setup->>'pathType' in ('A','B')
  and jsonb_typeof(setup->'sweeps')='array' and jsonb_array_length(setup->'sweeps') between 1 and 3
  and jsonb_typeof(setup->'confirmationSources')='array' and jsonb_array_length(setup->'confirmationSources')>0,false) then return false; end if;
 d:=(setup->>'dir')::integer;
 if (setup->>'obStartTime')::numeric+600>known or (setup->>'obBottom')::numeric<=0
  or (setup->>'obTop')::numeric<=(setup->>'obBottom')::numeric or (setup->>'obFvg')::numeric<=0 then return false; end if;
 if not coalesce(value->>'setupKey'=(value->>'instrument')||':'||d::text||':'||(setup->>'obStartTime'),false)
  or (setup ? 'instrument' and setup->>'instrument' is distinct from value->>'instrument') then return false; end if;
 for sw in select jsonb_array_elements((setup->'sweeps')||(setup->'confirmationSources')) loop
  if not public.valid_ts_source_level(sw->'level',d,known,sw->>'timeframe') then return false; end if;
  if sw->>'sourceKey' is not null and sw->>'sourceKey'<>public.ts_source_key(sw->'level',sw->>'timeframe') then return false; end if;
 end loop;
 if not public.valid_ts_source_level(setup->'ls',d,known,setup->'sweeps'->0->>'timeframe')
  or not public.same_ts_source(setup->'ls',setup->'sweeps'->0->'level') then return false; end if;
 for sw in select jsonb_array_elements(setup->'confirmationSources') loop
  if public.ts_source_key(sw->'level',sw->>'timeframe')=any(keys) then return false; end if;
  keys:=array_append(keys,public.ts_source_key(sw->'level',sw->>'timeframe'));
 end loop;
 for sw in select jsonb_array_elements(setup->'sweeps') loop
  if not exists(select 1 from jsonb_array_elements(setup->'confirmationSources') c
   where c->>'timeframe'=sw->>'timeframe' and public.same_ts_source(c->'level',sw->'level')) then return false; end if;
 end loop;
 fractal:=setup->'fractal';
 ftf:=case when public.same_ts_source(fractal,setup->'ls') then setup->'sweeps'->0->>'timeframe' else '5M' end;
 if fractal->'touched'='true'::jsonb then
  if not public.valid_ts_source_level(fractal,d,known,ftf) then return false; end if;
 elsif not coalesce(jsonb_typeof(fractal)='object' and fractal->'touched'='false'::jsonb
  and fractal->'touchedTime'='null'::jsonb and fractal->'dir'=to_jsonb(d)
  and public.valid_ts_source_time(fractal->'pivotTime') and (fractal->>'pivotTime')::numeric<=known
  and jsonb_typeof(fractal->'price')='number' and (fractal->>'price')::numeric>0
  and coalesce(fractal->>'sourceKind','liquidity')='liquidity',false) then return false; end if;
 if setup ? 'confirmationHistory' and setup->'confirmationHistory'<>'null'::jsonb then
  if jsonb_typeof(setup->'confirmationHistory')<>'array' then return false; end if;
  for item in select jsonb_array_elements(setup->'confirmationHistory') loop
   if not public.valid_ts_source_level(item->'level',d,known,item->>'timeframe')
    or not coalesce(item->>'status' in ('valid','unknown','superseded'),false) then return false; end if;
   if item->>'status'='superseded' then
    if item->>'timeframe'<>'5M' then return false; end if;
    next_source:=item->'supersededBy';
    if not coalesce(public.valid_ts_source_time(item->'validUntil') and (item->>'validUntil')::numeric<=known
     and public.valid_ts_source_time(next_source->'knownAt') and next_source->'validUntil'=item->'validUntil'
     and (next_source->>'knownAt')::numeric<=(item->>'validUntil')::numeric
     and (next_source->>'knownAt')::numeric>(next_source->'level'->>'pivotTime')::numeric
     and public.valid_ts_source_level(next_source->'level',d,known,'5M')
     and next_source->>'sourceKey'=public.ts_source_key(next_source->'level','5M')
     and (next_source->'level'->>'pivotTime')::numeric>(item->'level'->>'touchedTime')::numeric
     and (next_source->'level'->>'touchedTime')::numeric+300=(item->>'validUntil')::numeric
     and coalesce(next_source->'level'->>'sourceKind','liquidity')='liquidity'
     and coalesce(item->'level'->>'sourceKind','liquidity')='liquidity'
     and case when d=1 then (next_source->'level'->>'price')::numeric>(item->'level'->>'price')::numeric
      else (next_source->'level'->>'price')::numeric<(item->'level'->>'price')::numeric end,false) then return false; end if;
   elsif item->'validUntil' is distinct from 'null'::jsonb then return false; end if;
   if public.ts_source_key(item->'level',item->>'timeframe')=any(keys) and item->>'status'<>'valid' then return false; end if;
  end loop;
 end if;
 witness:=setup->'trendEvidence'->'goWitness';
 if not coalesce(public.valid_ts_source_time(witness->'knownAt') and (witness->>'knownAt')::numeric<=evaluated
  and public.valid_ts_owner(witness->'ownerProof',d,known,witness->'level')
  and public.valid_ts_source_level(witness->'level',d,known,witness->>'timeframe')
  and witness->>'sourceKey'=public.ts_source_key(witness->'level',witness->>'timeframe')
  and witness->>'sourceKey'=any(keys),false) then return false; end if;
 if not exists(select 1 from jsonb_array_elements(setup->'confirmationSources') c
  where c->>'timeframe'=witness->>'timeframe' and public.same_ts_source(c->'level',witness->'level'))
 then return false; end if;
 for item in
  select s from jsonb_array_elements(setup->'sweeps') s
  union all select s from jsonb_array_elements(setup->'confirmationSources') s
  union all select s from jsonb_array_elements(coalesce(nullif(setup->'confirmationHistory','null'::jsonb),'[]'::jsonb)) s
  union all select witness
  union all select jsonb_build_object('level',s->'supersededBy'->'level','timeframe','5M')
   from jsonb_array_elements(coalesce(nullif(setup->'confirmationHistory','null'::jsonb),'[]'::jsonb)) s where s->>'status'='superseded'
 loop
  for prior_sw in select s from jsonb_array_elements(proofs) s where
   public.ts_source_key(s->'level',s->>'timeframe')=public.ts_source_key(item->'level',item->>'timeframe') loop
   if not public.same_ts_source(prior_sw->'level',item->'level') then return false; end if;
  end loop;
  proofs:=proofs||jsonb_build_array(item);
 end loop;
 return true;
exception when others then return false;
end $$;

create table public.trade_setup_source_snapshots (
 id bigint generated by default as identity primary key,
 trade_setup_id bigint not null references public.trade_setups(id) on delete cascade,
 payload jsonb not null check (public.valid_ts_source_snapshot(payload)),
 source_profile text generated always as (payload->>'sourceProfile') stored,
 settings_hash text generated always as (payload->>'settingsHash') stored,
 canonical_setup_known_at bigint generated always as ((payload->>'canonicalSetupKnownAt')::bigint) stored,
 evaluation_as_of bigint generated always as ((payload->>'evaluationAsOf')::bigint) stored,
 created_at timestamptz not null default now(),
 unique(trade_setup_id,source_profile,settings_hash,canonical_setup_known_at,evaluation_as_of),
 unique(id,trade_setup_id)
);
alter table public.trade_setup_source_snapshots enable row level security;
create policy source_snapshots_read on public.trade_setup_source_snapshots for select to anon using(true);
create policy source_snapshots_insert on public.trade_setup_source_snapshots for insert to anon with check(true);
grant select,insert on public.trade_setup_source_snapshots to anon;
grant usage,select on sequence public.trade_setup_source_snapshots_id_seq to anon;

create function public.guard_ts_source_snapshot() returns trigger language plpgsql set search_path=public as $$
declare parent public.trade_setups;
begin
 if TG_OP='UPDATE' then raise exception 'Source snapshots are immutable'; end if;
 select * into strict parent from public.trade_setups where id=NEW.trade_setup_id;
 if NEW.payload->>'instrument'<>parent.instrument or (NEW.payload->'setup'->>'dir')::integer<>
  (case when parent.direction='short' then 1 else -1 end)
  or to_timestamp((NEW.payload->'setup'->>'obStartTime')::double precision)<>parent.ob_start_time then
  raise exception 'Source snapshot does not belong to trade setup';
 end if;
 return NEW;
end $$;
create trigger source_snapshot_guard before insert or update on public.trade_setup_source_snapshots
 for each row execute function public.guard_ts_source_snapshot();

alter table public.pin_context add column trade_setup_source_snapshot_id bigint,
 add constraint pin_source_snapshot_kind check(trade_setup_source_snapshot_id is null or (kind='trade_setup' and trade_setup_id is not null)),
 add constraint pin_source_snapshot_parent foreign key(trade_setup_source_snapshot_id,trade_setup_id)
 references public.trade_setup_source_snapshots(id,trade_setup_id);
create function public.guard_pin_source_snapshot() returns trigger language plpgsql set search_path=public as $$
begin
 if OLD.trade_setup_source_snapshot_id is not null and
  NEW.trade_setup_source_snapshot_id is distinct from OLD.trade_setup_source_snapshot_id then
  raise exception 'Pinned source snapshot is immutable';
 end if;
 return NEW;
end $$;
create trigger pin_source_snapshot_immutable before update on public.pin_context
 for each row execute function public.guard_pin_source_snapshot();
alter table public.dealing_ranges add column trade_setup_source_snapshot_id bigint,
 add constraint range_source_snapshot_parent_required check(trade_setup_source_snapshot_id is null or trade_setup_id is not null),
 add constraint range_source_snapshot_parent foreign key(trade_setup_source_snapshot_id,trade_setup_id)
 references public.trade_setup_source_snapshots(id,trade_setup_id);
alter table public.trade_evidence add column source_context jsonb,
 add constraint evidence_source_context_shape check(source_context is null or coalesce(
  kind='ob' and source_context->>'role'='orderBlockEdgeSweep'
  and source_context->>'timeframe'='5M'
  and source_context->'level'->>'sourceKind'='orderBlock'
  and source_context->'level'->'dir' in ('1'::jsonb,'-1'::jsonb)
  and public.valid_ts_source_level(source_context->'level',
   (source_context->'level'->>'dir')::integer,
   (source_context->'level'->>'touchedTime')::numeric+300,source_context->>'timeframe'),false));

create function public.guard_ob_edge_evidence() returns trigger language plpgsql set search_path=public as $$
declare zone public.ob_zones; level jsonb; symbol text;
begin
 if NEW.source_context is null then return NEW; end if;
 level:=NEW.source_context->'level';
 select * into strict zone from public.ob_zones where id=NEW.ob_zone_id;
 if NEW.dealing_range_id is not null then
  select instrument into strict symbol from public.dealing_ranges where id=NEW.dealing_range_id;
 else
  select dr.instrument into strict symbol from public.trade_positions p join public.dealing_ranges dr on dr.id=p.dealing_range_id
   where p.id=NEW.trade_position_id;
 end if;
 if not coalesce(zone.instrument=symbol and zone.timeframe='5M' and NEW.timeframe='5M'
  and NEW.price=(level->>'price')::numeric
  and NEW.range_low=zone.bottom and NEW.range_high=zone.top
  and (level->>'sourceBottom')::numeric=zone.bottom and (level->>'sourceTop')::numeric=zone.top
  and zone.start_time=to_timestamp((level->>'sourceStartTime')::double precision)
  and NEW.source_time=zone.start_time
  and NEW.touched_time=to_timestamp((level->>'touchedTime')::double precision)
  and zone.direction=case when (level->>'sourceDirection')::integer=1 then 'long' else 'short' end,false)
 then raise exception 'OB edge evidence does not match its source'; end if;
 return NEW;
end $$;
create trigger ob_edge_evidence_guard before insert or update on public.trade_evidence
 for each row execute function public.guard_ob_edge_evidence();
