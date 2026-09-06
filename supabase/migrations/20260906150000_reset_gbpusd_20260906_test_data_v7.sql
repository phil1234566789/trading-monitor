-- Nach dem Umbau auf "permanenter State pro (instrument, date_str)" (siehe
-- 20260906140000_trading_loop_state_permanent_per_day.sql) ist die Live-Testzeile der anderen
-- Session (S1/S2-Gate-Visibility-Verifikation, date_str=2026-09-06, ein Sonntag ohne echten
-- Forex-Handel) eine eigene Zeile geworden statt vom v6-Reset (nur date_str=2026-08-28) erfasst zu
-- werden. Loop-Status zeigte sie weiter als "AKTIV" an, obwohl sie fuer den GBPUSD-28.08-Testlauf
-- irrelevant ist.
delete from state_machine_log where instrument = 'GBPUSD' and date_str = '2026-09-06';
delete from trading_loop_state where instrument = 'GBPUSD' and date_str = '2026-09-06';
