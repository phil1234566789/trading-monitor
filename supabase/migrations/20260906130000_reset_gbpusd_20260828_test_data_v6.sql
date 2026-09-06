-- Sechster Reset des GBPUSD-28.08.2026-Testlaufs — Philip laesst die State Machine parallel in
-- einem anderen Chat ueberarbeiten, alter Loop-State (zuletzt "Short aktiv") vor dem naechsten
-- Testdurchlauf wieder auf null, gleiches Muster wie v3-v5.
delete from state_machine_log where instrument = 'GBPUSD' and date_str = '2026-08-28';
delete from trading_loop_state where instrument = 'GBPUSD' and date_str = '2026-08-28';
