-- Achte Laniakea-Kontext-Art: RSI-Divergenz-Konnektoren (Chat 2026-08-11) — wie M5-OB-Boxen/
-- M5-Liquiditäts-Level werden Divergenzen NIE persistiert (detectRsiDivergence()/
-- detectRsiDivergenceHistory() in src/rsi.js rechnen live auf allCandles, siehe dort), also
-- wieder ein Rohdaten-Snapshot direkt auf laniakea_context statt einer FK. Philip: "ich will DIR
-- paar Stellen zeigen" — derselbe Rechtsklick-Mechanismus, den's für OB-Zonen/LQ-Level schon gibt,
-- nur damit er (auch außerhalb der Laniakea-Persona) auf eine erkannte Divergenz zeigen kann statt
-- sie mühsam mit Uhrzeiten zu beschreiben.
alter table laniakea_context
  add column rsi_divergence_instrument text,
  add column rsi_divergence_type text check (rsi_divergence_type in ('bearish', 'bullish')),
  add column rsi_divergence_from_time timestamptz,
  add column rsi_divergence_to_time timestamptz,
  add column rsi_divergence_from_price numeric,
  add column rsi_divergence_to_price numeric,
  add column rsi_divergence_from_rsi numeric,
  add column rsi_divergence_to_rsi numeric;

alter table laniakea_context drop constraint laniakea_context_kind_check;
alter table laniakea_context add constraint laniakea_context_kind_check check (
  (kind = 'trade_position' and trade_position_id is not null and ob_zone_id is null and trade_setup_id is null and trade_confirmation_id is null and liquidity_level_id is null and m5_ob_instrument is null and m5_liquidity_instrument is null and rsi_divergence_instrument is null) or
  (kind = 'ob_zone' and ob_zone_id is not null and trade_position_id is null and trade_setup_id is null and trade_confirmation_id is null and liquidity_level_id is null and m5_ob_instrument is null and m5_liquidity_instrument is null and rsi_divergence_instrument is null) or
  (kind = 'trade_setup' and trade_setup_id is not null and trade_position_id is null and ob_zone_id is null and trade_confirmation_id is null and liquidity_level_id is null and m5_ob_instrument is null and m5_liquidity_instrument is null and rsi_divergence_instrument is null) or
  (kind = 'trade_confirmation' and trade_confirmation_id is not null and trade_position_id is null and ob_zone_id is null and trade_setup_id is null and liquidity_level_id is null and m5_ob_instrument is null and m5_liquidity_instrument is null and rsi_divergence_instrument is null) or
  (kind = 'liquidity_level' and liquidity_level_id is not null and trade_position_id is null and ob_zone_id is null and trade_setup_id is null and trade_confirmation_id is null and m5_ob_instrument is null and m5_liquidity_instrument is null and rsi_divergence_instrument is null) or
  (kind = 'm5_ob' and m5_ob_instrument is not null and m5_ob_direction is not null and m5_ob_top is not null and m5_ob_bottom is not null and m5_ob_start_time is not null and
    trade_position_id is null and ob_zone_id is null and trade_setup_id is null and trade_confirmation_id is null and liquidity_level_id is null and m5_liquidity_instrument is null and rsi_divergence_instrument is null) or
  (kind = 'm5_liquidity_level' and m5_liquidity_instrument is not null and m5_liquidity_timeframe is not null and m5_liquidity_direction is not null and m5_liquidity_price is not null and m5_liquidity_pivot_time is not null and
    trade_position_id is null and ob_zone_id is null and trade_setup_id is null and trade_confirmation_id is null and liquidity_level_id is null and m5_ob_instrument is null and rsi_divergence_instrument is null) or
  (kind = 'rsi_divergence' and rsi_divergence_instrument is not null and rsi_divergence_type is not null and rsi_divergence_from_time is not null and rsi_divergence_to_time is not null and rsi_divergence_from_price is not null and rsi_divergence_to_price is not null and rsi_divergence_from_rsi is not null and rsi_divergence_to_rsi is not null and
    trade_position_id is null and ob_zone_id is null and trade_setup_id is null and trade_confirmation_id is null and liquidity_level_id is null and m5_ob_instrument is null and m5_liquidity_instrument is null)
);

create unique index laniakea_context_rsi_divergence_key on laniakea_context (rsi_divergence_instrument, rsi_divergence_type, rsi_divergence_from_time, rsi_divergence_to_time);
