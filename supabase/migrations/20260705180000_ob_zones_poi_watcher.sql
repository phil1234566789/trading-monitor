-- Erweiterung fuer den POI-Watcher (D2, vereinfacht: nur Zonen-Erkennung + Telegram-Alert
-- bei Preis-Kontakt, kein M1/Claude-Check). ob_zones trackt jetzt Zonen ueber mehrere
-- Timeframes (4H + 1H) statt nur 4H, plus ob/wann eine Zone schon benachrichtigt wurde.

alter table ob_zones
  add column timeframe text not null default '4H' check (timeframe in ('1H', '4H')),
  add column notified boolean not null default false,
  add column notified_at timestamptz;

alter table ob_zones drop constraint ob_zones_instrument_start_time_direction_key;
alter table ob_zones add constraint ob_zones_instrument_timeframe_start_time_direction_key
  unique (instrument, timeframe, start_time, direction);
