-- Erneuter Reset für GBPUSD 28.08.2026: die vorherige Testzeile stand bereits bei s3_bias.computing
-- (16:14 manuell berechnet), jetzt soll der frisch deployte news.retryAtSec/retryAt-Fix
-- (check_pretrade_gates berechnet die Freigabe-Zeit nach einem News-Block selbst statt Lana raten zu
-- lassen) end-to-end ab 16:00 gegengetestet werden.
delete from state_machine_log where instrument = 'GBPUSD' and date_str = '2026-08-28';
delete from trading_loop_state where instrument = 'GBPUSD' and date_str = '2026-08-28';
