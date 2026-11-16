-- DOB-Setup v1: Quelle der Kraft = aktive H1/H4-OB-Zone höchstens 1,5 H1-ATR(14) von OB1 (Philip, Q16).
-- Rein additiv: die Seite liest select('*'), alte Frontend-Stände stören die neuen Spalten nicht.
alter table public.dob_trade_setups add column source_atr double precision;
alter table public.dob_trade_setups add column source_distance_atr double precision;
