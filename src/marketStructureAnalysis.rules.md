# marketStructureAnalysis: Regelübersicht

Ein-Satz-Zusammenfassung pro Regel + Verweis auf den Test, der sie tatsächlich absichert. Bei
Zweifel zählt der Test/Code, nicht diese Zeile — hier steht nur "was", nicht "wie genau".
Implementierung: [marketStructureAnalysis.ts](marketStructureAnalysis.ts).

## Pipeline (Kerzen -> Pivots -> State)

`computeRangesPivots(candles, period, cutoff, formatTime?)` und
`buildMarketStructureState(pivotsOuter, pivotsInner, periodOuter, periodInner, candles)` sind seit
Chat 2026-07-24 die EINZIGE Quelle für "Kerzen -> Pivots -> State", exportiert aus
`marketStructureAnalysis.ts`. Vorher lebte diese Logik nur als lokale Funktion in
`PriceChart.vue` (`computeRangesPivotsFor`/`computeMarketStructureState`) — Tests liefen deshalb
zwangsläufig gegen eine von Hand nachgebaute Kopie statt gegen exakt den Code, den die App
tatsächlich ausführt (Bug-Report Philip: "wie kann es sein, dass Tests grün laufen, aber der Algo
trotzdem nicht das macht, was die Tests eigentlich sicherstellen sollen?"). `PriceChart.vue`
delegiert jetzt an diese beiden Funktionen, statt sie zu duplizieren — ein Test, der sie direkt mit
echten Kerzen aus `.debug/metadata.json` aufruft (`marketStructureAnalysisRealPipeline.test.js`),
prüft damit 1:1 denselben Pfad wie die Live-App.

## Grundbegriffe

- **Outer-Pivot** (Periode 5, `applyMarketStructurePivot`) vs. **Inner-Pivot** (Periode 2,
  `applyInnerMarketStructurePivot`) — Inner erkennt einen Trend schneller (feinere Auflösung),
  wird aber bei jedem Outer-Pivot geleert (`innerStructurePivots: []`). Nur `trend` und
  `structurePivots` überleben dauerhaft.
- `currRange.high`/`currRange.low` — die aktuell gültigen, unbestätigten Rand-Pivots.
- `structurePivots` — Pullbacks seit Range-Beginn, überlebt jeden Pivot.
- `innerStructurePivots` — Pullbacks seit dem letzten Outer-Pivot, wird ständig geleert.

## Range-Grenzen

| Regel | Test |
|---|---|
| Erste zwei gelesene Pivots (ein High, ein Low) werden `currRange`, `trend` startet `unknown`. | `marketStructureAnalysis.test.js`: *rangeState1* |
| Ein Outer-Pivot mit niedrigerem Preis als `currRange.low` ersetzt `currRange.low` sofort, ohne Bestätigungsprüfung. | `marketStructureAnalysis.test.js`: *rangeState2* |
| Ein Outer-Pivot innerhalb der Range (bricht weder High noch Low) landet unverändert in `structurePivots`. | `marketStructureAnalysis.test.js`: *rangeState3*, *rangeState5+6* |

## Trendbestätigung (Uptrend)

| Regel | Test |
|---|---|
| Ein High-Bruch bestätigt NUR, wenn `currRange.high` zeitlich NACH `currRange.low` liegt ("eligible") — gilt nur für die allererste Bestätigung. | `marketStructureAnalysis.test.js`: *"bestätigt NICHT, wenn ... alle VOR dem aktuellen range-high gelesen wurden"* |
| Ein High-Bruch bestätigt NUR, wenn seit dem alten `currRange.high` auch tatsächlich eine Kerze DRÜBER geschlossen hat (`closesAboveOldHigh`, Docht-vs-Bruch) — bei reinem Docht bleibt `currRange.high` unverändert (`type: 'sweeped-high'`), keine Bestätigung. Bug-Report Philip 2026-07-26 (Screenshot: `nestedTrend.trend` zeigt fälschlich `'uptrend'`, obwohl keine Kerze über dem alten High schließt): dieser Check existierte bis dahin NUR im Inner-(Periode-2-)Pfad (seit Chat 2026-07-24) — der ältere Outer-(Periode-5-)Pfad bestätigte einen reinen Docht sofort, weil der Check dort inline nie ergänzt wurde (kein Refactor-Versäumnis in einem Rutsch, sondern mehrere unabhängige Baustellen ohne gemeinsame Vorlage — Punkt-2-Fix 2026-07-25 hatte den Check nur für die LOW-Invalidierungsseite nachgerüstet, nicht für die spiegelbildliche HIGH-Bestätigungsseite in derselben Funktion). Seit Chat 2026-07-26 in `evaluateConfirmingBreak` vereinheitlicht (EINE Implementierung statt vier: Outer/Inner × up/down), damit diese Bug-Klasse strukturell nicht mehr auftreten kann. Gilt spiegelbildlich für die eigenständige Downtrend-Bestätigung (`closesBelowLevel` gegen das alte `currRange.low`). | `marketStructureAnalysisOuterDocht.test.js` (gesamte Datei) |
| Die Docht-vs-Bruch-Obergrenze (`toTime` in `closesAboveOldHigh`/`closesBelowLevel`, über `evaluateConfirmingBreak` UND die vier Invalidierungs-Zweige in `applyMarketStructurePivotCore`/`applyInnerMarketStructurePivotCore`) ist NICHT `pivotTimeOf(pivot)` selbst, sondern optional `asOfTime` (Default weiterhin `pivotTimeOf(pivot)`, kein bestehender Aufrufer übergibt es). `buildMarketStructureState` übergibt dafür `entry.at` (pivotTime + Periode·3600 — denselben Anwendungszeitpunkt, der ohnehin schon die Verarbeitungsreihenfolge bestimmt). Bug-Report Philip 2026-07-26 ("1.32772 gilt als sweep, obwohl der spätere Outer-Pivot 1.32934 längst da ist"): die Kerze, deren DOCHT einen Pivot bildet, schließt oft selbst noch NICHT drüber/drunter — der echte Schluss passiert erst auf einer NACHFOLGENDEN Kerze, die `pivotTimeOf(pivot)` als Obergrenze nie sehen konnte. Bewusst NUR dieses feste, pivot-lokale Zeitfenster — NICHT die letzte irgendwann geladene Kerze (`latestKnownTime`, verworfener erster Versuch, siehe Git-Stash: vollständiges Hindsight quer durch die ganze Replay-Historie, brach dadurch an anderer Stelle bereits bestätigtes Verhalten). | `marketStructureAnalysisOuterDocht.test.js`: *"asOfTime erlaubt einen verzögerten Kerzenschluss..."* (beide Tests) |
| Kandidat fürs protected-low: Typ `low` ODER `LQ-sweep`, zeitlich NACH dem gebrochenen High, UND zum Bestätigungsmoment noch ungetoucht — kommt SEIT Chat 2026-07-26 NUR NOCH aus `structurePivots` (Periode 5), NICHT mehr aus `innerStructurePivots` ("P5 definiert Struktur, P2 erkennt nur SCHNELLER, wenn diese bereits definierte Struktur bricht" — Bug-Report Philip: "periode2Pivots sind doch viel zu schwach, wie kann es sein, dass wir daraus protected-pivots machen?"). Der BESTÄTIGENDE Bruch selbst (`breakingPivot`) darf weiterhin ein Periode-2-Pivot sein — nur der Pullback-KANDIDAT muss P5 sein. Macht die bisherige Migration (`innerStructurePivots.filter(p => p.type === protectedType)` in `applyMarketStructurePivotCore`) faktisch wirkungslos: ein Kandidat, der protected-* wird, steht durch die Suchbeschränkung von Anfang an schon in `structurePivots`, nie nur in `innerStructurePivots`. | `marketStructureAnalysisInnerPivots.test.js`: *rangeState1_4* (P5-Kandidat, P2-Bruch bestätigt mit); `marketStructureAnalysisProtectedLow.test.js`: *"ein rein eingebetteter (Periode-2-)Pullback wird NICHT mehr protected-low..."*; `marketStructureAnalysisDowntrend.test.js`: *"ein rein eingebetteter (Periode-2-)Pullback qualifiziert NICHT mehr..."* |
| Unter mehreren Kandidaten gewinnt der ZEITLICH JÜNGSTE, nicht der tiefste. | `marketStructureAnalysis.test.js`: *rangeState7*; `marketStructureAnalysisProtectedLow.test.js`: *"bei mehreren komplett ungetouchten Kandidaten gewinnt weiterhin der jüngste, nicht der tiefste"* |
| Ohne mindestens einen qualifizierenden Pullback: keine Bestätigung, `currRange.high` wird trotzdem ersetzt. | `marketStructureAnalysis.test.js`: *rangeState4* |
| **Bestätigung läuft bei JEDEM weiteren High-Bruch neu**, nicht nur beim ersten Mal — protected-low rückt auf einen neueren ungetouchten Pullback weiter, der alte fällt zurück auf `low`. Kein neuerer Kandidat -> alter bleibt stehen. | `marketStructureAnalysisProtectedLow.test.js`: *"protected-low rückt bei einem weiteren HH-Bruch auf den neueren ungetouchten Pullback weiter..."*, *"ohne einen neueren ungetouchten Pullback bleibt der bisherige protected-low stehen..."* |
| Ein per Inner-Pivot gesetztes protected-low wurde vor jedem `innerStructurePivots`-Reset nach `structurePivots` migriert, statt verloren zu gehen (Chat 2026-07-23). Seit der P5-only-Kandidatenregel oben (Chat 2026-07-26) praktisch tote Logik — ein protected-low/-high kann nicht mehr NUR in `innerStructurePivots` entstehen, es steht von Anfang an in `structurePivots`. Absichtlich (noch) nicht entfernt, siehe Code-Kommentar bei `migratedStructurePivots`. | `marketStructureAnalysisProtectedLow.test.js` |
| **"Strukturpunkt 3" (die Vorbruch-Grenze `currRange.high`/`.low`, an der der spätere bestätigende Bruch ansetzt) darf seit Chat 2026-07-26 nur noch durch Periode-5-Pivots unbestätigt verschoben werden** — ein Periode-2-Pivot, der real bricht, aber keinen qualifizierenden Kandidaten findet, lässt `currRange` unverändert (landet nur in `innerStructurePivots`). Bug-Report Philip (live beobachtet an einem Nested-Downtrend): eine Kaskade rein Periode-2-getriebener, unbestätigter Verschiebungen hatte einen "Strukturpunkt" erzeugt, der nie ein eigenständiger Schwenkpunkt war ("das ist eigentlich nur Noise"). **Ausnahme (`isOriginEligible`, Bug-Report Philip, gefunden über `marketStructureAnalysisRealPipeline.test.js` mit echten GBPUSD-Kerzen):** solange der Ursprung selbst noch nicht "eligible" ist (`currRange.high`/`.low` zeitlich falsch geordnet — z.B. der degenerierte Platzhalter aus der Nested-Invalidierung, oder ein zufällig unglücklich gewählter Fixed-Start-Ursprung), bleibt die Ausweitung auch für Periode-2 erlaubt — das ist reine Zeit-Reparatur der Origin-Reihenfolge, kein Strukturpunkt-3-Aufbau. Ohne diese Ausnahme blieb eine Range mit unglücklichem Ursprung für IMMER unbestätigbar (die Selbstkorrektur-Mechanik, siehe "Nested-Trend"-Abschnitt unten, brauchte genau diese Ausweitung). Betrifft `evaluateConfirmingBreak`s zwei Inner-Aufrufer UND den "down"-Bootstrap-Versuch im Inner-"up"-LOW-Zweig (`applyInnerMarketStructurePivotCore`). | `marketStructureAnalysisChoch.test.js`: *"ein einzelner Periode-2-Pivot repariert den NOCH NICHT eligible Platzhalter..."*; `marketStructureAnalysisDowntrend.test.js`; `marketStructureAnalysisTrendInvalidation.test.js`; `marketStructureAnalysisRealPipeline.test.js` (echte Kerzen) |
| Downtrend-BESTÄTIGUNG (ein "protected-high" als Pendant zum protected-low): seit Chat 2026-07-25 als Nested-Tracker PARALLEL zum noch laufenden Uptrend implementiert (siehe "Nested-Trend / CHoCH-Erkennung" unten) — UND seit Chat 2026-07-26 zusätzlich EIGENSTÄNDIG direkt aus `trend==='unknown'` heraus, ganz ohne vorherigen Uptrend (siehe eigener Abschnitt unten). | siehe jeweiliger Abschnitt |

## Inner-Pivots (Periode 2) — schnellere Vorab-Erkennung

| Regel | Test |
|---|---|
| Inner-Pivot innerhalb der Range -> reiner Pullback, landet in `innerStructurePivots`. | `marketStructureAnalysisInnerPivots.test.js`: *rangeState1_2* |
| Inner-Pivot bricht `currRange.high` preislich, aber KEINE Kerze schließt drüber -> nur `sweeped-high` (Preis/Zeit von `currRange.high` bleiben), kein echter Bruch. | `marketStructureAnalysisInnerPivots.test.js`: *rangeState2_1* |
| Inner-Pivot bricht `currRange.high` preislich UND mindestens eine Kerze schließt seit dem alten High tatsächlich drüber -> echter Bruch, `currRange.high` wird ersetzt, Bestätigungslogik läuft mit. | `marketStructureAnalysisInnerPivots.test.js`: *rangeState1_4* |
| Ohne Kerzendaten gilt ein Preis-Bruch konservativ als ECHTER Bruch (nicht als Sweep) — fehlender Candle-Fetch soll nicht heimlich jeden Bruch abwerten. | Code-Kommentar `closesAboveOldHigh`, kein dedizierter Test |

## Trend-Invalidierung (Uptrend-Bruch durch Inner-Pivot)

Spiegelbildlich zum Inner-High-Bruch oben, seit 2026-07-24 implementiert (live beobachtet: ein
Periode-2-Pivot bildete sich unter `currRange.low`, mehrere Kerzen schlossen danach tatsächlich
drunter). Kein direkter Sprung zu `downtrend` — nur Invalidierung, der Algo startet komplett neu
(siehe `test/tdd_mit_claude/ranges/gbp_h1_uptrend_uptrend_break_of_structure_und_trendumkehr.ts`
für das reale Ausgangsszenario).

| Regel | Test |
|---|---|
| Inner-Pivot bricht `currRange.low` preislich, aber KEINE Kerze schließt drunter -> nur `sweeped-low` (Preis/Zeit von `currRange.low` bleiben), Uptrend bleibt bestehen. | `marketStructureAnalysisTrendInvalidation.test.js`: *"bricht currRange.low NUR preislich (kein Close drunter) -> nur 'sweeped-low'..."* |
| War der Uptrend noch NICHT bestätigt (`trend==='unknown'`) und eine Kerze schließt echt drunter -> `currRange.low` wird einfach ausgeweitet, nichts zu invalidieren (spiegelbildlich zum unconfirmed Outer-Low-Bruch). | `marketStructureAnalysisTrendInvalidation.test.js`: *"Uptrend noch NICHT bestätigt ... currRange.low wird nur ausgeweitet..."* |
| War der Uptrend schon bestätigt (`trend==='uptrend'`) und eine Kerze schließt echt drunter, UND läuft KEIN bereits bestätigter Nested-Trend (siehe unten): Trend zurück auf `'unknown'`, komplett frischer Start: `currRange.high` bleibt der ALTE High (weiterverwendet, nicht verworfen — zeitlich VOR dem neuen Low, bärische Origin-Konstellation), `currRange.low` wird der brechende Pivot, `structurePivots`/`innerStructurePivots` geleert, `appliedPivots` nur noch die zwei neuen Origin-Pivots. | `marketStructureAnalysisTrendInvalidation.test.js`: *"bricht currRange.low PREISLICH UND eine Kerze schließt tatsächlich drunter -> Trend zurück auf 'unknown'..."*; `marketStructureAnalysisChoch.test.js`: *"Fallback bleibt erhalten..."* |
| **PROMOTION** (Chat 2026-07-25, `invalidateUptrend` — geteilt zwischen Outer- UND Inner-Pivot-Pfad, siehe Regel oben): läuft zum Invalidierungszeitpunkt bereits ein bestätigter Nested-Trend (`nestedTrend.trend === 'downtrend'`, siehe "Nested-Trend / CHoCH-Erkennung" unten), übernimmt DER als neuer Outer-Trend statt des vollen Resets — `trend`/`currRange`/`structurePivots`/`appliedPivots` kommen 1:1 vom Nested-State, `nestedTrend` wird `null`. Die alte (jetzt abgeschlossene) Uptrend-Range wird in `closedRanges` archiviert (`{low: alter currRange.low, middle: zuletzt bestätigter protected-low dieser Range (oder null), high: alter currRange.high, trend: 'uptrend'}`) — nur für die Darstellung (ZigZag low->middle->high, siehe "Darstellung" unten), keine Zustandslogik hängt daran. Der GERADE brechende Pivot (er LÖST die Promotion aus, weil er den ALTEN Haupttrend-Ursprung bricht — egal ob Outer- oder Inner-Pivot) wird direkt danach noch einmal gegen die frisch übernommene Range geprüft (`applyInnerMarketStructurePivotCore(promoted, pivot, {direction:"down"})`) — er wurde vorher NUR als Auslöser verwendet und sein eigener Wert verworfen, obwohl er `nested.currRange.low` selbst noch unterbieten kann (Bug-Report Philip 2026-07-25: "haben ein innerpivot 1.33003 unter dem range.low 1.33553 ... neues range.low sollte 1.33003 sein"). | `marketStructureAnalysisChoch.test.js`: *"echte Invalidierung ... übernimmt den bestätigten Nested-Trend UND lässt den brechenden Pivot selbst noch gegen die übernommene Range zählen"*, *"Promotion ohne weiteren Bruch..."*, *"Outer-Pivot-Invalidierung ... Promotion genau wie beim Inner-Pivot-Pfad"* |
| Ein Outer-Pivot bricht `currRange.low` — seit Chat 2026-07-25 ("Punkt 2 muss jetzt gemacht werden") GENAU wie ein Inner-Pivot: Docht-vs-Bruch-Prüfung (`closesBelowLevel`), bei echtem Bruch UND bereits bestätigtem Uptrend Invalidierung/Promotion über die geteilte `invalidateUptrend`-Funktion (siehe unten). Vorher weitete die Outer-Regel `currRange.low` immer nur hart aus, ganz ohne Kerzen-Check. | `marketStructureAnalysisChoch.test.js`: *"Outer-Pivot-Invalidierung"* (gesamter Describe-Block) |

## Eigenständige Downtrend-Erkennung/-Invalidierung (ohne vorherigen Uptrend)

Bug-Report Philip 2026-07-26 ("kein 1h downtrend erkannt", live reproduziert mit GBPUSD, Fixed-Start
15.07.,18:00): der Haupttrend lief bis dahin IMMER mit `direction="up"` (fest verdrahtet in
`buildMarketStructureState`), ein Downtrend entstand ausschließlich über den Umweg "erst Uptrend
bestätigen, dann Nested-CHoCH, dann Promotion" (siehe Abschnitt unten) — `advanceNestedTrend` läuft
aber nur, solange `trend` schon `'uptrend'` ist. Landete der allererste Origin-Pivot-Paar zufällig
als "High vor Low" (bärische Reihenfolge — z.B. weil ein Fixed-Start-/Replay-Fenster mitten in einem
laufenden Downtrend beginnt), konnte `'uptrend'` NIE bestätigen (dessen Eligibility verlangt "Low vor
High") — und weil `currRange.high` dann für den Rest der Laufzeit an seinem allerersten (nie wieder
überschrittenen) Wert hängen blieb, korrigierte sich diese falsche Reihenfolge auch nie von selbst.
Der Downtrend blieb dadurch für IMMER unsichtbar, egal wie offensichtlich er im Chart war.

| Regel | Test |
|---|---|
| `buildMarketStructureState` bestimmt die `direction` für JEDEN Pivot neu aus dem AKTUELLEN `state.trend` (`'downtrend'` -> `"down"`, sonst `"up"`) statt sie einmalig fest auf `"up"` zu setzen — sobald der Haupttrend selbst `'downtrend'` wird, laufen alle weiteren Pivots über die gespiegelten Zweige. | Implizit durch alle Tests in `marketStructureAnalysisDowntrend.test.js` (nutzen `buildMarketStructureState`-kompatible Direction-Übergabe an `applyMarketStructurePivot`/`applyInnerMarketStructurePivot`) |
| Solange `trend==='unknown'`: ein LOW-Bruch von `currRange.low` versucht (zusätzlich zur bisherigen unbestätigten Ausweitung) auch `tryConfirmTrend(..., "down")` — genau spiegelbildlich zum bestehenden HIGH-Bruch-Versuch für `"up"`. Nur EINE Richtung kann für ein gegebenes Origin-Paar jemals eligible sein (die Eligibility-Prüfung verlangt exakt entgegengesetzte Zeit-Reihenfolgen), daher keine Mehrdeutigkeit. | `marketStructureAnalysisDowntrend.test.js`: *"bestätigt direkt 'downtrend', wenn der Origin bärisch geordnet ist..."*, *"ein Periode-2-Pivot kann den Downtrend genauso direkt bestätigen..."*, *"bullischer Origin (Low vor High) bestätigt weiterhin nur 'uptrend'..."* |
| Invalidierung eines EIGENSTÄNDIG (nicht promoted) bestätigten Downtrends: geteilte `invalidateDowntrend`-Funktion (Spiegelbild von `invalidateUptrend`, aber OHNE Promotion-Zweig — ein bullischer Gegentrend-Tracker innerhalb eines Downtrends ist bewusst nicht verdrahtet, siehe unten), archiviert die Range in `closedRanges` (`trend:'downtrend'`), Origin-Konstruktion nutzt den auslösenden Pivot selbst als selbstkorrigierenden Platzhalter für BEIDE Seiten (dieselbe Begründung wie beim Nested-Invalidierungs-Fix, Chat 2026-07-25 — der alte `currRange.low` läge sonst chronologisch VOR dem neuen High und würde jede künftige Bestätigung dauerhaft sperren). Genutzt vom Outer- UND Inner-Pfad UND vom Nested-Tracker selbst (dort landet die archivierte Range in `nested.closedRanges`, was nirgends gerendert wird, also folgenlos bleibt). | `marketStructureAnalysisDowntrend.test.js`: *"ein bestätigter Downtrend wird bei einem ECHTEN neuen Hoch invalidiert..."*, *"bricht der neue Höchststand nur preislich..."* |
| `applyMarketStructurePivotCore`s `direction="down"`-HIGH-Zweig hatte bis dahin GAR KEINE Invalidierung (reine Erkundung, `currRange.high` wurde bei einem echten neuen Hoch stillschweigend für immer weiter ausgeweitet) — jetzt symmetrisch zum `direction="up"`-LOW-Zweig inkl. Docht-vs-Bruch-Prüfung (`closesAboveOldHigh`). | `marketStructureAnalysisDowntrend.test.js` (gesamte Datei) |

## Nested-Trend / CHoCH-Erkennung (`advanceNestedTrend`)

Live beobachtet (GBPUSD 1h, siehe `test/tdd_mit_claude/ranges/gbp_h1_uptrend_uptrend_break_of_structure_und_trendumkehr.ts`): ein Downtrend kündigt sich oft lange VOR der eigentlichen Invalidierung an — die Outer-Pivots 1.35583 (H) -> 1.35206 (L) -> 1.35429 (LH) -> 1.34601 (LL) bilden bereits eine bestätigte bärische Struktur (Change of Character), obwohl `currRange.low` des Haupttrends formal erst später real bricht. Ein zweiter, gegenläufiger Trend-Tracker (`state.nestedTrend`, dieselbe Form wie `MarketStructureState`) läuft dafür parallel mit, gefüttert über **dieselbe** Bestätigungslogik wie der Haupttrend, nur mit umgekehrter `direction` (siehe `tryConfirmTrend`/`applyMarketStructurePivot`/`markLqSweeps` — parametrisiert statt dupliziert). Seit Chat 2026-07-26 ("Bescheid :D") läuft das in BEIDE Richtungen: ein bärischer Kandidat innerhalb eines Uptrends (ursprüngliche Variante) UND, gespiegelt, ein bullischer Kandidat innerhalb eines Downtrends — welche Richtung der Nested-Tracker verfolgt, ergibt sich automatisch aus `state.trend` (`advanceNestedTrend`/`advanceNestedTrendInner` lesen das selbst, kein extra Parameter nötig).

| Regel | Test |
|---|---|
| Läuft über Outer-(Periode-5-)Pivots (`advanceNestedTrend`, für Seeding/Reseeding zuständig) UND, seit Chat 2026-07-25 zweite Runde ("range.low vom nestedTrend sollte schon tiefer sein, ein innerPivot hat sich bereits gebildet"), auch über Periode-2-Pivots (`advanceNestedTrendInner`, verfeinert nur einen BEREITS existierenden Nested-Tracker, reseeded selbst nicht — das bleibt exklusiv Sache der Outer-Pivots, weil der Ursprung `appliedPivots[0]` immer ein Outer-Pivot ist) — und nur, solange der Haupttrend bereits bestätigt ist (`'uptrend'` ODER, seit Chat 2026-07-26, `'downtrend'`). | `marketStructureAnalysisChoch.test.js` (gesamte Datei, bärischer Fall), `marketStructureAnalysisDowntrendChoch.test.js` (gesamte Datei, bullischer Fall) |
| Die AKTUELLE Ursprungsseite (`currRange.high` für den bärischen/`down`-Nested-Fall, `currRange.low` für den bullischen/`up`-Fall — gespiegelt zur Haupttrend-Richtung) ist IMMER der einzig gültige Ursprung — ein neues, ECHTES Extrem in Haupttrend-Richtung verwirft einen zuvor getrackten Gegentrend-Kandidaten komplett (reseeded auf `null`, wartet auf den nächsten Pullback als neuen Pairing-Punkt). Gilt seit Chat 2026-07-25 explizit AUCH für einen bereits bestätigten Nested-Tracker — setzt sich der Haupttrend nach der CHoCH-Bestätigung noch weiter fort (widerspricht der Prämisse, auf der die Bestätigung beruhte), war der CHoCH überholt und wird verworfen, statt für den kompletten Rest der Trend-Laufzeit stehen zu bleiben (Bug-Report Philip: "Choch Linie immernoch zu weit"). | `marketStructureAnalysisChoch.test.js`: *"Reseed..."*, *"ein bereits bestätigter Nested-Trend wird verworfen..."*; `marketStructureAnalysisDowntrendChoch.test.js`: dieselben Tests gespiegelt |
| Bestätigung läuft exakt wie beim Haupttrend gespiegelt: ein Bruch von `nestedTrend.currRange.low`/`.high` (dem ersten Pullback nach dem Nested-Origin) durch einen weiteren Pivot bestätigt, sofern ein qualifizierender Gegen-Pullback seit diesem Pivot existiert -> `protected-high`/`protected-low`, `nestedTrend.trend` kippt. Das ist exakt der CHoCH-Moment. | `marketStructureAnalysisChoch.test.js`: *"CHoCH-Bestätigung..."*; `marketStructureAnalysisDowntrendChoch.test.js`: *"CHoCH-Bestätigung..."* (gespiegelt) |
| Solange der Ursprung unverändert bleibt, wird ein bereits bestätigter Nested-Tracker NICHT reseeded, läuft aber über weitere Outer-Pivots normal weiter (`protected-high`/`protected-low` kann noch weiterrücken, `currRange` kann weiter Richtung Promotion wandern) — er ist ab hier bereit für die Promotion (siehe unten). | `marketStructureAnalysisChoch.test.js`/`marketStructureAnalysisDowntrendChoch.test.js`: *"firstConfirmedAt bleibt eingefroren..."* |
| `firstConfirmedAt` (auf `MarketStructureState`, von `tryConfirmTrend` EINMALIG gesetzt, sobald `trend` von `'unknown'` auf `'uptrend'`/`'downtrend'` kippt) friert exakt den Pivot ein, der die ALLERERSTE Bestätigung ausgelöst hat — bleibt unverändert, auch wenn `currRange` bei jeder weiteren Bestätigung normal weiterwandert. Existiert speziell, weil `currRange.low`/`.high` für die CHoCH-Darstellung der FALSCHE Anker ist (Bug-Report Philip 2026-07-25: "CHOCH Linie geht noch zu weit" — sie wuchs vorher bei jedem weiteren Bruch mit). | `marketStructureAnalysisChoch.test.js`/`marketStructureAnalysisDowntrendChoch.test.js`: *"firstConfirmedAt bleibt eingefroren..."* |
| Der Haupttrend selbst bleibt vom CHoCH komplett unberührt (reines Vorlauf-Signal, kein Reset) — erst die spätere ECHTE Invalidierung (siehe "Trend-Invalidierung"/"Eigenständige Downtrend-Erkennung" oben) verwertet ihn per Promotion. | `marketStructureAnalysisChoch.test.js`/`marketStructureAnalysisDowntrendChoch.test.js`: *"CHoCH-Bestätigung..."* (`state.trend` bleibt unverändert) |
| PROMOTION eines bestätigten Downtrends (Chat 2026-07-26, gespiegelt zur Uptrend-Promotion, siehe `invalidateDowntrend`): läuft zum Invalidierungszeitpunkt bereits ein bestätigter Nested-Tracker mit `nestedTrend.trend === 'uptrend'`, übernimmt DER als neuer Outer-Trend statt des vollen Resets, exakt wie bei `invalidateUptrend` (inkl. Archivierung in `closedRanges`, inkl. Re-Check des brechenden Pivots gegen die übernommene Range). | `marketStructureAnalysisDowntrendChoch.test.js`: *"echte Invalidierung ... übernimmt den bestätigten Nested-Trend als neuen Haupttrend..."*, *"Fallback bleibt erhalten..."* |
| Wird ein bereits bestätigter Nested-Downtrend durch einen ECHTEN neuen Bruch von `nestedTrend.currRange.high` invalidiert (`applyInnerMarketStructurePivotCore`, direction='down', HIGH-Zweig, oder gespiegelt der bullische Nested-Tracker über den LOW-Zweig), dient der auslösende Pivot selbst — umetikettiert — als Platzhalter für den neuen Origin (NICHT die alte, chronologisch VOR diesem Pivot liegende Gegenseite). Bug-Report Philip 2026-07-25 ("uptrend gebrochen -> trend:'unknown' statt Promotion, obwohl vorher ein nestedTrend existiert haben muss — beißt sich mit dem Ursprung des Algos"): die alte Gegenseite hätte die Eligibility-Regel sonst dauerhaft verletzt und eine erneute Bestätigung blockiert. Der Platzhalter wird vom nächsten echten Pivot automatisch aufgelöst. | `marketStructureAnalysisChoch.test.js`: *"ein Periode-2-Pivot invalidiert einen bereits bestätigten Nested-Trend..."*, *"nach der Platzhalter-Invalidierung..."* |
| `applyMarketStructurePivot`/`applyInnerMarketStructurePivot` entscheiden über ein `nested`-Flag (NICHT über `direction`!), ob der Wrapper den Gegentrend-Tracker mit anstößt — seit `direction="down"` auch einen TOP-LEVEL-Downtrend meinen kann (nicht mehr exklusiv "das ist der Nested-Tracker"), reicht `direction` allein nicht mehr zur Unterscheidung. Der Nested-Tracker selbst wird intern immer mit `nested: true` gefüttert. | Implizit durch alle Tests in `marketStructureAnalysisDowntrendChoch.test.js` (nutzen `applyMarketStructurePivot(...,{direction:"down"})` OHNE `nested`, um einen TOP-LEVEL-Downtrend zu simulieren) |

## LQ-Sweep (`markLqSweeps`)

| Regel | Test |
|---|---|
| Ein getouchtes `low`/`LQ-sweep`/`protected-low`, seit dessen eigener Kerze NIE eine Kerze drunter geschlossen hat, ist ein Liquidity-Grab -> wird/bleibt `LQ-sweep`. | `marketStructureAnalysisLqSweep.test.js`: *"touched LOW ohne jeden Close drunter -> 'LQ-sweep'"* |
| Sobald irgendeine Kerze seit der eigenen Pivot-Kerze tatsächlich drunter geschlossen hat, gilt es als echter Bruch -> wird/bleibt `low`. | `marketStructureAnalysisLqSweep.test.js`: *"touched LOW MIT echtem Close drunter -> bleibt 'low'"* |
| Ohne Kerzendaten gilt konservativ KEIN Sweep (Default ist `low`, nicht `LQ-sweep`) — umgekehrter Default als bei `closesAboveOldHigh`. | `marketStructureAnalysisLqSweep.test.js`: *"ohne Kerzendaten (candles=[]) konservativ KEIN Sweep behaupten"* |
| Nie getouchte Pivots werden gar nicht erst geprüft/reklassifiziert — "getoucht" heißt hier **zum aktuellen Verarbeitungszeitpunkt (`toTime`) bereits getoucht** (`isUntouchedAsOf`), NICHT der rohe globale Touch-Endfakt. Ein Pivot, dessen `touchedTime` erst in der Zukunft (relativ zu `toTime`) liegt, bleibt bis dahin unangetastet. **Fix Chat 2026-07-24**, gefunden über den echten `.debug/metadata.json`-Snapshot: vorher degradierte ein frisch bestätigtes `protected-low` oft schon beim nächsten Verarbeitungsschritt zu `LQ-sweep`, Tage bevor der eigentliche Touch chronologisch überhaupt stattfand — einmal so fälschlich degradiert, konnte der spätere ECHTE Close-drunter nie mehr `break-of-structure` auslösen (griff nur noch der `LQ-sweep`->`low`-Zweig). | `marketStructureAnalysisLqSweep.test.js`: *"nie touched -> wird gar nicht erst geprüft, bleibt 'low'"*; `marketStructureAnalysisProtectedLow.test.js`: *"ein bereits zu 'LQ-sweep' reklassifizierter Pullback kann trotzdem protected-low werden..."* (Zwischenstand bleibt jetzt `low`, nicht `LQ-sweep`), *"ein protected-low wird zu 'LQ-sweep', sobald es touched ist..."*; `marketStructureAnalysisRealPipeline.test.js` |
| `toTime` für die Kerzenschluss-Prüfung ist die Zeit der ZULETZT GELADENEN Kerze (`candles[candles.length-1].time`), nicht die pivotTime des gerade ankommenden Pivots selbst — `candles` liegt als vollständige, bis "jetzt" geladene Historie längst vor. **Fix Chat 2026-07-24**: vorher blieb ein längst tatsächlich erfolgter Kerzenschluss unentdeckt, bis zufällig ein NEUER Pivot die Neubewertung anstieß — bei ruhigem Markt (keine neuen Fraktale) blieb ein reales `break-of-structure` so u.U. für Stunden/Tage unsichtbar, obwohl die Kerzendaten dafür längst vorlagen. | `marketStructureAnalysisRealPipeline.test.js`: *"buildMarketStructureState erkennt einen break-of-structure, sobald 1.33806 real unterschlossen wird"* (reproduziert den Live-Bug 1:1 mit echten Kerzen+Settings aus `.debug/metadata.json`) |
| Neubewertung läuft BIDIREKTIONAL bei jedem Inner-Pivot (auch schon als `LQ-sweep` markierte Pivots) — durch die beiden Fixes oben ist ein "zu früh markiert, korrigiert sich später zurück"-Fall inzwischen die Ausnahme statt die Regel: ein bereits in `candles` sichtbarer Close-drunter wird i.d.R. schon beim ersten Verarbeitungsschritt korrekt erkannt. | `marketStructureAnalysisLqSweep.test.js`: *"ein bereits in candles sichtbarer Close-drunter wird sofort erkannt, auch an einem frühen Zwischenschritt (kein Nachlauf mehr)"* |
| Ein `protected-low` zählt bei dieser Prüfung mit (kein Sonderfall) — wird getoucht und schließt nie eine Kerze drunter -> wird ebenfalls `LQ-sweep`. | `marketStructureAnalysisProtectedLow.test.js`: *"ein protected-low wird zu 'LQ-sweep', sobald es touched ist, aber nie eine Kerze drunter schließt"* |
| Bricht dagegen ein `protected-low` durch einen ECHTEN Kerzenschluss drunter, wird es NICHT nur `low`, sondern `break-of-structure` (Chat 2026-07-24: "Break of Structure", eigener Wert seit `range.type.ts` — strukturell schwerwiegender als ein gewöhnlicher Pullback, der bricht). `trend`/`currRange` bleiben dabei komplett unangetastet (bleibt `uptrend`) — reines Warnsignal, KEIN Reset wie bei der Trend-Invalidierung unten. **Diese Prüfung selbst läuft seit Chat 2026-07-26 NICHT mehr bis `toTime`, sondern nur bis zum EIGENEN Touch-Zeitpunkt des Levels PLUS einer Toleranz** (`graceSeconds` = die Bestätigungsverzögerung des GERADE auslösenden Pivots, `asOfTime - pivotTime`, siehe `applyMarketStructurePivotCore`/`applyInnerMarketStructurePivotCore`) — Bug-Report Philip, echter GBPUSD-Fund: ein Level (`1.33292`), das WOCHEN vor einem völlig unabhängigen, viel späteren Bruch eines ANDEREN, tieferen Levels (`1.33239 < 1.33292`) schon getoucht (und damit "verbraucht") war, wurde durch die alte `toTime`-Grenze fälschlich rückwirkend zu `break-of-structure` ("als markante Strukturpunkte dürfen nur untouched pivots gelten"). Die Toleranz verhindert dabei, dass ein zeitgleicher/nahezu zeitgleicher Bruch in EINER durchgehenden Bewegung fälschlich mit-degradiert wird (echter Fund: `1.33806` bricht real erst 1h nach seinem eigenen Touch und soll trotzdem BOS bleiben). | `marketStructureAnalysisLqSweep.test.js`: *"protected-low MIT echtem Close drunter -> wird 'break-of-structure'..."*, *"markLqSweeps: BOS-Toleranzfenster..."* (beide Tests); `marketStructureAnalysisRealPipeline.test.js`: *"buildMarketStructureState erkennt einen break-of-structure, sobald 1.33806 real unterschlossen wird"* |
| Einmal `break-of-structure` wird NICHT mehr zurückbewertet (fällt aus dem Reklassifizierungs-Filter raus) — anders als `low`/`LQ-sweep`, die bei neuen Kerzendaten weiter pendeln können, ist ein bestätigter Strukturbruch ein permanenter historischer Fakt. | `marketStructureAnalysisLqSweep.test.js`: *"einmal 'break-of-structure' bleibt dauerhaft..."* |
| `markLqSweeps` läuft bei JEDEM neuen Pivot, Outer (Periode 5) UND Inner (Periode 2) gleichermaßen — ein reiner Periode-5-Pivot kann LQ-sweep/break-of-structure also genauso auslösen wie ein Periode-2-Pivot, nur i.d.R. mit größerer Verzögerung (Chat 2026-07-24, Bug-Report: "allerspätestens mit Bildung des folgenden P5-Fraktals sollte ein BOS stehen" — vorher rief `applyMarketStructurePivot` `markLqSweeps` gar nicht auf). `applyMarketStructurePivot` braucht dafür jetzt ebenfalls ein `candles`-Argument (Default `[]`, siehe PriceChart.vue: `rangesCandles` wird an BEIDE Pfade durchgereicht). | `marketStructureAnalysisLqSweep.test.js`: *"ein reiner Periode-5-Pivot mit echtem Kerzenschluss reklassifiziert ein protected-low zu 'break-of-structure'"* |

## Fibonacci-Level (`computeFibLevels`/`collectFibLevels`)

Chat 2026-07-30. Erste Annahme (Fib = `currRange.low` <-> `currRange.high`) war falsch — Philips
tatsächliche Fib-Ziehweise zieht immer vom Pivot, der die ganze Bewegung EINGELEITET hat, das ist
der zuletzt bestätigte `protected-low`/`-high`, nicht die (potenziell längst weitergewanderte)
Range-Kante selbst. Zwei Varianten gleichzeitig, pro Trend-Ebene (Haupttrend UND Nested-Trend,
`computeFibLevels` läuft auf beiden identisch, da derselbe `MarketStructureState`-Typ):

| Regel | Test |
|---|---|
| "Range-Fib" = Mittelwert von `currRange.low`/`.high` — immer vorhanden, sobald der Trend bestätigt ist (`trend !== 'unknown'`), reine Orientierung. | `marketStructureAnalysisFib.test.js` |
| "Protected-Fib" = Mittelwert vom zuletzt bestätigten `protected-low`/`-high` (Uptrend: `-low`; Downtrend gespiegelt: `-high`) bis zur GEGENÜBERLIEGENDEN `currRange`-Kante (Uptrend: `.high`; Downtrend: `.low`) — das ist die eigentlich gemeinte Bewegung. | `marketStructureAnalysisFib.test.js` |
| Protected-Fib existiert NUR, wenn (a) überhaupt ein `protected-low`/`-high` in `structurePivots` steht UND (b) der Preisabstand zur gegenüberliegenden Range-Kante mindestens `RANGE_FIB_MIN_PP_DISTANCE_PIPS` (50, siehe PIP-SETTINGS.md) beträgt — sonst `null`, kein Fib gezeichnet. | `marketStructureAnalysisFib.test.js` |
| `collectFibLevels` sammelt beide Varianten für Haupttrend UND (falls vorhanden, `trend !== 'unknown'`) Nested-Trend in einer flachen Liste — genutzt für die Klick-Erfassung als Trade-Bestätigung (`kind='fib'`, siehe `trade_confirmations`/`tradeConfirmations.ts`), dieselbe A/B-Form wie fürs Zeichnen. | `marketStructureAnalysisFib.test.js` |

Darstellung (kein eigener Test, siehe Abschnitt unten): Range-Fib nur als kurzer horizontaler
Tick (`FibTickPrimitive`) in der Mitte der bereits bestehenden Live-Verbindungslinie
(`RangeLinePrimitive`, siehe "Darstellung" unten) — keine eigene Linie, die gibt's schon.
Protected-Fib zusätzlich als gestrichelte Zickzack-Linie PP<->Range-Kante (`RangeLinePrimitive`
mit neuem `dashed`-Flag) + eigener Tick. Ein Farb-/Breiten-Key (`rangeFib`) für beide Varianten.

## Darstellung (`renderMarketStructureAnalysis`)

Rein visuell, keine Zustandslogik — kein Test, nur Code-Kommentare in
`marketStructureAnalysis.ts` ab `renderMarketStructureAnalysis`:

- Seit der Promotion-Funktion (Chat 2026-07-25) kann der HAUPTTREND selbst `'downtrend'` sein
  (übernommener Nested-Tracker) — alles unten ist deshalb seit Bug-Report Philip 2026-07-26
  ("1h-LQ-Sweeps ... bärisch, aber mit bullischem Pfeil nach oben angezeigt") trend-bewusst
  (`isDowntrend = state.trend === 'downtrend'`), vorher war die gesamte Darstellung hart auf
  bullisch verdrahtet (state.trend war praktisch immer `'uptrend'`, bevor Promotion existierte).
  `currRange.high`/`currRange.low` selbst bleiben als PHYSISCHE Grenzen unverändert (rot/oben bzw.
  grün/unten, unabhängig von der Trendrichtung).
- `currRange.high`: nur Linie (KEIN Pfeil mehr, siehe unten), gestrichelt solange nur
  `sweeped-high` ODER (im Downtrend) sobald irgendwo ein `break-of-structure` existiert (Resistance
  ist im Downtrend die geschützte Seite, gespiegelt zu `currRange.low` im Uptrend).
- `currRange.low`: nur Linie (KEIN Pfeil mehr, siehe unten), gestrichelt solange nur `sweeped-low`
  ODER (im Uptrend) sobald irgendwo ein `break-of-structure` existiert (Schwäche-Signal, Chat
  2026-07-24).
- Bug-Report Philip 2026-07-26 ("die Pfeile am range.high und range.low möchte ich doch nicht"):
  `currRange.high`/`currRange.low` bekommen KEINE `ArrowPrimitive`-Dreiecke mehr — nur noch die
  Linie selbst (inkl. gestrichelt-Logik oben). Der goldene LQ-Sweep-Pfeil (siehe unten) ist davon
  NICHT betroffen und bleibt bestehen.
- `protected-low`/`protected-high`: genau EINE Linie+Label (der jeweils aktuelle) — `protected-low`
  im Uptrend ("1h protected low"), `protected-high` im Downtrend ("1h protected high"), gleiche
  Farbe (`rangeProtectedLow`, neutraler weißer "geschützt"-Marker) für beide.
- `LQ-sweep`: JEDER aktuell so markierte `structurePivot` bekommt eine eigene goldene 1px-Linie
  (im Gegensatz zu protected-low/-high potenziell mehrere gleichzeitig) — der goldene Pfeil zeigt im
  Uptrend nach oben (bullischer Sweep), im Downtrend nach unten (bärischer Sweep, seit Bug-Report
  Philip 2026-07-26 — vorher hart auf "nach oben" verdrahtet, sichtbar falsch sobald
  `state.structurePivots` nach einer Promotion bärische LQ-Sweeps enthielt). Fällt komplett weg,
  sobald irgendwo ein `break-of-structure` existiert (keine Long-/Short-Andeutung mehr, siehe Chat
  2026-07-24: "damit ich keine Longs suche"). Endet seit Bug-Report Philip 2026-07-28 ("bereits
  früher gesweepte 1h LQ-Sweeps werden aktuell durchgezeichnet, bis zur aktuellen Uhrzeit") am
  tatsächlichen Sweep-Zeitpunkt (`toTouchedLevel`, analog zu `buildLevel` in `liquidity.js`), nicht
  mehr bis zur letzten geladenen Kerze wie `toLevel` es für die übrigen Range-Linien tut — ein
  `LQ-sweep`-Pivot ist per Definition schon berührt, anders als `currRange.high`/`.low`/
  `protected-low`/`-high`.
- `break-of-structure`: JEDER aktuell so markierte `structurePivot` bekommt eine eigene gestrichelte
  rote Linie + Label ("BOS", ohne Altersangabe — anders als bei `LQ-sweep` für die Handelsentscheidung
  nicht relevant, Chat 2026-07-24), mittig über der Linie im Uptrend / mittig darunter im Downtrend,
  kein eigener Pfeil (reines Warnsignal). Endet seit Chat 2026-07-25 ("BOS Linie soll auch nicht so
  weit gezeichnet werden ... wie bei CHOCH") genau wie die CHoCH-Linie an der ERSTEN tatsächlich
  unter dem Level schließenden Kerze (`firstCloseBelow` — derselbe Kerzenschluss, der den Pivot
  überhaupt erst zu `break-of-structure` reklassifiziert hat), nicht mehr bis zur letzten geladenen
  Kerze wie `toLevel` es für die übrigen Range-Linien tut.
- Verbindungslinie der AKTUELL laufenden Range (Chat 2026-07-25, Bug-Report Philip: "auch den
  jetzigen bestätigten uptrend auch verbunden"): sobald `state.trend !== 'unknown'`, eine einfache
  gerade Linie von `currRange.low` nach `currRange.high` (`RangeLinePrimitive`, kein Zigzag —
  bewusst so gewünscht), Farbe nach Trendrichtung (`rangeClosed` grün bullisch, `rangeChoch` rot
  bärisch — nach einer Promotion ist `state.trend` selbst `'downtrend'`).
- `closedRanges` (Chat 2026-07-25, Promotion): JE archivierter Range ein ZigZag `low` -> `middle`
  (falls vorhanden) -> `high`, fest zum Archivierungszeitpunkt (`RangeLinePrimitive` nimmt seit der
  zweiten CHoCH-Runde — Bug-Report Philip: "ich hätte gerne die ZickZack Linie ... noch im Chart
  drin" — ein `pivots`-Array statt nur zwei Punkten, zeichnet eine Polyline durch beliebig viele
  Punkte). `middle` = der zuletzt bestätigte `protected-low`/`protected-high` DIESER Range zum
  Archivierungsmoment (`invalidateUptrend` liest ihn aus `sweepChecked.structurePivots`), `null`
  falls keiner bestätigt war — dann nur eine gerade Linie wie zuvor. Farbe nach `closed.trend`
  (`rangeClosed` grün für ein archiviertes Uptrend, `rangeChoch` rot für ein archiviertes Downtrend
  — Bug-Report Philip: "kann die Zeichnung dann noch den uptrend und downtrend farblich
  unterscheiden?"; vorher war die Farbe hart auf grün fixiert). `LiquidityLinePrimitive` kann das
  nicht (zeichnet nur horizontale Preis-Level), daher eine eigene kleine Primitive
  (`RangeLinePrimitive`) nach demselben Muster wie `ArrowPrimitive`.
- Nested-Gegentrend-Struktur/CHoCH (Chat 2026-07-25): solange `state.nestedTrend?.trend ===
  'downtrend'` (bestätigt, aber noch nicht promoted) ZWEI Elemente — (1) dieselbe rote
  Verbindungslinie über `nestedTrend.currRange.low` -> `nestedTrend.currRange.high` (Bug-Report
  Philip: "eine rote Verbindungslinie von 1.35583 bis 1.34601"), UND (2) ein Linie+Label ("CHoCH")
  von der URSPRÜNGLICHEN Nested-Origin-Low (`nestedTrend.appliedPivots[1]`, NICHT
  `nestedTrend.currRange.low` — das ist nach der Bestätigung der brechende Pivot, nicht die
  gebrochene Ursprungsstruktur; Bug-Report Philip: "IST 1.34601, SOLL 1.35206") BIS ZU der ERSTEN
  Kerze (aus den angezeigten, meist feineren Candles — z.B. M5 bei H1-Pivots), die tatsächlich
  unter diesem Level SCHLIESST (`firstCloseBelow`). Kurzzeitig auf reine Docht-Berührung
  umgestellt gewesen (Chat: "das reine Zeichnen ist doch nur bis Kerzenberührung, da reicht sogar
  ein Docht"), dann aber zurückgebaut (Bug-Report Philip: "entsteht der choch pivot im
  outer-pivot bereich und direkt paar minuten später berührt ein innerpivot den choch schon") —
  der H1-Periode-5-Ursprungspivot sitzt auf grober Stundenrasterung, sein `pivotTime` markiert
  nicht zwingend exakt den echten M5-Extrempunkt; ein Docht-Check direkt danach greift durch
  normales Kerzenrauschen fast immer sofort. Ein echter Kerzenschluss ist robust genug dagegen —
  dieselbe Docht-vs-Bruch-Unterscheidung wie bei der Erkennung selbst (`closesBelowLevel`), nur für
  die Zeichnung statt für die LQ-Sweep/Strukturbruch-Klassifizierung. Weder
  `nestedTrend.firstConfirmedAt` (der H1-Periode-5-Fraktal-Pivot selbst, Stunden NACH dem
  eigentlichen Kerzenschluss bestätigt — nur noch Fallback, falls keine Kerze tatsächlich drunter
  schließt) noch `toLevel`s "bis zur letzten geladenen Kerze" noch `currRange.low` (wandert weiter,
  solange nicht promoted) sind der richtige Endpunkt — alle drei ließen die Linie in früheren
  Anläufen zu weit wachsen (Bug-Reports Philip: "CHOCH Linie geht noch zu weit", "Linie sollte
  irgendwo in der MMM am 16.07. 10:30-13:00 enden"). Eigene Farbe (`rangeChoch`). Reiner
  Vorlauf-Hinweis — nach der Promotion ist `nestedTrend` wieder `null`, dann übernimmt die reguläre
  `currRange`-Darstellung (inkl. der Live-Verbindungslinie oben) den neuen (jetzt primären) Trend.
- `protected-high`/`LQ-sweep`/`break-of-structure` DES NESTED-TRACKERS (Chat 2026-07-25, Bug-Report
  Philip: "dieser bärische LQ Sweep entstand als der downtrend noch ein nestedTrend war ... sollte
  viel früher erkannt werden") — solange `state.nestedTrend?.trend === 'downtrend'`, exakt dieselben
  drei Elemente wie oben für den Haupttrend, nur auf `nested.structurePivots` statt
  `state.structurePivots`, mit gespiegelter Pfeilrichtung (`ArrowPrimitive`: `direction: "up"` statt
  `"down"` fürs LQ-Sweep, bärisch statt bullisch) und `firstCloseAbove` statt `firstCloseBelow` fürs
  BOS-Linienende. WICHTIG: die ERKENNUNG (`markLqSweeps(direction="down")` über
  `advanceNestedTrend`/`advanceNestedTrendInner`) lief hierfür schon von Anfang an mit — nur die
  DARSTELLUNG zeigte bis hierhin ausschließlich `state.structurePivots`, `nested.structurePivots`
  wurde vor einer Promotion nie gerendert. Kein separater Test (Darstellung, siehe oben).
- Gespiegelt (Chat 2026-07-26, "Bescheid :D"): sobald `state.nestedTrend?.trend === 'uptrend'`,
  exakt dieselben Elemente wie die zwei Punkte oben, nur an einem bullischen Nested-Tracker
  innerhalb eines Downtrends — Verbindungslinie über `.currRange.low` -> `.currRange.high`
  (dieselbe Farbe `rangeChoch`, "CHoCH" ist als Vorlauf-Signal eine eigene Kategorie unabhängig von
  der Richtung), `protected-low` statt `protected-high`, LQ-Sweep-Pfeil `direction: "down"` (bullisch,
  zeigt nach oben), BOS-Linienende über `firstCloseBelow` statt `firstCloseAbove`, `labelSide:
  "center-above"` statt `"center-below"` für BOS UND CHoCH-Label. Anker fürs CHoCH-Label ist
  `nestedTrend.appliedPivots[1]` (die Nested-Origin-High, gespiegelt zur Origin-Low oben). Kein
  separater Test (Darstellung, siehe oben) — die Erkennung selbst ist in
  `marketStructureAnalysisDowntrendChoch.test.js` abgedeckt.
