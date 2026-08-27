-- Bug-Report Philip 2026-08-27: Position #76 (Dealing Range #48) bekam beim Anlegen über den
-- TSC-Button "jetzt" (27.08., 14:59) als triggered_at, obwohl das zugrundeliegende Setup ein
-- Backtest war — derselbe Bug, der gerade in addPositionToDealingRange/onTscTransferToTrades
-- gefixt wurde (Anker = OB-Bestätigung, sonst früheste Bestätigung, statt new Date()). Korrigiert
-- diese eine bereits angelegte Zeile nachträglich mit derselben Regel.

do $$
declare
  anchor_time timestamptz;
begin
  select coalesce(
    (select source_time from trade_confirmations where dealing_range_id = 48 and kind = 'ob' and source_time is not null order by source_time asc limit 1),
    (select source_time from trade_confirmations where dealing_range_id = 48 and source_time is not null order by source_time asc limit 1)
  ) into anchor_time;

  if anchor_time is not null then
    update trade_positions set triggered_at = anchor_time where id = 76;
    raise notice 'Position #76 triggered_at korrigiert auf %', anchor_time;
  else
    raise notice 'Position #76: keine Bestätigung mit source_time gefunden, nichts geändert';
  end if;
end $$;
