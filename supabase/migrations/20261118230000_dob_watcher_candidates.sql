-- Heutige DOB-Kandidaten je Instrument (src/dobWatcherCandidates.js) für das DOB-Watcher-Panel im Dashboard; der dob-watcher schreibt
-- sie je Lauf, die Seite liest sie nur.
alter table public.dob_watcher_state add column if not exists candidates jsonb;
