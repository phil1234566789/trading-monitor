-- Speichert das aktuelle cTrader-Access-/Refresh-Token-Paar, damit ctrader-candles und
-- poi-watcher es sich nach einem automatischen Refresh (siehe _shared/ctrader/client.ts)
-- gegenseitig weitergeben können. Edge-Function-Env (CTRADER_ACCESS_TOKEN als Supabase-
-- Secret) ist pro Deployment statisch — ein frisch refreshtes Token lässt sich dort zur
-- Laufzeit nicht zurückschreiben, deshalb diese Tabelle als eigentliche Quelle der Wahrheit.
-- Immer genau eine Zeile (id fest auf 1) statt einer Key-Value-Tabelle wie alarm_settings,
-- weil Access- und Refresh-Token nur als zusammengehöriges Paar Sinn ergeben.
create table ctrader_oauth_tokens (
  id int primary key default 1,
  access_token text not null,
  refresh_token text not null,
  updated_at timestamptz not null default now(),
  constraint ctrader_oauth_tokens_single_row check (id = 1)
);

create trigger ctrader_oauth_tokens_set_updated_at
  before update on ctrader_oauth_tokens
  for each row
  execute function set_updated_at();

-- Kein anon-Zugriff (anders als alarm_settings) — das sind Live-Credentials, keine
-- UI-Präferenzen. Nur der service_role-Key der Edge Functions liest/schreibt hier,
-- und der umgeht RLS ohnehin; die enable-Zeile unten schließt anon/authenticated aus.
alter table ctrader_oauth_tokens enable row level security;
