-- Task "Chart-Objekte: OBs auf kanonische ob_zones-ID konsolidieren" (PLAN-chart-objekte-forex.md),
-- Punkte 2+3+5: trade_setups.ob_top/ob_bottom/ob_start_time und trade_confirmations.kind='ob' (die
-- Preis-Snapshots) sollen zusätzlich per FK auf ob_zones.id verweisen, statt nur kopierte Werte zu
-- führen. Kein Re-Detect für den Altbestand (Philip 2026-08-21: "wenn die OB irgendwann mal als
-- relevant angesehen wurde, dann persistieren — passt so, selbst wenn sich detectOrderBlocks()
-- später ändert") — die vorhandenen Snapshot-Werte werden 1:1 als neue ob_zones-Zeile übernommen.
-- Alte Spalten (ob_top/ob_bottom/ob_start_time, range_low/range_high/timeframe für kind='ob')
-- bleiben unangetastet — Lesecode wird in einem separaten Schritt auf ob_zone_id umgestellt, diese
-- Migration ist rein additiv/backfill.

alter table trade_setups add column ob_zone_id bigint references ob_zones (id);
alter table trade_confirmations add column ob_zone_id bigint references ob_zones (id);

-- 1) trade_setups-OBs backfillen. Direction der OB entspricht der Setup-Direction selbst (siehe
--    poi-watcher/index.ts: ob_zones.direction = z.dir===1?"long":"short", trade_setups.direction =
--    setup.dir===1?"short":"long", und tradeSetup.js: obDir = dir===1?-1:1 — ein Short-Setup
--    (dir=1) braucht obDir=-1, das poi-watcher als "short" persistiert; ein Long-Setup (dir=-1)
--    braucht obDir=1 -> "long". Beide Werte fallen also auf denselben Text wie trade_setups.direction).
--    Alle Setup-OBs sind laut detectSetupObs() immer Timeframe "5m" -> ob_zones.timeframe '5M'.
insert into ob_zones (instrument, timeframe, direction, top, bottom, start_time)
select distinct ts.instrument, '5M', ts.direction, ts.ob_top, ts.ob_bottom, ts.ob_start_time
from trade_setups ts
on conflict (instrument, timeframe, start_time, direction) do nothing;

update trade_setups ts
set ob_zone_id = oz.id
from ob_zones oz
where oz.instrument = ts.instrument
  and oz.timeframe = '5M'
  and oz.direction = ts.direction
  and oz.start_time = ts.ob_start_time
  and oz.top = ts.ob_top
  and oz.bottom = ts.ob_bottom;

-- 2) trade_confirmations kind='ob' backfillen. instrument/direction stehen nicht direkt auf
--    trade_confirmations, sondern nur am Parent (dealing_range direkt, oder über trade_position ->
--    dealing_range) — Herkunfts-Direction wird als OB-Direction übernommen (bestmögliche Annahme
--    für Altbestand ohne gespeicherten Roh-dir, analog zur Setup-Parität oben: eine Bestätigung
--    stützt i.d.R. dieselbe Richtung wie die Idee/Ausführung, an der sie hängt).
with confirmation_parent as (
  select
    tc.id as confirmation_id,
    coalesce(dr_direct.instrument, dr_via_position.instrument) as instrument,
    coalesce(dr_direct.direction, dr_via_position.direction) as direction,
    tc.timeframe,
    tc.source_time,
    tc.range_high as top,
    tc.range_low as bottom
  from trade_confirmations tc
  left join dealing_ranges dr_direct on dr_direct.id = tc.dealing_range_id
  left join trade_positions tp on tp.id = tc.trade_position_id
  left join dealing_ranges dr_via_position on dr_via_position.id = tp.dealing_range_id
  where tc.kind = 'ob'
    and tc.range_low is not null
    and tc.range_high is not null
    and tc.timeframe is not null
    and tc.source_time is not null
)
insert into ob_zones (instrument, timeframe, direction, top, bottom, start_time)
select distinct instrument, timeframe, direction, top, bottom, source_time
from confirmation_parent
where instrument is not null and direction is not null
on conflict (instrument, timeframe, start_time, direction) do nothing;

update trade_confirmations tc
set ob_zone_id = oz.id
from (
  select
    tc.id as confirmation_id,
    coalesce(dr_direct.instrument, dr_via_position.instrument) as instrument,
    coalesce(dr_direct.direction, dr_via_position.direction) as direction,
    tc.timeframe,
    tc.source_time,
    tc.range_high as top,
    tc.range_low as bottom
  from trade_confirmations tc
  left join dealing_ranges dr_direct on dr_direct.id = tc.dealing_range_id
  left join trade_positions tp on tp.id = tc.trade_position_id
  left join dealing_ranges dr_via_position on dr_via_position.id = tp.dealing_range_id
  where tc.kind = 'ob'
) matched
join ob_zones oz
  on oz.instrument = matched.instrument
  and oz.timeframe = matched.timeframe
  and oz.direction = matched.direction
  and oz.start_time = matched.source_time
  and oz.top = matched.top
  and oz.bottom = matched.bottom
where tc.id = matched.confirmation_id;
