# Trade-Setup-Cockpit: No-Gos und Anti-Confluences

`src/tradeSetupCockpit.ts` (siehe die eigene Header-Kommentar-Zeile der Datei für die
Aggregations-Regel) trackt Dinge, die *gegen* einen Trade sprechen, gezeigt als "Spricht
dagegen"-Sektion auf der Cockpit-Card. `AntiConfluence.isNoGo` ist ein harter Block (sperrt die
Card immer, gezeigt als "🚫 KEIN TRADE"), unabhängig von `ANTI_CONFLUENCE_THRESHOLD` (aktuell 10)
— bewusst nicht als "weight == threshold" modelliert, damit ein späteres Anheben des Thresholds
einen No-Go nie stillschweigend freischalten kann.

High-Impact-Wirtschaftsnews ist ein No-Go, gespeist aus der `news_events`-Tabelle — siehe
[`docs/news-events.md`](news-events.md) für den ForexFactory-Screenshot-Workflow, der diese
Tabelle befüllt, und wie das No-Go-Fenster/die Chart-Marker sie konsumieren.

## find_anti_confluences (mechanische Kandidatensuche)

Analog zu `find_targets`/`findTargetCandidates.js` liefert `find_anti_confluences`
(`findAntiConfluenceCandidates.js` im MCP-Server, `src/findAntiConfluences.js` fürs Chart-UI,
Lupe-Button an der Anti-Confluences-Sektion) eine mechanische Kandidatenliste statt Lana/Philip
müssten den Chart selbst absuchen (Chat 2026-08-30). Ausgewählte Kandidaten werden wie eine manuell
per Chart-Klick hinzugefügte Anti-Confluence per `add_trade_confirmation`/`addRangeConfirmation`
mit `category='anti_confluence'` gespeichert — kein neuer `kind`-Wert, kein neuer Schreibpfad.

Zonen-Regel (Short-Fall, Long spiegelt alles): Zone = `[tiefstes Short-Target, aktueller Preis]`
— dieselbe Regel, die `00-trading-steps/06-dealing-range-validieren.md` im `trading`-Repo unter
"Anti-Confluences sammeln" → "Gegenläufige Dealing Range explizit suchen" bereits manuell/textuell
beschreibt. Innerhalb dieser Zone zählt als Anti-Confluence:

- offene (unberührte, nicht invalidierte) gegenläufige OBs (bullisch gegen Short, bärisch gegen Long),
- bereits berührte, aber GEHALTENE gegenläufige OBs (`touched && !invalidated`), solange nicht älter
  als `MAX_HELD_OB_AGE_DAYS` — das ist bereits aus den bestehenden OB-Feldern ableitbar
  (`orderBlockDetection.js`), kein fehlender Erkennungs-Algorithmus, nur ein bisher ungenutzter Filter,
- gegenläufige LQ-Sweeps (bereits berührte Low-Pivots gegen Short, High-Pivots gegen Long),
- eine gegenläufige RSI-Divergenz (`rsi.js`: `detectRsiDivergenceHistory`).

Zusätzlich, unabhängig von der Ziel-Zone: unberührte gegenläufige OBs knapp jenseits der
Invalidierung (max. `MAX_INVALIDATION_OB_DISTANCE_PIPS` = 10 Pips) — ein solches unfertiges,
gegenläufiges "Geschäft" wirkt als Preis-Magnet über die Invalidierung hinaus.

Ebenfalls unabhängig von der Ziel-Zone (`isFreshCounterInducement`, seit 22.09.2026): ein
gegenläufiger **Major- oder Medium-Inducement** — ein 1H/4H-LQ-Sweep, dessen Level beim Sweep
mindestens einen Handelstag alt war (`classifyAge`, Inducement-Klassifikation aus `liquidität.md`
im `trading`-Repo) und dessen Sweep auf denselben Europe/Berlin-Handelstag fällt wie der
Analysezeitpunkt. Grund: die Zonen-Regel stammt von `find_targets` und
fragt "was liegt noch *vor* mir" — ein Inducement ist aber ein bereits *gelaufener* Sweep und liegt
damit am Extrem der bisherigen Bewegung, also jenseits des eigenen Ziels, sobald der Preis dort
schon war. Diese Fallklasse konnte die Zonen-Regel strukturell nie finden (Auslöser: EURUSD-Short
22.09.2026, gesweeptes 1H-Low 1,14339 gegen eine Zone, die erst bei 1,14378 begann). Minor bleibt
bewusst zonengebunden, sonst zählt jedes heute entstandene und gleich wieder abgeräumte Level als
Gegenargument.

Genaue Konstanten/Grenzwerte: `findAntiConfluenceCandidates.js` ist die Quelle der Wahrheit,
nicht diese Doku-Zeilen.
