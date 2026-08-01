-- Zweite Laniakea-Kontext-Art: OB-Zonen (Chat 2026-08-01, direkte Fortsetzung von
-- 20260801120000_laniakea_context.sql — dort schon als Migrationspfad angekündigt: "kind-Spalte
-- ergänzen, trade_position_id nullable machen, neue Art-Spalte(n) daneben").
--
-- ob_zones existiert NUR für 1H/4H (poi-watcher's TIMEFRAMES, siehe supabase/functions/
-- poi-watcher/index.ts) — M5-OB-Boxen werden nie persistiert (nur live im Frontend erkannt, siehe
-- src/orderBlocks.js/collectObsZones in PriceChart.vue), können deshalb NICHT per Rechtsklick in
-- den Laniakea-Kontext aufgenommen werden (Frontend blendet "Laniakea zeigen" für M5-Boxen daher
-- gar nicht erst ein). Für Forex (GBPUSD/EURUSD) berechnet PriceChart.vue 1H/4H-Boxen zusätzlich
-- IMMER live selbst (fürs sofortige Rendern, ohne auf den 5-Min-Cron zu warten) — die live
-- gezeichnete Box trägt deshalb selbst keine DB-id, das Frontend löst sie beim Rechtsklick per
-- Natural-Key (instrument, timeframe, direction, start_time — derselbe Schlüssel wie ob_zones'
-- eigener Unique-Constraint) gegen die Tabelle auf, siehe laniakeaContext.js: resolveObZoneId.
alter table laniakea_context add column kind text not null default 'trade_position';
alter table laniakea_context alter column kind drop default;

alter table laniakea_context add column ob_zone_id bigint references ob_zones (id) on delete cascade;
alter table laniakea_context alter column trade_position_id drop not null;

alter table laniakea_context add constraint laniakea_context_kind_check check (
  (kind = 'trade_position' and trade_position_id is not null and ob_zone_id is null) or
  (kind = 'ob_zone' and ob_zone_id is not null and trade_position_id is null)
);

-- Analog zum bestehenden Unique-Index auf trade_position_id (NULLs kollidieren in Postgres nicht
-- miteinander, also stört diese Spalte die trade_position-Zeilen nicht).
create unique index laniakea_context_ob_zone_id_key on laniakea_context (ob_zone_id);
