-- POI LQ-Sweep: eigene Konfigzeile mit „nichts gesperrt, TP 2R“ (Gegen-DOB und Gegenkerzen aus). Erst nach dem Deploy der
-- POI-bewussten Leser anwenden (20261118120000, 20261118122000).
insert into public.dob_guardrails (instrument, poi_type, counter_dob_mode, counter_candles_mode)
values ('XAUUSD', 'lq_sweep', 'off', 'off') on conflict (instrument, poi_type) do nothing;
