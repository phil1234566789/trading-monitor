# PLAN: DR-Statistik in der UI anzeigen

> Historischer Konzeptstand mit cTrader-Zahlen. Seit dem FXCM-Wechsel gelten für die
> R-Leiter die neu berechneten 3282 FXCM-Setups aus 2025/2026 aus
> [ergebnis-baender.txt](analysis/dr-reichweite/ergebnis-baender.txt); Betrieb und Abnahme siehe
> [FXCM-Feed](docs/fxcm-feed.md). Die Zahlen in den folgenden Konzepttabellen sind historisch.

Status: Konzept steht, kein Code. Umsetzung in einer eigenen Session.
Datenbasis: `analysis/dr-reichweite/` — **3282 Dealing Ranges, Januar 2025 bis September 2026, GBPUSD**.
milk-city-Task: `tsc-historische-dr-statistik-zur-aktuellen-dealing-range-anzeigen`.

> Stand 20.09.2026, nach dem Backfill. Die erste Fassung dieses Plans rechnete mit 255 DRs und war
> an der 100-Fälle-Regel blockiert. **Beides ist erledigt**: die Stichprobe ist 5,2-mal so groß,
> und Philip hat die Schwelle auf 50 gesenkt. Jede geplante Gruppe liegt jetzt weit darüber.
>
> Zahlen am 21.09.2026 nachgezogen: die Erkennung wartet nicht mehr auf die Fraktal-Bestätigung
> (Task „Alarm sobald die FVG steht"), dieselben neun Monate liefern 1314 statt 915 DRs.
>
> Am 22.09.2026 auf FXCM umgestellt und über 2025 zurück backfillt: **3282 DRs aus 21 Monaten**.
> Damit ist ein Befund gekippt — der Alters-Effekt ist halb so groß wie gedacht, die Gegenkraft
> ist das stärkere Merkmal. Siehe „Das Kriterium ist das Sweep-ALTER" unten.

## Was angezeigt werden soll

Zu einer **laufenden** Dealing Range: wie sich vergleichbare DRs historisch verhalten haben.
Philip will **beides** nebeneinander, nicht eins von beidem:

1. **Die R-Leiter** — **2 bis 10 R**, 1 R gegen den auf 6 Pips gedeckelten Stopp (siehe
   „Der gedeckelte Stopp" unten). Beginnt bei 2, nicht bei 1. Philip 20.09.2026:
   *„1R macht keinen sinn ich mache keinen Trade um 1R zu gewinnen. 2R ist minimum, aber 3R ist
   laut strategie eigentlich minimum (in praxis geht das aber nicht immer)."*
2. **Die Pip-Leiter** — **10 / 15 / 20 / 25 / 30 / 35 / 40 Pips**. TP1 liegt bei rund 15.

**Beide gehören nach dem Risiko der DR aufgeteilt.** Auf der ersten, kleinen Stichprobe sah die
R-Leiter noch so aus, als gälte sie für alle DRs gleich (Terzile 49 / 51 / 44 % bei 3 R) — das
stimmt nicht, sie spreizt genauso deutlich. Nur die Richtung der Spreizung ist eine andere: über die
Pip-Leiter steigt die Quote mit dem Risiko, über die R-Leiter fällt sie.

| Spannweite über die fünf Risiko-Bänder | |
|---|---|
| Pip-Leiter (10 / 15 / 20 / 30 Pips) | 28 bis 39 Punkte |
| R-Leiter (2 / 3 / 4 / 5 R) | 23 bis 25 Punkte |

Bei 2 R stehen 75 % (Risiko unter 3 Pips) gegen 52 % (über 10 Pips). Die Begründung für die
R-Leiter ist also nicht mehr „sie verallgemeinert" — sondern schlicht, dass R die Einheit ist, in
der eine Position gesized wird. Beide Leitern sind nützlich, beide brauchen die Gruppierung.

Philips Begründung für die zweite: *„a) die DR ist eng, dann sinkt die Wahrscheinlichkeit für ne
weite Strecke über 15 Pips. b) Weite DR, ok 61 % Chance auf 15 Pips, kann man mal wagen."* Und zur
Leitkennzahl: *„mir ist doch egal wie weit die Pipstrecken gehen, ich will am ende 10-20 pips traden
und den Gewinn mitnehmen. Ich will ne gute Winrate von Dealing Ranges."* Bei rund 15 Pips nimmt er
TP1 — deshalb reicht die Reihe von 10 bis 40.

**Warum die Aufteilung zwingend ist:** ungeteilt ist jede der beiden Leitern irreführend.
„≥ 15 Pips" liegt über alle 3282 DRs bei 57 %, bei den engsten aber bei 38 % und bei den weitesten
bei 73 %. Der Durchschnitt trifft auf keine einzelne DR zu. In R **dreht sich die Reihenfolge um**
(77 % bei 2 R für die engsten gegen 50 % für die weitesten) — und genau deshalb braucht es beide
Leitern, jede mit ihrer Gruppierung.

## Stufe 1: die R-Skala an der Dealing Range — ohne jede Serverarbeit

**Das ist der erste Task.** Philip 20.09.2026: *„an die Dealing-Range eine Skala zu zeichnen ... dann
kann man ja sehen, ob eine Dealing-Range bereits eine 3- oder 4- oder 5-R-Strecke hingelegt hat."*

Der Clou: dafür braucht es **nichts** von dem, was weiter unten unter „Was serverseitig fehlt" steht.
Keine `dr_reach`-Tabelle, keinen Backfill, keinen Aggregations-Endpunkt, keine `poi-watcher`-Änderung.
Die Skala ist reine Geometrie aus Werten, die der Chart schon in der Hand hält:

```
ref   = direction === "short" ? setup.obBottom : setup.obTop
risk  = min(|setup.fractal.price − ref|, 6 Pips)
tick_k = direction === "short" ? ref − k · risk : ref + k · risk      für k = 2 … 10
```

