-- Loop-State GBPUSD 09.09.2026 zuruecksetzen fuer Runde 7.
--
-- Runde 6 kam bis s3_bias.llm3_kontextSynthese (Bias Long), Philip wollte einfach wieder einen
-- leeren Stand. Wie in den frueheren Resets nur Loop-State/Log loeschen. Keine dealing_ranges
-- betroffen — get_tsc_range lieferte vor diesem Reset bereits null.
delete from state_machine_log where instrument = 'GBPUSD' and date_str = '2026-09-09';
delete from trading_loop_state where instrument = 'GBPUSD' and date_str = '2026-09-09';
