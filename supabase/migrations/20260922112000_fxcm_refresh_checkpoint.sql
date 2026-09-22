-- Der vorhandene H1-Cache speichert den letzten erfolgreich ausgewerteten HTF-Stand.
alter table public.forex_h1_cache add column h4_last_time bigint;
