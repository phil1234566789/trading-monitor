-- Task "Chart-Objekte: 1H-Struktur-Pivots auf kanonische liquidity_levels-ID konsolidieren"
-- (Laniakea-Session 2026-08-24/25, Dealing Range #45): analog zur bestehenden ob_zone_id-
-- Konsolidierung (siehe 20260822100000_trade_setups_confirmations_ob_zone_id.sql) bekommen
-- trade_targets/trade_confirmations jetzt eine optionale liquidity_level_id-Spalte. kind='pivot'
-- muss künftig nicht mehr nur einen rohen price/source_time-Snapshot speichern, sondern kann per
-- find-or-create (db.ts: findOrCreateLiquidityLevelId, gleiches Upsert-Muster wie
-- findOrCreateObZoneId) auf eine echte liquidity_levels-Zeile verlinken — Voraussetzung dafür,
-- dass Targets/Bestätigungen im Chart dasselbe native, gepinnt-hervorhebbare Rendering nutzen
-- können wie liquidity_levels selbst (PriceChart.vue: renderLiquidityLevels/mergePinnedLevels),
-- statt einen eigenen, abweichenden Zeichenpfad zu pflegen.

alter table trade_targets add column liquidity_level_id integer references liquidity_levels(id);
alter table trade_confirmations add column liquidity_level_id integer references liquidity_levels(id);
