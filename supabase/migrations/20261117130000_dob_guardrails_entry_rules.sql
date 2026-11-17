-- Regeln je Entry-Zeitfenster statt nur Sperren (src/dobGuardrails.js): entry_windows = [{from, to, action:'block'|'tp', tpR?}]
-- in Berlin-Minuten, plus default_tp_r für Zeiten ohne Regel (Vorgabe 2R wie bisher). Rückwärtskompatibel: bestehende Sperren
-- werden als action 'block' übernommen; blocked_entry_windows bleibt und wird von der Seite mitgeschrieben, bis kein Leser mehr da ist.
alter table public.dob_guardrails
  add column entry_windows jsonb not null default '[]'::jsonb check (jsonb_typeof(entry_windows) = 'array'),
  add column default_tp_r double precision not null default 2 check (default_tp_r > 0);

update public.dob_guardrails
  set entry_windows = coalesce((select jsonb_agg(jsonb_build_object('from', w->0, 'to', w->1, 'action', 'block'))
    from jsonb_array_elements(blocked_entry_windows) w), '[]'::jsonb);
