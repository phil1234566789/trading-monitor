-- Versehentliche Live-Zeile fuer GBPUSD/2026-09-15 entfernen.
--
-- Entstanden am 15.09.2026 um 00:47 Uhr: check_pretrade_gates wurde mit `replayUntilSec` statt
-- `nowSec` aufgerufen. Das Tool kennt nur `nowSec`, hat den unbekannten Parameter stillschweigend
-- verworfen (Zod strippt unbekannte Keys) und ist auf seinen Default "jetzt" zurueckgefallen. Aus
-- einem Backtest-Aufruf fuer den 09.09. wurde damit ein Live-Aufruf fuer den 15.09. — nachts um
-- 00:47 ausserhalb des Handelszeit-Fensters 08:00-18:00, also current_node=end_keinTrade fuer
-- einen Tag, an dem noch gar nicht gearbeitet wurde.
--
-- Die Zeile ist reine Fehl-Buchhaltung, kein Analyse-Ergebnis: current_step=1, kein Bias, keine
-- Targets, leeres heartbeat_log.
delete from state_machine_log where instrument = 'GBPUSD' and date_str = '2026-09-15';
delete from trading_loop_state where instrument = 'GBPUSD' and date_str = '2026-09-15';
