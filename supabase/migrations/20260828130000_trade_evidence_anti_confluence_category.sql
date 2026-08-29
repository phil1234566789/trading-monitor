-- Anti-Confluence als dritte category (Chat 2026-08-28, direkt im Anschluss an die
-- Confirmation/Confluence-Trennung, Migration 20260828120000) — Philip: "im ersten Schritt
-- klickbare Chart-Objekte" für Anti-Confluences, gleicher kind-Satz wie Confirmation/Confluence
-- (pivot/ob/fib/rsi_divergence), aber category kann jetzt NICHT mehr rein aus kind abgeleitet
-- werden (z.B. ein gegenläufiger OB ist je nach Klick-Button Confirmation ODER Anti-Confluence,
-- nicht mehr 1:1 an kind gekoppelt). category wird darum von der generierten Spalte auf eine ganz
-- normale Spalte umgestellt, ab jetzt explizit von der App gesetzt (Frontend: Dashboard.vue reicht
-- die Kategorie je Arm-Zustand an insertConfirmation durch; MCP-Server: db.ts leitet sie weiterhin
-- automatisch aus kind ab, da add_trade_confirmation noch keinen eigenen Anti-Confluence-Weg hat —
-- siehe milk-city Task "Lana-MCP: Confirmations/Confluences/Anti-Confluences/Targets vollständig
-- für eine Dealing Range anlegbar"). DROP EXPRESSION behält die bisher berechneten Werte für alle
-- Alt-Zeilen 1:1 bei, kein Backfill nötig.
alter table trade_evidence alter column category drop expression;
alter table trade_evidence alter column category set not null;
alter table trade_evidence add constraint trade_evidence_category_check check (category in ('confirmation', 'confluence', 'anti_confluence'));
