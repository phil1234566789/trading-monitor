-- EURUSD HTF-OB wie GBPUSD: Start ohne Sperren, TP 2R, Gegen-DOB wie der XAU-Default, Gegenkerzen aus, kein Teilprofit.
-- Alarm aus für beide Forex-Zeilen: der dob-watcher läuft nur für XAU, der Schalter soll nichts anderes vorgeben.
insert into public.dob_guardrails (instrument, poi_type, counter_dob_mode, counter_candles_mode, partial_at_r, alarm_enabled)
values ('EURUSD', 'htf_ob', 'live_block_dead_5r', 'off', null, false) on conflict (instrument, poi_type) do nothing;
update public.dob_guardrails set alarm_enabled = false, updated_at = now() where instrument in ('GBPUSD', 'EURUSD');
