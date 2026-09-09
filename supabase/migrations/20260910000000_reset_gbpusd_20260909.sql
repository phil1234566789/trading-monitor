-- Backtest GBPUSD 09.09.2026 wird nach dem oppositeSetup-Fix (siehe 20260909220000) komplett neu
-- durchgespielt. Dealing Ranges #81/#82 sind bereits geloescht, es gibt keine trade_positions —
-- nur Loop-State/Log fuer den Tag zuruecksetzen, damit der Ablauf sauber wieder bei Schritt 1 startet.
delete from state_machine_log where instrument = 'GBPUSD' and date_str = '2026-09-09';
delete from trading_loop_state where instrument = 'GBPUSD' and date_str = '2026-09-09';
