-- trade_targets hatte bisher nur SELECT (20260727180000)/INSERT (20260727220000)/DELETE
-- (20260728120000) für anon, nie UPDATE — fiel erst beim Bau der neuen MCP-Tools
-- add_trade_target/update_trade_target/delete_trade_target auf (Chat 2026-08-09: TP1/TP2 einer
-- Dealing Range nachträglich korrigieren schlug mit "0 rows" statt einem Fehler fehl, klassisches
-- stilles RLS-Symptom). Gleiches permissives Single-User-Modell wie die bestehenden drei Policies.
create policy "trade_targets anon update"
  on trade_targets for update
  to anon
  using (true)
  with check (true);
