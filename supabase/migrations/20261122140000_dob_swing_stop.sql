-- SL-Variante (c) je Trade (src/dobMaxR.js, dobSwingStopVariant): bei Anti-Confluence „breit“ SL 5 Ticks hinter dem M15-P2, Ziel fest.
-- Gleiche Bedeutung wie max_r/sl_hit/ambiguous_r (in R des DOB-Risikos), dazu neues Risiko und neuer SL; null = Trade bleibt beim DOB-SL.
alter table public.dob_trade_setups add column if not exists swing_max_r double precision, add column if not exists swing_sl_hit boolean,
  add column if not exists swing_ambiguous_r double precision, add column if not exists swing_risk_usd double precision,
  add column if not exists swing_stop_price double precision;
-- Schalter je Instrument und POI-Art (wirkt nur bei HTF-OB), Default aus: ohne Philips Go ändert sich weder Statistik noch Alarm.
alter table public.dob_guardrails add column if not exists swing_stop boolean not null default false;
