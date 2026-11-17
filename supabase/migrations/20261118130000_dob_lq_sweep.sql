-- POI-Art LQ-Sweep (src/dobLqSweepPoi.js): Verbindungsstufe TS1.1 ↔ DOB, die noch zählt (edge = gleiche Kante, Philips Regel), und ein
-- Alarm-Schalter je POI-Art. LQ-Sweep sendet erst nach Philips Go; HTF-OB bleibt unverändert an.
alter table public.dob_guardrails add column poi_match_mode text not null default 'edge' check (poi_match_mode in ('edge', 'overlap', 'adjacent')),
  add column alarm_enabled boolean not null default true;
update public.dob_guardrails set alarm_enabled = false, updated_at = now() where poi_type = 'lq_sweep';
