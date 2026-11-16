-- Höchste Stufe, die in derselben Kerze wie der SL lag (src/dobMaxR.js): Ziele bis dort sind unentschieden wie beim 2R-Ausgang
-- (ambiguous), höhere Loss. Ohne sie wiche Ziel 2R um die uneindeutigen Trades vom gespeicherten Ausgang ab. Rein additiv.
alter table public.dob_trade_setups add column ambiguous_r double precision;
