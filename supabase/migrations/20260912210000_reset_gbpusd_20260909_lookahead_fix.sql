-- Backtest GBPUSD 09.09.2026 wird nach dem Lookahead-Leak-Fix (Commit 8d2bd92: Fraktal-Pivots und
-- OB-Zonen erscheinen im Replay erst ab ihrer Bestaetigung, nicht ab Kerzenoeffnung) erneut neu
-- durchgespielt — der alte Durchlauf lief auf Leveln, die es zum jeweiligen Stichzeitpunkt noch
-- nicht gab. Keine trade_positions/dealing_ranges fuer den Tag vorhanden (geprueft), deshalb wie in
-- 20260910000000 nur Loop-State/Log zuruecksetzen, damit der Ablauf wieder bei Schritt 1 startet.
delete from state_machine_log where instrument = 'GBPUSD' and date_str = '2026-09-09';
delete from trading_loop_state where instrument = 'GBPUSD' and date_str = '2026-09-09';
