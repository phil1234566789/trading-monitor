-- State Machine V1 (siehe docs/state-machine.md, milk-city Task state-machine-v1) — Auslöser:
-- Backtest GBPUSD 28.08.2026, Lana ist nach einem News-Spike aus dem dokumentierten Schritt-5-
-- Ablauf ausgestiegen (fehlende Pflicht-Tool-Aufrufe, kein Heartbeat, falsch gelabelter OB,
-- übersehenes Zwischen-Level). trading_loop_state ist der persistente Zustand, den die neuen
-- run_bias_check/run_dealing_range_loop-Tools lesen/schreiben, statt sich auf Lanas
-- Chat-Gedächtnis zu verlassen (auch über einen neuen Chat/eine neue Session hinweg fortsetzbar).
--
-- Partial-Unique-Index (nur EIN 'active'-Loop pro Instrument): ein Fall-1-Abschluss oder
-- Fall-4-Trigger beendet den Loop (status wechselt weg von 'active'), ein neuer run_bias_check-Aufruf
-- legt eine NEUE Zeile an (spiegelt die bestehende "mehrere DRs pro Tag, jede mit eigener Kennung"-
-- Regel aus 05-dealing-range-bestaetigen.md).
create table trading_loop_state (
  id bigint generated always as identity primary key,
  instrument text not null,
  date_str text not null,
  status text not null check (status in ('active', 'fall1_handoff', 'fall4_pending_bias', 'stopped_market_close', 'stopped_news_pause', 'superseded', 'completed')),
  current_step smallint not null check (current_step in (3, 4, 5)),
  current_case smallint check (current_case between 1 and 4),
  -- Trend-Richtung aus Schritt 3 (trend='uptrend' -> direction='long') — ohne diese Spalte müsste
  -- run_dealing_range_loop sie unzuverlässig aus trend_target/currentPrice zurückrechnen (Preis kann
  -- sich seit dem letzten vollen Durchlauf schon über das Target hinaus bewegt haben).
  direction text not null check (direction in ('long', 'short')),
  dealing_range_id bigint references dealing_ranges (id) on delete set null,
  trend_target jsonb,
  countertrend_target jsonb,
  intermediate_level jsonb,
  invalidation numeric,
  watch_level_above jsonb,
  watch_level_below jsonb,
  bias_computed_at timestamptz,
  last_analysis_time_sec bigint,
  -- null = live, gesetzt = Backtest/Replay-Zeitpunkt (dieselbe Konvention wie replayUntilSec auf
  -- get_data_export/get_data_snapshot/get_recent_reactions).
  replay_until_sec bigint,
  -- Append-only, serverseitig statt nur in der Tool-Response — schließt genau die Lücke aus dem
  -- Vorfall: selbst wenn Lana eine Antwort nicht vollständig weiterreicht, steht das Log fest und
  -- ist über einen Folge-Call (auch neue Chat-Session) abrufbar.
  heartbeat_log jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index trading_loop_state_instrument_idx on trading_loop_state (instrument);

create unique index trading_loop_state_one_active_per_instrument
  on trading_loop_state (instrument)
  where (status = 'active');

create trigger trading_loop_state_set_updated_at
  before update on trading_loop_state
  for each row
  execute function set_updated_at();

alter table trading_loop_state enable row level security;

-- Gleiches Anon-CRUD-Muster wie dealing_ranges/trade_positions (siehe 20260731120000) — der
-- MCP-Server schreibt mit dem anon-key (kein Service-Role-Key in dieser Einzelnutzer-App, siehe
-- CLAUDE.md "MCP-Server").
create policy "trading_loop_state read for anon"
  on trading_loop_state for select
  to anon
  using (true);

create policy "trading_loop_state anon insert"
  on trading_loop_state for insert
  to anon
  with check (true);

create policy "trading_loop_state anon update"
  on trading_loop_state for update
  to anon
  using (true)
  with check (true);

create policy "trading_loop_state anon delete"
  on trading_loop_state for delete
  to anon
  using (true);

-- Lanas Schritt-3/6-Freitext-Synthese (Kontext-Info-Herleitung, VALIDE/INVALIDE-Begründung) braucht
-- ein strukturiertes Zuhause in der DB, sonst geht sie verloren, sobald trading-runs/*.md (siehe
-- docs/state-machine.md "Reporting") ihren Zweck als einzige Aufzeichnung verliert. Analog zum
-- bereits vorhandenen trade_positions.reasoning.
alter table dealing_ranges add column reasoning text;
