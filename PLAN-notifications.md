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

- [ ] Trades/Signale (aus Backtest + Paper-Trading) im trading-monitor-Frontend
      schön visualisieren — Entry, SL, TP, Ergebnis, Begründung — damit alles
      nachvollziehbar und kontrollierbar ist

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

### D2 — 4H-Zonen-Wächter (Edge Function, läuft jede Minute)
- [ ] OKX-Candle-Fetch (4H) nach Deno/Edge-Function portieren (Logik existiert schon in `src/main.js` / `orderBlocks.js`, ist reines JS ohne DOM-Abhängigkeit — sollte sich fast 1:1 wiederverwenden lassen)
- [ ] `detectOrderBlocks()`-Logik aus `src/orderBlocks.js` wiederverwenden (bereits chart-unabhängig, reine Berechnung)
- [ ] Zonen in `ob_zones` persistieren/aktualisieren
- [ ] Prüfen: liegt aktueller Preis innerhalb einer aktiven, nicht invalidierten Zone?
  - Ja → `watch_state.mode = 'watching_m1'`, Zone merken
  - Nein → `watch_state.mode = 'idle'`
- [ ] Kein Claude-Call in dieser Phase — reine Vergleichslogik

### D3 — M1-Beobachtung + Claude-Entry-Check (nur wenn `watching_m1`)
- [ ] M1-Candle-Fetch (OKX) für die letzten ~30-50 Kerzen
- [ ] M1-Orderblock-Erkennung (gleiche Kernlogik wie 4H, andere Parameter — siehe `tv-indikator/src/calculations.pine` `processClosedBar` mit `capMode=true`, Cap auf max. Zonengröße)
- [ ] Strukturierte Anfrage an Claude (Sonnet 5, `output_config.effort` vorerst `medium` testen):
  - System-Prompt (gecacht): Auszug aus `setup-4h-ob-m1-bounce-snipe.md` (Entry-Varianten, Bedingungen, Stop-Loss-Regel)
  - User-Content: aktuelle 4H-Zone, letzte M1-Kerzen als JSON, erkannte M1-OB-Zonen
  - Erwartete Antwort (structured output / JSON): `{ entry: bool, direction: "long"|"short"|null, stopLoss: number|null, reasoning: string }`
- [ ] Bei `entry: true` → Eintrag in `signals`-Tabelle

### D4 — Notification
- [ ] Telegram-Nachricht bei neuem Signal (Richtung, Entry-Kontext, SL, Kurzbegründung)
- [ ] Markieren, dass Signal bereits benachrichtigt wurde (kein Doppel-Versand)

### D5 — Scheduling & Deployment
- [ ] Supabase Cron: Edge Function jede Minute triggern
- [ ] Dry-Run-Modus einbauen (loggen statt Telegram schicken) für ersten Testlauf
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
