# `poi-watcher`: die Alert-Cron und ihr Request-Budget-Throttling

`supabase/functions/poi-watcher/index.ts` läuft auf einem `pg_cron`-Schedule (alle 5 Min, siehe
`supabase/migrations/20260713120000_poi_watcher_cron_5min.sql`) und macht drei Dinge pro
Instrument (GBPUSD/EURUSD via cTrader): Order-Block-Zonen erkennen, 1H-Liquidity-Levels erkennen,
Trade-Setups erkennen (M5-Sweep + Fraktal + OB) — persistiert alles nach `ob_zones` /
`liquidity_levels` / `trade_setups`, und sendet eine Telegram-Nachricht beim ersten "Touch" einer
Zone/eines Levels, gated über ein Trading-Hours-Fenster und per-Alert-Typ-Toggles in der
`alarm_settings`-Tabelle (die "Alarme"-Seite im UI).

Nur geschlossene Kerzen sind verfügbar (kein Live-Ticker), also holt diese Function **nicht**
naiv alles neu bei jedem Lauf:
- Forex-Fetching passiert nur innerhalb eines Fetch-Fensters um die konfigurierte Trading-Session
  (`isForexFetchWindow`) — außerhalb werden GBPUSD/EURUSD komplett übersprungen.
- 4H-Kerzen werden nur einmal pro 4H-Grenze neu geholt (`isH4RefreshTick`); dazwischen werden nur
  die bereits erkannten Zonen in `ob_zones` gegen den Live-Preis geprüft (kein Re-Fetch, keine
  Neu-Erkennung).
- 1H-Kerzen werden nur einmal pro Stunde neu geholt (`isH1RefreshTick`); dazwischen laufen die
  1H-OB-Zonen-/Liquidity-Level-Checks genauso DB-only wie bei 4H, und die Trade-Setup-Logik
  (braucht eine 1H-Serie bei jedem 5-Minuten-Lauf, anders als die Zonen-Checks) liest eine
  gecachte Kopie aus der `forex_h1_cache`-Tabelle statt neu zu holen.
- M5 wird bei jedem Lauf geholt (Trade-Setups brauchen es frisch) und liefert auch den "aktuellen
  Preis" für Live-Touch-Checks — kein separater M1-Ticker-Call.

Bei einem neuen Feature in `poi-watcher` überlegen, zu welcher dieser drei Throttling-Stufen es
gehört, bevor ein neuer Per-Run-Fetch eingebaut wird.

`isH1RefreshTick`/`isH4RefreshTick` nutzen bewusst rohe UTC-Stunden statt Berlin-Zeit (Ausnahme zur
sonstigen Timezone-Konvention in `CLAUDE.md`), weil sie sich am UTC-basierten `pg_cron`-Schedule
ausrichten müssen, nicht an Berlin-Handelszeiten.
