# PLAN: DR-Statistik in der UI anzeigen

> Historischer Konzeptstand mit cTrader-Zahlen. Seit dem FXCM-Wechsel gelten für die
> R-Leiter die neu berechneten 3282 FXCM-Setups aus 2025/2026 aus
> [ergebnis-baender.txt](analysis/dr-reichweite/ergebnis-baender.txt); Betrieb und Abnahme siehe
> [FXCM-Feed](docs/fxcm-feed.md). Die Zahlen in den folgenden Konzepttabellen sind historisch.

Status: Konzept steht, kein Code. Umsetzung in einer eigenen Session.
Datenbasis: `analysis/dr-reichweite/` — **1314 Dealing Ranges, Januar bis September 2026, GBPUSD**.
milk-city-Task: `tsc-historische-dr-statistik-zur-aktuellen-dealing-range-anzeigen`.

> Stand 20.09.2026, nach dem Backfill. Die erste Fassung dieses Plans rechnete mit 255 DRs und war
> an der 100-Fälle-Regel blockiert. **Beides ist erledigt**: die Stichprobe ist 5,2-mal so groß,
> und Philip hat die Schwelle auf 50 gesenkt. Jede geplante Gruppe liegt jetzt weit darüber.
>
> Zahlen am 21.09.2026 nachgezogen: die Erkennung wartet nicht mehr auf die Fraktal-Bestätigung
> (Task „Alarm sobald die FVG steht"), dieselben neun Monate liefern 1314 statt 915 DRs.

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
„≥ 15 Pips" liegt über alle 1314 DRs bei 56 %, bei den engsten aber bei 41 % und bei den weitesten
bei 68 %. Der Durchschnitt trifft auf keine einzelne DR zu. In R **dreht sich die Reihenfolge um**
(74 % bei 2 R für die engsten gegen 55 % für die weitesten) — und genau deshalb braucht es beide
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

## Die Zahlen (Stand 21.09.2026, n=1314)

Alle vier Tabellen erzeugt `analysis/dr-reichweite/baenderTabellen.py`, Rohausgabe in
`ergebnis-baender.txt`.

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

**Warum 6 und nicht 7:** auf jeder R-Stufe gemessen besser (3 R: 59 % gegen 57 %, EV +1,36 gegen
+1,28 R). **Warum nicht enger:** die Messung kann den Optimalwert gar nicht bestimmen, je enger
desto besser, monoton ohne Boden (EV bei 3 R: Deckel 4 = +1,63, 5 = +1,46, 6 = +1,36, 7 = +1,30).
Das ist ein Artefakt — die Rechnung setzt den Entry exakt auf die OB-Kante und kennt weder Spread
noch Slippage. Die Untergrenze kommt aus der Praxis (Philip: *„maximal 6-7 Pips"*), nicht aus den
Daten.

**Was der Deckel mit den Bändern macht:** er flacht sie ab. Bei 3 R spannen die fünf Bänder ohne
Deckel 32 Punkte auf (72 bis 40), mit Deckel nur noch 20 (72 bis 52). Die oberen drei werden
praktisch ununterscheidbar — 59 / 52 / 53, das letzte Paar dreht die Reihenfolge sogar um, was bei
n = 182 gegen n = 134 Rauschen ist. **Aus „52 gegen 53" darf keine Aussage gebaut werden.** Die
Bänder bleiben trotzdem fünf (Philip 20.09.2026: *„die baender koennen bleiben"*), der Nutzer sieht
ohnehin immer nur eine Zeile.

Die Bandgrenze selbst wird weiter am **strukturellen** Risiko gemessen, nicht am gedeckelten: das
Band beschreibt, wie weit die Range aufgespannt ist, der Deckel nur, wo der Stopp liegt.

**Die Tabelle der Skala** (Tabelle 5 in `baenderTabellen.py`, Stopp auf 6 Pips gedeckelt, n = 1314):

| Band | 2 R | 3 R | 4 R | 5 R | 6 R | 7 R | 8 R | 9 R | 10 R |
|---|---|---|---|---|---|---|---|---|---|
| unter 3 Pips | 75 % | 63 % | 50 % | 44 % | 38 % | 31 % | 28 % | 26 % | 23 % |
| 3–5 Pips | 74 % | 57 % | 47 % | 39 % | 34 % | 30 % | 25 % | 22 % | 21 % |
| 5–7 Pips | 73 % | 58 % | 46 % | 39 % | 33 % | 30 % | 26 % | 24 % | 21 % |
| 7–10 Pips | 66 % | 50 % | 43 % | 37 % | 31 % | 29 % | 23 % | 21 % | 18 % |
| über 10 Pips | 72 % | 56 % | 47 % | 39 % | 33 % | 28 % | 25 % | 23 % | 17 % |
| **alle** | **72 %** | **57 %** | **47 %** | **39 %** | **33 %** | **30 %** | **25 %** | **23 %** | **20 %** |

Sobald das Risiko über dem Deckel liegt (42 % aller DRs), sitzen die Marken für JEDE DR bei
denselben Pip-Abständen: 2 R = 12 P bis 10 R = 60 P. Die Geometrie ist dort fix, nur die Quoten
dahinter unterscheiden sich noch nach Band.

**Grenze der oberen Stufen:** bei 10 R (60 Pips) sind 84 von 1314 DRs unentschieden — weder Ziel
noch Stopp binnen 24 h erreicht — und fallen aus dem Nenner. Bei 2 R sind es 0. Die Basis schrumpft
also nach oben leicht; 246 Treffer bei 10 R sind aber reichlich.

**EV über die ganze Leiter flach** (+1,16 bei 2 R bis +1,38 bei 7 R, dann wieder +1,22) — keine
„nimm diese Stufe"-Markierung, auch hier gilt informieren statt empfehlen.

Ziel 20 Pips, Erwartungswert ohne und mit 6-Pip-Deckel:

| Band | Stopp = Invalidierung | mit 6-Pip-Deckel |
|---|---|---|
| unter 3 Pips | 28 % · +1,55 R | unberührt |
| 3–5 Pips | 38 % · +1,32 R | unberührt |
| 5–7 Pips | 51 % · +1,26 R | 51 % · +1,31 R |
| 7–10 Pips | 52 % · +0,76 R | 47 % · **+1,05 R** |
| über 10 Pips | 62 % · +0,55 R | 52 % · **+1,23 R** |

Bei über 10 Pips Risiko verdoppelt der Deckel den Erwartungswert: 10 Punkte Trefferquote weniger,
dafür ein so viel besseres RR, dass es sich klar lohnt. Falls die Anzeige je einen Hinweis geben
soll, dann diesen — nicht eine Zielempfehlung.

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
2. **Backfill** über den Bestand (seit 21.09.2026 eine Zeile je OB, 1314 Zeilen → 1314 DRs). Muster:
   `supabase/functions/trading-monitor-mcp/scripts/backfillObZones.ts`.
3. **Fortschreibung in `poi-watcher`**, nach dem `trade_setups`-Upsert — die M5-Kerzen sind dort
   ohnehin geladen. Eine DR ist erst „entschieden", wenn sie invalidiert wurde oder das
   24-Stunden-Fenster abgelaufen ist; bis dahin bleibt die Zeile offen.
4. **Aggregations-Tool/Endpunkt**, das zu einer gegebenen DR die Vergleichsgruppe bildet und beide
   Leitern zurückgibt, inklusive `n` je Gruppe.

## Wo es in der UI auftaucht

| Ort | Was |
|---|---|
| **TSC** (`TradeSetupCockpit.vue`) | Block an der Dealing Range: beide Leitern untereinander, je Zeile Strecke + Quote |
| **Chart** | R-Skala mit Quote je Marke aus dem passenden Risiko-Band (`rScale.js`/`rScaleQuotes.js`/`rScaleRendering.js`) — steht seit 20.09.2026 |
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
   20.09.2026**, Task `chart-quoten-an-die-r-marken-schreiben-statisch` (`src/rScaleQuotes.js`).
   Nachgezogen 20.09.2026 auf den gedeckelten Stopp und 2-10 R, Task
   `r-skala-stopp-auf-6-pips-deckeln-und-bis-10-r-erweitern` — Tabelle 5 statt Tabelle 1. Die
   ungedeckelten Zahlen oben unter „Die Zahlen" gelten weiter für die Pip-Leiter, NICHT für die
   R-Skala.
3. Beide Leitern plus Vergleichszeilen als Block im TSC.
4. `find_targets`-Anreicherung.
5. Gegenkraft — zurückgestellt, siehe oben.
6. Serverseitige Messung — **nur falls** sich zeigt, dass die statischen Bänder zu grob sind.

### Warum statisch und nicht über eine `dr_reach`-Tabelle — entschieden 20.09.2026

Der ursprüngliche Plan sah zuerst eine serverseitige Messung vor (eigene Tabelle, Forward-Walk,
Backfill, Fortschreibung in `poi-watcher`, Aggregations-Endpunkt) und erst danach die Anzeige.
Das ist für den Zweck zu viel Apparat:

- Die Quoten stehen auf 1314 DRs aus neun Monaten. Ein weiterer Monat bringt ~145 dazu, also gut
  10 % — das verschiebt eine Quote um ein bis zwei Punkte. Selbst die 399 DRs, die die schnellere
  Erkennung am 21.09. dazubrachte, bewegten keine Zahl um mehr als 3 Punkte.
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
nur in die selbe Richtung traden wie der M5 Trend."* Das beträfe die große Mehrheit — 1244 von 1314
DRs sind Minor. Wäre die Regel wirksam, wäre sie damit der reichweitenstärkste Filter, den wir
bisher hätten.

**3) Bei Medium/Major ist der M5-Trend strukturell die falsche Frage.** Philip: *„bei medium/major
inducements kommt der Kurs ja in jedem Fall von der anderen Richtung, und der M5-Trend dreht dann
am Inducement-Level zwangsläufig (bei nem erfolgreichen Alarm/Signal). Es geht ja gar nicht anders,
weil das Inducement ja ein hohes Alter hat. Dort müssen wir wahrscheinlich die 1H-Market-Structure
beobachten."*

Das ist der interessanteste Teil, weil er **prüfbar** ist und der bisherige Nullbefund ihn nicht
ausschließt: der 1H-Strukturtrend wurde über **alle** 1314 DRs gemessen (633 zu 673, Intervall über
null) — **nie getrennt nach Sweep-Alter**. Philips Vermutung ist genau, dass er nur bei den reifen
Sweeps etwas sagt. Diese 70 DRs sind in der Gesamtzahl vollständig untergegangen.

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
