-- Persistiertes Forex-Kerzen-Archiv (Chat 2026-08-09, Philip: "wir holen gnadenlos alle candles
-- ... Lana kann dann auch dort die Candles lesen => kein gescheiße mit cTrader"). Bisher lief
-- praktisch jeder historische Read (Chart-Scroll-Back, Replay, Laniakea/MCP-Analysen) über eine
-- frische Live-cTrader-Verbindung — teuer (eigener OAuth-Handshake pro Request) und timeout-
-- anfällig (siehe PriceChart.vue showLoadOlderButton, selbes Datum). Diese Tabelle ist ein
-- wachsendes, unveränderliches Archiv geschlossener Kerzen: einmalig per Backfill-Script befüllt
-- (mcp-server/src/scripts/backfillForexCandles.ts), Erweiterung auf laufende Pflege (z.B. über
-- poi-watchers ohnehin laufenden M5-Fetch) ist ein separater, späterer Schritt.
--
-- Pilot-Umfang (bewusst klein, Philip will sich das Ergebnis erst ansehen, bevor wir aufs ganze
-- Jahr + EURUSD ausweiten): nur GBPUSD, nur 5m/1h/4h, nur Juli+August 2026.
--
-- time als timestamptz (nicht bigint Unix-Sekunden) — konsistent mit jeder anderen Zeitspalte in
-- diesem Schema (ob_zones.start_time, trade_setups.fractal_pivot_time, ...). bar-Werte folgen den
-- Labels aus timeframes.js/der forex-candles Edge Function (PERIOD_MAP), nicht den uneinheitlichen
-- Großschreib-Varianten in ob_zones ("1H"/"4H") oder liquidity_levels ("1h"/"5m").
--
-- Kein updated_at/Update-Trigger: geschlossene Kerzen ändern sich nie wieder, ein erneuter
-- Backfill-Lauf überspringt bereits vorhandene Zeilen (ON CONFLICT DO NOTHING im Script) statt sie
-- zu überschreiben — deshalb reicht eine reine anon-Insert-Policy, keine Update-Policy nötig.
create table forex_candles (
  instrument text not null,
  bar text not null check (bar in ('5m', '1h', '4h')),
  time timestamptz not null,
  open numeric not null,
  high numeric not null,
  low numeric not null,
  close numeric not null,
  volume numeric not null,
  primary key (instrument, bar, time)
);

alter table forex_candles enable row level security;

-- Gleiches Single-User-Anon-Modell wie news_events/sessions/trade_setups (siehe CLAUDE.md) — sowohl
-- das einmalige Backfill-Script als auch spätere Sync-Writes und alle Lesezugriffe (MCP, Frontend)
-- laufen über denselben anon-Key.
create policy "forex_candles read for anon"
  on forex_candles for select
  to anon
  using (true);

create policy "forex_candles insert for anon"
  on forex_candles for insert
  to anon
  with check (true);
