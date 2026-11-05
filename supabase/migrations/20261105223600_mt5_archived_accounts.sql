-- Archivierung entfernt nur die Handelsfreigabe; Deals und Journale bleiben erhalten.
alter table public.mt5_accounts add column archive_details jsonb not null default '{}'::jsonb
 check(jsonb_typeof(archive_details)='object');

