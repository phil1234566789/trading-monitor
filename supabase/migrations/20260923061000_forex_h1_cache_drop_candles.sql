-- Der 1H-Kerzen-Blob wird seit dem zugehoerigen poi-watcher-Deploy nicht mehr geschrieben
-- (h1_last_time ersetzt ihn, siehe Vor-Migration).
alter table public.forex_h1_cache drop column candles;
