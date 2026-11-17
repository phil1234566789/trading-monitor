-- Mindestalter der Kraftquelle-Zone an/aus mit gemerktem Wert: min_zone_age_seconds bleibt der wirksame Wert (null = aus), damit jeder
-- Leser „aus“ richtig sieht; min_zone_age_saved_seconds merkt den Wert fürs Wiedereinschalten. Rein additiv.
alter table public.dob_guardrails add column min_zone_age_saved_seconds bigint check (min_zone_age_saved_seconds is null or min_zone_age_saved_seconds >= 0);
update public.dob_guardrails set min_zone_age_saved_seconds = min_zone_age_seconds where min_zone_age_seconds is not null;
