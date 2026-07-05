-- Manueller Test-Trade zum Pruefen der DB-/Dashboard-Pipeline (kein Strategie-Signal).
-- Entry = Open der 8-Uhr-Kerze (lokal, 06:00 UTC). TP wurde in der 09:00-UTC-Kerze
-- erreicht (Low 62444.4 < TP 62594), SL nie touched (Hoch im Zeitraum max. 63105.6 < SL 63420).

insert into signals (
  instrument, source, direction, triggered_at,
  entry_price, stop_loss, take_profit,
  exit_time, exit_price, outcome, r_multiple,
  reasoning, notified
) values (
  'BTC-USDT', 'paper', 'short', '2026-07-05T06:00:00Z',
  62742.8, 63420, 62594,
  '2026-07-05T09:00:00Z', 62594, 'win', 0.22,
  'Manueller Test-Trade zum Pruefen der DB-/Dashboard-Pipeline (kein Strategie-Signal).',
  false
);
