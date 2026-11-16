-- Max R je Trade (src/dobMaxR.js): höchste 0,5R-Stufe bis 5R vor dem SL, verfolgt wie der 2R-Ausgang bis Datenende,
-- und ob der SL vorher kam. Damit wertet die Seite beliebige R-Ziele aus. Rein additiv, die Seite liest select('*') und blendet ohne Werte aus.
alter table public.dob_trade_setups add column max_r double precision, add column sl_hit boolean;
