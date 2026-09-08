-- State-Machine-Testlauf 07.09./08.09.2026 (Attention-Level-Fix + mehrere Anti-Confluence-Bugfixes)
-- erfolgreich komplett durchgespielt, Schritt 1-8 bis zum geschlossenen Trade. Dealing Range/
-- Confirmations/Position hat Philip bereits selbst geloescht - nur Loop-State/Log fuer den Tag
-- zuruecksetzen, damit Lana denselben Test sauber neu starten kann.
delete from state_machine_log where instrument = 'GBPUSD' and date_str = '2026-08-28';
delete from trading_loop_state where instrument = 'GBPUSD' and date_str = '2026-08-28';
