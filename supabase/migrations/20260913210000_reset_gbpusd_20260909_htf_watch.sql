-- Loop-State GBPUSD 09.09.2026 zuruecksetzen fuer den Akzeptanztest des HTF-Watch-Kanals
-- (Migration 20260913200000) plus der korrigierten Inducement-Klassifizierung.
--
-- Stand vor diesem Reset: Schritt 5, Knoten s45.fallClassification bei 10:00 Uhr, Durchlauf vom
-- 13.09.2026 auf Philips Stopp hin abgebrochen. Erwartung nach dem Reset: 1.35652 (4H-NY-High,
-- ungetoucht) muss ab dem ersten Tick als htf_watch_level_above stehen und beim Ueberschreiten um
-- 09:10 einen Tick mit der Klassifizierung "Major Inducement" ausloesen — vorher tauchte das Level
-- den ganzen Tag in keinem einzigen Tick auf.
--
-- Wie in 20260910000000/20260912210000/20260913120000 nur Loop-State/Log loeschen. Die an dem Tag
-- angelegten dealing_ranges (#87 Short verworfen, #88 Long invalide), Pins und Chart-Zeichnungen
-- bleiben bewusst stehen — das ist Journal-Inhalt, keine Maschinen-Buchhaltung.
delete from state_machine_log where instrument = 'GBPUSD' and date_str = '2026-09-09';
delete from trading_loop_state where instrument = 'GBPUSD' and date_str = '2026-09-09';
