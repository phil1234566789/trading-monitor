-- SL-Algo 1.0 je Trade (src/dobMaxR.js, dobSwingStopVariant): bei Anti-Confluence „breit“ SL 5 Ticks hinter dem M15-P2, Ziel fest.
-- Gleiche Bedeutung wie max_r/sl_hit/ambiguous_r (in R des DOB-Risikos), dazu neues Risiko und neuer SL; null = Trade bleibt beim DOB-SL.
alter table public.dob_trade_setups add column if not exists swing_max_r double precision, add column if not exists swing_sl_hit boolean,
  add column if not exists swing_ambiguous_r double precision, add column if not exists swing_risk_usd double precision,
  add column if not exists swing_stop_price double precision;
-- SL-Methode je Instrument und POI-Art (src/slAlgo.js), Default DOB-SL: ohne Philips Go ändert sich weder Statistik noch Alarm.
alter table public.dob_guardrails add column if not exists sl_algo jsonb not null default '{"method":"dob"}'::jsonb;
-- Zusätzliche Messgröße „Ziel bis Tagesende (NY-Close)“ (src/dobIntraday.js): höchste Stufe bis zum Tagesende in R des DOB-Risikos,
-- danach offen = kein Win; close_r = R zum Schlusskurs (Info), in R des verwendeten SL. swing_* = mit SL-Algo 1.0.
alter table public.dob_trade_setups add column if not exists intraday_max_r double precision, add column if not exists intraday_close_r double precision,
  add column if not exists swing_intraday_max_r double precision, add column if not exists swing_intraday_close_r double precision;
