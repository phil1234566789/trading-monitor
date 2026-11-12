alter table public.mt5_accounts add column if not exists history_requested_at timestamptz;
alter table public.mt5_history_sync add column if not exists completed_request_at timestamptz;

create or replace function public.mt5_request_history_refresh()
returns table(account_id uuid, requested_at timestamptz)
language sql security definer set search_path = public as $$
  update public.mt5_accounts
  set history_requested_at = greatest(history_requested_at, statement_timestamp())
  where not archived
  returning id, history_requested_at;
$$;
revoke all on function public.mt5_request_history_refresh() from public, anon, authenticated;
grant execute on function public.mt5_request_history_refresh() to service_role;
