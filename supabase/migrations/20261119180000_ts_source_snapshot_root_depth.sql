-- Seit TS1.1 v7 darf die Wurzel (Tiefe 0) die LS belegen; wie assertOwnerProof in _shared/tradeSetupSourceSnapshot.js
-- ist Tiefe 0 nur für den Wurzel-Beleg erlaubt, sonst bleibt es bei >= 1.
create or replace function public.valid_ts_owner(proof jsonb, d integer, known numeric, source jsonb)
 returns boolean language plpgsql immutable set search_path to 'public'
as $function$
declare r jsonb; p jsonb;
begin
 r:=coalesce(proof->'range',proof);
 if not coalesce(jsonb_typeof(proof)='object' and public.valid_ts_source_time(proof->'knownAt')
  and (proof->>'knownAt')::numeric<=known and jsonb_typeof(proof->'depth')='number'
  and (proof->>'depth')::numeric=trunc((proof->>'depth')::numeric)
  and (proof->>'depth')::numeric>=case when proof->>'basis'='deepestRangeAtLevelBirth' then 0 else 1 end
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
end $function$;
