-- Feature Philip 05.09.2026 (siehe trading/orderblöcke.md#retest-status): eine getouchte, nicht
-- invalidierte OB gilt erst als "Retest bestätigt" (Confluence), wenn die Reaktion nachweislich
-- abgeschlossen ist -- HTF (1H/4H) über einen späteren Kerzenschluss außerhalb der Zone, M5 über
-- eine gleichgerichtete FVG nach dem Touch (live berechnet, siehe orderBlockDetection.js/
-- _shared/orderBlocks.ts). Für 1H/4H persistiert (poi-watcher/backfillObZones.ts schreiben es),
-- da diese Zonen anders als M5 nicht bei jedem Tool-Aufruf neu aus Kerzen berechnet werden.
alter table ob_zones add column if not exists retested boolean not null default false;
comment on column ob_zones.retested is 'Retest bestätigt (Confluence-Signal) -- siehe orderblöcke.md#retest-status. Nur aussagekräftig wenn touched=true und invalidated=false.';

-- Zeitpunkt, ab dem retested=true gilt (die bestätigende Kerze/FVG) -- separat von end_time (das
-- bleibt der Touch-Zeitpunkt), noetig damit ein Replay/Backtest (replayUntilSec) retested korrekt
-- zeitlich zurückrechnen kann statt Zukunftswissen zu leaken (dieselbe Bug-Klasse wie bei
-- applyAsOfZones/touched+invalidated, siehe CLAUDE.md "Liquidity Levels History Gap"/"obZones
-- Replay-Blindheit").
alter table ob_zones add column if not exists retested_at timestamptz;
comment on column ob_zones.retested_at is 'Zeitpunkt der retest-bestätigenden Kerze/FVG -- für Replay-Rueckrechnung, siehe applyAsOfZones.';
