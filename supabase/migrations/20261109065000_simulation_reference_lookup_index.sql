-- Der Validierungsbeleg braucht nur denselben Lauf/Zeitpunkt statt aller großen Snapshots.
-- Die bestehende JSON-Prüfung und die Auswahl per id bleiben unverändert.
create index trade_setup_simulation_setups_reference_lookup
  on public.trade_setup_simulation_setups using btree (run_id, known_at, id);
