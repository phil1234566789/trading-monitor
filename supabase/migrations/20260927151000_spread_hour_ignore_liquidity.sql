-- Das Flag aus 20260927150000 fuer den Fall setzen, fuer den es gebaut wurde. Ohne diese Zeile
-- waere die Aenderung ausgeliefert, aber wirkungslos. Zurueckdrehen geht ueber die Checkbox
-- "Liquiditaet ignorieren" im Sessions-Modal, nicht ueber eine weitere Migration.
update sessions set ignore_liquidity = true where label = 'Spread Hour';
