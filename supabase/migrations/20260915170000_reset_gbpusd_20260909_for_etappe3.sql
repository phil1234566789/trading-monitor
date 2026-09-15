-- Loop-State GBPUSD 09.09.2026 zuruecksetzen vor dem A/B/C-Umbau, Etappe 3.
--
-- Etappe 3 baut den s45-Teilbaum in tradingMachine.ts strukturell um (Dealing Range wird von der
-- Ablaufsteuerung entkoppelt, siehe milk-city-Task a-b-c-dauerlauf-statt-linearer-trading-steps-
-- sequenz). Ein persistierter Snapshot, der auf einen umbenannten/entfernten Knoten zeigt, macht den
-- Actor beim naechsten Aufruf inkompatibel (siehe machineState.ts-Kopfkommentar, Bug-Vorfall
-- 05.09.2026) — es gibt dafuer keine automatische Reparatur.
--
-- Stand vor diesem Reset: Runde 5 lief bis s45.pinCheck2 (DR #91, Long, drei Bestaetigungen + ein
-- Target). Wie in den frueheren Resets nur Loop-State/Log loeschen. dealing_ranges bleiben stehen
-- (Journal-Inhalt, keine Maschinen-Buchhaltung) — DR #90 (verworfen) und #91 raeumt Philip fuer den
-- naechsten Testlauf selbst auf, deshalb hier bewusst kein Eingriff in dealing_ranges/trade_evidence/
-- trade_targets.
delete from state_machine_log where instrument = 'GBPUSD' and date_str = '2026-09-09';
delete from trading_loop_state where instrument = 'GBPUSD' and date_str = '2026-09-09';
