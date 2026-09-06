-- Persistenter State pro (instrument, date_str) statt "ein aktiver Loop pro Instrument" (Philip,
-- 06.09.2026: "der state soll dauerhaft bleiben ... egal welcher Schritt ... nur wenn ich den state
-- löschen lasse, geht er weg"). Ersetzt die alte Status-basierte Eindeutigkeit (ein 'active'-Loop
-- pro Instrument, per 'superseded'/'completed'/etc. wieder freigegeben) durch eine permanente
-- Identität: ein Tag+Instrument hat GENAU eine Zeile, für immer, unabhängig von Status/Schritt/Fall
-- — ein Fall-4-Neustart, mehrere Dealing Ranges am selben Tag etc. aktualisieren dieselbe Zeile in
-- place statt eine neue anzulegen (dealing_ranges selbst bleibt unverändert mehrzeilig pro Tag,
-- trading_loop_state ist nur der "Cursor", welche gerade aktuell ist).
drop index if exists trading_loop_state_one_active_per_instrument;
alter table trading_loop_state add constraint trading_loop_state_instrument_date_unique unique (instrument, date_str);
