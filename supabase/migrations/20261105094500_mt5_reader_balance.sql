-- Lesesnapshots dürfen weder die Handelsverbindung noch bestätigte Brokergrenzen überschreiben.
create function public.mt5_record_reader_balance(p_account_id uuid,p_snapshot jsonb,p_observed_at timestamptz)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if p_observed_at is null or p_observed_at<now()-interval '20 seconds' or p_observed_at>now()+interval '2 seconds'
  or jsonb_typeof(p_snapshot->'balance') is distinct from 'number'
  or jsonb_typeof(p_snapshot->'equity') is distinct from 'number'
  or jsonb_typeof(p_snapshot->'positions') is distinct from 'number'
  or (p_snapshot->>'positions')::integer<0 or coalesce(p_snapshot->>'currency','')!~'^[A-Z]{3,8}$'
  or not exists(select 1 from public.mt5_accounts where id=p_account_id and not archived) then
  raise exception 'invalid_reader_snapshot';
 end if;
 insert into public.mt5_account_balances(account_id,balance,equity,currency,positions,balance_at,balance_source)
 values(p_account_id,(p_snapshot->>'balance')::double precision,(p_snapshot->>'equity')::double precision,
  p_snapshot->>'currency',(p_snapshot->>'positions')::integer,p_observed_at,'MT5-Reader')
 on conflict(account_id) do update set balance=excluded.balance,equity=excluded.equity,currency=excluded.currency,
  positions=excluded.positions,balance_at=excluded.balance_at,balance_source=excluded.balance_source
 where mt5_account_balances.balance_at is null or excluded.balance_at>mt5_account_balances.balance_at;
end $$;
revoke all on function public.mt5_record_reader_balance(uuid,jsonb,timestamptz) from public,anon,authenticated;
grant execute on function public.mt5_record_reader_balance(uuid,jsonb,timestamptz) to service_role;
