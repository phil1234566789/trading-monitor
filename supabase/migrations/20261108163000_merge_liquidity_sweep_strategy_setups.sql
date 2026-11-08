-- Nur die zugeordneten LS-Kategorien vereinigen; offene/unbelegte Ideen bleiben unverändert.
alter table public.dealing_ranges drop constraint dealing_ranges_strategy_setup_check;
create function public.normalize_dealing_range_strategy_setup() returns trigger
language plpgsql set search_path = public as $$
begin
 if new.strategy_setup in ('countertrend','setup2') then new.strategy_setup := 'setup1'; end if;
 return new;
end;
$$;
-- Noch geöffnete ältere Clients dürfen weiter ihre bisherigen Schlüssel senden.
create trigger normalize_dealing_range_strategy_setup
before insert or update of strategy_setup on public.dealing_ranges
for each row execute function public.normalize_dealing_range_strategy_setup();
update public.dealing_ranges set strategy_setup = 'setup1' where strategy_setup in ('countertrend','setup2');
alter table public.dealing_ranges add constraint dealing_ranges_strategy_setup_check
 check (strategy_setup is null or strategy_setup in ('setup1','setup3','setup4','continuation'));
