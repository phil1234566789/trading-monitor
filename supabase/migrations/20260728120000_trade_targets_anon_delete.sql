-- Ziel wieder entfernen können (Chat 2026-07-28: "1,32992 kann ja jetzt raus") — z.B. ein
-- automatisch aus dem alten take_profit-Feld übernommenes Ziel, das nicht mehr passt.
create policy "trade_targets anon delete"
  on trade_targets for delete
  to anon
  using (true);
