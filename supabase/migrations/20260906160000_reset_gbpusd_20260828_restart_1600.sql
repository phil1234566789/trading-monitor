-- Manueller State-Machine-Testlauf GBPUSD 28.08.2026 wollte direkt bei 16:00 Berlin einsteigen,
-- lief aber schrittweise (12:00 Bias -> Schritt 4 bei 16:00 manuell vorgespult) durch die Maschine
-- und übersprang dabei den News-Blackout-Check (Schritt 5s progressiver Batch-Loop), der bei
-- 14:00 UTC/16:00 Berlin ("Fed Chairman Warsh Speaks") gegriffen hätte. Zeile löschen, sauberer
-- Neustart über check_pretrade_gates direkt bei 16:00 statt weiter manuell durch Zwischenknoten
-- zu springen.
delete from state_machine_log where instrument = 'GBPUSD' and date_str = '2026-08-28';
delete from trading_loop_state where instrument = 'GBPUSD' and date_str = '2026-08-28';
