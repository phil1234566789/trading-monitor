-- Exit-Zeitpunkt des Test-Trades war nur auf volle Stunde genau (Approximation aus
-- 1H-Kerzen). Anhand von 1m-Daten nachgeschaerft: TP 62594 wurde exakt in der
-- 09:39-UTC-Kerze beruehrt (Low 62535.7), nicht erst in der 09:00-Stundenkerze.

update signals
set exit_time = '2026-07-05T09:39:00Z'
where instrument = 'BTC-USDT'
  and source = 'paper'
  and triggered_at = '2026-07-05T06:00:00Z';
