-- Bug-Report Philip 2026-08-07: dealing_range #28 (GBP Position #51/#54/#55, "Short-Idee auf
-- Basis des App-erkannten Setups #221") zeigte im Edit-Modal keine Bestätigung fürs verlinkte
-- Setup, obwohl trade_setup_id korrekt gesetzt war. Ursache: die MCP-Journal-Write-Tools
-- (create_trade/add_trade_position, siehe mcp-server/src/db.ts) setzen trade_setup_id zwar auf
-- die dealing_range, legen aber anders als der Frontend-Chart-Klick-Weg (Dashboard.vue:
-- onSelectSetupConfirmations) nie die zugehörigen trade_confirmations-Zeilen an — dieselbe Lücke
-- betrifft auch die ältere dealing_range #27 (Setup #172, GBP Short vom 03.08.), per Skript
-- geprüft: alle dealing_ranges mit trade_setup_id, aber ganz ohne Bestätigung (weder range- noch
-- position-level) sind ausschließlich #27 und #28.
--
-- Backfill mit genau den zwei Zeilen, die onSelectSetupConfirmations bei "GO für die Idee" für
-- das jeweils verlinkte Setup erzeugt hätte (LS-Sweep als 'pivot' + M5-OB-Kante als 'ob', Preis
-- gemäß deriveSetupEntryInvalidation: bei Short = ob_bottom), auf Range-Ebene (dealing_range_id),
-- weil beide Ranges laut Reasoning-Text ihrer Ausführungen komplett auf dem jeweiligen Setup
-- basieren, nicht nur auf einer einzelnen Ausführung.

insert into trade_confirmations (dealing_range_id, kind, price, source_time, touched_time)
values (28, 'pivot', 1.34562, '2026-08-07T05:10:00+00', '2026-08-07T06:20:00+00');

insert into trade_confirmations (dealing_range_id, kind, price, source_time, touched_time, range_low, range_high, timeframe)
values (28, 'ob', 1.34533, '2026-08-07T07:00:00+00', null, 1.34533, 1.34578, '5M');

insert into trade_confirmations (dealing_range_id, kind, price, source_time, touched_time)
values (27, 'pivot', 1.34709, '2026-08-03T07:35:00+00', '2026-08-03T12:35:00+00');

insert into trade_confirmations (dealing_range_id, kind, price, source_time, touched_time, range_low, range_high, timeframe)
values (27, 'ob', 1.3466, '2026-08-03T12:40:00+00', null, 1.3466, 1.34722, '5M');
