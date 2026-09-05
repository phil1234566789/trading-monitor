-- Fuenfter Reset des GBPUSD-28.08.2026-Testlaufs — nach Entfernung von tscGet/tscExists aus
-- tradingMachine.ts (Merge zu s45.tscLink) blieb der bestehende Loop mit einem inkompatiblen
-- machine_snapshot (geparkt bei "s45.tscGet", das es nicht mehr gibt) zurueck. Rehydrieren dieses
-- Snapshots verhielt sich je nach Tool-Aufruf unterschiedlich kaputt (sofortiger XState-Fehler,
-- Actor ohne funktionierendes getSnapshot().can(), oder ein mehrminuetiger Haenger) — kein sauber
-- abfangbarer Fehler, also per Migration statt per weiterem MCP-Tool-Call bereinigt.
delete from state_machine_log where instrument = 'GBPUSD' and date_str = '2026-08-28';
delete from trading_loop_state where instrument = 'GBPUSD' and date_str = '2026-08-28';
