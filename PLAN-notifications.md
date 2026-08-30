# Plan: POI-Strategie-Findung, Backtesting & Trade-Notifications

Ziel (Endausbau): Ein Cloud-Service (Supabase), der eigenständig — unabhängig vom eigenen
PC — 4H-Orderblock-Zonen beobachtet, bei Preis-Kontakt auf M1-Beobachtung eskaliert,
das M1-Entry-Setup ("4H OB + M1 Bounce Snipe", siehe `trading/setup-4h-ob-m1-bounce-snipe.md`)
per Claude prüfen lässt und bei gültigem Signal eine Telegram-Nachricht schickt.

**Aktueller Status: Die Strategie ist noch nicht final** (POI bei 4H-OBs → Wechsel auf M1
ist ein guter Ausgangspunkt, aber noch nicht "gemeißelt"). Deshalb wird **zuerst getestet**
(Backtesting + Paper-Trading + Dashboard-Sichtbarkeit), **bevor** die Live-Notification-
Pipeline gebaut wird. Reihenfolge unten entsprechend angepasst.

Wird Stück für Stück abgearbeitet, ggf. über mehrere Sessions verteilt. Checkboxen
markieren den Fortschritt.

**Update 2026-08-21: BTC-USDT/OKX komplett entfernt.** Philip tradet BTC mit der aktuellen
Strategie nicht mehr — der OKX-Fetch/-Cron-Pfad und der `BTC-USDT`-Symbol-Switcher sind aus dem
Code raus (bestehende `ob_zones`/Journal-Zeilen für BTC bleiben unangetastet in der DB). Die
Abschnitte unten (insbesondere "Zwei Instrumente..." und "Status: cTrader Open API") beschreiben
den historischen Verlauf inkl. BTC und bleiben unverändert stehen — für den aktuellen Code-Stand
zählt nur noch Forex (GBPUSD/EURUSD).

---

## Zwei Instrumente, zwei Datenquellen, eine Pipeline

Beide Instrumente sind relevant und laufen **parallel** in dieselbe Downstream-Pipeline
(Claude-Judge + Telegram), aber mit unterschiedlicher Datenquelle/Erkennungsebene:

| | BTC-USDT (Krypto) | GBPUSD/EURUSD/XAUEUR (Forex) |
|---|---|---|
| Datenquelle | OKX REST-API (frei, kein Auth) | Kein Crypto-Exchange hat Forex-Paare — OKX fällt raus |
| Zonen-/Entry-Erkennung | Eigene JS-Logik (`orderBlocks.js`, Portierung auf Edge Function in D2) | **TradingView selbst** — `tv-indikator`-Pine-Skript berechnet 4H-OB + M1-Entry schon jetzt korrekt für genau diese Symbole |
| Trigger in die Pipeline | Cron pollt OKX jede Minute | **Webhook-Alert** aus TradingView (Nutzer hat Premium, Webhooks früher schon erfolgreich genutzt) — kein eigener FX-Datenanbieter nötig |
| Claude-Rolle | Erkennt Muster aus rohen Kerzendaten (JSON) | Bekommt Alert-Payload (Preis, Zeit, Zonen-Kontext als Text), macht nur noch finale Plausibilitätsprüfung/Begründung |

Für Forex-**Backtesting** (Phase A) reicht das nicht — dafür braucht es trotzdem historische
Daten, z.B. via TradingViews eigenem Strategy-Tester/Bar-Replay oder kostenlosen historischen
FX-Daten (z.B. Dukascopy).

## Architektur-Bausteine (Entscheidungen)

- **Live-Pipeline (später, Phase D):** Supabase Edge Functions + Cron + Postgres + Telegram —
  gemeinsamer Endpunkt für beide Instrumente (OKX-Cron-Trigger + TV-Webhook-Trigger).
- **Claude (Sonnet 5)** mit Prompt Caching für den statischen Strategie-Kontext. Bei Krypto:
  strukturierte Kerzendaten als JSON (kein Screenshot/Vision). Bei Forex: Alert-Payload aus TV.
- **TradingView-Webhooks:** Offiziell unterstützter Weg, TV-Alerts an einen eigenen Endpoint
  zu pushen (Pull/Fetch von Alerts geht nicht, TV hat keine öffentliche Lese-API dafür).
  Nutzer hat TV Premium und hat Webhook-Alerts früher schon eingerichtet — funktioniert gut.
  Wird für die Forex-Seite gebraucht (Ersatz für eine eigene FX-Datenquelle + Neuimplementierung
  der OB-Erkennung) — Details werden erst nach Strategie-Validierung ausgearbeitet.

Kostenschätzung Live-Pipeline (siehe Chat-Verlauf): bei gezielter POI-getriggerter
Beobachtung (nicht 24/7 durchlaufend) ca. $15-35/Monat.

---

## Phase A — Backtesting-Infrastruktur (aktuell dran)

- [ ] Tiefere historische Kerzendaten von OKX holen. Aktuell holt `main.js` nur einen
      Call an `/market/candles` (max. 300 Kerzen zurück → bei M1 nur ~5h Historie).
      OKX unterstützt Pagination über den `after`-Parameter, Historie ist bis 2021
      zurück verfügbar — braucht mehrere sequenzielle Calls, die zusammengesetzt werden.
- [ ] Backtesting-Skript/Modul: verschiedene POI-Definitionen (4H-OB-Varianten) +
      M1-Entry-Varianten (a: Impulscandle / b: Retest+Bestätigungscandle) gegen
      historische Daten laufen lassen
- [ ] Auswertung: Trefferquote, False Positives, R-Multiple-Verteilung pro Variante

## Phase B — Paper-Trading auf Live-Daten

- [ ] Gleiche Erkennungslogik live mitlaufen lassen (ohne echte Order), Signale loggen
- [ ] Vergleich Log vs. tatsächlicher Kursverlauf danach

## Phase C — Dashboard-Erweiterung

- [x] Trades/Signale (aus Backtest + Paper-Trading) im trading-monitor-Frontend
      schön visualisieren — Entry, SL, TP, Ergebnis, Begründung — damit alles
      nachvollziehbar und kontrollierbar ist. Umgesetzt: Trades-Tabelle + Stats-Zeile
      (Winrate, PnL in R) unten im Dashboard, exakte Entry-/Exit-Marker direkt im Chart
      (Punkt + Preis-Strich, snapped auf die richtige Kerze je Timeframe, sichtbar auf
      1m/5m/15m/1h). Mit einem manuellen Test-Trade verifiziert.
