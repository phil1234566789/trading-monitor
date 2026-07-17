-- Rückwirkende Befüllung für schon geswepte Level: der Sweep passiert per Definition
-- exakt am Level-Preis (touched = price wurde erreicht/durchbrochen), daher ist `price`
-- hier ein exakter (kein approximativer) Wert für alert_price — anders als bei ob_zones/
-- trade_setups, wo der historische Touch-Preis nicht mehr rekonstruierbar ist (dort bleibt
-- alert_price für Alt-Zeilen bewusst NULL statt eines geschätzten Werts).
update liquidity_levels set alert_price = price where touched and alert_price is null;
