-- Sauberer Neustart des manuellen State-Machine-Testlaufs GBPUSD 28.08.2026, ab 16:00 Berlin,
-- diesmal ausschließlich über get_next_action -> genanntes Tool, Schritt für Schritt.
delete from state_machine_log where instrument = 'GBPUSD' and date_str = '2026-08-28';
delete from trading_loop_state where instrument = 'GBPUSD' and date_str = '2026-08-28';
