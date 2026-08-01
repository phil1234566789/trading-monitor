-- Vierte Laniakea-Kontext-Art: trade_confirmations (Chat 2026-08-01, vierte Runde) — die
-- "✔ OB <preis> #<id>"-Box (Bestätigungen mit kind='ob', siehe refreshTradeConfirmationLinksInternal
-- in PriceChart.vue) wurde von Philip mit der Trade-Setup-Link-Box verwechselt (beide sehen als
-- kleine beschriftete OB-Box ähnlich aus) — bisher komplett unverdrahtet. Wie bei trade_setup ist
-- die id bereits direkt bekannt (confirmation.id), kein Natural-Key-Umweg nötig.
alter table laniakea_context add column trade_confirmation_id bigint references trade_confirmations (id) on delete cascade;

alter table laniakea_context drop constraint laniakea_context_kind_check;
alter table laniakea_context add constraint laniakea_context_kind_check check (
  (kind = 'trade_position' and trade_position_id is not null and ob_zone_id is null and trade_setup_id is null and trade_confirmation_id is null) or
  (kind = 'ob_zone' and ob_zone_id is not null and trade_position_id is null and trade_setup_id is null and trade_confirmation_id is null) or
  (kind = 'trade_setup' and trade_setup_id is not null and trade_position_id is null and ob_zone_id is null and trade_confirmation_id is null) or
  (kind = 'trade_confirmation' and trade_confirmation_id is not null and trade_position_id is null and ob_zone_id is null and trade_setup_id is null)
);

create unique index laniakea_context_trade_confirmation_id_key on laniakea_context (trade_confirmation_id);
