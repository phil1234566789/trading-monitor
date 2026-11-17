-- Setup-Familien des DOB-Setups (src/dobSetupFamily.js): htf_ob = Quelle der Kraft H1/H4-OB (alles Bisherige), ls = LS-Sweep (folgt).
-- Konfig, Läufe und Alarm-Historie je Familie, damit eine LS-Änderung HTF-OB nie mitverändert. Bestehende Zeilen werden htf_ob,
-- Werte unverändert. Die LS-Zeile kommt erst in 20261118121000, nachdem Seite und Watcher nach Familie filtern (sonst träfe
-- deren alte Abfrage je Instrument zwei Zeilen).
alter table public.dob_guardrails add column family text not null default 'htf_ob' check (family in ('htf_ob', 'ls'));
alter table public.dob_guardrails drop constraint dob_guardrails_pkey;
alter table public.dob_guardrails add primary key (instrument, family);

alter table public.dob_trade_setup_runs add column family text not null default 'htf_ob' check (family in ('htf_ob', 'ls'));
alter table public.dob_alarm_events add column family text not null default 'htf_ob' check (family in ('htf_ob', 'ls'));

-- Wie 20261116223000, nur mit Familie aus p_run (fehlt sie, bleibt htf_ob).
create or replace function public.replace_dob_trade_setups(p_run jsonb, p_instrument text, p_rows jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare inserted integer; run_key text := p_run->>'id';
begin
  insert into dob_trade_setup_runs (id, label, description, setup_version, sort, data_end, computed_at, family)
  values (run_key, p_run->>'label', p_run->>'description', p_run->>'setup_version', coalesce((p_run->>'sort')::integer, 0),
    (p_run->>'data_end')::bigint, now(), coalesce(p_run->>'family', 'htf_ob'))
  on conflict (id) do update set label = excluded.label, description = excluded.description, setup_version = excluded.setup_version,
    sort = excluded.sort, data_end = excluded.data_end, computed_at = excluded.computed_at, family = excluded.family;
  delete from dob_trade_setups where instrument = p_instrument and run_id = run_key;
  insert into dob_trade_setups
    select (jsonb_populate_record(null::dob_trade_setups, e || jsonb_build_object('computed_at', now()))).*
    from jsonb_array_elements(p_rows) e
    where e->>'instrument' = p_instrument and e->>'run_id' = run_key;
  get diagnostics inserted = row_count;
  return inserted;
end $$;
