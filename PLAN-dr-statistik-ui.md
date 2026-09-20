# PLAN: DR-Statistik in der UI anzeigen

Status: Konzept steht, kein Code. Umsetzung in einer eigenen Session.
Datenbasis: `analysis/dr-reichweite/` — **855 Dealing Ranges, Januar bis September 2026, GBPUSD**.
milk-city-Task: `tsc-historische-dr-statistik-zur-aktuellen-dealing-range-anzeigen`.

> Stand 20.09.2026, nach dem Backfill. Die erste Fassung dieses Plans rechnete mit 255 DRs und war
> an der 100-Fälle-Regel blockiert. **Beides ist erledigt**: die Stichprobe ist 3,4-mal so groß,
> und Philip hat die Schwelle auf 50 gesenkt. Jede geplante Gruppe liegt jetzt weit darüber.

## Was angezeigt werden soll

Zu einer **laufenden** Dealing Range: wie sich vergleichbare DRs historisch verhalten haben.
Philip will **beides** nebeneinander, nicht eins von beidem:

1. **Die R-Leiter** — **2 / 3 / 4 / 5 / 6 R**. Beginnt bei 2, nicht bei 1. Philip 20.09.2026:
   *„1R macht keinen sinn ich mache keinen Trade um 1R zu gewinnen. 2R ist minimum, aber 3R ist
   laut strategie eigentlich minimum (in praxis geht das aber nicht immer)."*
2. **Die Pip-Leiter** — **10 / 15 / 20 / 25 / 30 / 35 / 40 Pips**. TP1 liegt bei rund 15.

**Beide gehören nach dem Risiko der DR aufgeteilt.** Auf der ersten, kleinen Stichprobe sah die
R-Leiter noch so aus, als gälte sie für alle DRs gleich (Terzile 49 / 51 / 44 % bei 3 R) — auf 855
stimmt das nicht: sie spreizt sogar **stärker** als die Pip-Leiter.

| Spannweite über die fünf Risiko-Bänder | |
|---|---|
| Pip-Leiter (10 / 15 / 20 / 30 Pips) | 23 bis 28 Punkte |
| R-Leiter (2 / 3 / 4 / 5 R) | **33 bis 36 Punkte** |

Bei 2 R stehen 83 % (Risiko unter 3 Pips) gegen 50 % (über 10 Pips). Die Begründung für die
R-Leiter ist also nicht mehr „sie verallgemeinert" — sondern schlicht, dass R die Einheit ist, in
der eine Position gesized wird. Beide Leitern sind nützlich, beide brauchen die Gruppierung.

Philips Begründung für die zweite: *„a) die DR ist eng, dann sinkt die Wahrscheinlichkeit für ne
weite Strecke über 15 Pips. b) Weite DR, ok 61 % Chance auf 15 Pips, kann man mal wagen."* Und zur
Leitkennzahl: *„mir ist doch egal wie weit die Pipstrecken gehen, ich will am ende 10-20 pips traden
und den Gewinn mitnehmen. Ich will ne gute Winrate von Dealing Ranges."* Bei rund 15 Pips nimmt er
TP1 — deshalb reicht die Reihe von 10 bis 40.

**Warum die Aufteilung zwingend ist:** ungeteilt ist jede der beiden Leitern irreführend.
„≥ 15 Pips" liegt über alle 855 DRs bei 61 %, bei den engsten aber bei 45 % und bei den weitesten
bei 73 %. Der Durchschnitt trifft auf keine einzelne DR zu. In R **dreht sich die Reihenfolge um**
(83 % bei 2 R für die engsten gegen 50 % für die weitesten) — und genau deshalb braucht es beide
Leitern, jede mit ihrer Gruppierung.

## Stufe 1: die R-Skala an der Dealing Range — ohne jede Serverarbeit

**Das ist der erste Task.** Philip 20.09.2026: *„an die Dealing-Range eine Skala zu zeichnen ... dann
kann man ja sehen, ob eine Dealing-Range bereits eine 3- oder 4- oder 5-R-Strecke hingelegt hat."*

Der Clou: dafür braucht es **nichts** von dem, was weiter unten unter „Was serverseitig fehlt" steht.
Keine `dr_reach`-Tabelle, keinen Backfill, keinen Aggregations-Endpunkt, keine `poi-watcher`-Änderung.
Die Skala ist reine Geometrie aus Werten, die der Chart schon in der Hand hält:

```
ref   = direction === "short" ? setup.obBottom : setup.obTop
risk  = |setup.fractal.price − ref|
tick_k = direction === "short" ? ref − k · risk : ref + k · risk      für k = 2, 3, 4, 5, 6
```

