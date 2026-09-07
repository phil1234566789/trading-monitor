# Aufmerksamkeits-Level (Watch-Level-Strategie Schritt 5+)

Entstanden 07.09.2026 aus einem Bug im GBPUSD-28.08.-Backtest: die aktuellen Watch-Level
(`computeWatchLevels()`, `fallClassifier.ts`) passten nicht zu Fall 1/2 — siehe
[Bekannter Bug](#bekannter-bug-07092026) unten. Dieses Dokument hält Philips Zielbild fest, BEVOR
der Code angepasst wird.

Kern-Idee: Wie teuer/aufmerksam die Maschine hinschaut, hängt vom Fall ab, in dem sie gerade
steckt — nicht ein einziges Watch-Level-Schema für alles.

## a) Aufmerksamkeitslevel niedrig — kein DR, Markt gibt nichts her (Fall 3)

Warten, bis POIs erreicht werden. Level: 1H/4H-Liquidity + 1H/4H-OBs. Hier werden bewusst
Tokens/Aufrufe gespart — große, seltene Sprünge sind ok, weil gerade nichts Konkretes in Arbeit
ist.

## b) Aufmerksamkeitslevel hoch — Dealing Range bildet sich (Fall 2)

Hohe Aufmerksamkeit, hier NICHT an Tokens sparen. Der Cron-Job hält die Daten weiterhin alle 5
Minuten frisch — die eigentliche Frage ist, WANN das LLM (Lana) tatsächlich geweckt wird:

- Referenz-Timeframe ist **M5** (Philip: Daytrader, M5 ist das meistgenutzte TF) — nicht 1H/4H wie
  in Level a).
- Entspricht dem, was Philip manuell mit TradingView-Alarmen an M5-OB-Kanten/M5-Pivots macht.
- Watch-Level: nächste M5-Liquidity-Linie ODER M5-OB-Kante vom aktuellen Kurs aus — je eine über
  und eine unter dem Kurs.
- Zusatz, nur maschinell möglich (für Philip als Mensch nicht praktikabel): ein zusätzliches
  Watch-Level/Ping an Lana, sobald sich ein NEUER M5-OB bildet — damit sie den Chart erneut
  analysiert.

## c) Aufmerksamkeitslevel hoch — Dealing Range bestätigt (Fall 1)

Gleiche Mechanik wie b):

- nächste M5-OB-Kante oben/unten
- nächste M5-Liquidity-Linie oben/unten
- oder ein neuer M5-OB entsteht

Ziel dieses Levels: Lana soll Anti-Confluences im Blick behalten, die sich NACH dem DR-Fund
bilden — so lange, bis die Dealing Range validiert ist (Übergang zu Schritt 6+).

## d) Aufmerksamkeitslevel höchste — Dealing Range validiert (Schritt 7, Find Entry)

Aktuell Philips eigene Aufgabe: er überwacht dann M1/M3/M5 gleichzeitig selbst. Für die Maschine
heute zu komplex/teuer — und funktioniert bis dahin ohnehin noch nicht zuverlässig genug, um das
zu rechtfertigen. **Bewusst nicht jetzt implementieren.** Später soll dieses Level ebenfalls auf
Lana/State-Machine/Cron/Schedule übertragen werden, mit entsprechend hoher Taktung.

## Bekannter Bug (07.09.2026)

Die aktuelle `computeWatchLevels()`-Logik (`supabase/functions/trading-monitor-mcp/fallClassifier.ts`)
passt nicht zu diesem Bild:

- Nutzt 1H-Liquidity/OB-Level statt M5 — für Fall 1/2 (Level b/c) viel zu grob.
- Mischt `trendTarget`/`countertrendTarget`/`intermediateLevel` (Bias-Werte aus Schritt 3) hart mit
  `touched: false` in die Kandidatenliste, unabhängig davon, ob dieser Wert inzwischen noch
  relevant ist.
- Berücksichtigt das gerade laufende Trade-Setup (dessen OB-Kanten die eigentlich relevante
  M5-Struktur wären) überhaupt nicht.
- Kein Mechanismus für "neuer M5-OB entsteht" als eigenes Watch-Level/Ping.
- Unterscheidet nicht nach Fall — Level a)/b)/c) laufen aktuell alle über dieselbe (1H-lastige)
  Logik.

## Offen / TODO

- Fall-abhängige Auswahl der Watch-Level-Granularität (1H für Fall 3, M5 für Fall 1/2) statt einer
  einzigen `computeWatchLevels()`-Funktion für alle Fälle.
- M5-Liquidity/OB-Kandidaten für Level b)/c) (aktuell fließt nur `snapshot.liquidity`/`obZones`,
  beide 1H/4H, in die Kandidatenliste ein).
- Ping-Mechanismus für "neuer M5-OB entstanden", zusätzlich zu den Preis-Watch-Leveln.
- Level d) bleibt vorerst Philips manuelle Aufgabe, keine Implementierung.
