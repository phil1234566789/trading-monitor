-- Recovery nach dem current_step-Default-Bug (siehe 20260906150500_trading_loop_state_
-- current_step_default.sql): run_bias_check GBPUSD 28.08.2026 hatte BIAS_COMPUTED erfolgreich
-- transitioniert (current_node=s3_bias.llm3_kontextSynthese), ist dann aber beim anschließenden
-- upsertBiasFields gecrasht, BEVOR direction/trend_target/countertrend_target/invalidation
-- geschrieben wurden — Zeile blieb in inkonsistentem Zwischenzustand stehen (Knoten schon hinter
-- BIAS_COMPUTED, aber kein Bias). Ein erneuter run_bias_check-Aufruf würde jetzt hart gegen die
-- Guard-Transition laufen (BIAS_COMPUTED ist an llm3_kontextSynthese nicht mehr gültig) statt sich
-- selbst zu reparieren — Zeile löschen, nächster run_bias_check-Aufruf legt sie sauber neu an.
delete from state_machine_log where instrument = 'GBPUSD' and date_str = '2026-08-28';
delete from trading_loop_state where instrument = 'GBPUSD' and date_str = '2026-08-28';
