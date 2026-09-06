-- Neustart nach Korrektur NEWS_POST_EVENT_PAUSE_MINUTES 14 -> 15 (Philip: 16:14 lag noch in der
-- laufenden M5-Kerze 16:10-16:15, die erst um 16:15 geschlossen vorliegt; 14/15-Unterscheidung war
-- nur verwirrend, jetzt einheitlich 15 Min. feste Pause nach dem Event).
delete from state_machine_log where instrument = 'GBPUSD' and date_str = '2026-08-28';
delete from trading_loop_state where instrument = 'GBPUSD' and date_str = '2026-08-28';
