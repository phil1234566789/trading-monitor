-- TS1.1 heißt LS-Reaktion (src/lsReactionRows.js). Reiner Rename, Daten und Versionsschlüssel bleiben; vor dem dob-watcher-Deploy pushen.
alter table public.trade_setup_ts11_verdicts rename to ls_reaction_verdicts;
alter policy trade_setup_ts11_verdicts_read on public.ls_reaction_verdicts rename to ls_reaction_verdicts_read;
alter index public.trade_setup_ts11_verdicts_pkey rename to ls_reaction_verdicts_pkey;
