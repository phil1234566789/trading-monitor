-- Frischer State-Machine-Testlauf nach dem Aufmerksamkeits-Level-Fix (docs/attention-levels.md,
-- performFullTick nutzt jetzt M5-Watch-Level bei Fall 1/2 statt 1H/4H+Bias-Resten). Dealing Range
-- #77 und ihre Confirmations (#173/175/177) bleiben unberuehrt (andere Tabellen) - nur der
-- Loop-State/State-Machine-Log fuer den Tag wird zurueckgesetzt, analog den fruehreren Restarts
-- (siehe z.B. 20260906164500_reset_gbpusd_20260828_15min_fix.sql).
delete from state_machine_log where instrument = 'GBPUSD' and date_str = '2026-08-28';
delete from trading_loop_state where instrument = 'GBPUSD' and date_str = '2026-08-28';
