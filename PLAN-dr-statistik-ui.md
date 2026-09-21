# PLAN: DR-Statistik in der UI anzeigen

Status: Konzept steht, kein Code. Umsetzung in einer eigenen Session.
Datenbasis: `analysis/dr-reichweite/` — **915 Dealing Ranges, Januar bis September 2026, GBPUSD**.
milk-city-Task: `tsc-historische-dr-statistik-zur-aktuellen-dealing-range-anzeigen`.

> Stand 20.09.2026, nach dem Backfill. Die erste Fassung dieses Plans rechnete mit 255 DRs und war
> an der 100-Fälle-Regel blockiert. **Beides ist erledigt**: die Stichprobe ist 3,4-mal so groß,
> und Philip hat die Schwelle auf 50 gesenkt. Jede geplante Gruppe liegt jetzt weit darüber.

## Was angezeigt werden soll

Zu einer **laufenden** Dealing Range: wie sich vergleichbare DRs historisch verhalten haben.
Philip will **beides** nebeneinander, nicht eins von beidem:

1. **Die R-Leiter** — **2 bis 10 R**, 1 R gegen den auf 6 Pips gedeckelten Stopp (siehe
   „Der gedeckelte Stopp" unten). Beginnt bei 2, nicht bei 1. Philip 20.09.2026:
   *„1R macht keinen sinn ich mache keinen Trade um 1R zu gewinnen. 2R ist minimum, aber 3R ist
   laut strategie eigentlich minimum (in praxis geht das aber nicht immer)."*
2. **Die Pip-Leiter** — **10 / 15 / 20 / 25 / 30 / 35 / 40 Pips**. TP1 liegt bei rund 15.

**Beide gehören nach dem Risiko der DR aufgeteilt.** Auf der ersten, kleinen Stichprobe sah die
R-Leiter noch so aus, als gälte sie für alle DRs gleich (Terzile 49 / 51 / 44 % bei 3 R) — auf 915
stimmt das nicht: sie spreizt sogar **stärker** als die Pip-Leiter.

| Spannweite über die fünf Risiko-Bänder | |
|---|---|
| Pip-Leiter (10 / 15 / 20 / 30 Pips) | 22 bis 28 Punkte |
| R-Leiter (2 / 3 / 4 / 5 R) | **33 bis 36 Punkte** |

Bei 2 R stehen 82 % (Risiko unter 3 Pips) gegen 49 % (über 10 Pips). Die Begründung für die
R-Leiter ist also nicht mehr „sie verallgemeinert" — sondern schlicht, dass R die Einheit ist, in
der eine Position gesized wird. Beide Leitern sind nützlich, beide brauchen die Gruppierung.

Philips Begründung für die zweite: *„a) die DR ist eng, dann sinkt die Wahrscheinlichkeit für ne
weite Strecke über 15 Pips. b) Weite DR, ok 61 % Chance auf 15 Pips, kann man mal wagen."* Und zur
Leitkennzahl: *„mir ist doch egal wie weit die Pipstrecken gehen, ich will am ende 10-20 pips traden
und den Gewinn mitnehmen. Ich will ne gute Winrate von Dealing Ranges."* Bei rund 15 Pips nimmt er
TP1 — deshalb reicht die Reihe von 10 bis 40.

**Warum die Aufteilung zwingend ist:** ungeteilt ist jede der beiden Leitern irreführend.
„≥ 15 Pips" liegt über alle 915 DRs bei 59 %, bei den engsten aber bei 43 % und bei den weitesten
bei 71 %. Der Durchschnitt trifft auf keine einzelne DR zu. In R **dreht sich die Reihenfolge um**
(82 % bei 2 R für die engsten gegen 49 % für die weitesten) — und genau deshalb braucht es beide
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

