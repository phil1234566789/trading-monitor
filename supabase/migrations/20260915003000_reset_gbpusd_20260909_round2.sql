-- Loop-State GBPUSD 09.09.2026 zuruecksetzen fuer den Testlauf nach Runde 1 + 2.
--
-- Stand vor diesem Reset: Schritt 3 (s3_bias.llm3_kontextSynthese) bei 09:00, entstanden aus den
-- Verifikations-Aufrufen vom 13./14.09. — kein echter Analyse-Durchlauf.
--
-- Seit dem letzten Reset gefixt und damit im Testlauf zu pruefen:
--   1. Inducement-Klassifizierung (1.35652 = Major statt Medium)
--   2. HTF-Watch-Kanal (1.35652 ab dem ersten Tick sichtbar, Treffer meldet die Klasse mit)
--   3. 5-Minuten-Riegel (kein Fast-Forward mehr ueber einen Takt hinaus)
--   4. trendForce: Sweep-Kraft kommt aus dem Level ("baerische Kraft, GEGEN den Uptrend")
--   5. evidence.freshM5ObZones / evidence.allLiquiditySweeps (Entry-Zone 1.35647-1.3568 sichtbar)
--   6. log_fall_classification verlangt checkedM5ObSetups/checkedHtfSweeps
--
-- Wie in 20260910000000/20260912210000/20260913120000/20260913210000 nur Loop-State/Log loeschen.
-- Die dealing_ranges #87 (Short, verworfen) und #88 (Long, invalide) bleiben stehen — Journal-
-- Inhalt, keine Maschinen-Buchhaltung. ACHTUNG fuer den Testlauf: #88 ist weiterhin die offene
-- TSC-Range des Instruments, ein add_trade_confirmation ohne id wuerde sie per Bootstrap
-- wiederverwenden. Im Testlauf deshalb explizit create_dealing_range aufrufen.
delete from state_machine_log where instrument = 'GBPUSD' and date_str = '2026-09-09';
delete from trading_loop_state where instrument = 'GBPUSD' and date_str = '2026-09-09';
