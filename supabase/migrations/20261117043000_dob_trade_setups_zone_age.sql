-- Alter der Kraftquelle-Zone (H1/H4) von ihrer Entstehung bis zum Retest (Start der letzten Touch-Episode vor OB1), nur v1/v2.
-- Rein additiv; die Seite blendet die Tabelle aus, solange ein Lauf keine Werte hat.
alter table public.dob_trade_setups add column source_zone_age_seconds bigint;