## Die Zahlen (Stand 20.09.2026, n=915)

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
| unter 3 Pips | 136 | 59 % | 43 % | 32 % | 27 % | 24 % | 24 % | 21 % | 82 % | 72 % | 61 % | 55 % | 48 % |
| 3–5 Pips | 269 | 71 % | 52 % | 41 % | 33 % | 29 % | 25 % | 23 % | 78 % | 60 % | 49 % | 41 % | 35 % |
| 5–7 Pips | 194 | 79 % | 64 % | 52 % | 43 % | 38 % | 33 % | 30 % | 74 % | 57 % | 44 % | 38 % | 33 % |
| 7–10 Pips | 182 | 77 % | 66 % | 53 % | 46 % | 42 % | 35 % | 32 % | 60 % | 46 % | 36 % | 28 % | 21 % |
| über 10 Pips | 134 | 84 % | 71 % | 60 % | 55 % | 46 % | 41 % | 37 % | 49 % | 36 % | 26 % | 22 % | 13 % |
| **alle** | **915** | **74 %** | **59 %** | **47 %** | **40 %** | **35 %** | **31 %** | **28 %** | **70 %** | **55 %** | **44 %** | **37 %** | **31 %** |

## Entschiedene Design-Fragen

### Feste Bänder, keine Terzile — entschieden

Terzile sind immer gleich besetzt, verschieben aber ihre Grenzen, sobald die Stichprobe wächst;
eine DR würde nach dem nächsten Backfill andere Zahlen zeigen als heute. **Feste Bänder** (< 3 /
3–5 / 5–7 / 7–10 / > 10 Pips) sind stabil und mit n = 134 bis 269 alle gut besetzt.

### Die 50er-Schwelle ist erfüllt — kein Blocker mehr

Philip, 20.09.2026: *„es müssen nicht 100 sein, glaub 50 reichen mir für ne Prozentanzahl."* Das
kleinste feste Band hat 134 DRs. Beide Leitern können also **sofort als Prozent** angezeigt werden.
Die Anzeige sollte die Regel trotzdem im Code tragen (unter 50 entschiedenen Fällen rohe Zahlen
statt Prozent), damit ein späterer feinerer Schnitt nicht stillschweigend darunter rutscht.

### Ein zweiter Schnitt wäre möglich — aber zurückgestellt (siehe oben)

| Gruppe | n | 10 P | 15 P | 20 P | 25 P | 30 P | 35 P | 40 P | 2 R | 3 R | 4 R | 5 R | 6 R |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| reifer Sweep (≥ 24 h) | 75 | 91 % | 81 % | 69 % | 61 % | 52 % | 41 % | 37 % | 76 % | 64 % | 49 % | 40 % | 32 % |
| Minor, kein lebender Gegner | 576 | 79 % | 62 % | 49 % | 42 % | 37 % | 32 % | 30 % | 72 % | 57 % | 46 % | 38 % | 32 % |
| Minor gegen eine lebende M5-Gegen-DR | 242 | 56 % | 44 % | 36 % | 29 % | 26 % | 23 % | 20 % | 63 % | 48 % | 38 % | 33 % | 26 % |
| **alle** | **915** | **74 %** | **59 %** | **47 %** | **40 %** | **35 %** | **31 %** | **28 %** | **70 %** | **55 %** | **44 %** | **37 %** | **31 %** |

Diese Dreiteilung ist der informativste verfügbare Schnitt und alle drei Gruppen liegen über 50.
**Nicht** nach Trend schneiden — der 1H-Trend trennt nachweislich nicht (453 zu 458,
Bootstrap-Intervall über null).

### Das Kriterium ist das Sweep-ALTER, nicht die Herkunft — korrigiert 20.09.2026

Hier stand bis zum 20.09.2026 die Sweep-*Herkunft* (1H gegen M5). Philip: *„ob ein Liquidity Sweep
von M5 oder einem Higher Timeframe kommt, ist mir eigentlich egal. Es spielt das Alter eine Rolle:
Minor, Medium oder Major Inducement."*

Das ändert an den Zahlen wenig, weil beide Merkmale **strukturell fast dasselbe** sind: `poi-watcher`
lädt 300 M5-Kerzen (~25 h), ein M5-Level kann also gar nicht älter als ~25 h werden. Gemessen über
915 DRs: von 815 M5-Sweeps sind **0** reif, Alters-Median 1,5 h; von 100 1H-Sweeps sind 75 % reif,
Median 44,7 h. „M5" impliziert „Minor".

