-- Einmaliger Reset des GBPUSD-28.08.2026-Testlaufs (State-Machine-V2-Nachtest, Philip 05.09.2026) --
-- state_machine_log zuerst (loop_state_id referenziert trading_loop_state per "on delete set null",
-- Reihenfolge daher unkritisch, aber so bleibt keine tote Referenz stehen). Bewusst auf
-- instrument+date_str gescoped statt eines kompletten Tabellen-Wipes wie bei der letzten
-- Test-Reset-Migration, um einen evtl. parallel laufenden EURUSD-Loop nicht zu beruehren.
delete from state_machine_log where instrument = 'GBPUSD' and date_str = '2026-08-28';
delete from trading_loop_state where instrument = 'GBPUSD' and date_str = '2026-08-28';
