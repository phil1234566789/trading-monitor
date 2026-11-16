-- Vorberechnete DOB-Setup-Trades für die Statistikseite (/dob-statistik). TS2.0 war zu langsam, weil die Seite selbst rechnete;
-- hier liest sie nur fertige Zeilen. Eine Zeile = ein einmaliger Trade (gleiche Richtung/Entry/SL nur einmal, wie die Messung).
-- Zeiten in Epoch-Sekunden wie die Kerzen im Frontend.
create table public.dob_trade_setups (
  id text primary key,
  version text not null,
  instrument text not null,
  direction text not null check (direction in ('long','short')),
  route text not null check (route in ('a','b')),
  setup_id text not null,
  carrying_setups integer not null default 1,
  recognized_at bigint not null,
  entry_time bigint not null,
  entry_price double precision not null,
  stop_price double precision not null,
  target_price double precision,
  outcome text not null check (outcome in ('success','loss','open','ambiguous','unknown')),
  outcome_reason text,
  exit_time bigint,
  exit_price double precision,
  first_ob_start bigint not null,
  second_ob_start bigint not null,
  -- Quelle der Kraft: befüllt erst v1. Art z.B. 'ob_h1', Abstand OB1 ↔ H1/H4-Zone in USD, Zeitabstand Quelle → OB1.
  source_kind text,
  source_distance_usd double precision,
  source_gap_seconds bigint,
  computed_at timestamptz not null default now()
);
create index dob_trade_setups_page on public.dob_trade_setups (instrument, version, entry_time, id);

alter table public.dob_trade_setups enable row level security;
create policy dob_trade_setups_read on public.dob_trade_setups for select to anon, authenticated using (true);

-- Befüllskript läuft nur mit Anon-Key. Atomarer Austausch je Instrument+Version, damit die Seite nie einen halben Stand sieht;
-- die Zeilen sind jederzeit aus den Kerzen neu berechenbar, deshalb reicht der Anon-Zugang.
create function public.replace_dob_trade_setups(p_instrument text, p_version text, p_rows jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare inserted integer;
begin
  delete from dob_trade_setups where instrument = p_instrument and version = p_version;
  insert into dob_trade_setups select * from jsonb_populate_recordset(null::dob_trade_setups, p_rows)
    where instrument = p_instrument and version = p_version;
  get diagnostics inserted = row_count;
  return inserted;
end $$;
revoke all on function public.replace_dob_trade_setups(text, text, jsonb) from public;
grant execute on function public.replace_dob_trade_setups(text, text, jsonb) to anon, authenticated;
