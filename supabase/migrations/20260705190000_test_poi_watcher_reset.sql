-- Einmaliger Test-Reset: eine bereits erkannte Zone auf "nicht benachrichtigt" zurücksetzen,
-- um den echten Telegram-Versandpfad des poi-watchers zu verifizieren.
update ob_zones
set touched = false, notified = false, notified_at = null
where instrument = 'BTC-USDT'
  and timeframe = '1H'
  and direction = 'long'
  and start_time = '2026-07-05T07:00:00Z';
