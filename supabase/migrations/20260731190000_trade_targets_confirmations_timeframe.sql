-- Bug-Report Philip 2026-07-31, dritte Runde zur OB-Box: außerhalb Replay zog sich die Box bis
-- "jetzt" durch (touchedTime blieb null, kein Self-Heal mehr seit dem Timeframe-Mismatch-Fix) —
-- Philip will stattdessen exakt dasselbe Verhalten wie die live gezeichneten 1H/4H/M5-OB-Zonen
-- (detectOrderBlocks, dieselbe Funktion, dieselbe Kerzenreihe der jeweiligen Zeitebene). Dafür
-- muss PriceChart.vue wissen, von WELCHER Zeitebene ein OB-Target/-Confirmation stammt (bisher
-- nirgends gespeichert) — timeframe kommt direkt aus der Zone (findClickedOBZone: zone.timeframe).
alter table trade_targets add column timeframe text;
alter table trade_confirmations add column timeframe text;