Was die Herkunft trotzdem zusätzlich trüge: 25 DRs mit *frischem* 1H-Sweep kommen auf 80 % bei
15 Pips, also Major-Niveau. Die fallen unter einer reinen Altersregel durch. n=25 liegt aber unter
der 50er-Schwelle — deshalb **keine eigene Zeile**, aber `trade_setups.ls_timeframe` behalten,
damit die Gruppe auswertbar bleibt, sobald sie wächst.

**Medium und Major sind EIN Topf.** Der Unterschied zwischen ihnen ist nicht belegbar: bei 15 Pips
9 Punkte, 95 %-Intervall [−9, +26] auf n=30 gegen n=45. Für eine Absicherung bräuchte es das
Vierfache der Daten, also rund drei Jahre. Die belastbare Linie liegt bei **24 Handelsstunden**:
reif gegen Minor sind +25 Punkte, Intervall [14, 34], und das hält bei 10/20/25/30 Pips genauso.
Genau so rundet der Telegram-Alarm heute schon („<24h" / „≥24h").

### Erwartungswert je Ziel — und warum die Anzeige nicht empfehlen soll

Dieselben Bänder, aber statt der Trefferquote der Erwartungswert in R (Treffer zählt +RR,
Invalidierung −1, RR bei 10 gedeckelt):

| Band | n | 10 P | 15 P | 20 P | 25 P | 30 P | 35 P | 40 P | 2 R | 3 R | 4 R | 5 R | 6 R |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| unter 3 Pips | 136 | 2,10 | **2,18** | 2,01 | 1,73 | 1,43 | 1,43 | 1,20 | 1,45 | 1,88 | 2,05 | **2,31** | 2,29 |
| 3–5 Pips | 269 | **1,50** | 1,49 | 1,46 | 1,44 | **1,50** | 1,39 | 1,44 | 1,34 | 1,41 | 1,45 | 1,48 | **1,50** |
| 5–7 Pips | 194 | 1,14 | 1,29 | 1,30 | 1,32 | 1,40 | 1,42 | **1,56** | 1,23 | 1,30 | 1,26 | 1,35 | **1,45** |
| 7–10 Pips | 182 | 0,72 | 0,85 | 0,82 | 0,86 | **0,98** | 0,91 | 0,97 | 0,80 | 0,89 | **0,91** | 0,85 | 0,69 |
| über 10 Pips | 134 | 0,51 | 0,52 | 0,52 | **0,63** | 0,59 | 0,59 | 0,59 | 0,54 | **0,59** | 0,54 | 0,57 | 0,24 |
| **alle** | **915** | 1,21 | **1,28** | 1,25 | 1,23 | 1,24 | 1,20 | 1,22 | 1,11 | 1,24 | 1,28 | **1,35** | 1,31 |

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

**Die Tabelle der Skala** (Tabelle 5 in `baenderTabellen.py`, Stopp auf 6 Pips gedeckelt, n = 915):

| Band | 2 R | 3 R | 4 R | 5 R | 6 R | 7 R | 8 R | 9 R | 10 R |
|---|---|---|---|---|---|---|---|---|---|
| unter 3 Pips | 82 % | 72 % | 61 % | 55 % | 47 % | 38 % | 34 % | 32 % | 28 % |
| 3–5 Pips | 78 % | 60 % | 49 % | 41 % | 36 % | 33 % | 27 % | 25 % | 23 % |
| 5–7 Pips | 75 % | 59 % | 47 % | 41 % | 36 % | 32 % | 29 % | 25 % | 22 % |
| 7–10 Pips | 66 % | 52 % | 44 % | 38 % | 31 % | 29 % | 22 % | 19 % | 16 % |
| über 10 Pips | 71 % | 53 % | 46 % | 37 % | 32 % | 29 % | 24 % | 22 % | 17 % |
| **alle** | **75 %** | **59 %** | **49 %** | **42 %** | **36 %** | **32 %** | **27 %** | **24 %** | **22 %** |

