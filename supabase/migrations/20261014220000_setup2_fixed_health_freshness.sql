-- Die Entwarnung darf lange Scans nicht als gesunden, aktuellen Marktstand behandeln.
create or replace function public.setup2_recovery_healthy(p_reported_at timestamptz)
returns boolean language sql stable security definer set search_path=public as $$
 with clock as (select now() utc,now() at time zone 'Europe/Berlin' local),
 hours as (select utc,extract(hour from local)*60+extract(minute from local) minute,
  case extract(isodow from local) when 6 then 'saturday' when 7 then 'sunday' else 'weekday' end day from clock)
 select exists(select 1 from setup2_live_state where enabled)
 and not exists(
  select 1 from setup2_live_state s cross join hours h left join trading_schedules t on t.instrument=s.instrument
  where s.enabled and (
   nullif(s.state->>'error','') is not null
   or coalesce((s.state->>'lastSuccessAt')::timestamptz,'-infinity')<=p_reported_at
   or coalesce((s.state->>'nextExpectedCheck')::timestamptz,'-infinity')+interval '120 seconds'<h.utc
   or (exists(select 1 from jsonb_array_elements(coalesce(t.trading_windows->h.day,'[]'::jsonb)) w
      where h.minute>=(w->>0)::numeric and h.minute<(w->>1)::numeric)
    and case when jsonb_array_length(coalesce(s.state->'activeRanges','[]'::jsonb))>0
     then coalesce((s.state->>'evaluatedThrough')::timestamptz,'-infinity')+interval '120 seconds'<h.utc
     else coalesce(to_timestamp((s.state->>'lastM5Time')::double precision+300),'-infinity')+interval '420 seconds'<h.utc
    end)
  )
 )
 and exists(select 1 from pushover_test_limits where id
  and watch_checked_at>now()-interval '150 seconds'
  and provider_checked_at>now()-interval '420 seconds' and provider_error is null)
$$;
