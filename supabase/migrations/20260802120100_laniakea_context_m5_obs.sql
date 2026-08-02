-- Sechste Laniakea-Kontext-Art: M5-OB-Boxen (Chat 2026-08-02) — anders als 1H/4H-OB-Zonen werden
-- M5-OBs NIE persistiert (poi-watcher erkennt/speichert nur 1H/4H, siehe
-- 20260801130000_laniakea_context_ob_zones.sql-Kommentar "können deshalb NICHT per Rechtsklick
-- aufgenommen werden") — eine echte FK auf eine Tabellenzeile gibt es hier also nicht. Statt eine
-- neue Tabelle nur für M5-OBs anzulegen (poi-watcher müsste dann M5 zusätzlich erkennen/pflegen,
-- was der bewussten "M5 ist nur für Trade-Setups, keine eigene Zonen-Tabelle"-Architektur
-- widerspräche), speichert dieser Kind die Box als Rohdaten-Snapshot direkt auf laniakea_context —
-- analog zu trade_confirmations' kind='ob' (rohe Preis-/Range-Felder statt einer FK auf eine Zone).
-- Kein Update danach: touched/invalidated können ab dem Snapshot-Zeitpunkt abweichen, das ist ein
-- akzeptierter Tradeoff (Philip 2026-08-02: "Rohdaten-Snapshot", jede M5-Box soll sofort klickbar
-- sein statt nur die, die schon Teil eines erkannten Trade-Setups sind).
alter table laniakea_context
  add column m5_ob_instrument text,
  add column m5_ob_direction text check (m5_ob_direction in ('long', 'short')),
  add column m5_ob_top numeric,
  add column m5_ob_bottom numeric,
  add column m5_ob_start_time timestamptz;

alter table laniakea_context drop constraint laniakea_context_kind_check;
alter table laniakea_context add constraint laniakea_context_kind_check check (
  (kind = 'trade_position' and trade_position_id is not null and ob_zone_id is null and trade_setup_id is null and trade_confirmation_id is null and liquidity_level_id is null and m5_ob_instrument is null) or
  (kind = 'ob_zone' and ob_zone_id is not null and trade_position_id is null and trade_setup_id is null and trade_confirmation_id is null and liquidity_level_id is null and m5_ob_instrument is null) or
  (kind = 'trade_setup' and trade_setup_id is not null and trade_position_id is null and ob_zone_id is null and trade_confirmation_id is null and liquidity_level_id is null and m5_ob_instrument is null) or
  (kind = 'trade_confirmation' and trade_confirmation_id is not null and trade_position_id is null and ob_zone_id is null and trade_setup_id is null and liquidity_level_id is null and m5_ob_instrument is null) or
  (kind = 'liquidity_level' and liquidity_level_id is not null and trade_position_id is null and ob_zone_id is null and trade_setup_id is null and trade_confirmation_id is null and m5_ob_instrument is null) or
  (kind = 'm5_ob' and m5_ob_instrument is not null and m5_ob_direction is not null and m5_ob_top is not null and m5_ob_bottom is not null and m5_ob_start_time is not null and
    trade_position_id is null and ob_zone_id is null and trade_setup_id is null and trade_confirmation_id is null and liquidity_level_id is null)
);

-- Natural-Key-Unique wie bei den anderen Arten — ein zweiter Rechtsklick auf dieselbe M5-Box
-- aktualisiert die Notiz statt einen Zweiteintrag anzulegen (siehe addLaniakeaM5ObEntry).
create unique index laniakea_context_m5_ob_key on laniakea_context (m5_ob_instrument, m5_ob_direction, m5_ob_top, m5_ob_bottom, m5_ob_start_time);
