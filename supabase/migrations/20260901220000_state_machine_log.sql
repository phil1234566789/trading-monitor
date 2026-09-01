-- state_machine_log (milk-city Task state-machine-decision-log, siehe docs/state-machine.md) —
-- granulare Entscheidungs-Ebene UNTER trading_loop_state.heartbeat_log. heartbeat_log bleibt die
-- Batch-Zusammenfassung fürs Chat-Kopieren; diese Tabelle loggt JEDEN Entscheidungspunkt aus allen
-- 5 state-machine-Tools, auch wenn (noch) gar kein Loop existiert — Auslöser 01.09.2026: ein durch
-- das News-Gate geblockter run_bias_check-Versuch verschwand bisher spurlos, ohne im
-- heartbeat_log/UI sichtbar zu werden, weil trading_loop_state in diesem Fall gar nicht geschrieben
-- wird (siehe loopState.ts).
--
-- loop_state_id ist bewusst NULLABLE (kein FK-Zwang) — genau die geblockten Gate-Checks vor einem
-- entstandenen Loop sowie ein unresolvedTrend-Abbruch (Fall 5, 03-htf-bias.md) haben keinen Loop,
-- den sie referenzieren könnten.
create table state_machine_log (
  id bigint generated always as identity primary key,
  instrument text not null,
  date_str text not null,
  -- Analysezeitpunkt (Unix-Sekunden) der Entscheidung — bei Backtest/Replay der replay-Zeitpunkt,
  -- nicht der tatsächliche Insert-Zeitpunkt (siehe replayUntilSec-Konvention in loopState.ts).
  sec bigint not null,
  step smallint not null check (step between 1 and 6),
  tool text not null,
  decision text not null,
  result jsonb not null default '{}'::jsonb,
  message text,
  loop_state_id bigint references trading_loop_state (id) on delete set null,
  created_at timestamptz not null default now()
);

create index state_machine_log_instrument_date_idx on state_machine_log (instrument, date_str);
create index state_machine_log_loop_state_id_idx on state_machine_log (loop_state_id);

alter table state_machine_log enable row level security;

-- Append-only Log — anders als trading_loop_state (das per Tick gepatcht wird) braucht diese
-- Tabelle kein anon update/delete, nur read+insert (siehe stateMachineLog.ts: logDecision fügt nur
-- ein, ändert/löscht nie).
create policy "state_machine_log read for anon"
  on state_machine_log for select
  to anon
  using (true);

create policy "state_machine_log anon insert"
  on state_machine_log for insert
  to anon
  with check (true);
