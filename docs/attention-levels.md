# Aufmerksamkeits-Level (Watch-Level-Strategie Schritt 5+)

Entstanden 07.09.2026 aus einem Bug im GBPUSD-28.08.-Backtest: die aktuellen Watch-Level
(`computeWatchLevels()`, `fallClassifier.ts`) passten nicht zu Fall 1/2 — siehe
[Bekannter Bug](#bekannter-bug-07092026) unten. Dieses Dokument hält Philips Zielbild fest, BEVOR
der Code angepasst wird.

Kern-Idee: Wie teuer/aufmerksam die Maschine hinschaut, hängt vom Fall ab, in dem sie gerade
steckt — nicht ein einziges Watch-Level-Schema für alles.

**Ausnahme seit 13.09.2026: der HTF-Kanal läuft fall-unabhängig.** Die Level-Auswahl unten (a–d)
gilt nur für die beiden fall-abhängigen Watch-Level. Daneben hält die Maschine **immer** die
nächsten ungetouchten 1H/4H-Liquiditäts-Level über und unter dem Preis — siehe
[HTF-Watch-Kanal](#htf-watch-kanal-13092026-implementiert).

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

## HTF-Watch-Kanal (13.09.2026, implementiert)

Dritter Watch-Kanal neben den beiden fall-abhängigen Leveln und dem M5-OB-Formations-Trigger:
`computeHtfWatchLevels()` (`fallClassifier.ts`) liefert die nächsten **ungetouchten
1H/4H-Liquiditäts-Level** über und unter dem Preis, persistiert in
`trading_loop_state.htf_watch_level_above/_below` und ausgegeben in `get_loop_state` wie im Tick.

**Warum fall-unabhängig:** Die Level a–d oben sind exklusiv — sobald `reactionFound` gilt (Fall
1/2), füttert `performFullTick` nur noch M5-Kandidaten in `computeWatchLevels`. M5-Level liegen
dichter und verdrängen HTF-Level systematisch, sobald beide im selben Kandidatentopf landen. Im
GBPUSD-Backtest 09.09.2026 war ab dem ersten Tick um 09:00 durchgehend `hasReaction=true`; das
4H-Level 1.35652 tauchte deshalb den ganzen Tag in **keinem einzigen Tick** auf, obwohl der Kurs
direkt darauf zulief und es um 09:10 überschritt. Inducements sind laut `liquidität.md` aber per
Definition 1H/4H-Sweeps — man braucht sie genau dann, wenn eine Dealing Range in Arbeit ist.

Philip, 13.09.2026: „In meiner Strategie dreht sich alles um LQ-Sweeps! Das ist der HAUPTTEIL
meines Tradings. Das MUSS zuverlässig funktionieren."

- **Nur Liquidity-Level, keine OB-Kanten** — ein Inducement ist ein LQ-Sweep, OB-Kanten würden das
  Signal verwässern.
- **Dritter Trigger:** Live wie Backtest wecken die HTF-Level den Loop gleichberechtigt neben den
  M5-Watch-Leveln und dem OB-Formations-Trigger.
- **Treffer liefert die Inducement-Klasse fertig mit** (`assessInducement`, Schwelle aus
  `_shared/ageTier.ts`): `evidence.htfInducementHits` plus ein Zusatz im Heartbeat. Bewusst
  mechanisch statt Lanas Herleitung — „Major" löst das Handelsverbot aus
  `liquidität.md#regel--kein-trade-gegen-einen-kraftvollen-major-inducement` aus, „Medium" nicht,
  und genau diese Einstufung ging im 09.09.-Durchlauf schief. Die Richtung steht im Text mit drin
  (gesweeptes Hoch = Kraft nach unten), weil auch die dort verdreht wurde.

**Grenze:** Der Kanal ist nur so gut wie `snapshot.liquidity`, das preislich vorgefiltert ist
(`SNAPSHOT_RANGE_PIPS`). Liegt kein ungetouchtes HTF-Level in Reichweite, bleibt die Seite `null`.

## Offen / TODO

- Level d) bleibt vorerst Philips manuelle Aufgabe, keine Implementierung.
- `computeWatchLevels()` wählt weiterhin rein das preislich nächste Level, unabhängig vom Alter der
  Zone — eine 12 Tage alte Zone als Watch-Level bleibt ein Warnzeichen für sich. Durch den
  Formations-Trigger oben nicht mehr akut.
