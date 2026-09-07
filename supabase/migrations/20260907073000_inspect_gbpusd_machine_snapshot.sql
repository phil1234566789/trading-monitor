-- Inspektion (kein Datenwechsel) — Shape von machine_snapshot vor dem Fall-2-Korrektur-Fix
-- (current_node steckt auf s45.llmPickTarget fest, siehe PLAN-notifications.md) verstehen, bevor
-- ein gezielter UPDATE geschrieben wird.
do $$
declare
  snap jsonb;
begin
  select machine_snapshot into snap from trading_loop_state
  where instrument = 'GBPUSD' and date_str = '2026-08-28';
  raise notice 'machine_snapshot: %', snap;
end $$;
