-- Ziele nachträglich zu einem Trade hinzufügen (Chat 2026-07-27: "wie wärs, wenn wir ermöglichen,
-- einem Trade ein Target hinzuzufügen" — LQ-Level im Chart anklicken, siehe Trade-Modus/
-- tradeIntake.js) — trade_targets hatte bisher nur eine Read-Policy für anon (siehe
-- 20260727180000_trade_thesis_and_partial_exits.sql), der neue Browser-Weg braucht INSERT.
create policy "trade_targets anon insert"
  on trade_targets for insert
  to anon
  with check (true);
