-- Fix: die 11 Bot-Retail-Nils-Trades (20260730140000_seed_bot_retail_nils_trades.sql) wurden mit
-- den von Philip gelieferten Zeitstempeln 1:1 ALS UTC eingetragen — Bug-Report Philip 2026-07-30:
-- "24.07. SOLL 16:05, IST 18:05" / "14.07. SOLL 18:29, IST 20:29", beides exakt +2h zu viel. Die
-- Zeitstempel waren also bereits Europe/Berlin-Lokalzeit (Juli = CEST = UTC+2), keine UTC-Werte.
-- triggered_at ist bewusst identisch zu exit_time (siehe Ursprungsmigration, keine Open-Zeit
-- bekannt) -> beide um 2h zurückverschieben, damit die App (die überall Europe/Berlin anzeigt)
-- wieder die von Philip genannten Uhrzeiten zeigt.
update signals
set triggered_at = triggered_at - interval '2 hours',
    exit_time = exit_time - interval '2 hours'
where trading_account_id = (select id from trading_accounts where name = 'Bot Retail Nils');
