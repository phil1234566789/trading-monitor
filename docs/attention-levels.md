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

## Bekannter Bug (07.09.2026, behoben)

Die alte `computeWatchLevels()`-Verdrahtung (`performFullTick`, `dealingRangeLoop.ts`) passte nicht
zu diesem Bild: sie nutzte immer 1H/4H-Liquidity/OB + hart mit `touched:false` reingemischte
Schritt-3-Bias-Reste (`trendTarget`/`countertrendTarget`/`intermediateLevel`), unabhängig vom Fall
— das laufende Trade-Setup selbst floss nie ein. Ergebnis im GBP-28.08.-Backtest: `watchLevelAbove`
zeigte auf den >60 Pips entfernten Schritt-3-Countertrend-Target statt auf den ~30 Pips entfernten,
tatsächlich laufenden Setup-OB.

**Fix (07.09.2026):** `performFullTick` verzweigt jetzt nach `reactionFound` — Fall 3
(`reactionFound=false`) bleibt exakt beim alten 1H/4H+Bias-Reste-Pfad (Tokens sparen), Fall 1/2
(`reactionFound=true`) nutzt `m5Liquidity`/`m5ObZones` aus `get_recent_reactions`
(`buildRecentReactions`, dort neu exponiert — kein zweiter Kerzen-Fetch/keine zweite Erkennung
nötig, `computeM5LiquidityAndObZones` lief für die Reaktionsauswertung ohnehin schon).

## Offen / TODO

- **Ping-Mechanismus für "neuer M5-OB entstanden"** (Zusatz aus Level b/c) — noch NICHT
  implementiert. Würde einen eigenen, von den beiden Preis-Watch-Leveln unabhängigen Trigger
  brauchen (ein neu geformter M5-OB muss nicht zwingend eines der beiden aktuellen Watch-Level
  berühren) — vermutlich ein persistierter "zuletzt gesehene M5-OB-Keys"-Abgleich pro Tick, kein
  kleiner Zusatz. Separates Vorhaben.
- Level d) bleibt vorerst Philips manuelle Aufgabe, keine Implementierung.
