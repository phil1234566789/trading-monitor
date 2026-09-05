-- Einmaliger Reset der Test-Daten aus dem pendingDecisions-Pilot (05.09.2026, GBPUSD-Backtest
-- 28.08.2026) -- state_machine_log zuerst (loop_state_id referenziert trading_loop_state per
-- "on delete set null", Reihenfolge daher unkritisch, aber so bleibt keine tote Referenz stehen).
delete from state_machine_log;
delete from trading_loop_state;
