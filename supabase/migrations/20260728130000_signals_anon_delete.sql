-- Trade-CRUD (Chat 2026-07-28: "lass die Entity 'trades' CRUD Funktionalität weitermachen") —
-- signals hatte bisher SELECT/INSERT/UPDATE für anon (siehe 20260727190000_trade_mode_setup_intake.sql),
-- aber kein DELETE. Fürs "Trade löschen" im neuen Bearbeiten-Modal gebraucht.
create policy "signals anon delete"
  on signals for delete
  to anon
  using (true);
