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
      (`npm run build` + Pages-Workflow). Nächstes Mal dran erinnern.
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

## Status: cTrader Open API (Forex-Datenquelle)

**Blockiert — wartet auf Freischaltung durch Spotware.** App auf connect.spotware.com
angelegt (Client ID vorhanden, `.env` lokal, nicht committed), aber neue Open-API-Apps
müssen erst manuell von Spotware freigeschaltet werden ("OA client is not in active state").
Mail an support@ctrader.com mit der Application ID geschickt — warten auf Antwort.
Danach: OAuth-Autorisierungs-URL erneut aufrufen, Code gegen Access-/Refresh-Token tauschen.

---

**Nächster Schritt:** Phase A — tiefere Kerzenhistorie von OKX holen (Pagination), dann Backtesting-Modul aufsetzen.
