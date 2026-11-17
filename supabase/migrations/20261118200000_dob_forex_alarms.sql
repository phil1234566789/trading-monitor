-- Philip: jede POI-Art auf jedem Instrument mit Alarm (XAUUSD, GBPUSD, EURUSD × HTF-OB, LQ-Sweep); sperren kann er im Panel.
-- Fehlende Zeilen mit „nichts gesperrt, TP 2R“ (LQ-Sweep ohne Gegen-DOB und Gegenkerzen); bestehende Werte bleiben, nur der
-- Alarm-Schalter wird überall eingeschaltet.
insert into public.dob_guardrails (instrument, poi_type, counter_dob_mode, counter_candles_mode)
values ('GBPUSD', 'lq_sweep', 'off', 'off'), ('EURUSD', 'lq_sweep', 'off', 'off')
on conflict (instrument, poi_type) do nothing;
insert into public.dob_guardrails (instrument, poi_type) values ('EURUSD', 'htf_ob') on conflict (instrument, poi_type) do nothing;
update public.dob_guardrails set alarm_enabled = true, updated_at = now()
where instrument in ('XAUUSD', 'GBPUSD', 'EURUSD') and alarm_enabled = false;
