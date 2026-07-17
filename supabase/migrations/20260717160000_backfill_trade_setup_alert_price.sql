-- trade_setups-Zeilen werden nie erneut upgesertet (siehe poi-watcher: existingSetupKeys
-- ueberspringt bereits bekannte Setups komplett) — Alt-Zeilen von vor dem alert_price-Fix
-- wuerden nie automatisch nachgezogen. Rueckwirkend mit fractal_price ("Protected") befuellt
-- statt des tatsaechlichen Live-Preises (nicht mehr rekonstruierbar) — auf Philips Wunsch als
-- gute Naeherung akzeptiert.
update trade_setups set alert_price = fractal_price where alert_price is null;
