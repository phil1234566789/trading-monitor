-- „Quelle der Kraft“ heißt POI (src/dobPoiType.js): die Spalte der POI-Art wird poi_type mit den Werten htf_ob | lq_sweep, die
-- source_*-Spalten der DOB-Trades werden poi_*. Reine Umbenennung, Werte und Läufe bleiben; Trade-IDs und Links (dob=dob-setup-v3:…)
-- hängen an keiner dieser Spalten.
alter table public.dob_guardrails rename column family to poi_type;
alter table public.dob_trade_setup_runs rename column family to poi_type;
alter table public.dob_alarm_events rename column family to poi_type;
alter table public.dob_guardrails drop constraint dob_guardrails_family_check,
  add constraint dob_guardrails_poi_type_check check (poi_type in ('htf_ob', 'lq_sweep'));
alter table public.dob_trade_setup_runs drop constraint dob_trade_setup_runs_family_check,
  add constraint dob_trade_setup_runs_poi_type_check check (poi_type in ('htf_ob', 'lq_sweep'));
alter table public.dob_alarm_events drop constraint dob_alarm_events_family_check,
  add constraint dob_alarm_events_poi_type_check check (poi_type in ('htf_ob', 'lq_sweep'));

alter table public.dob_trade_setups rename column source_kind to poi_kind;
alter table public.dob_trade_setups rename column source_distance_usd to poi_distance_usd;
alter table public.dob_trade_setups rename column source_gap_seconds to poi_gap_seconds;
alter table public.dob_trade_setups rename column source_atr to poi_atr;
alter table public.dob_trade_setups rename column source_distance_atr to poi_distance_atr;
alter table public.dob_trade_setups rename column source_retest_kind to poi_retest_kind;
alter table public.dob_trade_setups rename column source_retest_age_seconds to poi_retest_age_seconds;
alter table public.dob_trade_setups rename column source_zone_age_seconds to poi_zone_age_seconds;
alter table public.dob_trade_setups rename column source_zone_top to poi_zone_top;
alter table public.dob_trade_setups rename column source_zone_bottom to poi_zone_bottom;
alter table public.dob_trade_setups rename column source_zone_start to poi_zone_start;
alter table public.dob_trade_setups rename constraint dob_trade_setups_source_retest_kind_check to dob_trade_setups_poi_retest_kind_check;

-- Wie 20261118120000, Spalte jetzt poi_type (p_run.poi_type, fehlt sie, bleibt htf_ob).
create or replace function public.replace_dob_trade_setups(p_run jsonb, p_instrument text, p_rows jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare inserted integer; run_key text := p_run->>'id';
begin
  insert into dob_trade_setup_runs (id, label, description, setup_version, sort, data_end, computed_at, poi_type)
  values (run_key, p_run->>'label', p_run->>'description', p_run->>'setup_version', coalesce((p_run->>'sort')::integer, 0),
    (p_run->>'data_end')::bigint, now(), coalesce(p_run->>'poi_type', 'htf_ob'))
  on conflict (id) do update set label = excluded.label, description = excluded.description, setup_version = excluded.setup_version,
    sort = excluded.sort, data_end = excluded.data_end, computed_at = excluded.computed_at, poi_type = excluded.poi_type;
  delete from dob_trade_setups where instrument = p_instrument and run_id = run_key;
  insert into dob_trade_setups
    select (jsonb_populate_record(null::dob_trade_setups, e || jsonb_build_object('computed_at', now()))).*
    from jsonb_array_elements(p_rows) e
    where e->>'instrument' = p_instrument and e->>'run_id' = run_key;
  get diagnostics inserted = row_count;
  return inserted;
end $$;

-- Lauf-Texte im Dropdown: dieselbe Umbenennung, ohne die Läufe neu zu füllen.
update public.dob_trade_setup_runs set
  label = replace(label, 'Quelle der Kraft', 'POI'),
  description = replace(replace(replace(description, 'Retest der Kraftquelle', 'Retest des POI'), 'Quelle der Kraft', 'POI'), 'Kraftquelle', 'POI');
