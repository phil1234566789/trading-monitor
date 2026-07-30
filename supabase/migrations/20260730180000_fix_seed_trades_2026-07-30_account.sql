-- Fix: die 4 am 30.07.2026 nachträglich eingespeisten Trades (20260730170000_seed_trades_2026-07-30.sql,
-- ids 17-20) landeten mit trading_account_id = NULL statt beim 10k-Challenge-Konto. Die Migration
-- verwies auf den Kontonamen '10k Challenge' (Stand bei dessen Anlage, siehe
-- 20260730130000_trading_accounts.sql) — das Konto wurde seither über die Konten-Seite zu
-- '10k Challenge IQCapital' umbenannt, die Subquery fand also keine Zeile mehr und
-- trading_account_id blieb still NULL (Spalte ist nullable, kein Fehler). Bug-Report Philip
-- 2026-07-30 ("kann die trades nicht sehen") — das Trades-Panel filtert nach ausgewähltem Konto,
-- ein Trade ohne Konto taucht bei keiner Auswahl auf.
update signals
set trading_account_id = (select id from trading_accounts where name = '10k Challenge IQCapital')
where id in (17, 18, 19, 20);
