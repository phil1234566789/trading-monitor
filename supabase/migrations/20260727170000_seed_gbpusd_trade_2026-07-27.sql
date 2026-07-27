-- Manueller Live-Trade GBPUSD, 2026-07-27: Entry in zwei Teilen aufgeteilt.
-- Zeiten laut Broker (Europe/Berlin, CEST = UTC+2), TP-Treffer laut Broker um 16:57 --
-- trading-monitor zeigte den TP-Treffer zu dem Zeitpunkt noch nicht (Kerzen-Diskrepanz
-- ggue. Broker/TradingView wird in einer separaten Session untersucht); hier zaehlen
-- die Broker-Werte als Quelle der Wahrheit fuer's Protokoll.

insert into signals (
  instrument, source, direction, triggered_at,
  entry_price, stop_loss, take_profit,
  exit_time, exit_price, outcome, r_multiple,
  reasoning, notified
) values
  (
    'GBPUSD', 'live', 'short', '2026-07-27T14:17:00Z',
    1.33146, 1.33182, 1.32992,
    '2026-07-27T14:57:00Z', 1.32992, 'win', 4.28,
    'Split-Entry Teil 1 von 2 (16:17 Europe/Berlin).',
    false
  ),
  (
    'GBPUSD', 'live', 'short', '2026-07-27T14:41:00Z',
    1.33101, 1.33139, 1.32992,
    '2026-07-27T14:57:00Z', 1.32992, 'win', 2.87,
    'Split-Entry Teil 2 von 2 (16:41 Europe/Berlin).',
    false
  );
