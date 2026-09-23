-- Der H1-Kerzen-Blob war ein Twelve-Data-Cache: 3000 Kerzen ablegen, um den API-Call zu sparen.
-- Die Kerzen kommen inzwischen aus dem eigenen Archiv, gelesen wurde vom Blob ohnehin nur noch
-- die letzte Kerzenzeit — dafuer reicht eine Zahl statt ~250 KB JSON hin und zurueck, pro Lauf
-- und Instrument (alle 5 Minuten). candles wird nach dem zugehoerigen Deploy nicht mehr
-- beschrieben und in der Folge-Migration gedroppt.
alter table public.forex_h1_cache add column h1_last_time bigint;

update public.forex_h1_cache
  set h1_last_time = (candles -> (jsonb_array_length(candles) - 1) ->> 'time')::bigint
  where candles is not null and jsonb_array_length(candles) > 0;

alter table public.forex_h1_cache alter column candles drop not null;
