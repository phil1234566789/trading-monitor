-- Philip: Default für Gegen-DOB ist „lebende sperren, nur tote TP 5R“; block_all bleibt Schalterstellung.
alter table public.dob_guardrails alter column counter_dob_mode set default 'live_block_dead_5r';
update public.dob_guardrails set counter_dob_mode = 'live_block_dead_5r', updated_at = now() where counter_dob_mode = 'block_all';
