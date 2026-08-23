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
