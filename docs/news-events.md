# News Events seeden

`news_events` ist die einzige Quelle für den TSC-No-Go "High-Impact-News" — **keine externe
News-API**, ausschließlich manuell/per Screenshot gepflegt.

## Ablauf

1. Philip schickt einen ForexFactory-Kalender-Screenshot, meist schon auf EUR/GBP/USD gefiltert —
   nur die roten/High-Impact-Zeilen sind relevant.
2. Zeiten im Screenshot sind Europe/Berlin, DST-aware — vor dem Insert nach UTC konvertieren
   (CEST/CET je nach Datum prüfen, nicht pauschal annehmen).
3. Einpflegen über eine One-off-Daten-Migration (`supabase/migrations/..._news_events_seed_<datum>.sql`),
   gleiches Muster wie andere One-off-Daten-Migrationen im Repo.
4. `npx supabase db push`, um die Migration auf die Remote-DB anzuwenden.

## Wie die Daten benutzt werden (zur Einordnung, nicht zum Ändern)

- `currentNewsNoGo()` behandelt ein Event als No-Go für ±`NEWS_NOGO_WINDOW_MINUTES` (30) um seinen
  Zeitstempel, für das Instrument, dessen Währungspaar betroffen ist (`EURUSD`→EUR/USD,
  `GBPUSD`→GBP/USD).
- `syncNewsEvents()` (`src/newsEvents.js`) lädt die GESAMTE Tabelle, kein "nur die letzten 24h"-
  Filter — nicht wieder einbauen, ein früherer Recency-Filter hat sowohl die No-Go-Prüfung als auch
  die Chart-Marker für alles nicht frisch Eingetragene stillschweigend versteckt. Die Tabelle
  bleibt klein genug (wenige Zeilen/Woche), dass "alles laden" einfacher und sicherer ist.
- Zweiter, manueller Schreibpfad existiert für den Fall, dass Claude nicht verfügbar ist:
  `NewsModal.vue` ("⚙" neben dem "News"-Toolbar-Toggle). Beide Pfade (Migration-Insert und
  Browser-Insert) koexistieren in derselben Tabelle — Schreiben passiert per Zeile
  (Insert/Delete + Re-Fetch), nie als Full-Resync, damit der eine Pfad nie Zeilen des anderen
  überschreibt.
- Chart-Marker (`src/newsMarkers.js`, "News"-Toolbar-Toggle) zeigen unabhängig vom ±30min-No-Go-
  Fenster VERGANGENE UND ZUKÜNFTIGE Events als gestrichelte vertikale Linie. Label ist bewusst nur
  Wochentag-kurz + Uhrzeit (z. B. "Do 14:15"), rotiert 90°, keine Währung/Titel — Philips expliziter
  Wunsch für schnelle Zuordnung ohne Platzverbrauch. Farbe: `chartColors.newsEvent`.