- [ ] **Deployment offen:** FE ist noch nicht live — braucht zuerst ein GitHub-Repo/Remote
      (aktuell nur lokales Git, kein `origin`), dann Deploy auf GitHub Pages einrichten
      (`npm run build` + Pages-Workflow). **Achtung beim Deploy:** `vite.config.js` braucht
      dann noch `base: '/<repo-name>/'` (Projekt-Pages-Pfad) — Hash-Routing selbst braucht
      kein `base`, aber Asset-URLs schon. Nächstes Mal dran erinnern.
- [x] **Frontend auf Vue 3 migriert (2026-07-05):** Vanilla-JS + zwei Multi-Page-HTML-Dateien
      → Vue 3 (`<script setup>`) + `vue-router` (Hash-History, SPA) auf demselben Vite-Setup.
      Grund: Philip will das Dashboard jahrelang weiterbauen, kennt Vue, HTML-String-
      Templating (`el.innerHTML = ...`) und doppelte Status-Leisten-Logik zwischen den
      beiden alten Seiten wurden als konkrete Reibungspunkte identifiziert. Chart
      (lightweight-charts) bleibt bewusst imperativ in `PriceChart.vue` gekapselt (Canvas-
      API lässt sich nicht sinnvoll deklarativ abbilden) — inkl. sauberem Dispose bei
      Routenwechsel (`onUnmounted`: Timer clearen, `ResizeObserver` trennen, `chart.remove()`,
      Guards gegen "Object is disposed" bei noch laufenden Async-Loads). Neue Struktur:
      `App.vue` (Status-Leiste+Nav), `views/Dashboard.vue`+`views/Protokoll.vue`,
      `components/PriceChart.vue`+`Gauge.vue`+`TradesTable.vue`+`TradeStats.vue`+
      `ProtokollTable.vue`, `composables/useStatusBar.js`+`usePolledFetch.js` (einzige zwei
      Composables — Candles/CVD/Gauges bewusst NICHT extrahiert, da Single-Consumer und eng
      an die Chart-Instanz gekoppelt). Verifiziert: beide Routen, alle Timeframes, Gauges,
      Test-Trade-Marker, POI-Zonen, mehrfache Navigation ohne Chart-Leak, Production-Build
      (`npm run build`, Dashboard/Protokoll als separate Lazy-Chunks).
- [x] **Letzter Fix des Tages:** Off-by-one-Bug in `detectOrderBlocks()` gefunden — `endTime`
      fror genau eine Kerze zu frueh ein (auf der Kerze, die touched/invalidated ausloest,
      wurde der Status gesetzt, aber `endTime` fuer ebendiese Kerze nicht mehr mitgezogen).
      Sichtbarer Effekt: Zonen-Boxen endeten 1 Balkenbreite zu frueh (4h bei 4H-Zonen, 1h bei
      1H-Zonen). Fix in beiden Kopien (`src/orderBlocks.js` + `supabase/functions/_shared/
      orderBlocks.ts`), Edge Function redeployt + einmal manuell angestoßen, damit alle
      bestehenden Zonen sofort mit korrektem `end_time` neu geschrieben werden (kein
      Datenmigrations-Schritt nötig, wird bei jedem Lauf ohnehin komplett neu berechnet).
- [x] Neue Seite `protokoll.html` — Log aller erreichten POIs (Timeframe, Richtung, Zone,
      ob TG-Nachricht raus ist, Platzhalter-Spalte "Trade-Signal" für später/D3). Header-
      Navigation (Dashboard/Protokoll) in beiden Seiten, `vite.config.js` für Multi-Page-Build ergänzt
- [x] Chart zeigt jetzt 4H- **und** 1H-Order-Blocks gleichzeitig, direkt aus `ob_zones`
      (Supabase, dieselben Daten wie der poi-watcher) statt lokal neu berechnet — damit
      Chart und Bot immer exakt dasselbe zeigen, unabhängig vom gewählten Chart-Timeframe.
      1H-Zonen etwas dezenter eingefärbt als 4H, Label zeigt Timeframe (`4H OB Bull` etc.)
- [x] Nachbesserung 2026-07-05: eigene `touched_at`/`invalidated_at`-Spalten ergänzt
      (Migration `20260705230000_...`), getrennt von `notified_at` (das jetzt exklusiv
      "hier ging wirklich eine TG-Nachricht raus" bedeutet). Fixt zwei Dinge, die Philip
      per Chart-Screenshot gezeigt hat: (1) Zonen-Boxen wurden bis zur aktuellen Kerze
      weitergezogen statt am Touch/Invalidierungs-Zeitpunkt einzufrieren — lag daran, dass
      als Fallback `updated_at` genutzt wurde, das bei jedem Cron-Lauf neu gestempelt wird;
      (2) Protokoll-Seite zeigte "Erreicht am" nur, wenn wirklich eine TG-Nachricht raus
      ist — Philip braucht die Zeit aber immer, die TG-Flag getrennt zur Einordnung.
      Navigation (Dashboard/Protokoll) außerdem in die oberste Status-Leiste verschoben
      (war vorher in der Toolbar neben dem Symbol)
- [x] **Korrektur derselben Session:** `touched_at`/`invalidated_at` (Wanduhr-Zeit, wann der
      Cron es bemerkt hat) war der falsche Ansatz fürs Chart — Zonen-Boxen brauchen die
      **Kerzen-Zeit** der zuletzt gewachsenen Kerze, nicht wann der Bot es zufällig gesehen
      hat. `detectOrderBlocks()` berechnet das intern schon korrekt als `endTime` (wächst,
      bis touched/invalidated, dann automatisch eingefroren) — wurde nur nie persistiert.
      Ersetzt durch eine einzige `end_time`-Spalte (Migration `20260705240000_...`,
      `touched_at`/`invalidated_at` wieder entfernt), direkt aus der Zonen-Erkennung
      übernommen. Fixt sowohl die Chart-Boxen (verifiziert: Box stoppt jetzt an einer
      festen historischen Kerze statt am rechten Rand) als auch die Protokoll-Sortierung/
      -Anzeige. `notified_at` bleibt separat für "TG wirklich gesendet"

## Phase D — Live-Notification-Pipeline (erst nach validierter Strategie)

