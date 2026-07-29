-- Manueller Live-Trade EURUSD long, 2026-07-28: Entry in zwei Teilen aufgeteilt.
-- Zeiten laut Philip (Europe/Berlin, CEST = UTC+2). Kein trade_setup_id-Link moeglich: die
-- Twelve-Data-Kerzen weichen an diesem Tag von FOREX.com ab (weder M5-OB noch das gesweepte
-- LQ-Level tauchten in Twelve Data auf) — separat zu untersuchen, hier zaehlen Philips manuell
-- notierte Werte als Quelle der Wahrheit. Kein Stop-Loss genannt -> stop_loss/r_multiple bleiben
-- NULL (seit 20260727190000_trade_mode_setup_intake.sql nullable).

insert into signals (
  instrument, source, direction, triggered_at,
  entry_price, exit_time, exit_price, outcome,
  reasoning, notified
) values
  (
    'EURUSD', 'live', 'long', '2026-07-28T05:56:00Z',
    1.13674, '2026-07-28T06:30:00Z', 1.13712, 'win',
    'Split-Entry Teil 1 von 2 (07:56 Europe/Berlin). Kein M5-OB im Chart sichtbar (Twelve-Data-Kerzen-Diskrepanz ggue. FOREX.com).',
    false
  ),
  (
    'EURUSD', 'live', 'long', '2026-07-28T06:04:00Z',
    1.13655, '2026-07-28T07:14:00Z', 1.13733, 'win',
    'Split-Entry Teil 2 von 2 (08:04 Europe/Berlin). Kein M5-OB im Chart sichtbar (Twelve-Data-Kerzen-Diskrepanz ggue. FOREX.com).',
    false
  );
