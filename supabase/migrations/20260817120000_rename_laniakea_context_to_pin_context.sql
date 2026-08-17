-- Feature-Rename "Laniakea" -> "Pin" (Chat 2026-08-17, Philip: "Highlight macht Sinn, ist aber
-- blöd zu schreiben" -> Pin bestätigt). Reines Umbenennen, keine Schema-Änderung — Spalten,
-- Constraints, Daten bleiben unverändert, nur Tabellen-, Index- und Policy-Namen wandern auf die
-- neue Terminologie, damit sie zum umbenannten Code (src/pinContext.js, mcp-server/src/tools/
-- pins.ts, get_pin_context) passt. Alte Migrationsdateien (20260801120000_laniakea_context.sql
-- und Folge-Migrationen) bleiben unangetastet — das ist Historie, kein aktueller Zustand.
alter table laniakea_context rename to pin_context;

alter index laniakea_context_trade_position_id_key rename to pin_context_trade_position_id_key;

alter policy "laniakea_context read for anon" on pin_context rename to "pin_context read for anon";
alter policy "laniakea_context write for anon" on pin_context rename to "pin_context write for anon";
