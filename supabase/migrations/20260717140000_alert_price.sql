-- Der tatsächliche Preis im Moment des Alarms fehlte bisher in allen drei Tabellen — die
-- Telegram-Nachricht selbst zeigt ihn ("Preis: ..."), aber er wurde nie mitpersistiert.
-- Analog zu end_time: einmal beim ersten Touch/Setup eingefroren, kein Wanduhr-Wert.
alter table ob_zones add column alert_price numeric;
alter table liquidity_levels add column alert_price numeric;
alter table trade_setups add column alert_price numeric;
