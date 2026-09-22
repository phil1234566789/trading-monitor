-- Der Collector holt kurz nach Minutenschluss; die Auswertung folgt eine Minute später.
select cron.alter_job(jobid, schedule := '1-59/5 * * * *') from cron.job where jobname='poi-watcher-5min';
-- Stundenweises, idempotentes Prüfen folgt dem saisonalen New-York-D1-Schluss.
select cron.alter_job(jobid, schedule := '15 * * * *') from cron.job where jobname='daily-structure-pivots';
