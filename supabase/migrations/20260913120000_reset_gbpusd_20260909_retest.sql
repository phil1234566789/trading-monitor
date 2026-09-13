-- Loop-State GBPUSD 09.09.2026 wird auf Philips Wunsch fuer einen erneuten Testlauf zurueckgesetzt
-- (Stand vor diesem Reset: Schritt 7 s7_findEntry, keine dealing_ranges/trade_positions fuer den
-- Tag vorhanden, geprueft ueber get_journal). Wie in 20260910000000/20260912210000 nur
-- Loop-State/Log loeschen, damit der Ablauf wieder bei Schritt 1 startet.
delete from state_machine_log where instrument = 'GBPUSD' and date_str = '2026-09-09';
delete from trading_loop_state where instrument = 'GBPUSD' and date_str = '2026-09-09';
