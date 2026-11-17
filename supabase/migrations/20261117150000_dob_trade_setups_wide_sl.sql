-- Weite SL-Variante je Trade (src/dobMaxR.js, dobWideVariant): SL an der fernen M5-Kante von OB2, nur wo der Indikator-SL am
-- Retest-Extrem liegt; sonst null (eng = weit). Gleiche Bedeutung wie max_r/sl_hit/ambiguous_r, dazu das weite Risiko in USD.
alter table public.dob_trade_setups add column wide_max_r double precision, add column wide_sl_hit boolean,
  add column wide_ambiguous_r double precision, add column wide_risk_usd double precision;
