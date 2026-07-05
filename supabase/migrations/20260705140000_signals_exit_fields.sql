-- Ergaenzung zu signals: exakter Exit-Zeitpunkt/-Preis, um Einstieg UND Ausstieg
-- praezise (nicht nur die Kerze) im Chart markieren zu koennen.

alter table signals
  add column exit_time timestamptz,
  add column exit_price numeric;
