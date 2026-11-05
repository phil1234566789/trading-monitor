alter table public.mt5_accounts add column trade_role text check(trade_role in ('risky','safe','normal'));
create unique index mt5_account_trade_role_unique on public.mt5_accounts(trade_role) where not archived and trade_role is not null;
create function public.mt5_assign_account_role(p_account uuid,p_role text)
returns void language plpgsql security invoker set search_path=public as $$
begin
 perform pg_advisory_xact_lock(29092026,1);
 if p_role is not null and p_role not in ('risky','safe','normal') then raise exception 'invalid_role';end if;
 if not exists(select 1 from public.mt5_accounts where id=p_account and not archived) then raise exception 'account_not_found';end if;
 -- Ein Tag bezeichnet genau ein handelbares Konto, keine implizite Vervielfachung.
 update public.mt5_accounts set trade_role=null where trade_role=p_role;
 update public.mt5_accounts set trade_role=p_role where id=p_account;
end $$;
revoke all on function public.mt5_assign_account_role(uuid,text) from public,anon,authenticated;
grant execute on function public.mt5_assign_account_role(uuid,text) to service_role;
