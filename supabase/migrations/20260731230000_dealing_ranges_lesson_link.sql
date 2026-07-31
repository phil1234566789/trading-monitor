-- Chat 2026-07-31 (vierte Runde): manche Fehler-Trades haben einen "richtigen" Trade als Lehre
-- daneben (Philip: "GBP Short#23 war ein dummer Fehler, Long#24 wäre die Lesson daraus" — kann
-- auch eine falsch bestimmte dealing range sein, nicht nur ein Ausführungsfehler). Self-
-- referencing FK statt eigener Join-Tabelle, weil pro dealing_range höchstens EINE
-- "das wäre richtig gewesen"-Referenz Sinn ergibt (kein n:n) — die Rückrichtung ("wer
-- referenziert MICH als Lesson") wird in trades.js per Zusatz-Query aufgelöst, nicht als zweite
-- Spalte gespeichert. on delete set null (nicht cascade): Löschen der Lesson-Range darf nicht die
-- referenzierende Range mitreißen, nur die Verknüpfung selbst verschwindet.
alter table dealing_ranges
  add column lesson_dealing_range_id bigint references dealing_ranges (id) on delete set null,
  add constraint dealing_ranges_lesson_not_self check (lesson_dealing_range_id is null or lesson_dealing_range_id <> id);
