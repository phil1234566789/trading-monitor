-- Statistik je Konfig-Sperre für den ⛔-Alarm (src/dobBlockStats.js): der dob-watcher rechnet sie aus dem Referenzlauf, wenn die Konfig
-- seit der letzten Rechnung gespeichert wurde oder sie einen Tag alt ist, und legt sie hier ab.
alter table public.dob_guardrails add column if not exists blocked_stats jsonb, add column if not exists blocked_stats_at timestamptz;
