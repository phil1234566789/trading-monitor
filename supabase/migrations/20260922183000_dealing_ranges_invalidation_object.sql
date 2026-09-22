-- Invalidierung trägt jetzt das Chart-Objekt, aus dem sie stammt, nicht nur den Preis (Philip
-- 22.09.2026: "ich hätte lieber, so wie bei den anderen Feldern ... dass das Chart-Objekt
-- übernommen wird" — samt Hervorhebung des Objekts im Chart). Dieselbe Verknüpfungsart wie
-- trade_targets/trade_evidence, nur als Spalten statt als eigene Zeile: eine Range hat GENAU EINE
-- Invalidierung, eine eigene Tabellenzeile dafür wäre eine 1:1-Beziehung mit Extra-Join.
--
-- dealing_ranges.invalidation (Zahl) bleibt unverändert die Wahrheit für alle Leser (poi-watcher,
-- MCP-Tools, RR-Rechnung) — diese beiden Spalten sagen nur, WELCHES Objekt den Wert gesetzt hat.
alter table dealing_ranges
  add column invalidation_liquidity_level_id integer references liquidity_levels (id) on delete set null,
  add column invalidation_ob_zone_id bigint references ob_zones (id) on delete set null;

-- Höchstens eines von beiden: eine Invalidierung kommt aus EINEM Objekt (analog dem
-- Entweder-oder-CHECK auf trade_evidence.dealing_range_id/trade_position_id).
alter table dealing_ranges add constraint dealing_ranges_invalidation_object_check check (
  invalidation_liquidity_level_id is null or invalidation_ob_zone_id is null
);
