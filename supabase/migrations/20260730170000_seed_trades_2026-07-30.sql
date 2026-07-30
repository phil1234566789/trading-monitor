-- 4 Trades vom 30.07.2026, aus einem Broker-Screenshot übertragen (Philip: "der trade von heute
-- ist ja gar nicht drinnen") — 10k-Challenge-Konto (GBPUSD/EURUSD, siehe
-- 20260730130000_trading_accounts.sql). Zeitstempel im Screenshot sind Europe/Berlin-Lokalzeit
-- (Juli = CEST = UTC+2, siehe CLAUDE.md/Bug-Report 2026-07-30 zu den Bot-Retail-Nils-Trades) ->
-- hier direkt korrekt als UTC-2h eingetragen, nicht 1:1 übernommen.
--
-- direction/Vorzeichen aus Preisbewegung + Netto-P&L hergeleitet (kein Feld dafür im Export):
-- alle 3 GBPUSD-Trades haben Entry < Exit UND positives Netto-P&L -> long; die Pip-Rechnung geht
-- exakt auf (z.B. Trade 3: 14 Pips * 0,2 Lot * ~$10/Pip = $28, minus $1 Prov. = $27.00). Der
-- EURUSD-Trade hat Entry > Exit UND negatives Netto-P&L -> ebenfalls long (Verlust durch fallenden
-- Preis), nicht short.
--
-- EURUSD-Trade laut Philip ein Versehen: wollte GBPUSD öffnen, war noch auf EURUSD eingestellt,
-- danach sofort mit Verlust geschlossen.
insert into signals (
  instrument, source, direction, triggered_at,
  entry_price, exit_time, exit_price, outcome,
  reasoning, notified, trading_account_id
) values
  (
    'EURUSD', 'live', 'long', '2026-07-30T07:32:01Z',
    1.14379, '2026-07-30T07:32:44Z', 1.14352, 'loss',
    'Versehen: wollte GBPUSD öffnen, war auf EURUSD eingestellt, sofort mit Verlust geschlossen. Menge 0,5, Netto P/L -$13.50.',
    false, (select id from trading_accounts where name = '10k Challenge')
  ),
  (
    'GBPUSD', 'live', 'long', '2026-07-30T07:32:32Z',
    1.33386, '2026-07-30T07:55:00Z', 1.3339, 'win',
    'Menge 0,5, Netto P/L $1.00.',
    false, (select id from trading_accounts where name = '10k Challenge')
  ),
  (
    'GBPUSD', 'live', 'long', '2026-07-30T08:05:06Z',
    1.33446, '2026-07-30T08:28:59Z', 1.33568, 'win',
    'Menge 0,2, Netto P/L $23.40.',
    false, (select id from trading_accounts where name = '10k Challenge')
  ),
  (
    'GBPUSD', 'live', 'long', '2026-07-30T08:05:51Z',
    1.3346, '2026-07-30T09:05:15Z', 1.336, 'win',
    'Menge 0,2, Netto P/L $27.00.',
    false, (select id from trading_accounts where name = '10k Challenge')
  );
