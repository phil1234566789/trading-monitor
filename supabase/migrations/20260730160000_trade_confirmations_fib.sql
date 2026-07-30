-- Chat 2026-07-30: dritte Bestätigungs-Art neben 'pivot'/'ob' — ein 0,5er-Fib-Level (siehe
-- marketStructureAnalysis.ts: computeFibLevels/collectFibLevels, marketStructureAnalysis.rules.md
-- Abschnitt "Fibonacci-Level"). Anders als ein einzelner Pivot/eine OB-Zone hängt ein Fib-Wert an
-- ZWEI Ankerpreisen (die tatsächlich verwendete Range- oder Protected-Fib-Spanne) — range_low/
-- range_high halten diese zwei Preise fest, damit ein gespeichertes Fib später nachvollziehbar
-- bleibt, auch wenn sich die live berechnete Range inzwischen längst weiterbewegt hat (der ganze
-- Grund, wieso Philip das überhaupt als Trade-Bestätigung festhalten will). price bleibt der
-- abgeleitete 0,5-Wert, unverändertes Verhalten für bestehenden Anzeige-Code (tradeConfirmations.ts).
alter table trade_confirmations drop constraint trade_confirmations_kind_check;
alter table trade_confirmations add constraint trade_confirmations_kind_check check (kind in ('pivot', 'ob', 'fib'));

alter table trade_confirmations
  add column range_low numeric,
  add column range_high numeric;
