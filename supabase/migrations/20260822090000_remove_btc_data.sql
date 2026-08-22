-- BTC-USDT komplett aus der DB entfernt (milk-city-Task
-- "btc-komplettes-rausschmeißen-code-cron-db-inkl-journal-historie", Philip 2026-08-22:
-- "komplett raus, inkl. Historie" — bewusste, explizit bestätigte Entscheidung, nicht nur
-- Live-Tracking abschalten). Der Code-Pfad (Frontend-Chart-Zweig, poi-watcher's OKX-Fetch,
-- der okx-market-MCP-Server) wurde bereits vorher entfernt, siehe CLAUDE.md "What this is".
--
-- Löscht:
-- - dealing_ranges (BTC-USDT) — kaskadiert automatisch auf trade_positions, trade_confirmations
--   (dealing_range_id), trade_targets (siehe 20260731120000_dealing_ranges_trade_positions.sql,
--   jeweils "on delete cascade"), und von dort weiter auf pin_context (trade_position_id) sowie
--   trade_partial_exits (trade_position_id, ex-signal_id).
--   Betrifft laut Seed-Migrationen mindestens: 1 Paper-Test-Trade (20260705150000_seed_test_trade.sql)
--   + 11 "Bot Retail Nils"-Live-Trades (20260730140000_seed_bot_retail_nils_trades.sql) — ggf. mehr,
--   falls Philip seither manuell weitere BTC-Trades im UI angelegt hat.
-- - ob_zones / liquidity_levels / trade_setups (BTC-USDT) — laufend von poi-watcher seit Einführung
--   der OKX-Anbindung erzeugte Zonen/Level/Setups, kein Journal-Bezug.
-- - trading_accounts, die ausschließlich für BTC angelegt wurden ("Test-Konto",
--   "Bot Retail Nils" — siehe 20260730130000_trading_accounts.sql /
--   20260730140000_seed_bot_retail_nils_trades.sql). Kein delete cascade nötig: die referenzierenden
--   trade_positions sind durch den dealing_ranges-Delete oben bereits weg.
--
-- Nicht angefasst: bestehende, bereits angewendete Migrationen mit BTC-Seed-Daten bleiben als
-- SQL-Historie unverändert stehen (nie nachträglich editieren) — diese Migration hier ist der
-- Gegenzug dazu, nicht ein Ersatz dafür.

delete from dealing_ranges where instrument = 'BTC-USDT';
delete from ob_zones where instrument = 'BTC-USDT';
delete from liquidity_levels where instrument = 'BTC-USDT';
delete from trade_setups where instrument = 'BTC-USDT';
delete from trading_accounts where name in ('Test-Konto', 'Bot Retail Nils');
