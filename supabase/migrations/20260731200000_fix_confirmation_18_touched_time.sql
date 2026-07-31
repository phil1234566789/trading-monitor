-- Backfill für die eine bestehende OB-Bestätigung (id 18, trade_position 25, Short #23) — Bug-
-- Report Philip 2026-07-31: "OB zeichnet sich durch bis zum jetzigen Zeitpunkt ... da ich einen
-- LOSS eingefangen hab, weißt du, dass da auch candles durchgingen". Konnte die exakte live
-- erkannte M5-Zone nicht zuverlässig zurückrechnen (rangeLow/rangeHigh dieser Zeile sind die ums
-- Fraktal geweiteten Setup-Box-Kanten, nicht die rohen detectOrderBlocks-Kanten — deckt sich mit
-- trade_positions.id=25.stop_loss=1.34315, identisch zu range_high hier). Verlässlicherer Anker:
-- die tatsächlich bekannte exit_time der Position (14:37 UTC) — price lief bis exit_price 1.34332
-- (über Entry UND Stop-Loss) durch, die Zone war da mit an Sicherheit grenzender Wahrscheinlichkeit
-- längst gebrochen.
update trade_confirmations
set touched_time = '2026-07-31T14:37:00+00:00'
where id = 18;
