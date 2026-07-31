-- Nachzügler zu 20260731170000: der Backfill dort zielte auf trade_targets.id=20, aber Philip
-- hatte die Zeile zwischenzeitlich gelöscht+neu angelegt (jetzt id=21, gleicher Preis/OB) — Ziel
-- existiert schon, nur der Backfill traf die falsche (mittlerweile weg-gelöschte) id.
update trade_targets
set range_low = 1.33647, range_high = 1.33691
where id = 21 and kind = 'ob' and price = 1.33647 and range_low is null;
