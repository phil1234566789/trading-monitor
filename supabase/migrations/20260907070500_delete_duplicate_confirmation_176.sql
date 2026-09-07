-- Duplikat-Bestätigung (id=176), nur erzeugt um den State-Machine-Übergang
-- s45.tscLink -> s45.pinCheck für den Backtest-Tag 2026-08-28 gegen die
-- richtige sec (statt Live-Zeile) neu zu feuern. Range #77 hat bereits
-- 3 saubere Bestätigungen, diese 4. war reiner Nebeneffekt.
delete from trade_evidence where id = 176;
