-- Nachträgliche Verknüpfung der beiden GBPUSD-Short-Trades vom 2026-07-27 (Split-Entry, siehe
-- 20260727170000_seed_gbpusd_trade_2026-07-27.sql) mit dem tatsächlich erkannten Trade-Setup —
-- die Trades wurden noch vor dem Trade-Modus/tradeIntake.js-Feature manuell eingetragen, ohne
-- trade_setup_id. Setup-Id per Hand ermittelt (Query gegen trade_setups: instrument=GBPUSD,
-- direction=short, ob_top/ob_bottom passen exakt zum Entry-Bereich der beiden Trades):
-- id=105, ob_bottom=1.33158, ob_top=1.33161, notified_at 2026-07-27T14:00:15Z.
-- setup_entry/invalidation nach derselben Regel wie tradeIntake.js (bärisch: Unterkante=Entry,
-- Oberkante=Invalidation).
update signals
set trade_setup_id = 105,
    setup_entry = 1.33158,
    invalidation = 1.33161
where instrument = 'GBPUSD'
  and direction = 'short'
  and entry_price in (1.33146, 1.33101);
