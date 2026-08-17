-- Telegram-Touch-Alarm für Pins (Chat 2026-08-17, siehe Task "Pin-Kontext: MCP-Write, fehlende
-- Chart-Highlights, Touch-Alarm") — poi-watcher soll benachrichtigen, sobald eine gepinnte Stelle
-- (OB-Zone/1H-Liquiditäts-Level/Trade-Setup/M5-OB/M5-Liquiditäts-Level) vom Preis erreicht wird.
--
-- Bewusst NUR notified/notified_at, KEINE separate touched-Spalte: für kind='ob_zone'/
-- 'liquidity_level'/'trade_setup' ist der Touch-Zustand jederzeit billig aus der referenzierten
-- Zeile selbst able­sbar (ob_zones.touched/liquidity_levels.touched/trade_setups' eigene Felder,
-- siehe poi-watcher/index.ts); für kind='m5_ob'/'m5_liquidity_level' (reine Rohdaten-Snapshots
-- ohne Live-Status) wird der Touch jeden Lauf live gegen den aktuellen Preis geprüft, da die
-- Snapshot-Grenzen (top/bottom/price) ohnehin fix sind. notified bleibt false, solange die Stelle
-- zwar schon getouched, aber gerade außerhalb des Handelszeiten-Alarmfensters ist (isInWindows) —
-- der nächste Lauf versucht es erneut, sobald das Fenster öffnet (gleiches Prinzip wie bei
-- ob_zones/liquidity_levels, nur ohne die dortige Notwendigkeit einer zusätzlichen Spalte, weil
-- pin_context keinen zweiten Konsumenten für den reinen Touch-Zustand hat wie z.B. der Live-Chart).
alter table pin_context
  add column notified boolean not null default false,
  add column notified_at timestamptz;

insert into alarm_settings (key, enabled) values
  ('pin_context', true)
on conflict (key) do nothing;
