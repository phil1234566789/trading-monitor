-- Fünfte Laniakea-Kontext-Art: liquidity_levels (Chat 2026-08-02, direkte Fortsetzung der
-- ob_zone/trade_setup/trade_confirmation-Kontext-Arten von gestern — bereits in der allerersten
-- laniakea_context-Migration als "für später angekündigt" erwähnt).
--
-- liquidity_levels wird von poi-watcher NUR für Timeframe '1H' geschrieben (siehe
-- supabase/functions/poi-watcher/index.ts) — genau wie bei ob_zone (nur 1H/4H persistiert, M5 nie)
-- ist die Zeile also nur klickbar, wenn Philip gerade den 1h-Chart-Timeframe anschaut (auf jedem
-- anderen Timeframe erkennt PriceChart.vue die Level live aus den dort geladenen Kerzen neu — die
-- entsprächen dann keiner echten liquidity_levels-Zeile). Die live gezeichnete Linie trägt selbst
-- keine DB-id, Auflösung per Natural-Key (instrument, timeframe, direction, pivot_time — derselbe
-- Schlüssel wie liquidity_levels' eigener Unique-Constraint aus poi-watcher's upsert), analog zu
-- resolveObZoneId in src/laniakeaContext.js.
alter table laniakea_context add column liquidity_level_id bigint references liquidity_levels (id) on delete cascade;

alter table laniakea_context drop constraint laniakea_context_kind_check;
alter table laniakea_context add constraint laniakea_context_kind_check check (
  (kind = 'trade_position' and trade_position_id is not null and ob_zone_id is null and trade_setup_id is null and trade_confirmation_id is null and liquidity_level_id is null) or
  (kind = 'ob_zone' and ob_zone_id is not null and trade_position_id is null and trade_setup_id is null and trade_confirmation_id is null and liquidity_level_id is null) or
  (kind = 'trade_setup' and trade_setup_id is not null and trade_position_id is null and ob_zone_id is null and trade_confirmation_id is null and liquidity_level_id is null) or
  (kind = 'trade_confirmation' and trade_confirmation_id is not null and trade_position_id is null and ob_zone_id is null and trade_setup_id is null and liquidity_level_id is null) or
  (kind = 'liquidity_level' and liquidity_level_id is not null and trade_position_id is null and ob_zone_id is null and trade_setup_id is null and trade_confirmation_id is null)
);

create unique index laniakea_context_liquidity_level_id_key on laniakea_context (liquidity_level_id);
