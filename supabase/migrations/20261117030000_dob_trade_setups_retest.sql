-- DOB-Setup v2: Art und Alter des Retests der Quell-Zone je Trade, damit Folge-Touch bzw. frischer Retest später als Guardrail
-- geprüft werden kann, ohne neu zu messen. Rein additiv und nullable (v0/v1 haben keinen Wert).
alter table public.dob_trade_setups add column source_retest_kind text check (source_retest_kind in ('first','followUp'));
alter table public.dob_trade_setups add column source_retest_age_seconds bigint;
