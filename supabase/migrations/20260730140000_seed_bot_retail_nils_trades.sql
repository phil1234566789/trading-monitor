-- Bot-Trades "Bot Retail Nils" (Chat 2026-07-30) — 11 BTC-Trades aus einem externen Bot-Konto,
-- die Philip testweise ins Journal einspeisen will, getrennt vom 10k-Challenge-Konto (siehe
-- 20260730130000_trading_accounts.sql). Kein Stop-Loss bekannt -> stop_loss/r_multiple bleiben
-- NULL. Der einzige gelieferte Zeitstempel je Trade ist laut Philip die CLOSE-Zeit, keine
-- Open-Zeit bekannt -> triggered_at (Pflichtfeld) wird bewusst identisch zu exit_time gesetzt,
-- statt eine erfundene Open-Zeit einzutragen. Zeitstempel im Format "YYYY.MM.DD HH:MM:SS" (typisches
-- MetaTrader-Exportformat) werden hier als UTC übernommen (unbestätigte Annahme, keine
-- Rückmeldung von Philip zur Broker-Zeitzone) — bei Bedarf später per eigener Migration korrigieren.
-- direction: MT "buy"/"sell" -> long/short. outcome: alle 11 Trades sind Wins (Preisrichtung passt
-- in jedem Fall zur Kauf-/Verkaufsrichtung UND der gemeldete Profit ist durchgehend positiv).

-- insert ... select ... where not exists statt eines einfachen insert values (...): ein erster
-- db-push-Versuch dieser Migration schlug an der signals-Insert-Anweisung fehl (BTC-USDT-Check
-- o.ä.), das Konto-Insert davor war aber schon committed — ohne den Guard würde ein erneuter
-- push-Versuch das Konto ein zweites Mal anlegen (kein Unique-Constraint auf name) und die
-- folgende Subquery "(select id from trading_accounts where name = ...)" würde mit "more than one
-- row returned" fehlschlagen.
insert into trading_accounts (name, notes)
select 'Bot Retail Nils', 'Externes Bot-Konto (BTC) — testweise eingespeist, siehe Chat 2026-07-30.'
where not exists (select 1 from trading_accounts where name = 'Bot Retail Nils');

insert into signals (
  instrument, source, direction, triggered_at,
  entry_price, exit_time, exit_price, outcome,
  reasoning, notified, trading_account_id
) values
  (
    'BTC-USDT', 'live', 'long', '2026-07-14T18:29:29Z',
    64409.87, '2026-07-14T18:29:29Z', 64519.27, 'win',
    'Bot-Import (Bot Retail Nils), Volumen 0.42, P/L $40.16',
    false, (select id from trading_accounts where name = 'Bot Retail Nils')
  ),
  (
    'BTC-USDT', 'live', 'long', '2026-07-15T01:21:52Z',
    64994.27, '2026-07-15T01:21:52Z', 65078.23, 'win',
    'Bot-Import (Bot Retail Nils), Volumen 1.14, P/L $83.83',
    false, (select id from trading_accounts where name = 'Bot Retail Nils')
  ),
  (
    'BTC-USDT', 'live', 'short', '2026-07-16T04:19:06Z',
    64472.35, '2026-07-16T04:19:06Z', 64431.67, 'win',
    'Bot-Import (Bot Retail Nils), Volumen 1.05, P/L $37.24',
    false, (select id from trading_accounts where name = 'Bot Retail Nils')
  ),
  (
    'BTC-USDT', 'live', 'short', '2026-07-17T03:31:48Z',
    63796.00, '2026-07-17T03:31:48Z', 63745.66, 'win',
    'Bot-Import (Bot Retail Nils), Volumen 1.08, P/L $47.51',
    false, (select id from trading_accounts where name = 'Bot Retail Nils')
  ),
  (
    'BTC-USDT', 'live', 'long', '2026-07-18T20:41:52Z',
    64383.16, '2026-07-18T20:41:52Z', 64424.16, 'win',
    'Bot-Import (Bot Retail Nils), Volumen 0.78, P/L $27.97',
    false, (select id from trading_accounts where name = 'Bot Retail Nils')
  ),
  (
    'BTC-USDT', 'live', 'long', '2026-07-19T00:15:59Z',
    64730.85, '2026-07-19T00:15:59Z', 64802.07, 'win',
    'Bot-Import (Bot Retail Nils), Volumen 0.78, P/L $48.58',
    false, (select id from trading_accounts where name = 'Bot Retail Nils')
  ),
  (
    'BTC-USDT', 'live', 'long', '2026-07-20T03:14:57Z',
    64960.83, '2026-07-20T03:14:57Z', 65020.60, 'win',
    'Bot-Import (Bot Retail Nils), Volumen 0.64, P/L $33.47',
    false, (select id from trading_accounts where name = 'Bot Retail Nils')
  ),
  (
    'BTC-USDT', 'live', 'short', '2026-07-20T08:13:12Z',
    64194.47, '2026-07-20T08:13:12Z', 64113.46, 'win',
    'Bot-Import (Bot Retail Nils), Volumen 0.65, P/L $46.01',
    false, (select id from trading_accounts where name = 'Bot Retail Nils')
  ),
  (
    'BTC-USDT', 'live', 'long', '2026-07-21T09:35:56Z',
    65888.21, '2026-07-21T09:35:56Z', 65942.96, 'win',
    'Bot-Import (Bot Retail Nils), Volumen 0.49, P/L $23.50',
    false, (select id from trading_accounts where name = 'Bot Retail Nils')
  ),
  (
    'BTC-USDT', 'live', 'short', '2026-07-23T10:11:51Z',
    65461.49, '2026-07-23T10:11:51Z', 65411.79, 'win',
    'Bot-Import (Bot Retail Nils), Volumen 0.49, P/L $21.31',
    false, (select id from trading_accounts where name = 'Bot Retail Nils')
  ),
  (
    'BTC-USDT', 'live', 'short', '2026-07-24T16:05:48Z',
    64608.96, '2026-07-24T16:05:48Z', 64541.87, 'win',
    'Bot-Import (Bot Retail Nils), Volumen 0.5, P/L $29.50',
    false, (select id from trading_accounts where name = 'Bot Retail Nils')
  );
