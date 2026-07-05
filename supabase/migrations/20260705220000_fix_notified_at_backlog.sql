-- Bereinigt die Backlog-Zonen vom allerersten poi-watcher-Deploy: die hatten faelschlich
-- den Deploy-Zeitpunkt als notified_at, obwohl dafuer nie eine echte Telegram-Nachricht
-- rausging (nur die eine bewusst getestete Zone unten war ein echter Versand).
update ob_zones
set notified_at = null
where notified_at is not null
  and not (
    instrument = 'BTC-USDT'
    and timeframe = '1H'
    and direction = 'long'
    and start_time = '2026-07-05T07:00:00Z'
  );
