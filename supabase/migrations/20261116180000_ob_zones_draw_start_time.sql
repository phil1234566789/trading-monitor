-- Zeichenbeginn eines HTF-OB, dessen Kante aus der Kerze vor der Impulskerze stammt (Star/Session-Extrem).
-- start_time bleibt Schlüssel und Erkennungsbasis.
alter table public.ob_zones add column if not exists draw_start_time timestamptz;
