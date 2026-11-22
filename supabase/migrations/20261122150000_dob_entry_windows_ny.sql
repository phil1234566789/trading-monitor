-- Default-Entry-Fenster für HTF-OB (Philip 22.11., Messung Intraday-WR je Entry-Stunde): normale, schaltbare Einträge in entry_windows
-- (Berlin-Minuten, Intl; dobEntryRule). Vorne eingefügt, weil das erste passende Fenster gilt (XAU hat 14–19 Uhr eine TP-Regel).
-- NY-Close-Schluss 20:00–24:00 an (Entries ab 22:00 sperrt der Indikator ohnehin); NY-Open 15:00–16:00 aus, zum Ausprobieren.
-- Idempotent über das Label.
update public.dob_guardrails g
set entry_windows = (
    select coalesce(jsonb_agg(w), '[]'::jsonb) from jsonb_array_elements(jsonb_build_array(
      '{"label":"NY-Close-Schluss","from":1200,"to":0,"action":"block","enabled":true}'::jsonb,
      '{"label":"NY-Open","from":900,"to":960,"action":"block","enabled":false}'::jsonb)) w
    where not exists (select 1 from jsonb_array_elements(g.entry_windows) e where e->>'label' = w->>'label')
  ) || g.entry_windows,
  updated_at = now()
where g.poi_type = 'htf_ob';
