-- Fehlerhafter run_dealing_range_loop-Aufruf (Claude, 07.09.2026) hat replayUntilSec=Tagesende
-- uebergeben statt im 5-Minuten-Takt zu ticken (Fall 2 = aktiv beobachten, wie beim Live-Cron-Takt,
-- siehe 05-dealing-range-bestaetigen.md) - dadurch last_analysis_time_sec faelschlich auf 23:59:59
-- vorgerueckt, obwohl der letzte ECHTE Tick bei 16:25 lag (Watch-Level ausgeloest, Fall 2 klassifiziert).
-- current_node/direction/machine_snapshot bleiben unberuehrt (s45.backtestBatch ist fuer
-- run_dealing_range_loop aequivalent zu einem frischen Einstieg ueber s45.entry, siehe
-- machineState.ts/dealingRangeLoop.ts transitionIfPossible-Kommentare) - nur Cursor + die dadurch
-- erzeugten Heartbeat-Eintraege (Index 4-8: die faelschlich vorgespulten Batches) werden zurueckgesetzt.
update trading_loop_state
set last_analysis_time_sec = 1787927100,
    heartbeat_log = (
      select jsonb_agg(elem)
      from jsonb_array_elements(heartbeat_log) with ordinality as t(elem, idx)
      where idx <= 3
    )
where instrument = 'GBPUSD' and date_str = '2026-08-28';
