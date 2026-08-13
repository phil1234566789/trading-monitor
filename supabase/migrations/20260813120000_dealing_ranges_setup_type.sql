-- "Favorit"-Markierung für dealing_ranges (Chat 2026-08-13): Philip will Trade-Ideen markieren
-- können, die für seine (aktuell einzige) Strategie perfekt gelaufen sind, um über die Zeit eine
-- Sammlung an Top-Setups aufzubauen. Bewusst kein plain boolean, sondern eine Spalte mit
-- CHECK-Constraint-"Enum" wie direction/outcome anderswo in diesem Schema (statt eines echten
-- Postgres-ENUM-Typs, siehe CLAUDE.md-Konvention) — Philip explizit: "kein Freitextfeld", er will
-- über die Zeit eine feste, kuratierte Liste an Setup-Kategorien sammeln statt frei formulierten
-- Text. Aktuell genau EIN Wert ('10/10-Trade', Philips eigene Bezeichnung); weitere Kategorien
-- (z.B. sobald es eine zweite Strategie gibt) kommen als eigene Migration dazu, die den CHECK
-- erweitert. Ein späteres Umbenennen eines Werts ist eine simple UPDATE-Query + Constraint-Anpassung
-- (Philips eigener Vorschlag), kein Schema-Redesign.
--
-- Auf dealing_ranges (die IDEE), nicht trade_positions (die Ausführung) — Philip: die Bewertung
-- gilt der ganzen Trade-Idee, nicht einer einzelnen Ausführung/einem Re-Entry.
alter table dealing_ranges add column setup_type text;

alter table dealing_ranges add constraint dealing_ranges_setup_type_check
  check (setup_type is null or setup_type in ('10/10-Trade'));