`setup.obTop`, `setup.obBottom` und `setup.fractal.price` stehen bereits in `tradeSetupsMetadata`
(`usePriceChartTradeSetups.js`), und `usePriceChartTradeSetupDrawing.js` zeichnet daraus heute schon
Fraktal-Linie und OB-Box. Die Skala ist ein weiteres Primitive an derselben Stelle — Muster:
`FibTickPrimitive` in `marketStructureRendering.ts`, Farben aus `chartColors.js`.

**Was Philip damit sofort hat:** er sieht an jeder DR im Chart ab, wie weit sie schon gelaufen ist.
Das ist genau die Information, die er für die Einschätzung einer gegnerischen DR braucht — ohne
dass irgendetwas klassifiziert oder bewertet werden muss. Die Skala zeigt den Stand, die Abwägung
macht er.

### Die Falle: Path B hat kein echtes Invalidierungslevel — ERLEDIGT 20.09.2026

Stand beim Schreiben dieses Plans: `detectTradeSetups` lieferte zwei Sorten Setup; bei Path B war
`fractal` auf `ls` gesetzt, also aufs **gesweepte Level** statt aufs Extrem-Fraktal. Die Skala
wurde deshalb zunächst nur bei `pathType === "A"` gezeichnet.

Inzwischen aufgelöst (Task "Trade-Setup: Path A und B zu EINEM Setup zusammenführen"): die
Invalidierung ist pfadunabhängig die **ferne OB-Kante**, also das von `widenObForSweep` beim
Erkennen aufgezogene Sweep-Extrem — gemessen in 96 % auf unter 1 Pip identisch mit dem später
bestätigten Extrem-Fraktal, und wo nicht, liegt sie weiter weg statt enger. Die Skala zeichnet
seitdem an jedem Setup, `pathType` steuert nichts mehr.

**Reihenfolge der R-Marken:** 2 bis 10 R. Kein 1 R — Philip: *„1R macht keinen sinn ich
mache keinen Trade um 1R zu gewinnen."* 3 R ist laut Strategie das Minimum, die Marke gehört also
sichtbar hervorgehoben.

