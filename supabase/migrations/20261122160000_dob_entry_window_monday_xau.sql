-- XAU HTF-OB: Fenster „Montag“ (ganzer Tag, nur Montag Berlin), aus. Philip schaltet es im Panel an (Messung WR je Wochentag).
-- days wie session.days (0=So..6=Sa, dobEntryRule). Vorne eingefügt, damit es eingeschaltet vor den TP-Regeln greift. Idempotent über das Label.
update public.dob_guardrails g
set entry_windows = '[{"label":"Montag","from":0,"to":1440,"days":[1],"action":"block","enabled":false}]'::jsonb || g.entry_windows,
  updated_at = now()
where g.instrument = 'XAUUSD' and g.poi_type = 'htf_ob'
  and not exists (select 1 from jsonb_array_elements(g.entry_windows) e where e->>'label' = 'Montag');
