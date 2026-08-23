-- Manueller Re-Auth nach ACCESS_DENIED beim automatischen Refresh (siehe
-- scripts/ctrader-reauth.mjs Kommentar) — Refresh-Token war invalidiert, per Browser-Login
-- frisches Token-Paar geholt und hier geseedet.
insert into ctrader_oauth_tokens (id, access_token, refresh_token)
values (1, 'xxMYsNu-73YxOEBA0mcuGiBimKg-JPz2rzGwfodHuj4', 'tsGVbrVUZdotx9aYbqA0N4C-w6eXJJMN9ZPbaJjEid4')
on conflict (id) do update set access_token = excluded.access_token, refresh_token = excluded.refresh_token;
