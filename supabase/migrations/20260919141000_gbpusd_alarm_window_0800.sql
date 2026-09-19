-- GBPUSD-Alarmfenster von 07:00 auf 08:00 ziehen, Ende von 17:45 auf 18:00 -- deckungsgleich
-- mit trading_windows.
--
-- Vorher: alarm_windows 420-1065 (07:00-17:45), trading_windows 480-1080 (08:00-18:00). Die
-- Stunde davor erzeugte Alarme für Setups, die laut Schritt-1-Gate gar nicht handelbar sind.
--
-- Messung 19.09.2026 (analysis/dr-reichweite/, 255 GBPUSD-Dealing-Ranges): 26 Alarme gingen
-- außerhalb des Handelsfensters raus, Reichweiten-Median 5,5 Pips, nur 4 davon erreichten
-- überhaupt 20 Pips. 07:00 ist mit Median 4,9 Pips die schlechteste Stunde des ganzen Tages
-- (zum Vergleich: 08:00 = 14,9, das Fenster insgesamt = 16,4).
--
-- EURUSD bleibt unverändert -- dort ist der Telegram-Versand ohnehin abgeschaltet
-- (INSTRUMENTS in poi-watcher/index.ts), und gemessen wurde nur GBPUSD.
update trading_schedules
set alarm_windows = '{"weekday": [[480, 1080]], "saturday": [], "sunday": []}'::jsonb,
    updated_at = now()
where instrument = 'GBPUSD';
