-- Datenkorrektur: backfillLiquidityLevels.ts setzte end_time in seiner ersten Version
-- (Commit 7028dea) auch für UNBERÜHRTE Level (auf den letzten archivierten Kerzen-Zeitpunkt statt
-- null) — poi-watcher selbst setzt end_time bei touched=false immer explizit null (siehe
-- index.ts: endTimeIso), damit ein Level in der Chart-Anzeige bis "jetzt" weiterwächst statt an
-- einem eingefrorenen Zeitpunkt zu enden. Das Script wurde korrigiert (nächster Lauf setzt
-- ignoreDuplicates, würde bestehende falsche Zeilen also NICHT von selbst reparieren) — hier
-- einmalig nachgezogen.
update liquidity_levels set end_time = null where touched = false and end_time is not null;
