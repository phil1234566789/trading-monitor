-- Confirmation vs. Confluence (Chat 2026-08-28, siehe trading-Repo trade-from-poi.md#confirmation-
-- confluence-und-anti-confluence--wie-eine-dealing-range-go-bekommt): Philip hat die bisher
-- vermischten kind-Werte ('pivot'/'ob'/'fib'/'rsi_divergence') in trade_confirmations begrifflich
-- neu getrennt — 'pivot'/'ob' geben einer Dealing Range/Position tatsaechlich das GO
-- (Confirmation/"Bestaetigung"), 'fib'/'rsi_divergence' geben nur zusaetzliche Sicherheit, kein GO
-- (Confluence/"Zusatzargument"). Statt drei separater Tabellen (Confirmation/Confluence/spaeter
-- persistierte Anti-Confluence) bleibt es EINE Tabelle mit einer category-Spalte — Philip explizit:
-- "kommt ja noch anti-confluences dazu", eine gemeinsame Tabelle spart die dritte fast-identische
-- Kopie derselben Klick-Infrastruktur (dealing_range_id/trade_position_id-Dualitaet, price/
-- source_time/touched_time), wenn Anti-Confluences irgendwann ebenfalls persistiert werden.
--
-- Tabellen-Rename auf trade_evidence, weil "trade_confirmations" ab jetzt irrefuehrend waere (die
-- Tabelle traegt beide Kategorien, nicht mehr nur GO-Signale). category ist bewusst eine
-- GENERIERTE Spalte statt von der App gesetzt: dadurch bleibt sie automatisch konsistent mit kind,
-- ohne dass Frontend UND MCP-Server (zwei getrennte Runtimes, siehe CLAUDE.md) beide separat
-- pflegen muessen, welcher kind zu welcher category gehoert — und ohne Backfill-Risiko fuer
-- Alt-Zeilen (die generierte Spalte berechnet sich beim ADD COLUMN sofort fuer den Bestand).
alter table trade_confirmations rename to trade_evidence;

-- Der PK-Constraint-Rename zieht seinen Backing-Index automatisch mit um (Postgres-Verhalten) —
-- kein separates ALTER INDEX noetig.
alter table trade_evidence rename constraint trade_confirmations_pkey to trade_evidence_pkey;
alter index trade_confirmations_trade_position_id_idx rename to trade_evidence_trade_position_id_idx;
alter index trade_confirmations_dealing_range_id_idx rename to trade_evidence_dealing_range_id_idx;
alter table trade_evidence rename constraint trade_confirmations_trade_position_id_fkey to trade_evidence_trade_position_id_fkey;
alter table trade_evidence rename constraint trade_confirmations_dealing_range_id_fkey to trade_evidence_dealing_range_id_fkey;
alter table trade_evidence rename constraint trade_confirmations_kind_check to trade_evidence_kind_check;
alter table trade_evidence rename constraint trade_confirmations_exactly_one_parent to trade_evidence_exactly_one_parent;
alter table trade_evidence rename constraint trade_confirmations_ob_zone_id_fkey to trade_evidence_ob_zone_id_fkey;
alter table trade_evidence rename constraint trade_confirmations_liquidity_level_id_fkey to trade_evidence_liquidity_level_id_fkey;

alter policy "trade_confirmations read-only for anon" on trade_evidence rename to "trade_evidence read-only for anon";
alter policy "trade_confirmations anon insert" on trade_evidence rename to "trade_evidence anon insert";
alter policy "trade_confirmations anon delete" on trade_evidence rename to "trade_evidence anon delete";

alter table trade_evidence add column category text generated always as (
  case when kind in ('pivot', 'ob') then 'confirmation' else 'confluence' end
) stored;