`setup.obTop`, `setup.obBottom` und `setup.fractal.price` stehen bereits in `tradeSetupsMetadata`
(`usePriceChartTradeSetups.js`), und `usePriceChartTradeSetupDrawing.js` zeichnet daraus heute schon
Fraktal-Linie und OB-Box. Die Skala ist ein weiteres Primitive an derselben Stelle — Muster:
`FibTickPrimitive` in `marketStructureRendering.ts`, Farben aus `chartColors.js`.

**Was Philip damit sofort hat:** er sieht an jeder DR im Chart ab, wie weit sie schon gelaufen ist.
Das ist genau die Information, die er für die Einschätzung einer gegnerischen DR braucht — ohne
dass irgendetwas klassifiziert oder bewertet werden muss. Die Skala zeigt den Stand, die Abwägung
macht er.

### Die Falle: Path B hat kein echtes Invalidierungslevel

`detectTradeSetups` (`src/tradeSetup.js`) liefert zwei Sorten Setup, unterscheidbar an `pathType`:

- **Path A** — `fractal` ist das echte Extrem-Fraktal. `|fractal.price − ref|` ist das Risiko. ✅
- **Path B** — `fractal` ist auf `ls` gesetzt, also auf das **gesweepte Level**, nicht auf das
  Extrem-Fraktal (siehe `tradeSetup.js:204`). Das ist ein Platzhalter, damit die Zeile vollständig
  ist. Als Invalidierung ist er **unbrauchbar** — genau deshalb hat die Auswertung alle Path-B-only
  Dealing Ranges ausgeschlossen (60 von 915).

**Wird das übersehen, zeichnet die Skala bei jedem Path-B-Setup falsche Marken**, weil `risk` aus
dem falschen Preis kommt. Die Zeichenroutine kennt `pathType` bereits (sie blendet dort schon das
PP-Label aus, `usePriceChartTradeSetupDrawing.js:67`).

Fürs Erste die einfachste korrekte Lösung: **Skala nur bei `pathType === "A"` zeichnen.** Häufig
existiert für denselben M5-OB ohnehin eine Path-A-Zeile — sauberer wäre, deren Fraktal zu
verwenden, aber das ist eine Verfeinerung, kein Muss für den ersten Task.

**Reihenfolge der R-Marken:** 2 / 3 / 4 / 5 / 6 R. Kein 1 R — Philip: *„1R macht keinen sinn ich
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

## Die Zahlen (Stand 20.09.2026, n=855)

Angezeigt wird immer die Zeile des Bandes, in das die laufende DR fällt — die Gesamtzeile steht
nur als Bezugspunkt dabei:

### Beide Leitern nach festem Risiko-Band

| Band | n | 10 P | 15 P | 20 P | 25 P | 30 P | 35 P | 40 P | 2 R | 3 R | 4 R | 5 R | 6 R |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| unter 3 Pips | 136 | 61 % | 45 % | 33 % | 27 % | 24 % | 24 % | 21 % | 83 % | 74 % | 62 % | 56 % | 49 % |
| 3–5 Pips | 247 | 75 % | 56 % | 44 % | 36 % | 32 % | 27 % | 25 % | 81 % | 65 % | 53 % | 45 % | 38 % |
| 5–7 Pips | 184 | 80 % | 65 % | 54 % | 45 % | 39 % | 34 % | 31 % | 76 % | 58 % | 46 % | 40 % | 34 % |
| 7–10 Pips | 174 | 78 % | 67 % | 55 % | 47 % | 43 % | 35 % | 32 % | 60 % | 47 % | 37 % | 29 % | 22 % |
| über 10 Pips | 114 | 84 % | 73 % | 61 % | 57 % | 46 % | 43 % | 39 % | 50 % | 38 % | 29 % | 23 % | 14 % |
| **alle** | **855** | **76 %** | **61 %** | **49 %** | **41 %** | **36 %** | **32 %** | **29 %** | **72 %** | **58 %** | **46 %** | **39 %** | **33 %** |

Erzeugt von `analysis/dr-reichweite/quotenTabelle.py` und `leiterPipsVsR.py`.

## Entschiedene Design-Fragen

### Feste Bänder, keine Terzile — entschieden

Terzile sind immer gleich besetzt, verschieben aber ihre Grenzen, sobald die Stichprobe wächst;
eine DR würde nach dem nächsten Backfill andere Zahlen zeigen als heute. **Feste Bänder** (< 3 /
3–5 / 5–7 / 7–10 / > 10 Pips) sind stabil und mit n = 114 bis 247 alle gut besetzt.

### Die 50er-Schwelle ist erfüllt — kein Blocker mehr

Philip, 20.09.2026: *„es müssen nicht 100 sein, glaub 50 reichen mir für ne Prozentanzahl."* Das
kleinste feste Band hat 114 DRs. Beide Leitern können also **sofort als Prozent** angezeigt werden.
Die Anzeige sollte die Regel trotzdem im Code tragen (unter 50 entschiedenen Fällen rohe Zahlen
statt Prozent), damit ein späterer feinerer Schnitt nicht stillschweigend darunter rutscht.

