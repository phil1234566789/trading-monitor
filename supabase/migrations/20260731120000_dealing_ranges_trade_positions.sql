-- Trade-Journal-Umbau (Chat 2026-07-31): bisher war eine "signals"-Zeile gleichzeitig die
-- Trade-IDEE (POI -> Target, "dealing range") UND ihre AUSFÜHRUNG. Das passt nicht, sobald ein
-- Trade mehrere Einstiege/Re-Entries hat, die alle zur selben Idee gehören — Philip: "Trade-
-- Ausführungen sind also 1-n untergeordnete zu einer dealing-range".
--
-- Aufteilung (Philips eigene Abgrenzung, nicht die ursprünglich angenommene):
--   dealing_ranges (Idee, 1)   — instrument, direction, invalidation (Idee wird ungültig),
--                                trade_setup_id (Link zum erkannten Muster, das die ganze Idee
--                                auslöste). NICHT hier: Entry-Kriterien — die können sich zwischen
--                                Re-Entries unterscheiden ("kann sein, dass sie verschiedene
--                                Entry-Kriterien hatten"), gehören also zur Ausführung.
--   trade_positions (Ausf., n) — ex "signals": entry_price/stop_loss/exit_*/outcome/r_multiple/
--                                source/reasoning/trading_account_id, plus neue FK dealing_range_id.
--
-- trade_targets gehören zur Idee (ein Ziel gilt für alle Ausführungen darunter) -> FK auf
-- dealing_ranges. trade_partial_exits bleiben bei der einzelnen Ausführung (jeder Entry hat seine
-- eigenen Teilverkäufe) -> FK weiterhin auf trade_positions (nur umbenannt).
--
-- trade_confirmations sind laut Philip zweigleisig: "gibt confirmations, die mir das GO für die
-- dealing range gibt, gibt noch andere confirmations, die mir das go für den entry geben" — UND
-- "die confirmations und das setup für den Entry sind so ziemlich das gleiche" -> das bisherige
-- setup_entry-Feld (Entry-Kriterium) fällt komplett weg und wird durch eine ganz normale
-- Bestätigung mit trade_position_id ersetzt. trade_confirmations bekommt darum ZWEI nullable FKs
-- (dealing_range_id, trade_position_id) mit CHECK "genau eine von beiden gesetzt" — kein
-- generisches parent_type/parent_id, weil es in Postgres für genau diesen Fall extra Syntax gibt.

-- 1) Neue Parent-Entity ------------------------------------------------------------------------
create table dealing_ranges (
  id bigint generated always as identity primary key,
  instrument text not null,
  direction text not null check (direction in ('long', 'short')),
  invalidation numeric,
  trade_setup_id bigint references trade_setups (id),
  created_at timestamptz not null default now(),
  -- Nur für den Backfill unten gebraucht (Mapping alte signals.id -> neue dealing_ranges.id),
  -- fliegt am Ende dieser Migration wieder raus.
  legacy_position_id bigint
);

create index dealing_ranges_instrument_idx on dealing_ranges (instrument);

alter table dealing_ranges enable row level security;

-- Gleiches volle Anon-CRUD wie bisher signals (siehe 20260705120002_signals.sql +
-- 20260727190000_trade_mode_setup_intake.sql + 20260728130000_signals_anon_delete.sql) — die
-- neue Tabelle übernimmt exakt die Rolle, die "signals" für These-Felder schon hatte.
create policy "dealing_ranges read-only for anon"
  on dealing_ranges for select
  to anon
  using (true);

create policy "dealing_ranges anon insert"
  on dealing_ranges for insert
  to anon
  with check (true);

create policy "dealing_ranges anon update"
  on dealing_ranges for update
  to anon
  using (true)
  with check (true);

create policy "dealing_ranges anon delete"
  on dealing_ranges for delete
  to anon
  using (true);

-- 2) Backfill: jede bisherige signals-Zeile war 1:1 auch eine "Idee" -> genau eine dealing_ranges-
-- Zeile pro bisherigem Trade, legacy_position_id hält die alte signals.id fest fürs Rückverknüpfen.
insert into dealing_ranges (instrument, direction, invalidation, trade_setup_id, created_at, legacy_position_id)
select instrument, direction, invalidation, trade_setup_id, created_at, id
from signals;

