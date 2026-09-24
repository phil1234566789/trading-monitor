-- Nur den autorisierten H4-Test ergänzen; Gold-M5 und Live-Ingest bleiben gesperrt.
alter table public.fxcm_candles drop constraint fxcm_gold_h1_preview_check;
alter table public.fxcm_candles add constraint fxcm_gold_preview_check
  check (instrument <> 'XAUUSD' or bar in ('1h', '4h'));
