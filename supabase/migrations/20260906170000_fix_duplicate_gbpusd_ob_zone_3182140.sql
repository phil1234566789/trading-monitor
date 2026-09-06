-- Bug-Report Philip 2026-09-06 (per Pin auf ob_zones-Zeile 3182140): 1H-Short-OB GBPUSD
-- 1.36015-1.36027 wurde am 27.08. um 15:00 Berlin (13:00 UTC) vom Kurs durchbrochen (High 1.36028
-- > top 1.36027 -> per Regel "jede Überschreitung invalidiert sofort", siehe orderBlocks.ts),
-- wurde auf dem Chart aber weiterhin als live/unangetastet gezeichnet.
--
-- Root Cause: Zeile 3182140 ist ein Duplikat derselben realen Zone wie Zeile 3164983 (identisches
-- top/bottom/direction/instrument) — 3164983 wurde beim regulären stündlichen Tick am 27.08. 05:00
-- UTC korrekt angelegt und beim 13:00-UTC-Tick korrekt invalidiert (end_time=2026-08-27T13:00:00Z).
-- 3182140 entstand erst 3 Tage später (30.08. 20:25 UTC, außerhalb des vollen Stunden-Rasters) durch
-- einen manuellen forceH1Refresh-Aufruf (poi-watcher/index.ts) mit start_time 15h später (27.08.
-- 05:00 statt 26.08. 14:00) und leicht abweichendem weak-Wert trotz identischer top/bottom-Werte —
-- spricht für einen einmaligen cTrader-Datenausreißer bei diesem Ad-hoc-Fetch, kein reproduzierbarer
-- Fehler im regulären 5min-Cron-Pfad (der hat dieselbe Zone ja korrekt erkannt/invalidiert). Zeile
-- bewusst nicht gelöscht (Philips Pin referenziert sie per ob_zone_id), stattdessen auf den real
-- korrekten Zustand korrigiert.
update ob_zones
set invalidated = true,
    end_time = '2026-08-27T13:00:00+00:00',
    weak = true,
    notified = true
where id = 3182140;
