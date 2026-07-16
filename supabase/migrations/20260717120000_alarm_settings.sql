-- Ein/Aus-Schalter je Alarm-Typ, gesteuert über die neue "Alarme"-Seite im Dashboard —
-- steuert NUR den Telegram-Versand im poi-watcher, nicht die zugrundeliegende Erkennung/
-- Persistierung (Zonen/Level/Setups werden immer weiter erkannt und in ob_zones/
-- liquidity_levels/trade_setups gespeichert, unabhängig vom Schalter — sonst würde
-- Ausschalten und späteres Wiedereinschalten historische Lücken reißen).
--
-- Schreibzugriff für anon (nicht nur lesend wie bei den anderen Tabellen), weil das
-- Dashboard direkt aus dem Browser umschaltet — unkritisch, da rein Benachrichtigungs-
-- Präferenzen ohne sensible Daten, kein Unterschied zum ohnehin voll lesbaren anon-Key.
create table alarm_settings (
  key text primary key,
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create trigger alarm_settings_set_updated_at
  before update on alarm_settings
  for each row
  execute function set_updated_at();

insert into alarm_settings (key, enabled) values
  ('ob_zone_4h', true),
  ('ob_zone_1h', true),
  ('liquidity_1h', true),
  ('trade_setup', true);

alter table alarm_settings enable row level security;

create policy "alarm_settings read for anon"
  on alarm_settings for select
  to anon
  using (true);

create policy "alarm_settings update for anon"
  on alarm_settings for update
  to anon
  using (true)
  with check (true);
