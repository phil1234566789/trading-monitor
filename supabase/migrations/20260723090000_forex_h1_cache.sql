-- Cached 1H-Kerzen pro Forex-Instrument (Chat 2026-07-23: 1H-Fetch von alle-5min auf einmal-
-- pro-Stunde gedrosselt, wie zuvor schon bei 4H via ob_zones). Anders als bei den 4H-/1H-OB-
-- Zonen oder den 1H-Liquiditäts-Leveln gibt es für die vom Trade-Setup gebrauchten 1H-
-- Fraktale (Protected-High/Low-Referenz, siehe candles1hForSetup in poi-watcher/index.ts)
-- noch keine Persistenz — die werden pro Lauf transient aus den rohen Kerzen berechnet und
-- nirgends gespeichert. Diese Tabelle cacht deshalb die rohen 1H-Kerzen selbst (nicht die
-- daraus abgeleiteten Fraktale), einmal pro Stunde befüllt, dazwischen einfach wieder
-- ausgelesen statt neu von Twelve Data zu holen.
create table forex_h1_cache (
  instrument text primary key,
  candles jsonb not null,
  updated_at timestamptz not null default now()
);

create trigger forex_h1_cache_set_updated_at
  before update on forex_h1_cache
  for each row
  execute function set_updated_at();

-- Kein anon-Zugriff nötig — nur der service_role-Key der Edge Functions liest/schreibt hier
-- (wie ctrader_oauth_tokens); die enable-Zeile schließt anon/authenticated ohne Policy aus.
alter table forex_h1_cache enable row level security;
