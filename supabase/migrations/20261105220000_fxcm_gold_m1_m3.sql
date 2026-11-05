-- Native M1/M3 für den Gold-Chart; bestehende Kerzen und übrige Validierungen bleiben erhalten.
alter table public.fxcm_candles drop constraint fxcm_gold_supported_bars_check;
alter table public.fxcm_candles add constraint fxcm_gold_supported_bars_check
  check (instrument <> 'XAUUSD' or bar in ('1m', '3m', '5m', '1h', '4h', '1D'));
