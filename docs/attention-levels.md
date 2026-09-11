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

## Ping bei neuem M5-OB (10.09.2026, implementiert)

Der Zusatz aus Level b/c ist jetzt ein eigener, von den beiden Preis-Watch-Leveln unabhängiger
Trigger: `firstObFormationTimeAfter()` (`obFormationTrigger.ts`) lässt die M5-OB-Erkennung über die
Batch-Kerzen mitlaufen und liefert den Zeitpunkt, zu dem eine neu entstandene Zone erstmals
*erkennbar* war (Schluss der bildenden Kerze, nicht ihre `startTime` — sonst derselbe
Lookahead-Leak wie in `replayAsOf.ts`). `runDealingRangeLoop` nimmt im Backtest-Batch wie im
Live-Pfad den früheren der beiden Trigger. Kein persistierter "zuletzt gesehene OB-Keys"-Abgleich
nötig — der letzte Analysezeitpunkt des Loops reicht als Abgrenzung.

Gilt bewusst nur bei hoher Aufmerksamkeit (Fall 1/2, erkennbar an gesetzten M5-Watch-Leveln): in
Fall 3 entstehen mehrere M5-OBs pro Stunde, der Trigger würde dort den Token-Spar-Modus aushebeln.

Auslöser war der GBPUSD-Backtest 09.09.2026: der 09:20-Tick wartete auf einen 12 Tage alten
OB-Rand 3,5 Pips über dem Kurs, während zeitgleich die eigentliche Entry-Zone 1.35647–1.3568
entstand — deren Rand hätte die 09:45-Kerze getroffen. Nächster Tick kam erst um 10:00, der Trade
(+8,5R) war weg.

## Offen / TODO

- Level d) bleibt vorerst Philips manuelle Aufgabe, keine Implementierung.
- `computeWatchLevels()` wählt weiterhin rein das preislich nächste Level, unabhängig vom Alter der
  Zone — eine 12 Tage alte Zone als Watch-Level bleibt ein Warnzeichen für sich. Durch den
  Formations-Trigger oben nicht mehr akut.