Sobald das Risiko über dem Deckel liegt (43 % aller DRs), sitzen die Marken für JEDE DR bei
denselben Pip-Abständen: 2 R = 12 P bis 10 R = 60 P. Die Geometrie ist dort fix, nur die Quoten
dahinter unterscheiden sich noch nach Band.

**Grenze der oberen Stufen:** bei 10 R (60 Pips) sind 65 von 915 DRs unentschieden — weder Ziel
noch Stopp binnen 24 h erreicht — und fallen aus dem Nenner. Bei 2 R sind es 0. Die Basis schrumpft
also nach oben leicht; 183 Treffer bei 10 R sind aber reichlich.

**EV über die ganze Leiter flach** (+1,24 bei 2 R bis +1,57 bei 7 R, dann wieder +1,37) — keine
„nimm diese Stufe"-Markierung, auch hier gilt informieren statt empfehlen.

Ziel 20 Pips, Erwartungswert ohne und mit 6-Pip-Deckel:

| Band | Stopp = Invalidierung | mit 6-Pip-Deckel |
|---|---|---|
| unter 3 Pips | 32 % · +2,01 R | unberührt |
| 3–5 Pips | 41 % · +1,46 R | unberührt |
| 5–7 Pips | 52 % · +1,30 R | 52 % · +1,36 R |
| 7–10 Pips | 54 % · +0,82 R | 48 % · **+1,10 R** |
| über 10 Pips | 61 % · +0,52 R | 49 % · **+1,13 R** |

Bei über 10 Pips Risiko verdoppelt der Deckel den Erwartungswert: 12 Punkte Trefferquote weniger,
dafür ein so viel besseres RR, dass es sich klar lohnt. Falls die Anzeige je einen Hinweis geben
soll, dann diesen — nicht eine Zielempfehlung.

### Saisonalität bewusst NICHT einbauen

Der Monatsunterschied ist real und groß (März 71 % gegen August 45 % bei 15 Pips), aber er stammt
aus **einem** Jahr. „Der August ist schwach" wäre aus neun Monaten eine Überanpassung — dafür
bräuchte es mehrere Jahre. Und er ist größtenteils Volatilität: in R liegen alle Monate bei 2 R
zwischen 66 und 74 %. Wer die R-Leiter anzeigt, hat den Effekt implizit schon drin.

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
2. **Backfill** über den Bestand (1233 Setup-Zeilen → 915 DRs). Muster:
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

- Die Quoten stehen auf 915 DRs aus neun Monaten. Ein weiterer Monat bringt ~100 dazu, also gut
  10 % — das verschiebt eine Quote um ein bis zwei Punkte. Am 20.09. kamen 60 DRs dazu, und keine
  Zahl bewegte sich mehr als 3 Punkte.
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
nur in die selbe Richtung traden wie der M5 Trend."* Das beträfe die große Mehrheit — 840 von 915
DRs sind Minor. Wäre die Regel wirksam, wäre sie damit der reichweitenstärkste Filter, den wir
bisher hätten.

**3) Bei Medium/Major ist der M5-Trend strukturell die falsche Frage.** Philip: *„bei medium/major
inducements kommt der Kurs ja in jedem Fall von der anderen Richtung, und der M5-Trend dreht dann
am Inducement-Level zwangsläufig (bei nem erfolgreichen Alarm/Signal). Es geht ja gar nicht anders,
weil das Inducement ja ein hohes Alter hat. Dort müssen wir wahrscheinlich die 1H-Market-Structure
beobachten."*

Das ist der interessanteste Teil, weil er **prüfbar** ist und der bisherige Nullbefund ihn nicht
ausschließt: der 1H-Strukturtrend wurde über **alle** 915 DRs gemessen (453 zu 458, Intervall über
null) — **nie getrennt nach Sweep-Alter**. Philips Vermutung ist genau, dass er nur bei den reifen
Sweeps etwas sagt. Diese 75 DRs sind in der Gesamtzahl vollständig untergegangen.

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
