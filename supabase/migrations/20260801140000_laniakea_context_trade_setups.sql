-- Dritte Laniakea-Kontext-Art: trade_setups (Chat 2026-08-01, dritte Runde) — die "#<id>"-Box, die
-- bei einem bereits geloggten Trade dessen ursprüngliches M5-Setup zeigt (siehe
-- refreshTradeSetupLinksInternal in PriceChart.vue). Anders als bei ob_zones ist hier KEIN
-- Natural-Key-Umweg nötig: trade_setups.id ist über trade_positions -> dealing_ranges.trade_setup_id
-- schon im Frontend bekannt (t.tradeSetupId), sobald ein Trade geloggt ist — die Box referenziert
-- also direkt eine echte, bereits existierende Zeile.
alter table laniakea_context add column trade_setup_id bigint references trade_setups (id) on delete cascade;

alter table laniakea_context drop constraint laniakea_context_kind_check;
alter table laniakea_context add constraint laniakea_context_kind_check check (
  (kind = 'trade_position' and trade_position_id is not null and ob_zone_id is null and trade_setup_id is null) or
  (kind = 'ob_zone' and ob_zone_id is not null and trade_position_id is null and trade_setup_id is null) or
  (kind = 'trade_setup' and trade_setup_id is not null and trade_position_id is null and ob_zone_id is null)
);

create unique index laniakea_context_trade_setup_id_key on laniakea_context (trade_setup_id);
