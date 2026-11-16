-- Läufe/Varianten der DOB-Statistik (Dropdown auf /dob-statistik): v1 oder ein weiterer Filter erscheint als neue Zeile, ohne Seitenumbau.
create table public.dob_trade_setup_runs (
  id text primary key,
  label text not null,
  description text,
  setup_version text not null,
  sort integer not null default 0,
  data_end bigint,
  computed_at timestamptz not null default now()
);
alter table public.dob_trade_setup_runs enable row level security;
create policy dob_trade_setup_runs_read on public.dob_trade_setup_runs for select to anon, authenticated using (true);

insert into public.dob_trade_setup_runs (id, label, description, setup_version, sort)
values ('dob-setup-v0', 'v0 · nur DOB', 'DOB + TP 2R, ohne Quelle der Kraft', 'dob-setup-v0', 0);

alter table public.dob_trade_setups rename column version to run_id;
alter table public.dob_trade_setups add constraint dob_trade_setups_run_fk
  foreign key (run_id) references public.dob_trade_setup_runs (id) on delete cascade;

drop function public.replace_dob_trade_setups(text, text, jsonb);
-- Lauf-Metadaten und Trades in einer Transaktion, damit Dropdown und Zahlen nie auseinanderlaufen.
create function public.replace_dob_trade_setups(p_run jsonb, p_instrument text, p_rows jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare inserted integer; run_key text := p_run->>'id';
begin
  insert into dob_trade_setup_runs (id, label, description, setup_version, sort, data_end, computed_at)
  values (run_key, p_run->>'label', p_run->>'description', p_run->>'setup_version', coalesce((p_run->>'sort')::integer, 0),
    (p_run->>'data_end')::bigint, now())
  on conflict (id) do update set label = excluded.label, description = excluded.description, setup_version = excluded.setup_version,
    sort = excluded.sort, data_end = excluded.data_end, computed_at = excluded.computed_at;
  delete from dob_trade_setups where instrument = p_instrument and run_id = run_key;
  insert into dob_trade_setups
    select (jsonb_populate_record(null::dob_trade_setups, e || jsonb_build_object('computed_at', now()))).*
    from jsonb_array_elements(p_rows) e
    where e->>'instrument' = p_instrument and e->>'run_id' = run_key;
  get diagnostics inserted = row_count;
  return inserted;
end $$;
revoke all on function public.replace_dob_trade_setups(jsonb, text, jsonb) from public;
grant execute on function public.replace_dob_trade_setups(jsonb, text, jsonb) to anon, authenticated;
