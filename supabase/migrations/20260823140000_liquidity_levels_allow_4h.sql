-- Task "Chart-Objekte: OBs auf kanonische ob_zones-ID konsolidieren", Nachbesserung 2026-08-23
-- (Philip: preisnahe relevante 4H-Level zusätzlich zu 1H, auf M5-4H sichtbar) — liquidity_levels
-- kannte bisher nur `timeframe='1H'` (siehe 20260715120000_liquidity_levels.sql), poi-watcher
-- erkennt/persistiert 4H-Liquiditäts-Level ab jetzt genauso wie 1H (gleiche TIMEFRAMES-Schleife
-- wie bei ob_zones, siehe poi-watcher/index.ts).
alter table liquidity_levels drop constraint liquidity_levels_timeframe_check;
alter table liquidity_levels add constraint liquidity_levels_timeframe_check check (timeframe in ('1H', '4H'));

-- Eigener Alarm-Schalter für die "Alarme"-Seite (Dashboard: src/alarmSettings.js), analog zu
-- ob_zone_4h/ob_zone_1h — ohne diese Zeile würde ein Ausschalten des neuen "4H Liquiditäts-Level
-- geswept"-Toggles per UPDATE auf eine nicht existierende Zeile still verpuffen (kein Insert),
-- der fail-open-Default in fetchAlarmSettings würde die Ausschaltung dann nie persistieren.
insert into alarm_settings (key, enabled) values ('liquidity_4h', true)
on conflict (key) do nothing;
