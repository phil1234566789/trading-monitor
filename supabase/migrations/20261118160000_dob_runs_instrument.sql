-- DOB-Läufe je Instrument (GBPUSD-Läufe neben XAU): die Statistikseite zeigt im Lauf-Dropdown nur Läufe des gewählten Instruments.
-- Bestehende Läufe sind alle XAU. Die RPC trägt das Instrument des Füllaufrufs ein; ältere Aufrufer bleiben gültig.
alter table public.dob_trade_setup_runs add column if not exists instrument text not null default 'XAUUSD';

create or replace function public.replace_dob_trade_setups(p_run jsonb, p_instrument text, p_rows jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare inserted integer; run_key text := p_run->>'id';
begin
  insert into dob_trade_setup_runs (id, label, description, setup_version, sort, data_end, computed_at, poi_type, instrument)
  values (run_key, p_run->>'label', p_run->>'description', p_run->>'setup_version', coalesce((p_run->>'sort')::integer, 0),
    (p_run->>'data_end')::bigint, now(), coalesce(p_run->>'poi_type', 'htf_ob'), p_instrument)
  on conflict (id) do update set label = excluded.label, description = excluded.description, setup_version = excluded.setup_version,
    sort = excluded.sort, data_end = excluded.data_end, computed_at = excluded.computed_at, poi_type = excluded.poi_type,
    instrument = excluded.instrument;
  delete from dob_trade_setups where instrument = p_instrument and run_id = run_key;
  insert into dob_trade_setups
    select (jsonb_populate_record(null::dob_trade_setups, e || jsonb_build_object('computed_at', now()))).*
    from jsonb_array_elements(p_rows) e
    where e->>'instrument' = p_instrument and e->>'run_id' = run_key;
  get diagnostics inserted = row_count;
  return inserted;
end $$;

-- GBPUSD HTF-OB: Start ohne Sperren, TP 2R, Gegen-DOB wie der XAU-Default, Gegenkerzen aus, kein Teilprofit. Philip stellt selbst ein.
insert into public.dob_guardrails (instrument, poi_type, counter_dob_mode, counter_candles_mode, partial_at_r)
values ('GBPUSD', 'htf_ob', 'live_block_dead_5r', 'off', null) on conflict (instrument, poi_type) do nothing;
