-- Siebte Laniakea-Kontext-Art: Liquiditäts-Level auf JEDEM Chart-Timeframe außer 1h (Chat
-- 2026-08-02, direkte Fortsetzung von 20260802120000_laniakea_context_liquidity_levels.sql).
--
-- kind='liquidity_level' (vorherige Migration) funktioniert nur im 1h-Chart-Timeframe, weil nur
-- dort die live gezeichnete Linie einer echten liquidity_levels-Zeile entspricht (poi-watcher
-- persistiert nur Timeframe '1H'). Philip will aber explizit eine Linie auf M5 (oder grundsätzlich
-- jedem anderen Timeframe) anklicken können — src/components/PriceChart.vue's refreshLiquidityInternal
-- zeichnet auf JEDEM Timeframe live neu erkannte Fraktal-Level (aus allCandles = props.currentBar),
-- unabhängig vom Backend. Gleiche Situation wie bei M5-OB-Boxen (20260802120100_laniakea_context_m5_obs.sql):
-- keine FK möglich, also Rohdaten-Snapshot direkt auf laniakea_context — inkl. timeframe-Spalte
-- (anders als bei m5_ob, wo der Timeframe implizit "5M" ist), weil diese Snapshots auf JEDEM
-- Nicht-1h-Timeframe entstehen können, nicht nur M5.
alter table laniakea_context
  add column m5_liquidity_instrument text,
  add column m5_liquidity_timeframe text,
  add column m5_liquidity_direction text check (m5_liquidity_direction in ('high', 'low')),
  add column m5_liquidity_price numeric,
  add column m5_liquidity_pivot_time timestamptz;

alter table laniakea_context drop constraint laniakea_context_kind_check;
alter table laniakea_context add constraint laniakea_context_kind_check check (
  (kind = 'trade_position' and trade_position_id is not null and ob_zone_id is null and trade_setup_id is null and trade_confirmation_id is null and liquidity_level_id is null and m5_ob_instrument is null and m5_liquidity_instrument is null) or
  (kind = 'ob_zone' and ob_zone_id is not null and trade_position_id is null and trade_setup_id is null and trade_confirmation_id is null and liquidity_level_id is null and m5_ob_instrument is null and m5_liquidity_instrument is null) or
  (kind = 'trade_setup' and trade_setup_id is not null and trade_position_id is null and ob_zone_id is null and trade_confirmation_id is null and liquidity_level_id is null and m5_ob_instrument is null and m5_liquidity_instrument is null) or
  (kind = 'trade_confirmation' and trade_confirmation_id is not null and trade_position_id is null and ob_zone_id is null and trade_setup_id is null and liquidity_level_id is null and m5_ob_instrument is null and m5_liquidity_instrument is null) or
  (kind = 'liquidity_level' and liquidity_level_id is not null and trade_position_id is null and ob_zone_id is null and trade_setup_id is null and trade_confirmation_id is null and m5_ob_instrument is null and m5_liquidity_instrument is null) or
  (kind = 'm5_ob' and m5_ob_instrument is not null and m5_ob_direction is not null and m5_ob_top is not null and m5_ob_bottom is not null and m5_ob_start_time is not null and
    trade_position_id is null and ob_zone_id is null and trade_setup_id is null and trade_confirmation_id is null and liquidity_level_id is null and m5_liquidity_instrument is null) or
  (kind = 'm5_liquidity_level' and m5_liquidity_instrument is not null and m5_liquidity_timeframe is not null and m5_liquidity_direction is not null and m5_liquidity_price is not null and m5_liquidity_pivot_time is not null and
    trade_position_id is null and ob_zone_id is null and trade_setup_id is null and trade_confirmation_id is null and liquidity_level_id is null and m5_ob_instrument is null)
);

create unique index laniakea_context_m5_liquidity_key on laniakea_context (m5_liquidity_instrument, m5_liquidity_timeframe, m5_liquidity_direction, m5_liquidity_pivot_time);
