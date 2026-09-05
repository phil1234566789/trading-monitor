-- Vierter Reset des GBPUSD-28.08.2026-Testlaufs — nach Einführung von retested/Confluence-Modus.
delete from state_machine_log where instrument = 'GBPUSD' and date_str = '2026-08-28';
delete from trading_loop_state where instrument = 'GBPUSD' and date_str = '2026-08-28';
