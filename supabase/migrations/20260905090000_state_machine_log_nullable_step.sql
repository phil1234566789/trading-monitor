-- Philip 05.09.2026: add_pin_entry/create_dealing_range/add_trade_confirmation sollen ebenfalls in
-- state_machine_log landen. create_dealing_range passt sauber auf Schritt 5, aber ein Pin oder eine
-- Bestätigung kann bei JEDEM Schritt entstehen (z.B. eine HTF-Res-Zone in Schritt 3, siehe heutiges
-- Beispiel) — step erzwingt hier keine künstliche Zuordnung mehr, sondern darf null bleiben.
alter table state_machine_log alter column step drop not null;
alter table state_machine_log drop constraint state_machine_log_step_check;
alter table state_machine_log add constraint state_machine_log_step_check check (step is null or step between 1 and 6);