### Ein zweiter Schnitt wäre möglich — aber zurückgestellt (siehe oben)

| Gruppe | n | 10 P | 15 P | 20 P | 25 P | 30 P | 35 P | 40 P | 2 R | 3 R | 4 R | 5 R | 6 R |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1H-Sweep | 98 | 93 % | 83 % | 70 % | 62 % | 53 % | 43 % | 37 % | 74 % | 64 % | 53 % | 43 % | 35 % |
| M5-Sweep, kein lebender Gegner | 525 | 80 % | 64 % | 50 % | 43 % | 38 % | 34 % | 31 % | 74 % | 59 % | 48 % | 41 % | 35 % |
| M5-Sweep gegen eine lebende M5-Gegen-DR | 216 | 56 % | 44 % | 36 % | 29 % | 25 % | 22 % | 19 % | 64 % | 51 % | 39 % | 34 % | 27 % |
| **alle** | **855** | **76 %** | **61 %** | **49 %** | **41 %** | **36 %** | **32 %** | **29 %** | **72 %** | **58 %** | **46 %** | **39 %** | **33 %** |

Diese Dreiteilung ist der informativste verfügbare Schnitt und alle drei Gruppen liegen deutlich
über 50. Sie kombiniert die zwei Merkmale, die sich als wirksam erwiesen haben. **Nicht** nach
Trend schneiden — der 1H-Trend trennt nachweislich nicht (424 zu 427, Bootstrap-Intervall über
null). Sweep-Alter wäre der stärkste Filter überhaupt (Major: 100 % auf 10 Pips), ist aber mit
n=28 unter der Schwelle und mit 3 % aller DRs zu selten für eine eigene Zeile.

### Erwartungswert je Ziel — und warum die Anzeige nicht empfehlen soll

Dieselben Bänder, aber statt der Trefferquote der Erwartungswert in R (Treffer zählt +RR,
Invalidierung −1, RR bei 10 gedeckelt):

| Band | n | 10 P | 15 P | 20 P | 25 P | 30 P | 35 P | 40 P | 2 R | 3 R | 4 R | 5 R | 6 R |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| unter 3 Pips | 136 | 2,28 | **2,29** | 2,08 | 1,89 | 1,59 | 1,59 | 1,28 | 1,49 | 1,94 | 2,12 | 2,35 | **2,45** |
| 3–5 Pips | 247 | 1,65 | 1,68 | 1,66 | 1,62 | **1,78** | 1,67 | 1,72 | 1,44 | 1,61 | 1,65 | 1,67 | **1,73** |
| 5–7 Pips | 184 | 1,18 | 1,34 | 1,38 | 1,40 | 1,44 | 1,45 | **1,58** | 1,27 | 1,34 | 1,33 | 1,46 | **1,51** |
| 7–10 Pips | 174 | 0,71 | 0,88 | 0,87 | 0,91 | **1,03** | 0,94 | 0,97 | 0,81 | 0,93 | **0,94** | 0,91 | 0,71 |
| über 10 Pips | 114 | 0,51 | 0,58 | 0,57 | 0,72 | 0,64 | 0,70 | **0,72** | 0,60 | 0,67 | **0,70** | 0,66 | 0,30 |
| **alle** | **855** | 1,31 | **1,39** | 1,36 | 1,35 | 1,38 | 1,34 | 1,34 | 1,18 | 1,35 | 1,41 | **1,47** | 1,45 |

Zwei Dinge, die daraus für die Anzeige folgen:

**Innerhalb einer Zeile ist der Erwartungswert flach.** Bei 3–5 Pips Risiko liegt alles zwischen
1,65 und 1,78, egal ob 10 oder 40 Pips angepeilt werden. Das Ziel zu optimieren bringt also fast
nichts — dasselbe Ergebnis wie bei den `find_targets`-Auswahlregeln. Die Anzeige soll deshalb
**informieren, nicht empfehlen**.

**Zwischen den Zeilen liegt Faktor 3** (2,29 gegen 0,72). Das ist keine Mechanik, sondern eine
empirische Eigenschaft: von der engsten zur weitesten Gruppe wächst das Risiko um Faktor 5
(2,4 → 13 Pips), die Trefferquote auf 15 Pips aber nur um Faktor 1,6 (45 → 73 %). **Die Strecke,
die eine DR läuft, skaliert viel langsamer als ihr Risiko** — ein gutes RR kommt also aus der
Auswahl der DR, nicht aus der Wahl des Ziels. Genau das sollte die Anzeige sichtbar machen.

### Der gedeckelte Stopp repariert die weiten Bänder

Ziel 20 Pips, Erwartungswert ohne und mit 6-Pip-Deckel:

