-- Reparatur der Zeilen, die der touched-Regression im poi-watcher zum Opfer fielen (siehe
-- Kommentar an der wasTouchedInDb-Bedingung in supabase/functions/poi-watcher/index.ts):
-- getouchte, danach invalidierte Zonen wurden beim naechsten Refresh-Tick auf touched=false
-- zurueckgesetzt und verschwanden damit aus dem /protokoll, obwohl der Telegram-Alarm rausging.
-- alert_price als Kriterium statt notified_at: es wird beim Touch immer eingefroren, auch wenn
-- gar keine Nachricht rausging (Alarm aus / ausserhalb der Session).
update ob_zones set touched = true where touched = false and alert_price is not null;
