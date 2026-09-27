-- Autorisierter Gold-Rollout: ausschließlich die für Chart/Struktur verwendeten Zeitebenen.
alter table public.fxcm_candles drop constraint fxcm_gold_preview_check;
alter table public.fxcm_candles add constraint fxcm_gold_supported_bars_check
  check (instrument <> 'XAUUSD' or bar in ('5m', '1h', '4h', '1D'));
