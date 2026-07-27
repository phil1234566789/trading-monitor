-- Trade-Modus: Trade-Setup im Chart anklicken -> direkt als Trade ins Journal übernehmen (Chat
-- 2026-07-27). Zwei Dinge, die "signals" dafür braucht:
--
-- 1) entry_price/stop_loss nullable — ein übernommenes Setup ist zunächst nur eine ABSICHT (z.B.
--    Limit-Order an der M5-OB-Kante), die nicht zwingend gefüllt wird. Dieser Fall ("es gibt ein
--    setupEntry, aber kein entryPrice") lässt sich nur abbilden, wenn entry_price NULL sein darf.
--    stop_loss zieht mit, aus demselben Grund (kein echter Stop, solange nichts gefüllt ist).
-- 2) trade_setup_id — Verknüpfung zum erkannten Setup (OB/LS/Fraktal), das der Trade übernommen
--    hat. Broker-/Datenquellen-unabhängig, weil trade_setups schon ein fertiger Snapshot ist
--    (geschrieben von poi-watcher, unabhängig davon ob Twelve Data oder später cTrader die
--    Kerzen liefert) — siehe Chat: "die Preise ändern sich von Börse zu Börse".
alter table signals
  alter column entry_price drop not null,
  alter column stop_loss drop not null,
  add column trade_setup_id bigint references trade_setups (id);

-- Anon-Schreibzugriff für den neuen Browser-Weg (Trade-Modus-Klick -> Übernahme-Formular) — analog
-- zu news_events_anon_write.sql (gleiches Muster: Single-User-App, RLS gated nur auf die Rolle).
-- UPDATE zusätzlich zu INSERT, weil "Setup übernommen, aber noch nicht gefüllt" später ergänzt
-- werden muss (tatsächlicher entry_price/stop_loss, sobald die Order greift).
create policy "signals anon insert"
  on signals for insert
  to anon
  with check (true);

create policy "signals anon update"
  on signals for update
  to anon
  using (true)
  with check (true);
