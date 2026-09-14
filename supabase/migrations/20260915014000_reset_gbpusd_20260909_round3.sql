-- Loop-State GBPUSD 09.09.2026 zuruecksetzen fuer den Testlauf nach Runde 3.
--
-- Stand vor diesem Reset: Schritt 5 abgeschlossen (s45.pinCheck bestaetigt) bei 09:00 — Fall 1 fuer
-- eine Short-DR aus dem Gegen-Setup #554, danach auf Philips Ansage angehalten.
--
-- Seit dem letzten Reset gefixt und damit im Testlauf zu pruefen:
--   1. add_trade_target verlangt jetzt eine echte AUSWAHL aus find_targets statt einer blossen
--      Mitgliedschaftspruefung — ein weiter entfernter Preis wird abgelehnt, solange nicht jeder
--      naeher liegende Kandidat in skippedCandidates begruendet ist (siehe targetChoiceGuard.ts).
--      Ausloeser: Target 1.35368 war in Runde 3 der ENTFERNTESTE von acht Kandidaten.
--
-- Wie in den frueheren Resets nur Loop-State/Log loeschen. dealing_ranges bleiben stehen (Journal-
-- Inhalt, keine Maschinen-Buchhaltung) — die TSC-Range #87 raeumt Philip fuer diesen Testlauf selbst
-- auf, deshalb hier bewusst kein Eingriff in dealing_ranges/trade_evidence/trade_targets.
delete from state_machine_log where instrument = 'GBPUSD' and date_str = '2026-09-09';
delete from trading_loop_state where instrument = 'GBPUSD' and date_str = '2026-09-09';
