-- Loop-State GBPUSD 09.09.2026 zuruecksetzen fuer Runde 6.
--
-- Runde 5 lief in einer parallelen Session bereits an, waehrend noch ein Doku-Fix unterwegs war:
-- 03-htf-bias.md verwies auf ein veraltetes Feld (trendForce statt force, siehe trading-Repo-Commit
-- 6924068) und beschrieb die OB-Kraftrichtung noch trend-relativ statt objekt-relativ (derselbe
-- Bug, den forceAssessment.ts im trading-monitor-Repo fixt). Sauberer Neustart, damit Runde 6 mit
-- korrigierter Doku beginnt.
--
-- Wie in den frueheren Resets nur Loop-State/Log loeschen. Keine dealing_ranges betroffen — get_tsc_range
-- lieferte vor diesem Reset bereits null, get_journal fuer diesen Tag war leer.
delete from state_machine_log where instrument = 'GBPUSD' and date_str = '2026-09-09';
delete from trading_loop_state where instrument = 'GBPUSD' and date_str = '2026-09-09';