### D0 — Vorbereitung
- [x] Supabase-Projekt anlegen (oder bestehendes nutzen) — bestehendes Projekt `vkphwtqcvqrkphksproj` (eu-west-1/Ireland) verlinkt, CLI-Login via Access-Token
- [x] Telegram-Bot erstellen über [@BotFather](https://t.me/BotFather) (`/newbot`) → Bot-Token notieren — Bot `@milkyway_200a_bot` ("Trading Monitor Alerts")
- [x] Eigene Telegram-Chat-ID ermitteln (Nachricht an den Bot schicken, dann `getUpdates`-Endpoint abfragen) — Chat-ID `6388438907`, Testnachricht erfolgreich zugestellt
- [x] Anthropic API-Key bereitlegen
- [x] Secrets in Supabase hinterlegen: `ANTHROPIC_API_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`
      — gesetzt via `supabase secrets set --env-file supabase/functions.env`
      (lokale Datei `supabase/functions.env` mit echten Werten, gitignored)

### D1 — Datenmodell
- [x] Tabelle `ob_zones` — aktuell erkannte 4H-Orderblock-Zonen (top, bottom, dir, weak, touched, invalidated, startTime) — Migration `supabase/migrations/20260705120000_ob_zones.sql`, angewendet
- [x] Tabelle `watch_state` — pro Instrument: Modus (`idle` / `watching_m1`), aktiv beobachtete Zone, Zeitpunkt des letzten Zonen-Kontakts — Migration `20260705120001_watch_state.sql`, angewendet
- [x] Tabelle `signals` — Log aller Entry-Signale (Zeitpunkt, Richtung, Entry-Preis, SL, TP, Begründung, Outcome/R-Multiple, ob Notification verschickt wurde) — inkl. `source`-Spalte (`backtest`/`paper`/`live`), damit dieselbe Tabelle auch für Phase A/B/C nutzbar ist. Migration `20260705120002_signals.sql`, angewendet

### D2 — 4H+1H-Zonen-Wächter (Edge Function, läuft jede Minute) — **vereinfacht vorgezogen, 2026-07-05**
- [x] OKX-Candle-Fetch nach Deno/Edge-Function portiert — `supabase/functions/poi-watcher/index.ts`, läuft für **4H und 1H** (nicht nur 4H — Philip will für beide Timeframes eine Benachrichtigung, um sich selbst/den Trade vorzubereiten)
- [x] `detectOrderBlocks()`-Logik nach `supabase/functions/_shared/orderBlocks.ts` portiert (1:1 aus `src/orderBlocks.js`, muss bei Änderungen an der Zonen-Erkennung manuell mitgezogen werden — kein gemeinsames Build-System zwischen Vite-Frontend und Deno-Function)
- [x] Zonen in `ob_zones` persistieren/aktualisieren (Schema um `timeframe`, `notified`, `notified_at` erweitert, Migration `20260705180000_ob_zones_poi_watcher.sql`)
- [x] Bei Preis-Kontakt (Zone wird zum ersten Mal `touched`) → Telegram-Alert (siehe D4). Historische Alt-Touches beim allerersten Lauf lösen bewusst **keinen** Alert aus (sonst Spam beim Deploy)
- [x] Kein Claude-Call — reine Vergleichslogik, wie geplant
- [ ] ~~`watch_state`/M1-Eskalation~~ — noch nicht gebaut, da an D3 (Claude-Check) gekoppelt, aktuell übersprungen

### D3 — M1-Beobachtung + Claude-Entry-Check — **übersprungen, 2026-07-05**
Bewusst ausgelassen: es gibt noch kein fertiges Regelwerk für Claude (Strategie wird gerade in einer parallelen Session verfeinert). Nachholen, sobald die Strategie steht:
- [ ] M1-Candle-Fetch (OKX) für die letzten ~30-50 Kerzen
- [ ] M1-Orderblock-Erkennung (gleiche Kernlogik wie 4H, andere Parameter — siehe `tv-indikator/src/calculations.pine` `processClosedBar` mit `capMode=true`, Cap auf max. Zonengröße)
- [ ] Strukturierte Anfrage an Claude (Sonnet 5, `output_config.effort` vorerst `medium` testen):
  - System-Prompt (gecacht): Auszug aus `setup-4h-ob-m1-bounce-snipe.md` (Entry-Varianten, Bedingungen, Stop-Loss-Regel)
  - User-Content: aktuelle 4H-Zone, letzte M1-Kerzen als JSON, erkannte M1-OB-Zonen
  - Erwartete Antwort (structured output / JSON): `{ entry: bool, direction: "long"|"short"|null, stopLoss: number|null, reasoning: string }`
- [ ] Bei `entry: true` → Eintrag in `signals`-Tabelle

### D4 — Notification — **vereinfachte Version live, 2026-07-05**
- [x] Telegram-Nachricht, sobald ein 4H- oder 1H-OB erreicht wird (Richtung, Zonen-Range, aktueller Preis) — noch **kein** Entry-Signal-Alert (das braucht D3/Claude), nur "POI erreicht, jetzt selbst analysieren"
- [x] Markieren, dass eine Zone bereits benachrichtigt wurde (`ob_zones.notified`), kein Doppel-Versand
- [x] Quiet Hours 23–5 Uhr lokal (Europe/Berlin, Philips Schlafenszeit): kein Telegram-Versand
      in diesem Fenster. Zonen werden trotzdem normal erkannt/upgedatet (Kontinuität für die
      touched-Erkennung), nur der Versand pausiert — kein nachträglicher Alarm beim Aufwachen.
      Bewusst **nicht** auf Philips Handelszeiten (Mo-Fr 7-11 & 18-22) eingeschränkt, da er
      auch außerhalb davon (z.B. 6 Uhr) manchmal reagiert, wenn die Bedingungen passen
- [x] Bug gefunden+gefixt (2026-07-05): beim allerersten Deploy bekamen historische
      Alt-Touches (schon vor dem Bot getouchte Zonen) fälschlich den Deploy-Zeitpunkt als
      `notified_at`, obwohl nie eine echte Nachricht rausging. Kein Doppel-Versand passiert
      (der Send-Gate war korrekt), nur die Zeitstempel-Anzeige im Protokoll war irreführend.
      Fix deployed, Alt-Daten per Migration bereinigt (`20260705220000_fix_notified_at_backlog.sql`)
- [x] **Update 2026-07-09: Multi-Instrument, BTC stummgeschaltet.** `poi-watcher` erkennt/
      persistiert Zonen weiterhin für alle drei Instrumente (BTC-USDT/GBPUSD/EURUSD — Dashboard
      braucht das), aber Telegram geht jetzt nur noch für GBPUSD/EURUSD raus (`sendTelegram`
      je Instrument in `INSTRUMENTS`, siehe `supabase/functions/poi-watcher/index.ts`). Grund:
      BTC war nur zum Testen der Pipeline, Philip tradet Daytrading auf Forex. GBPUSD/EURUSD-
      Kerzen kommen über denselben cTrader-Connector wie der Dashboard-Chart (`_shared/
      ctrader/client.ts`), ein Connect/Auth-Handshake pro Instrument und Lauf statt drei
      (`fetchTrendbarsBatch` — Preis + 4H + 1H in einer Verbindung). Dabei einen echten
      Off-by-one in der cTrader-API gefunden+gefixt: `count: N` liefert IMMER `N-1` Bars
      (leere `toTimestamp`-Bar zählt intern mit, wird aber nie zurückgegeben, da noch nicht
      geschlossen) — betraf auch schon den Dashboard-Chart unbemerkt (999 statt 1000 Bars).
      Fix zentral in `fetchOneTrendbar` (fragt intern `count+1` an), profitiert beide Nutzer
      (`ctrader-candles` UND `poi-watcher`) automatisch. Neue Instrumente starten wie BTC
      damals ohne Alarm-Flut (erster Lauf hat keine `existing`-Zeilen, historische Alt-Touches
      lösen keinen Alert aus).
- [ ] Entry-Signal-Alert (Richtung, SL, Kurzbegründung) — folgt mit D3

### D5 — Scheduling & Deployment
- [x] Supabase Cron: Edge Function jede Minute triggern — via `pg_cron`+`pg_net`, Migration `20260705200000_poi_watcher_cron.sql`, verifiziert (läuft automatisch)
- [x] Dry-Run-Modus eingebaut (`DRY_RUN`-Secret, loggt statt zu senden) — aktuell **aus** (live), da Philip den Bot testen wollte
- [ ] Nach Testphase: ggf. `DRY_RUN=true` setzen, falls die Erkennungslogik nochmal geändert wird, bevor sie wieder scharf geschaltet wird
- [ ] Nach Testphase: scharf schalten

---

## Ideen für später (aus TradingAgents-Recherche, aktuell NICHT umsetzen)

Quelle: [TauricResearch/TradingAgents](https://github.com/TauricResearch/TradingAgents) — generisches
Multi-Agent-LLM-Trading-Framework (LangGraph, Analyst-/Researcher-/Trader-/Risk-Agenten).
Architektur selbst passt nicht zu unserem Fall (News/Sentiment/Fundamentaldaten-lastig,
generisches Multi-LLM-Setup — wir haben eine präzise eigene Strategie und bleiben bei Claude).
Diese drei Einzel-Ideen daraus sind aber potenziell nützlich, falls die Testphase zeigt,
dass ein einzelner Claude-Judge-Call nicht reicht:

- **Decision-Log mit Lessons-Learned-Feedback:** Kurzfassung der letzten X Signale (inkl. ob
  Treffer oder nicht) mit in den Claude-Kontext geben, als eine Art Gedächtnis ohne
  Weight-Updates. Passt gut zu Phase C (Dashboard zeigt Trades/Signale eh schon an).
- **Bull/Bear-Debatte als optionaler Stresstest:** zweiter Claude-Call, der gegen ein
  erkanntes Signal argumentiert, bevor es geloggt/gemeldet wird — nur einbauen, falls
  Backtesting zu viele Fehlsignale zeigt.
- **Risk-Manager-Freigabe-Gate:** letzter Sanity-Check (R:R, Positionsgröße) vor der
  Telegram-Notification, angelehnt an deren Portfolio-Manager-Schritt.

---

## Offene Fragen

- Welche Entry-Variante zuerst testen? → Variante b (M1-OB + Retest + Bestätigungscandle) hat Priorität, da Variante a (Impulscandle) laut eigener Beobachtung im Indikator selten auftritt
- Wie viele M1-Kerzen als Kontext an Claude schicken (Kosten vs. Genauigkeit)?
- TP-Pivot-Point-Erkennung automatisieren oder erstmal nur Entry+SL melden und TP manuell lassen? (im Handbuch selbst als offene Frage markiert)
- Backtesting: wie weit zurück testen, welcher Zeitraum ist repräsentativ genug?
- TradingView-Webhook-Integration für GBPUSD/EURUSD/XAUEUR: erst nach Strategie-Validierung
  im Detail ausarbeiten (welches Alert-Payload-Format, welche Pine-`alertcondition()`-Trigger)
- Forex-Backtesting-Datenquelle: TV Bar-Replay vs. Dukascopy vs. anderer Anbieter — noch offen

## Status: cTrader Open API (Forex-Datenquelle) — 2026-07-09

**Freigeschaltet und angebunden.** App auf connect.spotware.com ist jetzt "Active".
OAuth-Flow (scope=`accounts`, read-only) durchlaufen, Access-/Refresh-Token liegen lokal
in `.env` und als Supabase-Secrets (`CTRADER_CLIENT_ID/SECRET/ACCESS_TOKEN`, nicht committed).
Genutzt wird das **Demo-Konto** (`ctidTraderAccountId 47792490`, Broker `thetradingpit`,
GBPUSD `symbolId 2`) — bewusste Wahl, weil es nur um Kursdaten fürs Chart geht, kein Trading.

**Wire-Protokoll (manuell verifiziert, keine offizielle JS/Deno-Bibliothek genutzt):**
TLS-Verbindung zu `demo.ctraderapi.com:5035`, 4-Byte-Big-Endian-Längenpräfix +
binär-kodierte `ProtoMessage`-Hülle (protobuf). Handshake: `ApplicationAuthReq` (2100) →
`GetAccountListByAccessTokenReq` (2149) → `AccountAuthReq` (2102) → `SymbolsListReq` (2114)
→ `GetTrendbarsReq` (2137). Preise kommen relativ zu `low` (`low`, `deltaOpen`, `deltaHigh`,
`deltaClose`, alle durch 100000 geteilt). Max. 14000 Bars pro Request laut Spotware-Docs,
hier reicht ein einzelner Call (kein Multi-Page nötig wie bei OKX). Die vier offiziellen
`.proto`-Schemadateien (spotware/openapi-proto-messages) sind als String-Konstanten in
`supabase/functions/_shared/ctrader/protoSource.ts` eingebettet — `protobufjs`s
dateibasiertes `Root.load()` funktioniert im Edge-Runtime-Bundle nicht (bindet intern an
Node-`fs`, ignoriert eine `util.fetch`-Überschreibung), daher `protobuf.parse()` auf die
rohen Strings, in Abhängigkeitsreihenfolge, in einen gemeinsamen `Root`.

**Architektur:** neue Edge Function `ctrader-candles` (`supabase/functions/ctrader-candles/`)
— pro HTTP-Request eine frische TCP/TLS-Verbindung auf, Handshake, Trendbars holen, JSON
zurückgeben (`{time,open,high,low,close,volume}`, oldest-first), Verbindung wieder zu. Kein
Cron/keine Persistenz — Frontend ruft das wie bisher OKX auf Poll-Basis auf
(`src/ctraderCandles.js`, gleiche Form wie die OKX-Fetch-Funktionen in `PriceChart.vue`).
Account-ID/Symbol-ID werden pro warmer Isolate gecacht, um nicht bei jedem Request neu
aufzulösen. `Deno.connectTls` brauchte (anders als ein simples Node-`tls.connect`, das ohne
`minVersion:"TLSv1.2"` im Test mit ECONNRESET reagierte) keine Sonderbehandlung.

**Dashboard:** Symbol-Switcher (BTC-USDT/GBPUSD) in der Toolbar, `PriceChart.vue` bekommt
`symbol`-Prop, `Dashboard.vue` rendert es mit `:key="symbol"` (voller Remount statt
Laufzeit-Umschaltung — einfacher als dynamisches Umbauen von Chart-Panes). Für GBPUSD:
keine CVD-Pane/-Gauges (nur für BTC/Binance-Futures sinnvoll), keine Trades/OB-Zonen (die
Forex-OB-Erkennung läuft weiterhin nicht über diese Codebase, siehe TradingView-Webhook-Plan
oben) — nur der reine Kerzenchart samt Lazy-Scroll-Historie. Verifiziert per Playwright
(headless Chromium, da kein `chromium-cli` verfügbar): BTC↔GBPUSD-Wechsel, alle 6
Timeframes, keine Konsolenfehler, CVD erscheint/verschwindet korrekt.

**Bekannte Lücken/nächste Schritte:** Access-Token läuft nach ~30 Tagen ab (`expiresIn`
2.628.000s) — noch kein automatischer Refresh via `CTRADER_REFRESH_TOKEN` eingebaut, nur
manuell erneuerbar. `scope=accounts` reicht für Kursdaten; falls später Trading übers Open
API gebraucht wird, braucht es einen neuen Autorisierungs-Durchlauf mit `scope=trading`.

---

## Experiment: Kronos LLM-Forecast als Entry-Filter getestet — 2026-08-08 (verworfen)

Kurzer Ausflug, kein Teil der App: [Kronos](https://github.com/shiyu-coder/Kronos), ein
Open-Source-Foundation-Model fürs Vorhersagen von Candlestick-Sequenzen (AAAI-2026-Paper,
MIT-Lizenz), lokal getestet (Python/PyTorch, GPU) als möglicher zusätzlicher Filter für
Trade-Entries — auf BTC und GBPUSD, M5/1H, per Replay-Backtest (historischer Zeitpunkt →
Kronos simuliert N mögliche Zukunftspfade → Vergleich mit dem, was danach tatsächlich
passiert ist). Code lag in `kronos-prototype/` (Python-Standalone, eigenes venv, nicht Teil
des Vue/Supabase-Stacks), **wurde nach dem Test wieder gelöscht** — Ergebnis unten war zu
schwach, um den Ordner zu behalten; bei Interesse müsste man von vorn anfangen (Repo klonen,
`pip install`, siehe Kronos-eigenes README für den Ablauf).

**Ergebnisse/Beobachtungen (jeweils kleine Stichproben, keine große Studie):**
- BTC-USDT, 1H, 15 Replay-Punkte (24h-Horizont): Richtungs-Trefferquote 40% — **schlechter
  als Münzwurf** (50%), Brier Score 0,354 (schlechter als 0,25 = Zufalls-Baseline).
- Die von Kronos' eigener Live-Demo gezeigte "Upside Probability" vergleicht NUR den
  Endpreis am Horizont-Ende gegen den Startpreis — ignoriert komplett den Weg dahin
  (Drawdown/Runup unterwegs). Ein GBPUSD-M5-Test (4h-Horizont) zeigte genau das Problem:
  Kronos sagte durchgehend 55-70% "up", real ging der Kurs erst 16 Pips ins Minus, endete
  am Ende sogar leicht negativ — ein "Treffer" nach der reinen Endpunkt-Metrik wäre hier
  irreführend gewesen.
- Bei nur 20 Simulationen ist die Probability selbst instabil: identischer Input, zwei
  Läufe hintereinander ergaben 100% vs. 90% — reines Stichproben-Rauschen, kein stabiler
  Wert.
- Nach einem plötzlichen Preissprung wird Kronos auffällig **überkonfident** (durchgehend
  0%/100% über viele Folge-Zeitpunkte) und lag dabei mehrfach klar daneben (starke
  Mean-Reversion vorhergesagt, die real nicht eintrat) — Konfidenz und tatsächliche
  Trefferquote laufen auseinander.
- Eine "Ziel-vs-Stop-Wettlauf"-Metrik (pro Simulation: wird zuerst das Gewinnziel oder das
  Verlustlimit erreicht, per High/Low nicht nur Close) war der brauchbarste Ansatz für echte
  Entry-Bewertung, deckte aber auch auf: ein simulierter Docht riss einen 6-Pip-Stop nur 5
  Minuten bevor der reale Kurs um +45 Pips durchstartete — Beispiel dafür, wie knapp
  Stop-Platzierung an Zufall hängt, unabhängig von Kronos' eigener Qualität.
- **Praxistest am konkreten Fall:** Short-Setup-Idee vom 07.08. 09:15 (GBPUSD) mit echten
  500 1H-Kerzen Lookback geprüft — Kronos' Mehrheitsvotum für die Folgekerze war 80%
  BULLISCH (16/20 Simulationen), hätte also klar vom Short abgeraten. Die echte Kerze war
  BÄRISCH (-4,8 Pips) — Kronos hätte hier den richtigen Trade verhindert.

**Fazit (Philip, 2026-08-08): "was für ein Scheiß"** — aktuell kein brauchbarer Zusatzfilter
für Entries, weder auf BTC noch auf Forex, weder auf 1H noch auf M5. Größere Sweeps (mehr
Replay-Punkte), `Kronos-base` statt `-small`, oder eine bessere kalibrierte Metrik könnten
das Bild ändern, wurden aber nicht mehr verfolgt. Falls das Thema nochmal aufkommt: bei
Null anfangen, dieser Eintrag ist nur die Zusammenfassung, kein lauffähiger Code mehr da.

---

## Status: Persistiertes Forex-Kerzen-Archiv (Pilot) — 2026-08-09

Auslöser: der neue Retry-Button fürs Scroll-Back-Nachladen im Chart (cTrader-Timeouts beim
Zurückscrollen, siehe `PriceChart.vue`'s `showLoadOlderButton`) legte offen, dass praktisch
JEDER historische Read — Chart-Scroll-Back, Replay, UND Lanas Analysen über den MCP-Server —
über eine frische Live-cTrader-Verbindung läuft, nicht bloß der Chart. Philips Einwand
("ich dachte wir haben einen IndexedDB-Cache?") war berechtigt, aber der Cache
(`src/candleCache.js`) deckt nur Initial-Load/TF-Wechsel/Replay-Sprung ab — NICHT das
Scroll-Back-Nachladen selbst (das ruft `fetchOlderCandles` direkt auf, ohne je durch den
Cache zu gehen), und läuft als Browser-API (IndexedDB) für Lana (Node-Prozess) ohnehin gar
nicht mit.

Philips Idee: statt bei jedem Read live gegen cTrader zu fetchen, die Kerzen einmalig in die
eigene DB holen — dort sowohl für den Chart als auch für Lana lesbar, cTrader nur noch für
Live-Preise/aktuelle Kerze nötig, "vor allem gut für Live-Analysen: sämtliche historischen
OBs dann leichter verfügbar".

**Umgesetzt (Pilot-Umfang, bewusst klein — Philip will sich das Ergebnis erst ansehen, bevor
wir aufs ganze Jahr + EURUSD ausweiten):**
- Neue Tabelle `forex_candles` (Migration `20260809120000_forex_candles.sql`), eine Row pro
  Kerze (PK `instrument, bar, time`) — bewusst NICHT ein JSON-Blob pro Tag: bei der
  Datenmenge hier (~14k Zeilen für den Piloten, ~150k fürs ganze Jahr + EURUSD) ist Storage
  kein Thema, und Row-per-Candle bleibt konsistent mit jeder anderen Tabelle in diesem
  Schema (direkt per `WHERE time BETWEEN ... ORDER BY time` lesbar, kein Entpacken nötig).
- Backfill-Script (`mcp-server/src/scripts/backfillForexCandles.ts`, manueller Einmal-Lauf,
  kein MCP-Tool) — paginiert rückwärts über dieselbe `forex-candles` Edge Function, die auch
  Live-Reads nutzen, batch-upsertet (`ON CONFLICT DO NOTHING`, damit ein erneuter Lauf nach
  einem Abbruch einfach überspringt statt zu duplizieren). cTrader-Connects waren dabei
  tatsächlich wie erwartet flaky (mehrere Timeouts im ersten Testlauf) — ein simpler
  Retry-mit-Pause (`withRetries`, 3s zwischen Versuchen) hat gereicht, sofortiges Retry ohne
  Pause schien die Lage eher zu verschlimmern.
- Ergebnis: GBPUSD, 5m/1h/4h, ab 2026-07-01 — **8.015 M5-, 671 H1-, 167 H4-Kerzen** (8.853
  gesamt), verifiziert per Direkt-Query (älteste/neueste Kerze, Zeilen-Count pro Timeframe).
- Neues MCP-Tool `get_forex_candles_archive` (`mcp-server/src/db.ts`'s
  `getForexCandlesArchive`, registriert in `tools/reads.ts`) — gleiche
  `{time,open,high,low,close,volume}`-Form wie `get_forex_candles`, liest aber aus der
  Tabelle statt live von cTrader. Tool-Beschreibung macht den Pilot-Umfang explizit (leeres
  Array statt Fehler außerhalb des befüllten Bereichs) und verweist bei `get_forex_candles`
  selbst auf das Archiv-Tool als schnellere Alternative, wo verfügbar — plus dort gleich die
  seit dem 08-03-Umstieg zurück auf cTrader veraltete "Twelve Data"-Erwähnung gefixt.

**Bewusst NICHT Teil dieses Piloten:** kein automatischer Sync mehr — die Tabelle wächst nach
dem Script-Lauf nicht weiter. `poi-watcher`s ohnehin laufender M5-Fetch dort mit reinschreiben
zu lassen (kein zusätzlicher cTrader-Call) ist der naheliegende nächste Schritt, sobald Philip
sich für die Ausweitung entscheidet — genau wie EURUSD und das restliche Jahr.

---

## Status: Archiv-Ausbau + historischer OB-Backfill — 2026-08-09, Fortsetzung

Direkte Fortsetzung des Piloten oben, gleicher Tag. Drei Anlässe:

1. **Chart-Feedback**: Scroll-Back "ging schon ganz gut", aber TF-Wechsel auf 1H hing komplett an
   einem cTrader-Timeout fest — der Pilot deckte nur `fetchOlderCandles` ab, `loadInitial()` (TF-
   Wechsel, Mount, UND `loadTradeSetupM5`/1H-Ranges/4H-OBs, die alle über dieselbe Funktion laufen)
   ging weiterhin zu 100% live. Fix: `fetchInitialCandles` in `forexCandles.js` jetzt auch DB-first
   (Archiv bis zum angefragten Zeitpunkt, live nur für den kleinen Rest danach) — UND schlägt dieser
   Rest fehl, wird nicht mehr geworfen, sondern einfach der archivierte Stand zurückgegeben. Live
   mit Playwright verifiziert (M5→1H-Wechsel, Screenshot, keine Konsolenfehler, ~6s statt Hänger).
2. **Größere Page-Size**: `FOREX_HISTORY_PAGE_SIZE` 100→2000 für Forex-Scroll-Back (zeilenbasiert,
   nicht tagebasiert — funktioniert dadurch automatisch sinnvoll für M5 UND H1/H4 gleichermaßen).
3. **Sidequest — Lana braucht OBs für Backtests**: Philip wollte GBPUSD 4H fürs ganze Jahr
   nachladen, dann kam die eigentliche Lücke ans Licht: `ob_zones` hatte für einen alten
   Backtest-Zeitpunkt (z.B. April) schlicht nichts — die Tabelle enthält nur, was `poi-watcher`s
   Live-Cron seit Start der jeweiligen Instrument-Anbindung erkannt hat, kein rückwirkender Batch.

**Umgesetzt:**
- Kerzen-Archiv erweitert: GBPUSD 5m/1h/4h jetzt komplett ab 2026-01-01 (vorher nur Juli+August) —
  **44.882 M5-, 3.747 H1-, 936 4H-Kerzen** neu geholt (`backfillForexCandles.ts`, jetzt per
  `BACKFILL_INSTRUMENTS`/`BACKFILL_BARS`/`BACKFILL_START_DATE`-Env-Vars parametrisierbar statt
  Konstanten von Hand zu ändern).
- Neues Script `backfillObZones.ts`: liest die komplette archivierte Kerzenserie pro
  Instrument/Timeframe, lässt `detectOrderBlocks` (bereits Node-tauglich, kein dritter Port nötig)
  einmal drüberlaufen statt nur über ein rollierendes Live-Fenster, upserted die Zonen in
  `ob_zones`. Kein `sendTelegram`-Aufruf irgendwo im Script — historische Zonen dürfen nie einen
  echten Alarm auslösen.
- **Design-Entscheidung (Philip via Frage): M5-OBs werden für den archivierten Zeitraum jetzt
  auch persistiert** — bricht bewusst mit der bisherigen "M5 nie in DB"-Regel (dafür musste
  `ob_zones.timeframe`s CHECK-Constraint um `'5M'` erweitert werden), gilt aber NUR für diesen
  historischen Backfill, `poi-watcher`s Live-Cron bleibt unverändert bei nur 1H/4H.
- `ob_zones` war anon-select-only (nur `poi-watcher` per `service_role` durfte schreiben) — zwei
  neue Migrationen (anon-insert, anon-delete) haben das geöffnet, angeglichen an den Rest des
  Schemas, weil das Backfill-Script (lokal, kein `service_role` verfügbar) sonst nicht schreiben
  konnte.
- Ergebnis: **7.244 M5-, 425 H1-, 110 4H-OB-Zonen** neu erkannt/gesichert. Verifiziert per
  `get_ob_zones`-Smoke-Test mit `asOfSec` für ein simuliertes 15.04.2026-Backtest-Datum — liefert
  korrekt zurückgerechnete aktive Zonen für alle drei Timeframes, kein neues MCP-Tool nötig
  (`asOfSec` gab's dafür schon).

**Ein echter Bug unterwegs, selbst gefangen und korrigiert**: `fetchAllCandles`s
`.range()`-Pagination in `backfillObZones.ts` brach nach der ersten Seite ab, weil Supabase/
PostgREST eine einzelne Response serverseitig auf offenbar 1000 Zeilen deckelt, UNABHÄNGIG von der
angefragten `.range()`-Größe — `data.length < angefragte Page-Size` ist deshalb kein verlässliches
Abbruchsignal. Dadurch lief der erste OB-Backfill-Versuch nur über die ersten 1000 (statt 44k) M5-
Kerzen, erzeugte 262 falsche Zonen (basierend auf einer künstlich abgeschnittenen Kerzenserie).
Per `created_at`-Zeitstempel präzise von echten, älteren `poi-watcher`-Daten unterschieden
(überraschender Fund dabei: es gab schon einen legitimen historischen 1H-Zonen-Bestand von einem
`poi-watcher`-Kaltstart-Lauf vom 09.07. — nicht anfassen), gelöscht, Pagination gefixt (jetzt um
`data.length` statt um die angefragte Page-Size weiterzählen), sauber neu gelaufen.

**Weiterhin offen:** EURUSD komplett unbefüllt, kein laufender Sync (Kerzen UND OB-Zonen wachsen
nur bei einem erneuten manuellen Script-Lauf) — beides bekannte, akzeptierte Lücken, kein
nächster Schritt ohne Philips Ansage.

**Nachtrag, gleicher Tag, dritte Runde**: der oben "gefixte" Pagination-Bug steckte noch an zwei
weiteren Stellen — nicht nur im Backfill-Script. Bug-Report Philip: GBPUSD-M5-Replay auf
08.07.2026 13:40 zeigte fast keine Kerzen (Screenshot: nur zwei kleine Cluster, riesige Lücken,
EMA-Linie lief aber durch — Hinweis, dass der EMA-Datensatz woanders herkam als die Haupt-Kerzen).
Ursache: `fetchInitialCandles` fragte `count = INITIAL_CANDLE_COUNT + REPLAY_LOOKAHEAD_SEC`-Bars
(1000+2500=3500 bei M5) über ein einzelnes `.limit()` an, bekam vom selben PostgREST-Cap still nur
1000 zurück — aus einem Fenster WEIT NACH dem eigentlichen Replay-Punkt (da "neueste zuerst" beim
Lookahead-Ende ansetzt), nicht um ihn herum. Derselbe Bug auch in `getForexCandlesArchive` (dem
MCP-Tool, das Lana nutzt!) bei einem `limit` über 1000. Alle drei Stellen jetzt auf dieselbe
Pagination umgestellt (`fetchArchivedPage` in `forexCandles.js`, analoges Pattern in `db.ts`) —
außerdem `candleCache.js`s `DB_VERSION` auf 5 gebumpt (der fehlerhafte Fetch wurde ganz normal als
"vollständig" gecacht, ein reiner Code-Fix räumt einen schon vergifteten IndexedDB-Eintrag nicht
auf). Mit Playwright verifiziert: derselbe Replay-Zeitpunkt zeigt jetzt durchgehend Kerzen,
Sessions, OB-Zonen und ein korrektes Trade-Setup-Cockpit, keine Konsolenfehler.

**Nachtrag, Folgetag (2026-08-10), vierte Runde**: anderer Bug als oben, gleiche Baustelle.
Philip fragte, warum Lana in einer Analyse selbst erwähnte, dass sie 3× live cTrader versucht
(alles Timeouts) und sich DANN selbst mit `get_forex_candles_archive` beholfen hat — für ein
GBPUSD-Datum (03.06.2026), das längst im Archiv liegt. Ursache: Pass eins (08-09) hatte
`get_forex_candles_archive` nur als NEUES, separates Tool hinzugefügt und die *Frontend*-Fetches
archive-first gemacht — `mcp-server/src/forexCandles.ts`s `fetchForexCandles` selbst (die einzige
Stelle, über die `get_data_export`/`get_forex_rsi`/`get_forex_ema`/`get_forex_candles`
ÜBERHAUPT Kerzen holen) blieb dabei unangetastet, 100% live, ausnahmslos. Kein Datenproblem —
die Kerzen waren längst da — sondern eine Verkabelungslücke: das Archiv-Tool war nur eine
zusätzliche Option, kein automatischer Ersatz.

Fix: `fetchForexCandles` selbst archive-first gemacht (neue `getForexCandlesArchiveUpTo` in
`db.ts` — "neueste N Kerzen bis zu einem Zeitpunkt", bewusst eine eigene Funktion neben der
bestehenden `getForexCandlesArchive` (die "aufsteigend ab `fromTime`" bedient, eine andere
Query-Form) — dieselbe Query-Form wie das Frontend-Pendant). Da JEDER MCP-Kerzen-Aufrufer über
diese eine Funktion läuft, war das ein Ein-Stellen-Fix ohne Änderungen an dataExport.ts/
indicatorWindow.ts selbst. Smoke-Test mit `buildDataExport({instrument:"GBPUSD",
dateStr:"2026-06-03"})` (genau Lanas Szenario): 474ms statt 3× Timeout, korrekte Kerzen/OB-Zonen/
Liquidity-Level/Structure-Trend für den Tag. Tool-Beschreibungen von `get_forex_candles`/
`get_forex_candles_archive` entsprechend nachgezogen (nicht mehr "get_forex_candles = immer
live").

**Nachtrag, Folgetag (2026-08-10), fünfte Runde**: Bug-Report Philip — GBPUSD M1 im Replay-Modus,
komplett leerer Chart, kein Loading, kein Fehler. Live per Playwright nachgestellt und mit
Tracing durchleuchtet: der Live-Fallback-Fetch (M1 ist nicht archiviert) kam tatsächlich
erfolgreich zurück (~1s), aber mit Kerzen aus dem FALSCHEN Zeitfenster. Ursache: `REPLAY_LOOKAHEAD_SEC`
ist eine feste Sekundenzahl, kalibriert für M5 (2500 Kerzen) — bei M1 (60s statt 300s/Kerze)
ergibt dieselbe Sekundenzahl 12.500 statt 2.500 Lookahead-Kerzen, der addierte count sprengt die
Edge Function's `MAX_COUNT` (1000), der gekappte Live-Fetch liefert Kerzen nah am (weit in der
Zukunft liegenden) Lookahead-Ende statt um den echten Replay-Punkt, `clipReplay()` filtert alles
weg. Gefixt mit zwei zusammenspielenden Änderungen: `MAX_LOOKAHEAD_BARS`-Deckel (2500, M5s eigener
Kalibrierungswert) in `candleCache.js`, UND `toMs` wird aus dem gedeckelten Wert zurückgerechnet
statt aus der rohen Sekundenzahl, damit count/Zeitfenster konsistent bleiben. Plus Edge-Function-
`MAX_COUNT` 1000→5000 angehoben und deployed (deckt jetzt auch den größten Fall,
`TRADE_SETUP_M5_CANDLE_COUNT`(2500)+Lookahead(2500), ab — weit unter cTraders 14.000-Limit).
`DB_VERSION` auf 6 gebumpt (gleicher Poisoning-Grund wie zuvor). Mit Playwright verifiziert:
GBPUSD M1, Replay 08.07.2026 13:40, zeigt jetzt korrekt Kerzen + Sessions + Trade-Setup-Cockpit.

**Nachtrag, gleicher Tag, sechste Runde**: EURUSD-Kerzen-Archiv nachgezogen (5m/1h/4h, ab
01.01.2026, Philip: "alles läuft sehr gut, dann hol bitte für EU auch alle candles" — M1
ausdrücklich NICHT, "auf Bedarf"). Dabei ein Bug im Backfill-Script selbst gefunden: seit
`fetchForexCandles` (mcp-server) archive-first ist (siehe vierte Runde oben), griff
`backfillForexCandles.ts` — das dieselbe Funktion importierte — mitten im eigenen Lauf auf die
gerade erst selbst (unvollständig) geschriebenen Archiv-Zeilen zu, statt sauber live weiter
zupaginieren. Ersten Lauf abgebrochen, Script auf die neu exportierte reine
`fetchLiveForexCandles` umgestellt (ein Backfill darf nie aus dem Archiv lesen, das es selbst
befüllt), neu gestartet. Ergebnis: **44.894 M5-, 3.744 H1-, 936 4H-Kerzen** für EURUSD,
01.01.–07.08.2026 — praktisch deckungsgleich mit GBPUSDs Zahlen von vorhin. Direkt im Anschluss
(Philip: "yes OBs auch befüllen bitte") `backfillObZones.ts` für EURUSD gelaufen — 7.095 M5-,
331 H1-, 98 4H-OB-Zonen neu erkannt/gesichert, kein Code-Change nötig (nur `BACKFILL_INSTRUMENTS`).
Beide Instrumente (GBPUSD/EURUSD) sind damit jetzt bei Kerzen UND OB-Zonen symmetrisch befüllt.

---

## Status: Market-Structure-Startpunkt: 1D-Periode-4-Pivots — 2026-08-30

Auslöser: der 1H-Market-Structure-Algo (`marketStructureAnalysis.ts`) hatte keinen fundierten
Default-Startpunkt, nur ein rollierendes Lookback-Fenster (7 Tage Frontend, 21 Tage MCP-Server) —
Philip wollte stattdessen den zuletzt gebildeten 1D-Periode-4-Fraktal-Pivot als Default-Start.

**Umgesetzt:**
- `forex_candles` persistiert jetzt auch `1D`-Kerzen (Migration `20260830090000`, `forex-candles`-
  Edge-Function erweitert) — bisher explizit ausgeschlossen ("1D bleibt reiner Live-Read").
- Neue Tabelle `daily_structure_pivots` (Migration `20260830091000`) + neue, tägliche Edge Function
  `daily-structure-pivots`: holt/persistiert 1D-Kerzen für GBPUSD/EURUSD, erkennt Periode-4-
  Fraktal-Pivots darauf (`_shared/liquidityDetection.ts`, aus `trading-monitor-mcp/liquidityDetection.js`
  nach `_shared/` verschoben, damit sie von mehreren Functions genutzt werden kann) und löst pro
  Pivot die tatsächliche 1H-Kerze auf (`_shared/resolveStructureStartTime.ts`, Preis-Match mit
  Epsilon-Toleranz, ältester Treffer bei mehreren am selben Tag) — eine 1D-Kerze hat selbst keinen
  Intraday-Zeitpunkt, den der 1H-Algo als Cutoff braucht. Cron auf `22:15 UTC` (Migration
  `20260830092000`) — empirisch verifiziert (Live-Fetch gegen `forex-candles`) statt geraten: D1
  rollt aktuell (Sommerzeit) um 21:00 UTC, 22:15 UTC bleibt auch nach dem Winterzeit-Sprung
  (22:00 UTC) sicher danach.
- `ctrader_oauth_tokens`-Laden/Zurückschreiben (bis dahin doppelt in `poi-watcher`/`forex-candles`
  dupliziert) nach `_shared/ctraderCreds.ts` extrahiert, alle drei Functions nutzen das jetzt —
  eine dritte Kopie für die neue Function hätte die "DRY within a single runtime"-Regel verletzt.
- Default-Einspeisung bleibt umschaltbar: MCP-Server (`compute1hStructureState`) nutzt den neuesten
  Pivot nur, wenn `structureConfig.fixedStartActive` GAR NICHT übergeben wird (nicht `false`),
  Fallback aufs alte 21-Tage-Fenster ohne Pivot. Frontend (`Dashboard.vue`) füllt `rangesFixedStartTime`/
  `-Active` einmalig automatisch vor, nur wenn Philip diesen Toggle in diesem Browser noch nie
  angefasst hat (roher `localStorage`-Check) — ein späteres manuelles Zurückschalten auf
  rollierenden Lookback bleibt danach dauerhaft unangetastet.
- Dreieck-Marker (▲ High-Pivot, ▼ Low-Pivot) über alle Timeframes hinweg, an den Kerzenrand
  geklemmt statt bei weggescrolltem Fenster zu verschwinden (`src/dailyPivotMarkers.js`,
  `usePriceChartDailyPivots.js`) — eigene Chart-Farben `dailyPivotHigh`/`dailyPivotLow`.

**Noch offen (Philips erster Versuch, über Zeit zu validieren):** `touched` auf
`daily_structure_pivots` wird nur beim Ersterkennen gesetzt, nicht laufend nachgeführt (kein
aktiver Nutzer dieses Felds bisher — reine Parität zu `liquidity_levels`). Erste echte Cron-Läufe
und der resultierende Default-Cutoff sind nach dem Deploy noch mit Philip zu verifizieren.

---

**Nächster Schritt:** Phase A — tiefere Kerzenhistorie von OKX holen (Pagination), dann Backtesting-Modul aufsetzen.
