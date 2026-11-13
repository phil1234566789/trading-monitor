-- Die schlanke Kurvenprojektion braucht die Kontoidentität; Trade-IDs sind kein API-Ersatz dafür.
create or replace function public.mt5_statistics_series(p_account_ids uuid[],p_asset text default '',p_currency text default 'USD',p_from date default null,p_to date default null,p_outcomes text[] default array['win','loss','breakeven'],p_offset integer default 0,p_limit integer default 500)
returns jsonb language sql stable security definer set search_path=public as $$
 with f as materialized(select id,account_id,opened_at,closed_at,net,commission from mt5_statistics_filtered(p_account_ids,p_asset,p_currency,p_from,p_to,p_outcomes)),
 page as(select * from f order by closed_at,id limit greatest(1,least(500,p_limit)) offset greatest(0,p_offset))
 select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(page) order by closed_at,id) from page),'[]'::jsonb),
 'next_offset',case when greatest(0,p_offset)+(select count(*) from page)<(select count(*) from f) then greatest(0,p_offset)+(select count(*) from page) else null end)
$$;
revoke all on function public.mt5_statistics_series(uuid[],text,text,date,date,text[],integer,integer) from public,anon,authenticated;
grant execute on function public.mt5_statistics_series(uuid[],text,text,date,date,text[],integer,integer) to service_role;