**Stufe 2 wäre dann**, an jede Marke die historische Quote zu schreiben („3 R — 58 %"). Erst dafür
braucht es die serverseitige Messung. Die Skala allein funktioniert vorher.

## Zurückgestellt: die Gegenkraft

Philip 20.09.2026: *„Gegner ist ja bei mir Anti-Confluence. Das stellen wir nach hinten, weil es
eine schwierige Kategorie ist. Das erfordert viel Feingefühl und Erfahrung."*

Die Vorarbeit ist trotzdem gemacht und steht weiter unten — inklusive der Erkenntnis, dass die
Einstufung an einer Definition von „fertig" hängt, die aus Philips Strategie kommen sollte (3 R)
statt aus einer erfundenen Pip-Zahl. Nicht anfangen, bis Philip darauf zurückkommt.

Die R-Skala aus Stufe 1 deckt einen guten Teil des Bedarfs ohnehin ab: wer sieht, dass die
gegenläufige DR schon 4 R hinter sich hat, kann selbst abwägen, ohne dass die UI das Urteil fällt.

## Die Zahlen (Stand 22.09.2026, n=3282)

Alle Tabellen erzeugt `analysis/dr-reichweite/baenderTabellen.py`, Rohausgabe in
`ergebnis-baender.txt`. Stichprobe: 1921 Setups vom 08.01.–31.12.2025 plus 1361 vom
05.01.–21.09.2026, durchgehend native FXCM-Bid-Kerzen.

Angezeigt wird immer die Zeile des Bandes, in das die laufende DR fällt — die Gesamtzeile steht
nur als Bezugspunkt dabei:

### Beide Leitern nach festem Risiko-Band

> Die R-Spalten hier sind **ungedeckelt** (Stopp = Invalidierung). Die Skala im Chart rechnet
> seit 20.09.2026 gegen den gedeckelten Stopp, ihre Zahlen stehen unten unter
> „Der gedeckelte Stopp".

| Band | n | 10 P | 15 P | 20 P | 25 P | 30 P | 35 P | 40 P | 2 R | 3 R | 4 R | 5 R | 6 R |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| unter 3 Pips | 447 | 53 % | 38 % | 30 % | 26 % | 22 % | 20 % | 17 % | 77 % | 66 % | 55 % | 49 % | 43 % |
| 3–5 Pips | 906 | 64 % | 49 % | 40 % | 33 % | 27 % | 24 % | 21 % | 73 % | 58 % | 48 % | 40 % | 34 % |
| 5–7 Pips | 716 | 74 % | 60 % | 49 % | 40 % | 34 % | 29 % | 25 % | 68 % | 53 % | 43 % | 34 % | 28 % |
| 7–10 Pips | 652 | 76 % | 63 % | 50 % | 43 % | 38 % | 33 % | 29 % | 58 % | 44 % | 33 % | 28 % | 22 % |
| über 10 Pips | 561 | 85 % | 73 % | 64 % | 54 % | 47 % | 42 % | 36 % | 50 % | 33 % | 23 % | 17 % | 13 % |
| **alle** | **3282** | **71 %** | **57 %** | **47 %** | **39 %** | **34 %** | **29 %** | **26 %** | **65 %** | **51 %** | **40 %** | **34 %** | **28 %** |

## Entschiedene Design-Fragen

### Feste Bänder, keine Terzile — entschieden

Terzile sind immer gleich besetzt, verschieben aber ihre Grenzen, sobald die Stichprobe wächst;
eine DR würde nach dem nächsten Backfill andere Zahlen zeigen als heute. **Feste Bänder** (< 3 /
3–5 / 5–7 / 7–10 / > 10 Pips) sind stabil und mit n = 447 bis 906 alle gut besetzt.

### Die 50er-Schwelle ist erfüllt — kein Blocker mehr

Philip, 20.09.2026: *„es müssen nicht 100 sein, glaub 50 reichen mir für ne Prozentanzahl."* Das
kleinste feste Band hat 447 DRs. Beide Leitern können also **sofort als Prozent** angezeigt werden.
Die Anzeige sollte die Regel trotzdem im Code tragen (unter 50 entschiedenen Fällen rohe Zahlen
statt Prozent), damit ein späterer feinerer Schnitt nicht stillschweigend darunter rutscht.

### Ein zweiter Schnitt wäre möglich — aber zurückgestellt (siehe oben)

| Gruppe | n | 10 P | 15 P | 20 P | 25 P | 30 P | 35 P | 40 P | 2 R | 3 R | 4 R | 5 R | 6 R |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| reifer Sweep (≥ 24 h) | 188 | 78 % | 66 % | 55 % | 46 % | 41 % | 31 % | 27 % | 58 % | 44 % | 33 % | 27 % | 19 % |
| Minor, kein lebender Gegner | 2210 | 75 % | 60 % | 50 % | 42 % | 37 % | 33 % | 28 % | 67 % | 53 % | 42 % | 34 % | 29 % |
| Minor gegen eine lebende M5-Gegen-DR | 847 | 59 % | 45 % | 35 % | 29 % | 24 % | 21 % | 19 % | 63 % | 47 % | 39 % | 32 % | 27 % |
| **alle** | **3282** | **71 %** | **57 %** | **47 %** | **39 %** | **34 %** | **29 %** | **26 %** | **65 %** | **51 %** | **40 %** | **34 %** | **28 %** |

Diese Dreiteilung ist der informativste verfügbare Schnitt und alle drei Gruppen liegen über 50.
**Nicht** nach Trend schneiden — der 1H-Trend trennt nachweislich nicht (453 zu 458,
Bootstrap-Intervall über null).

### Das Kriterium ist das Sweep-ALTER, nicht die Herkunft — korrigiert 20.09.2026

Hier stand bis zum 20.09.2026 die Sweep-*Herkunft* (1H gegen M5). Philip: *„ob ein Liquidity Sweep
von M5 oder einem Higher Timeframe kommt, ist mir eigentlich egal. Es spielt das Alter eine Rolle:
Minor, Medium oder Major Inducement."*

Das ändert an den Zahlen wenig, weil beide Merkmale **strukturell fast dasselbe** sind: `poi-watcher`
lädt 300 M5-Kerzen (~25 h), ein M5-Level kann also gar nicht älter als ~25 h werden. Gemessen über
3282 DRs: von 3050 M5-Sweeps ist **genau einer** reif; 187 der 188 reifen Sweeps stammen aus der
HTF-Gruppe (n=232). Alters-Median über alle 1,9 h, p90 18,0 h. „M5" impliziert „Minor".

Was die Herkunft trotzdem zusätzlich trüge: 45 DRs mit *frischem* 1H/4H-Sweep kommen auf 69 % bei
15 Pips und einen Reichweiten-Median von 23,6 Pips — näher an Major (76 %) als an Minor. Die fallen
unter einer reinen Altersregel durch. Mit n=45 immer noch knapp unter der 50er-Schwelle, deshalb
weiter **keine eigene Zeile**, aber `trade_setups.ls_timeframe` behalten: die Gruppe ist seit dem
2025-Backfill von 8 auf 45 gewachsen und reißt die Schwelle demnächst.

**Der Alters-Effekt ist kleiner, als er auf 1361 DRs aussah — korrigiert 22.09.2026.** Nach dem
Backfill über 2025 (3282 DRs, die reife Gruppe von n=70 auf n=188 gewachsen) schrumpft „reif gegen
Minor" bei 15 Pips von **+25 Punkten, Intervall [14, 34]** auf **+10 Punkte, Intervall [3, 17]**.
Die alte Schätzung lag also am oberen Rand dessen, was das neue Intervall noch zulässt — der Effekt
ist weiter positiv, aber weniger als halb so groß. Feiner aufgelöst liegt die Linie eher bei
**120 h** als bei 24: Medium (n=116, Reichweiten-Median 17,6 Pips) ist von Minor (n=3094, 17,6)
nicht mehr zu unterscheiden, nur Major ≥ 120 h (n=72, 29,4) steht heraus.

**Die Gegenkraft ist jetzt das stärkere Merkmal.** Eine lebende M5-Gegen-DR kostet bei 15 Pips
**15 Punkte, Intervall [11, 19]** (60 % → 45 %) — größerer Effekt und engeres Intervall als das
Sweep-Alter. Das deckt sich mit Philips eigener Regel („wir traden nur, wenn die gegnerische Seite
viel zu schwach ist") und war vorher die zurückgestellte Kategorie.

Für eine Anzeige heißt das: die Alters-Vergleichszeile bleibt vertretbar, darf aber nicht mehr als
der große Hebel verkauft werden. Der Telegram-Alarm rundet weiterhin auf „<24h" / „≥24h" — das
bleibt als Anzeige richtig, trägt nur weniger Aussage als gedacht.

### Erwartungswert je Ziel — und warum die Anzeige nicht empfehlen soll

Dieselben Bänder, aber statt der Trefferquote der Erwartungswert in R (Treffer zählt +RR,
Invalidierung −1, RR bei 10 gedeckelt):

| Band | n | 10 P | 15 P | 20 P | 25 P | 30 P | 35 P | 40 P | 2 R | 3 R | 4 R | 5 R | 6 R |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| unter 3 Pips | 447 | **1,87** | 1,84 | 1,75 | 1,63 | 1,37 | 1,10 | 0,79 | 1,32 | 1,62 | 1,72 | 1,89 | **1,93** |
| 3–5 Pips | 906 | 1,23 | 1,31 | **1,38** | 1,33 | 1,31 | 1,25 | 1,18 | 1,18 | 1,27 | 1,36 | 1,39 | **1,40** |
| 5–7 Pips | 716 | 0,99 | 1,10 | **1,13** | 1,10 | 1,11 | 1,02 | 1,04 | 1,02 | 1,12 | **1,13** | 1,04 | 1,01 |
| 7–10 Pips | 652 | 0,68 | 0,76 | 0,71 | 0,72 | **0,76** | 0,73 | 0,73 | 0,73 | **0,77** | 0,68 | 0,72 | 0,65 |
| über 10 Pips | 561 | 0,48 | 0,53 | **0,57** | 0,54 | 0,57 | 0,54 | 0,46 | **0,56** | 0,47 | 0,34 | 0,23 | 0,12 |
| **alle** | **3282** | 1,03 | **1,10** | 1,10 | 1,07 | 1,04 | 0,96 | 0,89 | 0,97 | 1,06 | 1,07 | **1,08** | 1,06 |

Zwei Dinge, die daraus für die Anzeige folgen:

**Innerhalb einer Zeile ist der Erwartungswert flach.** Bei 3–5 Pips Risiko liegt alles zwischen
1,39 und 1,50, egal ob 10 oder 40 Pips angepeilt werden. Das Ziel zu optimieren bringt also fast
nichts — dasselbe Ergebnis wie bei den `find_targets`-Auswahlregeln. Die Anzeige soll deshalb
**informieren, nicht empfehlen**.

**Zwischen den Zeilen liegt Faktor 4** (2,18 gegen 0,52). Das ist keine Mechanik, sondern eine
empirische Eigenschaft: von der engsten zur weitesten Gruppe wächst das Risiko um Faktor 5
(2,5 → 12,3 Pips), die Trefferquote auf 15 Pips aber nur um Faktor 1,7 (43 → 71 %). **Die Strecke,
die eine DR läuft, skaliert viel langsamer als ihr Risiko** — ein gutes RR kommt also aus der
Auswahl der DR, nicht aus der Wahl des Ziels. Genau das sollte die Anzeige sichtbar machen.

### Der gedeckelte Stopp — durchgängige Konvention seit 20.09.2026

Philip tradet mit gedeckeltem Stopp: *„deckel bitte einbauen, auch in die R-Skala."* **1 R heißt in
diesem Plan und im Code ab hier: min(strukturelles Risiko, 6 Pips)** (`rScale.js:
STOPP_DECKEL_PIPS`). Ohne Deckel meinte dieselbe „3 R" am Chart eine andere Pip-Strecke als in
seiner Position — bei 12,3 Pips Risiko 37 statt 18 Pips.

**Warum 6 und nicht 7:** auf jedem gemessenen Ziel besser (Ziel 15 P: EV +1,27 gegen +1,20 R;
Ziel 20 P: +1,31 gegen +1,23). **Warum nicht enger:** die Messung kann den Optimalwert gar nicht
bestimmen, je enger desto besser, monoton ohne Boden (Ziel 20 P, EV: Deckel 5 = +1,42, 6 = +1,31,
7 = +1,23, 8 = +1,19). Das ist ein Artefakt — die Rechnung setzt den Entry exakt auf die OB-Kante
und kennt weder Spread noch Slippage. Die Untergrenze kommt aus der Praxis (Philip: *„maximal
6-7 Pips"*), nicht aus den Daten. Rohzahlen in `ergebnis-deckel.txt`.

**Was der Deckel mit den Bändern macht:** er flacht sie ab. Bei 3 R spannen die fünf Bänder ohne
Deckel 33 Punkte auf (66 bis 33), mit Deckel nur noch 17 (66 bis 49). Und er zerwürfelt die
Reihenfolge: mit Deckel liegt „über 10 Pips" (55 %) wieder über „5–7" (54 %) und „7–10" (49 %) —
die drei oberen Bänder sind praktisch ununterscheidbar. **Aus dieser Reihenfolge darf keine Aussage
gebaut werden.** Die Bänder bleiben trotzdem fünf (Philip 20.09.2026: *„die baender koennen
bleiben"*), der Nutzer sieht ohnehin immer nur eine Zeile.

Die Bandgrenze selbst wird weiter am **strukturellen** Risiko gemessen, nicht am gedeckelten: das
Band beschreibt, wie weit die Range aufgespannt ist, der Deckel nur, wo der Stopp liegt.

### Die Pip-Leiter — gegen denselben gedeckelten Stopp

Tabelle 6 in `baenderTabellen.py`, ergänzt 22.09.2026. Der Stopp ist **min(strukturelles Risiko,
6 Pips)**, nicht pauschal 6 — bei einer engen DR ist er enger (Philip: *„6 Pips maximal, und wenn
es weniger geht, dann weniger"*). Nenner wie in Tabelle 5 die entschiedenen Fälle.

| Band | n | 10 P | 15 P | 20 P | 25 P | 30 P | 35 P | 40 P |
|---|---|---|---|---|---|---|---|---|
| unter 3 Pips | 447 | 53 % | 38 % | 30 % | 25 % | 22 % | 19 % | 16 % |
| 3–5 Pips | 906 | 64 % | 49 % | 40 % | 33 % | 28 % | 24 % | 21 % |
| 5–7 Pips | 716 | 74 % | 59 % | 49 % | 40 % | 35 % | 29 % | 26 % |
| 7–10 Pips | 652 | 72 % | 58 % | 46 % | 39 % | 35 % | 30 % | 27 % |
| über 10 Pips | 561 | 77 % | 61 % | 52 % | 44 % | 38 % | 33 % | 29 % |
| **alle** | **3282** | **68 %** | **54 %** | **44 %** | **36 %** | **32 %** | **27 %** | **24 %** |

Der Deckel kostet vor allem die weiten Bänder: „über 10 Pips" fällt bei 15 Pips von 73 % (Tabelle 1,
Stopp = Invalidierung) auf 61 %, „unter 3 Pips" bleibt bei 38 % unberührt, weil der Deckel dort gar
nicht greift. Die Spannweite über die Bänder schrumpft von 35 auf 23 Punkte — dieselbe Abflachung
wie bei der R-Leiter, nur schwächer. Und anders als dort bleibt die Reihenfolge nahezu monoton:
mehr Risiko heißt weiterhin mehr Pips, nur nicht mehr so viel mehr.

Unentschieden (weder Ziel noch Stopp binnen 24 h) sind bei 10 Pips 0 von 3282, bei 40 Pips 61 — die
Basis schrumpft nach oben also deutlich weniger als bei der R-Leiter (dort 128 bei 10 R).

**Die Tabelle der Skala** (Tabelle 5 in `baenderTabellen.py`, Stopp auf 6 Pips gedeckelt, n = 3282)
— genau diese Zahlen stehen in `src/drQuoten.js`:

| Band | n | 2 R | 3 R | 4 R | 5 R | 6 R | 7 R | 8 R | 9 R | 10 R |
|---|---|---|---|---|---|---|---|---|---|---|
| unter 3 Pips | 447 | 77 % | 66 % | 54 % | 48 % | 42 % | 38 % | 33 % | 30 % | 28 % |
| 3–5 Pips | 906 | 73 % | 57 % | 47 % | 40 % | 34 % | 30 % | 26 % | 23 % | 21 % |
| 5–7 Pips | 716 | 68 % | 54 % | 43 % | 36 % | 30 % | 26 % | 23 % | 21 % | 19 % |
| 7–10 Pips | 652 | 66 % | 49 % | 40 % | 35 % | 29 % | 25 % | 22 % | 20 % | 17 % |
| über 10 Pips | 561 | 70 % | 55 % | 45 % | 38 % | 32 % | 27 % | 23 % | 20 % | 18 % |
| **alle** | **3282** | **70 %** | **55 %** | **46 %** | **39 %** | **33 %** | **29 %** | **25 %** | **22 %** | **20 %** |

Sobald das Risiko über dem Deckel liegt (46 % aller DRs), sitzen die Marken für JEDE DR bei
denselben Pip-Abständen: 2 R = 12 P bis 10 R = 60 P. Die Geometrie ist dort fix, nur die Quoten
dahinter unterscheiden sich noch nach Band.

**Grenze der oberen Stufen:** bei 10 R (60 Pips) sind 128 von 3282 DRs unentschieden — weder Ziel
noch Stopp binnen 24 h erreicht — und fallen aus dem Nenner. Bei 2 R sind es 0. Die Basis schrumpft
also nach oben leicht; rund 630 Treffer bei 10 R sind aber reichlich.

**EV über die ganze Leiter flach** (+1,11 bei 2 R bis +1,32 bei 5 R, am oberen Ende wieder +1,22) —
keine „nimm diese Stufe"-Markierung, auch hier gilt informieren statt empfehlen.

Ziel 20 Pips, Erwartungswert ohne und mit 6-Pip-Deckel:

| Band | Stopp = Invalidierung | mit 6-Pip-Deckel |
|---|---|---|
| unter 3 Pips | 30 % · +1,75 R | unberührt |
| 3–5 Pips | 40 % · +1,38 R | unberührt |
| 5–7 Pips | 49 % · +1,13 R | 49 % · +1,19 R |
| 7–10 Pips | 50 % · +0,71 R | 46 % · **+1,01 R** |
| über 10 Pips | 64 % · +0,57 R | 52 % · **+1,25 R** |

Bei über 10 Pips Risiko verdoppelt der Deckel den Erwartungswert: 12 Punkte Trefferquote weniger,
dafür ein so viel besseres RR, dass es sich klar lohnt. Falls die Anzeige je einen Hinweis geben
soll, dann diesen — nicht eine Zielempfehlung.

### Die FVG-Größe — der stärkste Schnitt, gemessen 23.09.2026

Anlass war Philips Einwand zu Setup #2936: *„die FVG ist 0,5 Pip. viel zu schwach. koennten wir
ueberlegen sowas rauszufiltern."* Gemessen mit `analysis/dr-reichweite/fvgBaender.py`, Rohausgabe
in `ergebnis-fvg.txt`, Tabelle als `FVG_BAENDER` in `src/drQuoten.js`.

Dieselben 3282 Ranges, nur nach der Lücke gruppiert, die den bestätigenden M5-OB ausgemacht hat.
Die R-Spalten hier sind **gedeckelt** (min(Risiko, 6 Pips)), also direkt mit „Der gedeckelte Stopp"
weiter unten vergleichbar, nicht mit der ungedeckelten Tabelle oben:

| FVG | n | 10 P | 15 P | 20 P | 30 P | 2 R | 3 R | 4 R | 6 R | Reichw.-Median | OB-Retest |
|---|---|---|---|---|---|---|---|---|---|---|---|
| unter 1 Pip | 972 | 56 % | 42 % | 34 % | 23 % | 61 % | **47 %** | 38 % | 26 % | 13,1 P | 95 % |
| 1–2 Pips | 963 | 65 % | 50 % | 39 % | 28 % | 68 % | 52 % | 43 % | 31 % | 15,9 P | 91 % |
| 2–3 Pips | 539 | 69 % | 54 % | 45 % | 32 % | 72 % | 57 % | 47 % | 34 % | 18,7 P | 89 % |
| 3–5 Pips | 493 | 82 % | 64 % | 52 % | 38 % | 79 % | 61 % | 49 % | 36 % | 22,7 P | 85 % |
| 5–8 Pips | 217 | 92 % | 75 % | 67 % | 46 % | 89 % | 75 % | 65 % | 45 % | 29,3 P | 81 % |
| über 8 Pips | 98 | 100 % | 96 % | 90 % | 73 % | 99 % | **91 %** | 84 % | 71 % | 46,8 P | 69 % |
| **alle** | **3282** | **68 %** | **54 %** | **44 %** | **32 %** | **70 %** | **55 %** | **46 %** | **33 %** | 17,8 P | 90 % |

Monoton über die ganze Reihe, und **er hält in R** — Bootstrap für das oberste gegen das unterste
Band +37 bis +50 Punkte bei 3 R (+34/+42 bei 2 R, +38/+54 bei 4 R). Anders als bei Saisonalität und
Handelszeit ist das also nicht überwiegend Volatilität: die Reichweite wandert um Faktor 3,6 mit,
das Risiko nur um 1,7. Damit ist es der stärkste Einzelschnitt, den dieses Projekt gemessen hat —
zum Vergleich bei 3 R: reifer Sweep 44 % (ungedeckelt, n=188), 1H-Sweep 63 % (n=78).

Die **relative** FVG (Lücke / OB-Höhe) trennt ebenfalls, aber schwächer: 43 / 50 / 52 / 60 / 74 %
bei 3 R, Bootstrap +26 bis +36. Philips ursprünglicher Verdacht war ein Missverhältnis (0,5 Pip in
einem 15,8-Pip-OB) — in dieser Form bestätigt er sich nicht, die absolute Zahl ist das bessere
Kriterium. Die relative Tabelle ist deshalb bewusst **nicht** in `drQuoten.js` übernommen.

**Kein Unterdrückungs-Filter.** Der Verlauf hat keine Kante, an der sich eine Schwelle begründen
ließe, und das schwächste Band ist mit 29,6 % zugleich das größte — ein Filter in `poi-watcher`
würde knapp ein Drittel aller Alarme unsichtbar machen, und zwar unprüfbar: ein unterdrückter Alarm
lässt sich hinterher nicht mehr nachrechnen. Markieren ist reversibel, wegwerfen nicht (dieselbe
Entscheidung wie bei der Gegenkraft).

**Zwei Dinge, die beim Anzeigen schiefgehen können:**

1. Das ist ein **zweiter Schnitt derselben Grundgesamtheit**, keine Verfeinerung des Risiko-Bands.
   „Enge Range UND große FVG" ist ungemessen. Die beiden Quoten dürfen nebeneinander stehen, aber
   nicht multipliziert oder als Filterkette gelesen werden — dieselbe Falle wie beim zweiten
   Schnitt weiter oben.
2. Eine FVG von X Pip ist **per Konstruktion schon Teil der gemessenen Strecke** — der Preis steht
   bei FVG-Bestätigung bereits so weit von der nahen Kante weg. Bei den besetzungsstarken unteren
   Bändern (Median 0,7 bis 2,5 Pip) fällt das gegen ein 10-Pip-Ziel nicht ins Gewicht, im obersten
   Band (Median 10,1 Pip, 3 % der Ranges) trägt es einen Teil der 91 %.

Die Spalte `OB-Retest` läuft nur mit, weil sie eine eigene Warnung enthält: je größer die Lücke,
desto seltener kommt der Preis an die Kante zurück. Sie geht in keine Quote ein — Philip sucht den
Entry unabhängig von der Dealing Range, notfalls im M1 ohne OB-Retest.

**Stand der Umsetzung:** `trade_setups.ob_fvg` existiert (Migration `20260923083000`), `poi-watcher`
schreibt sie live mit, und alle 2691 rückrechenbaren Altzeilen sind gefüllt
(`scripts/backfillObFvg.ts`). Die Tabelle liegt als `FVG_BAENDER`/`fvgQuote()` in `drQuoten.js`,
ist aber **noch nirgends aufgerufen** — wo genau sie im TSC auftaucht, ist offen.

### Saisonalität bewusst NICHT einbauen

Der Monatsunterschied ist real und groß (März 67 % gegen August 42 % bei 15 Pips), aber er stammt
aus **einem** Jahr. „Der August ist schwach" wäre aus neun Monaten eine Überanpassung — dafür
bräuchte es mehrere Jahre. Und er ist größtenteils Volatilität: in R liegen alle Monate bei 2 R
zwischen 63 und 74 %. Wer die R-Leiter anzeigt, hat den Effekt implizit schon drin.

## Was serverseitig fehlen WÜRDE — zurückgestellt, siehe „Reihenfolge"

Nicht anfangen, solange die statischen Bänder reichen. Steht hier nur, damit der Weg nicht neu
hergeleitet werden muss, falls die Anzeige eines Tages je konkret laufender DR rechnen soll:

1. **Eigene Tabelle** (Vorschlag `dr_reach`): je Dealing Range `reach_pips`, `risk_pips`,
   `invalidated_at_sec`, `measured_until_sec`, dazu die Merkmale für den Schnitt (`ls_timeframe`
   liegt schon auf `trade_setups`, die Gegenkraft-Konstellation muss berechnet werden).
   `trade_setup_outcomes` ist am 20.09.2026 gelöscht worden — der Forward-Walk wird neu
   geschrieben, diesmal direkt gegen Philips Erfolgsdefinition. Vorlage:
   `analysis/dr-reichweite/messeDrReichweite.py`, die Pfad-Simulation liegt dort schon fertig in
   `drMerkmale.py: lauf()`. Das Sweep-Alter braucht KEINE eigene Spalte — es ergibt sich aus
   `ls_pivot_time`/`ls_touched_time`, beide NOT NULL.
2. **Backfill** über den Bestand — seit 21.09.2026 eine Zeile je OB, Zeilen = DRs. Achtung: in
   `trade_setups` stehen nur die live erkannten ~1360 GBPUSD-Zeilen; die 1921 aus 2025 stammen aus
   einem Trockenlauf (`BACKFILL_DRY_RUN=1`) und liegen ausschließlich als Dump in `analysis/`. Muster:
   `supabase/functions/trading-monitor-mcp/scripts/backfillObZones.ts`.
3. **Fortschreibung in `poi-watcher`**, nach dem `trade_setups`-Upsert — die M5-Kerzen sind dort
   ohnehin geladen. Eine DR ist erst „entschieden", wenn sie invalidiert wurde oder das
   24-Stunden-Fenster abgelaufen ist; bis dahin bleibt die Zeile offen.
4. **Aggregations-Tool/Endpunkt**, das zu einer gegebenen DR die Vergleichsgruppe bildet und beide
   Leitern zurückgibt, inklusive `n` je Gruppe.

## Wo es in der UI auftaucht

| Ort | Was |
|---|---|
| **TSC** (`TradeSetupCockpit.vue`) | Block an der Dealing Range: beide Leitern untereinander, je Zeile Strecke + Quote — steht seit 22.09.2026 |
| **Chart** | R-Skala mit Quote je Marke aus dem passenden Risiko-Band (`rScale.js`/`drQuoten.js`/`rScaleRendering.js`) — steht seit 20.09.2026 |
| **`find_targets`** | je Kandidat „historisch erreicht in N von M vergleichbaren DRs" |

Fallstrick bei `find_targets`: das Tool sortiert nach Distanz zum **aktuellen Preis**, die Statistik
hängt aber an der **OB-Kante**. Beim Anreichern gegen die Kante rechnen.

Zweiter Fallstrick, aus der Auswertung: `find_targets`' eigene Kandidatenwahl ist
erwartungswert-neutral (alle Regeln zwischen +1,20 und +1,45 R). Die Anzeige soll also **informieren,
nicht empfehlen** — eine Quote je Kandidat ist nützlich, eine automatische „nimm diesen"-Markierung
wäre durch nichts gedeckt.

## Definitionen (nicht neu herleiten)

- **Dealing Range** = der M5-Orderblock eines *erkannten* Trade-Setups, nicht jeder beliebige M5-OB.
  Seit 20.09.2026 ist das 1:1 eine `trade_setups`-Zeile (Schlüssel `instrument, direction,
  ob_start_time`) — vorher waren es zwei, eine je Pfad.
- **Referenz für alles** = nahe OB-Kante (`ob_bottom` bei Short, `ob_top` bei Long).
- **Risiko / 1 R** = nahe OB-Kante → ferne OB-Kante (`trade_setups.invalidation`), **gedeckelt
  auf 6 Pips** (`rScale.js: STOPP_DECKEL_PIPS`). Ungedeckelt heißt hier durchgängig
  **strukturelles Risiko** — das bestimmt nur noch das Quoten-Band.
- **Invalidierung** = Berührung der fernen OB-Kante (= Sweep-Extrem).
- **Reichweite** = größte Bewegung in Trade-Richtung vor der Invalidierung. Docht zählt.
- **Start** = `ob_start_time` + 2 M5-Kerzen (600 s).
- **Fenster** = 24 h.

## Reihenfolge

1. **R-Skala im Chart** (Stufe 1, siehe oben) — reines Frontend, kein Server. **Erledigt
   20.09.2026**, Task `chart-r-skala-an-der-dealing-range-zeichnen`.
2. **Quoten an die R-Marken, statisch** — die 25 Zahlen aus Tabelle 1 oben als Konstante im
   Frontend, erzeugt von `baenderTabellen.py`. Kein Server (Begründung unten). **Erledigt
   20.09.2026**, Task `chart-quoten-an-die-r-marken-schreiben-statisch` (`src/drQuoten.js`).
   Nachgezogen 20.09.2026 auf den gedeckelten Stopp und 2-10 R, Task
   `r-skala-stopp-auf-6-pips-deckeln-und-bis-10-r-erweitern` — Tabelle 5 statt Tabelle 1.
   **Korrigiert 22.09.2026:** hier stand, die ungedeckelten Zahlen gälten weiter für die
   Pip-Leiter. Das war falsch — beide Leitern stehen im TSC nebeneinander und dürfen nicht zwei
   verschiedene Fragen beantworten. Die Pip-Leiter misst jetzt gegen denselben Stopp,
   Tabelle 6 (siehe „Die Pip-Leiter" unten). Tabelle 1 bleibt als Referenz für die
   Reichweite gegen die strukturelle Invalidierung stehen.
3. Beide Leitern plus Vergleichszeile als Block im TSC. **Erledigt 22.09.2026**, Task
   `tsc-beide-leitern-vergleichszeile-zur-laufenden-dealing-range` — `src/rScaleQuotes.js` heißt
   seitdem `src/drQuoten.js` (trägt jetzt beide Leitern plus die Vergleichsgruppen). Das Risiko-Band
   kommt aus der OB-Bestätigung der TSC-Range, das Sweep-Alter aus deren erster Sweep-Bestätigung;
   ohne OB-Bestätigung entfällt der Block wie auf EURUSD. Die Gegenkraft-Zeile fehlt bewusst (Stufe 5).
4. `find_targets`-Anreicherung.
5. Gegenkraft — zurückgestellt, siehe oben.
6. Serverseitige Messung — **nur falls** sich zeigt, dass die statischen Bänder zu grob sind.

### Warum statisch und nicht über eine `dr_reach`-Tabelle — entschieden 20.09.2026

Der ursprüngliche Plan sah zuerst eine serverseitige Messung vor (eigene Tabelle, Forward-Walk,
Backfill, Fortschreibung in `poi-watcher`, Aggregations-Endpunkt) und erst danach die Anzeige.
Das ist für den Zweck zu viel Apparat:

- Die Quoten stehen auf 3282 DRs aus 21 Monaten. Ein weiterer Monat bringt ~145 dazu, also gut
  4 % — das verschiebt eine Quote um weniger als einen Punkt. Selbst der 2025-Backfill, der die
  Stichprobe mehr als verdoppelte, bewegte die R-Leiter nur um wenige Punkte je Feld.
- Die Vergleichsgruppe ist ein **festes Risiko-Band**, keine pro-DR gebildete Menge. Eine
  Nachschlagetabelle reicht dafür per Definition aus.
- `trade_setup_outcomes` wurde am 20.09.2026 gelöscht, weil genau diese Maschinerie ein
  Sackgassen-Versuch war. Sie unter neuem Namen sofort wieder aufzubauen, ohne dass ein Verbraucher
  Live-Aktualität braucht, wäre derselbe Weg nochmal.

**Wann der Server-Weg doch nötig wird:** sobald die Quote nicht mehr je Risiko-Band, sondern je
konkret laufender DR gebildet werden soll (Gegenkraft-Konstellation, Sweep-Alter und aktueller
Monat kombiniert). Dann wird die Vergleichsgruppe pro Abfrage neu gebildet und eine Tabelle reicht
nicht mehr. Das ist aber genau der „zweite Schnitt", den dieser Plan ohnehin zurückstellt.

Das Aktualisieren ist ein Skriptlauf: `baenderTabellen.py` ausführen, die Konstante ersetzen.

## Idee: wie wir den Trend doch noch dazubekommen

Philips Skizze vom 21.09.2026, **noch nichts davon gemessen oder entschieden**. Festgehalten, weil
sie den Trend-Nullbefund weiter unten nicht widerlegt, sondern präzisiert: gemessen wurde **eine**
Trend-Definition über **alle** Dealing Ranges. Beides greift die Idee an.

**1) Einen M5-Trend bauen — über Kerzenstärke statt Pivots.** Philip: *„wir könnten die Stärken der
M5-Kerzen messen. Also akkumuliert man alle (in irgendeiner Range) bullischen Kerzen und alle
bärischen Kerzen, dann erhält man eine Differenz. Daran kann man den Trend gut ableiten, ohne
Pivots. Aber vielleicht machen wir es auch mit Pivots. Mal sehen."*

Offen ist alles Konkrete: welches Fenster, ob Körper oder ganze Spanne, ob nach Größe gewichtet,
und ab welcher Differenz überhaupt ein Trend vorliegt statt einer Range.

> **Vorerfahrung, die dazugehört:** am 09.08.2026 wurde ein verwandter Ansatz auf **M1** probiert
> (Kerzen bullisch/bärisch plus FVG-Vergleich) und mangels klarem Signal eingemottet; die
> Rohdaten liegen in `trading/archiv/candle-snapshots/`. Das ist kein Gegenbeweis — M5 ist nicht
> M1, und eine akkumulierte Differenz ist etwas anderes als ein Auszählen —, aber der erste
> Messlauf sollte gegen diesen Vorlauf geprüft werden, bevor viel Arbeit hineingeht.

**2) Bei Minor-Inducements nur mit dem M5-Trend traden.** Philip: *„bei minor inducements kann man
nur in die selbe Richtung traden wie der M5 Trend."* Das beträfe die große Mehrheit — 3094 von 3282
DRs sind Minor. Wäre die Regel wirksam, wäre sie damit der reichweitenstärkste Filter, den wir
bisher hätten — und seit der Alters-Effekt auf +10 Punkte geschrumpft ist, ist dieser Weg
interessanter geworden, nicht weniger.

**3) Bei Medium/Major ist der M5-Trend strukturell die falsche Frage.** Philip: *„bei medium/major
inducements kommt der Kurs ja in jedem Fall von der anderen Richtung, und der M5-Trend dreht dann
am Inducement-Level zwangsläufig (bei nem erfolgreichen Alarm/Signal). Es geht ja gar nicht anders,
weil das Inducement ja ein hohes Alter hat. Dort müssen wir wahrscheinlich die 1H-Market-Structure
beobachten."*

Das ist der interessanteste Teil, weil er **prüfbar** ist und der bisherige Nullbefund ihn nicht
ausschließt: der 1H-Strukturtrend wurde über **alle** 3282 DRs gemessen (1542 mit gegen 1591 gegen
den Trend, bei 15 Pips 57 % gegen 56 %) — **nie getrennt nach Sweep-Alter**. Philips Vermutung ist
genau, dass er nur bei den reifen Sweeps etwas sagt. Diese inzwischen 188 DRs sind in der
Gesamtzahl vollständig untergegangen.

### Was als Erstes zu messen wäre

Drei Schritte, jeder für sich aussagekräftig, aufsteigend nach Aufwand:

1. **Den bestehenden 1H-Trend nach Sweep-Alter aufteilen.** Kostet fast nichts — `trend-je-dr.json`
   und die Altersklasse liegen beide vor, das ist ein Schnitt in `filterTrend.py`. Beantwortet
   Punkt 3 direkt. Erwartungsdämpfer vorab: 75 reife DRs auf mit/gegen aufgeteilt sind rund 37 je
   Seite, also unter der 50er-Schwelle — ein deutlicher Unterschied wäre sichtbar, ein kleiner
   nicht. Das ist trotzdem der erste Lauf, weil er praktisch umsonst ist.
2. **Einen M5-Trend nach Punkt 1 definieren und je DR bestimmen**, analog zu `messeTrendJeDr.py`.
   Danach dieselbe Auswertung wie beim 1H-Trend, aber auf die 840 Minor-DRs gerichtet.
3. **Beides kreuzen** — M5-Trend bei Minor, 1H-Struktur bei reif — und gegen die heutige Quote
   halten.

Reihenfolge nicht umdrehen: erst Schritt 1, denn wenn der 1H-Trend auch bei reifen Sweeps nichts
sagt, ist Punkt 3 der Idee erledigt, bevor überhaupt ein M5-Trend gebaut wird.

## Grenzen, die in die Anzeige gehören

Nur GBPUSD (EURUSD bleibt bewusst ungemessen, Entscheidung Philip 20.09.2026). Neun Monate eines
Jahres. Die Erkennung lief nur im Alarmfenster, abends entstehende Setups fehlen strukturell. Und:
die Quoten sind **historische Häufigkeiten, keine Wahrscheinlichkeiten** — das gehört an die
Anzeige, nicht nur in die Doku.
