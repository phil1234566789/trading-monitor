-- liquidity_levels fehlte bisher ein Kerzen-Zeit-Feld für "wann geswept" — analog zu
-- ob_zones.end_time (siehe dortige Historie: touched_at/updated_at sind Wanduhr-Zeit und
-- damit für Chart/Protokoll ungeeignet, da der Cron jede touched=true-Zeile bei jedem Lauf
-- erneut upsertet und updated_at damit immer "jetzt" zeigt). Ohne end_time gäbe es für
-- geswepte Level keinen brauchbaren Zeitstempel fürs neue Multi-Typ-Protokoll.
alter table liquidity_levels add column end_time timestamptz;
