-- Die Strategie gehört zur Idee; setup_type bleibt die unabhängige 10/10-Markierung.
alter table public.dealing_ranges add column strategy_setup text;
alter table public.dealing_ranges add constraint dealing_ranges_strategy_setup_check
 check (strategy_setup is null or strategy_setup in ('countertrend','setup2','setup3','setup4','continuation'));
