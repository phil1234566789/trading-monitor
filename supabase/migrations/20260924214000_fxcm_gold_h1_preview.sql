-- Gold zunächst ausschließlich für den geprüften H1-Datentest zulassen; keine Feed-Umstellung.
alter table public.fxcm_candles drop constraint fxcm_candles_instrument_check;
alter table public.fxcm_candles add constraint fxcm_candles_instrument_check
  check (instrument in ('GBPUSD', 'EURUSD', 'XAUUSD'));
alter table public.fxcm_candles add constraint fxcm_gold_h1_preview_check
  check (instrument <> 'XAUUSD' or bar = '1h');
