-- Zweiter Reset des GBPUSD-28.08.2026-Testlaufs (Nachtest nach den drei Bugfixes vom 05.09.2026:
-- Erster-Tick-Shortcut, OB-Wick-Invalidierung, completedTradeSetup-Live-Check) — gleiches Muster
-- wie die vorherige Reset-Migration, wieder gescoped auf instrument+date_str.
delete from state_machine_log where instrument = 'GBPUSD' and date_str = '2026-08-28';
delete from trading_loop_state where instrument = 'GBPUSD' and date_str = '2026-08-28';
