-- „Sperren und Regeln“ heißt auf der Seite jetzt „Setup-Konfiguration“: gleiche Umbenennung im Lauftext, ohne die Läufe neu zu füllen.
update public.dob_trade_setup_runs set description = replace(description, '„Sperren und Regeln“', 'die Setup-Konfiguration')
where description like '%„Sperren und Regeln“%';
