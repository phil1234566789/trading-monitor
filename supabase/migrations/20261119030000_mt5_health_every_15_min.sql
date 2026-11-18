-- Der Alarm kommt erst nach 2 h Dauerstörung, der Leerlauf-Worker meldet sich nur stündlich; minütlich prüfen
-- kostete ~600 REST/h ohne Nutzen. Akute Fehler (Fault, unklarer Versand) stoßen mt5-health weiterhin sofort an.
select cron.alter_job((select jobid from cron.job where jobname='mt5-health'), schedule := '*/15 * * * *');