| Band | Stopp = Invalidierung | mit 6-Pip-Deckel |
|---|---|---|
| unter 3 Pips | 33 % · +2,08 R | unberührt |
| 3–5 Pips | 44 % · +1,66 R | unberührt |
| 5–7 Pips | 54 % · +1,38 R | 54 % · +1,44 R |
| 7–10 Pips | 55 % · +0,87 R | 49 % · **+1,14 R** |
| über 10 Pips | 62 % · +0,55 R | 49 % · **+1,13 R** |

Bei über 10 Pips Risiko verdoppelt der Deckel den Erwartungswert: 13 Punkte Trefferquote weniger,
dafür ein so viel besseres RR, dass es sich klar lohnt. Falls die Anzeige je einen Hinweis geben
soll, dann diesen — nicht eine Zielempfehlung.

### Saisonalität bewusst NICHT einbauen

Der Monatsunterschied ist real und groß (März 75 % gegen August 45 % bei 15 Pips), aber er stammt
aus **einem** Jahr. „Der August ist schwach" wäre aus neun Monaten eine Überanpassung — dafür
bräuchte es mehrere Jahre. Und er ist größtenteils Volatilität: in R liegen alle Monate bei 2 R
zwischen 64 und 77 %. Wer die R-Leiter anzeigt, hat den Effekt implizit schon drin.

## Was serverseitig fehlt

Die Messung existiert bisher **nur als Python-Skripte**. Für eine Live-Anzeige braucht es:

1. **Eigene Tabelle** (Vorschlag `dr_reach`): je Dealing Range `reach_pips`, `risk_pips`,
   `invalidated_at_sec`, `measured_until_sec`, dazu die Merkmale für den Schnitt (`ls_timeframe`
   liegt schon auf `trade_setups`, die Gegenkraft-Konstellation muss berechnet werden).
   `trade_setup_outcomes` ist am 20.09.2026 gelöscht worden — der Forward-Walk wird neu
   geschrieben, diesmal direkt gegen Philips Erfolgsdefinition. Vorlage:
   `analysis/dr-reichweite/messeDrReichweite.py`.
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
| **Chart** | waagrechte Ticks bei `nahe OB-Kante ± k · Risiko`, beschriftet mit der Quote. Muster: `FibTickPrimitive` in `marketStructureRendering.ts`, Farben aus `chartColors.js` |
| **`find_targets`** | je Kandidat „historisch erreicht in N von M vergleichbaren DRs" |

Fallstrick bei `find_targets`: das Tool sortiert nach Distanz zum **aktuellen Preis**, die Statistik
hängt aber an der **OB-Kante**. Beim Anreichern gegen die Kante rechnen.

Zweiter Fallstrick, aus der Auswertung: `find_targets`' eigene Kandidatenwahl ist
erwartungswert-neutral (alle Regeln zwischen +1,20 und +1,45 R). Die Anzeige soll also **informieren,
nicht empfehlen** — eine Quote je Kandidat ist nützlich, eine automatische „nimm diesen"-Markierung
wäre durch nichts gedeckt.

## Definitionen (nicht neu herleiten)

- **Dealing Range** = der M5-Orderblock eines *erkannten* Trade-Setups, nicht jeder beliebige M5-OB.
  Path-A- und Path-B-Zeile desselben OB sind eine DR.
- **Referenz für alles** = nahe OB-Kante (`ob_bottom` bei Short, `ob_top` bei Long).
- **Risiko / 1 R** = nahe OB-Kante → Extrem-Fraktal (`fractal_price` der Path-A-Zeile).
- **Invalidierung** = Berührung des Extrem-Fraktals. Nie die OB-Kante.
- **Reichweite** = größte Bewegung in Trade-Richtung vor der Invalidierung. Docht zählt.
- **Start** = `ob_start_time` + 2 M5-Kerzen (600 s).
- **Fenster** = 24 h.

## Reihenfolge

1. **R-Skala im Chart** (Stufe 1, siehe oben) — reines Frontend, kein Server. Der erste Task.
2. Serverseitige Messung: Tabelle, Forward-Walk, Backfill, Fortschreibung in `poi-watcher`.
3. Aggregations-Endpunkt mit beiden Leitern und `n`.
4. Quoten an die R-Marken schreiben (Stufe 2) und beide Leitern als Block im TSC.
5. `find_targets`-Anreicherung.
6. Gegenkraft — zurückgestellt, siehe oben.

## Grenzen, die in die Anzeige gehören

Nur GBPUSD (EURUSD bleibt bewusst ungemessen, Entscheidung Philip 20.09.2026). Neun Monate eines
Jahres. Die Erkennung lief nur im Alarmfenster, abends entstehende Setups fehlen strukturell. Und:
die Quoten sind **historische Häufigkeiten, keine Wahrscheinlichkeiten** — das gehört an die
Anzeige, nicht nur in die Doku.