-- 3) signals -> trade_positions, FK zur neuen Parent-Entity ------------------------------------
alter table signals rename to trade_positions;
alter index signals_pkey rename to trade_positions_pkey;
drop index signals_instrument_source_idx; -- instrument wandert weg, Index ergibt so nicht mehr Sinn

alter table trade_positions add column dealing_range_id bigint references dealing_ranges (id) on delete cascade;

update trade_positions
set dealing_range_id = dealing_ranges.id
from dealing_ranges
where dealing_ranges.legacy_position_id = trade_positions.id;

alter table trade_positions alter column dealing_range_id set not null;
create index trade_positions_dealing_range_id_idx on trade_positions (dealing_range_id);

alter table dealing_ranges drop column legacy_position_id;

-- 4) trade_confirmations: zweigleisig machen (dealing_range ODER trade_position) — VOR dem
-- setup_entry-Backfill unten, weil der schon die neue trade_position_id-Spalte braucht -------
alter table trade_confirmations rename column signal_id to trade_position_id;
alter index trade_confirmations_signal_id_idx rename to trade_confirmations_trade_position_id_idx;
alter table trade_confirmations rename constraint trade_confirmations_signal_id_fkey to trade_confirmations_trade_position_id_fkey;
alter table trade_confirmations alter column trade_position_id drop not null;
alter table trade_confirmations add column dealing_range_id bigint references dealing_ranges (id) on delete cascade;
create index trade_confirmations_dealing_range_id_idx on trade_confirmations (dealing_range_id);

-- setup_entry war das Entry-Kriterium DIESER Ausführung — wird jetzt zu einer ganz normalen
-- Bestätigung (kind='ob', da setup_entry immer die M5-OB-Kante war, siehe
-- tradeIntake.js: deriveSetupEntryInvalidation), damit "Entry-Kriterium" und "Bestätigung" ab
-- jetzt dieselbe Sache sind, wie von Philip gewünscht.
insert into trade_confirmations (trade_position_id, price, kind, created_at)
select id, setup_entry, 'ob', now()
from trade_positions
where setup_entry is not null;

-- Jetzt, wo alle bisherigen Zeilen (Alt-Bestätigungen UND die neu aus setup_entry migrierten)
-- garantiert genau eine der beiden FKs gesetzt haben, die CHECK-Regel scharf schalten.
alter table trade_confirmations add constraint trade_confirmations_exactly_one_parent
  check (((dealing_range_id is not null)::int + (trade_position_id is not null)::int) = 1);

alter table trade_positions drop column setup_entry;
alter table trade_positions drop column instrument;
alter table trade_positions drop column direction;
alter table trade_positions drop column invalidation;
alter table trade_positions drop column trade_setup_id;

-- 5) trade_targets: FK wandert von der Ausführung zur Idee (Ziele gelten für alle Re-Entries) ---
alter table trade_targets add column dealing_range_id bigint;

update trade_targets
set dealing_range_id = trade_positions.dealing_range_id
from trade_positions
where trade_positions.id = trade_targets.signal_id;

alter table trade_targets alter column dealing_range_id set not null;
alter table trade_targets add constraint trade_targets_dealing_range_id_fkey
  foreign key (dealing_range_id) references dealing_ranges (id) on delete cascade;
alter table trade_targets drop constraint trade_targets_signal_id_fkey;
-- drop column reißt den alten signal_id-Index automatisch mit (Postgres droppt Indizes, die
-- ausschließlich auf der gedroppten Spalte liegen) — kein separates drop index nötig.
alter table trade_targets drop column signal_id;
create index trade_targets_dealing_range_id_idx on trade_targets (dealing_range_id);

-- 6) trade_partial_exits: bleibt bei der Ausführung, nur Spalte umbenannt --------------------
alter table trade_partial_exits rename column signal_id to trade_position_id;
alter index trade_partial_exits_signal_id_idx rename to trade_partial_exits_trade_position_id_idx;
alter table trade_partial_exits rename constraint trade_partial_exits_signal_id_fkey to trade_partial_exits_trade_position_id_fkey;
