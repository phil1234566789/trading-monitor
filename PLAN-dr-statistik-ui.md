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

### Ein zweiter Schnitt ist jetzt auch möglich

| Gruppe | n | 10 P | 15 P | 20 P | 30 P | 2 R |
|---|---|---|---|---|---|---|
| 1H-Sweep | 98 | 93 % | 83 % | 70 % | 53 % | 74 % |
| M5-Sweep, kein lebender Gegner | 525 | 80 % | 64 % | 50 % | 38 % | 74 % |
| M5-Sweep gegen eine lebende M5-Gegen-DR | 216 | 56 % | 44 % | 36 % | 25 % | 64 % |

Diese Dreiteilung ist der informativste verfügbare Schnitt und alle drei Gruppen liegen deutlich
über 50. Sie kombiniert die zwei Merkmale, die sich als wirksam erwiesen haben. **Nicht** nach
Trend schneiden — der 1H-Trend trennt nachweislich nicht (424 zu 427, Bootstrap-Intervall über
null). Sweep-Alter wäre der stärkste Filter überhaupt (Major: 100 % auf 10 Pips), ist aber mit
n=28 unter der Schwelle und mit 3 % aller DRs zu selten für eine eigene Zeile.

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

1. Serverseitige Messung: Tabelle, Forward-Walk, Backfill, Fortschreibung in `poi-watcher`.
2. Aggregations-Endpunkt mit beiden Leitern und `n`.
3. Beide Leitern im TSC, je nach Risiko-Band der laufenden DR.
4. Chart-Ticks und die `find_targets`-Anreicherung.

## Grenzen, die in die Anzeige gehören

Nur GBPUSD (EURUSD bleibt bewusst ungemessen, Entscheidung Philip 20.09.2026). Neun Monate eines
Jahres. Die Erkennung lief nur im Alarmfenster, abends entstehende Setups fehlen strukturell. Und:
die Quoten sind **historische Häufigkeiten, keine Wahrscheinlichkeiten** — das gehört an die
Anzeige, nicht nur in die Doku.
