-- "invalid" als outcome-Wert raus (Chat 2026-07-31: "das wurde am Anfang schon angelegt und wir
-- haben die Invalidierungslinie ewig nicht implementiert" — vermutlich vorausschauend für ein
-- Feature angelegt, das anders (dealing_ranges.invalidation + Chart-Linie, siehe
-- 20260731220000-Vorgänger-Chats) gelöst wurde, nie tatsächlich genutzt). 0 Zeilen betroffen
-- (siehe REST-Check vor dieser Migration: nur win/loss/null kommen aktuell vor).
alter table trade_positions drop constraint signals_outcome_check;
alter table trade_positions add constraint trade_positions_outcome_check check (outcome in ('win', 'loss', 'open'));
