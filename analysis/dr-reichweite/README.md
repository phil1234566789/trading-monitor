# DR-Reichweite — Grundmessung + Filter-Auswertungen

Einmalige Auswertung vom 19.09.2026, GBPUSD, 15.07.–16.09.2026. Beantwortet die Frage, die vorher
nicht beantwortbar war: **welche erkannten Setups taugen** — gemessen an Philips eigener
Erfolgsdefinition („Target erreicht, bevor der Invalidierungspunkt erreicht wird").

Kein Produktionscode. Die Skripte laufen lokal mit Python gegen JSON-Dateien, die vorher über die
`trading-monitor`-MCP-Tools gezogen wurden.

## Datenquellen (vor dem Lauf ziehen)

Die drei Eingabedateien entstehen aus diesen MCP-Aufrufen; ihre Pfade stehen oben in jedem Skript
und müssen auf die tatsächlichen Ablageorte angepasst werden:

| Datei | Aufruf |
|---|---|
| Setups | `get_trade_setups(instrument="GBPUSD", limit=400)` |
| M5-Kerzen | `get_forex_candles_archive(instrument="GBPUSD", timeframe="5m", fromTime="2026-07-15", toTime="2026-09-19", limit=20000)` |
| LQ-Level | `get_near_relevant_liquidity_levels(instrument="GBPUSD", fromSec=1784073600, toSec=1789603200)` |

Zwei weitere Eingaben holen sich ihre Skripte selbst über den MCP und legen sie im Ordner ab:
`find-targets-roh.jsonl.gz` (`messeFindTargets.py sammeln`) und `trend-je-dr.json`
(`messeTrendJeDr.py`). Beide brauchen `TRADING_MONITOR_MCP_TOKEN` in der Umgebung.

## Definitionen

Eine **Dealing Range = ein M5-OB.** Path-A- und Path-B-Zeile desselben OB werden zusammengefasst
(336 Setup-Zeilen → 268 DRs). Die Invalidierung kommt immer aus der Path-A-Zeile — bei Path B steht
in `fractal_price` das gesweepte Level statt des Extrem-Fraktals und ist als Invalidierung
unbrauchbar.

- **Invalidierung**: Berührung des Extrem-Fraktals (`fractal_price` der Path-A-Zeile). Entscheidung
  Philip, 19.09.2026: gilt für die Dealing Range immer das Extrem-Fraktal, nie die OB-Kante — der
  reale Stop-Loss bei der Ausführung ist davon unabhängig.
- **Reichweite**: größte Bewegung in Trade-Richtung vor der Invalidierung, gemessen ab der **nahen
  OB-Kante** (`ob_bottom` bei Short, `ob_top` bei Long).
- **Startzeitpunkt**: `ob_start_time` + 2 M5-Kerzen — vorher ist die FVG nicht bestätigt, die DR
  existiert also noch nicht.
- **Fenster**: 24 h.

## Skripte

| Datei | Zweck |
|---|---|
| `messeDrReichweite.py` | Grundmessung, schreibt `punkt1_result.json` (255 DRs) |
| `filterHtfSweep.py` | Filter 1: HTF-Sweep (1H/4H) vs. M5-Sweep |
| `filterGegenkraft.py` | Filter 2: lebende Gegen-DR, als Paarvergleich nach Sweep-Stärke |
| `filterAlterUndHandelszeit.py` | Filter 3+4: Inducement-Klasse und Handelszeit/Tageszeit |
| `messeFindTargets.py` | `find_targets` gegen dieselbe Messung, siehe unten |
| `messeTrendJeDr.py` | holt den 1H-Trend je DR, schreibt `trend-je-dr.json` |
| `filterTrend.py` | legt die Trendlage über alles Obige, siehe unten |
| `winrate.py` | Winrate je Ziel-Regel und Qualitätsstufe, siehe unten |
| `leiterPipsVsR.py` | Wahrscheinlichkeit je Strecke, Pips gegen R, siehe unten |
| `drMerkmale.py` | gemeinsame Merkmale (Sweep-Herkunft, Alter, Handelsstunde, Trendlage) |

Die `ergebnis-*.txt` sind die abgelegten Ausgaben dieser Läufe.

Sweep-Herkunft und Sweep-Alter lagen anfangs in drei Skripten in je eigenen Kopien; seit der
Trend-Auswertung stehen sie einmal in `drMerkmale.py`, die Filter-Skripte importieren von dort.
Dass die Extraktion nichts verschoben hat, ist geprüft: alle vier Skripte erzeugen ihre abgelegte
`ergebnis-*.txt` weiterhin zeichengleich.

`messeFindTargets.py` ist das einzige Skript, das selbst Daten zieht: es ruft den **echten deployten
`find_targets`** über den trading-monitor-MCP auf (255 sequentielle Aufrufe, ~7 Minuten, braucht
`TRADING_MONITOR_MCP_TOKEN`) und legt die Antworten in `find-targets-roh.jsonl.gz` ab. Ohne
Argument wertet es nur diese Datei aus, mit `sammeln` holt es fehlende Antworten nach. Eine
Python-Nachbildung des Algorithmus wäre hier wertlos gewesen — sie hätte den Kandidaten-Pool (M5
live + HTF aus der DB, `touched`-Nachprüfung, Dedup) zwangsläufig anders getroffen als die
Produktion.

## Basis

255 Dealing Ranges. Reichweite Median **12,5 Pips** (p25 6,5 / p75 29,6 / max 108). 188 binnen
24 h invalidiert, 67 nie. Zeit bis Invalidierung Median 102 Min. Abstand nahe OB-Kante →
Extrem-Fraktal Median 4,3 Pips.

Damit ist Philips Erfolgsdefinition für jedes Target rückwirkend beantwortbar: ≥10 Pips erreicht
in 155 von 255 Fällen, ≥15 in 117, ≥20 in 90, ≥30 in 61.

## Rangfolge der vier Filter

Sortiert nach **Belegstärke**, nicht nach Effektgröße — der größte Median steht auf der kleinsten
Stichprobe.

### 1. Handelszeit — größter Effekt, größte Stichprobe

| | n | Median | ≥20 P |
|---|---|---|---|
| im Fenster 08:00–18:00 | 176 | 16,4 | 72 |
| außerhalb | 79 | 7,1 | 18 |

Beste Stunden (Berlin, OB-Entstehung): 16:00 → 27,2 und 15:00 → 23,4 (NY). Schlechteste: 07:00 →
4,9 und 05:00 → 5,1. MMM-Fenster 10:30–13:00: 13,9 gegen 17,8 im übrigen Handelsfenster — die
Notiz „nur mit zusätzlichen Bestätigungen" in `trading_schedules` bestätigt sich, aber schwächer
als der Handelszeit-Effekt selbst.

**Direkt umgesetzt:** 26 Alarme gingen außerhalb des Handelsfensters raus (Median 5,5 Pips, nur 4
davon erreichten 20 Pips). Ursache: `alarm_windows` begann um 07:00, `trading_windows` erst um
08:00. Korrigiert in Migration `20260919141000_gbpusd_alarm_window_0800.sql`.

### 2. Gegenkraft — Paarvergleich nach Sweep-Stärke

41 % der DRs entstehen gegen eine noch lebende Gegen-DR („lebend" = früher entstanden, weder
invalidiert noch am Ziel).

| Konstellation | n | Median |
|---|---|---|
| keine lebende Gegen-DR | 151 | 14,8 |
| ich HTF, Gegner M5 | 12 | 16,1 |
| beide HTF | 7 | 12,0 |
| beide M5 | 55 | 10,8 |
| ich M5, Gegner HTF | 30 | 7,4 |

Die Rangfolge kippt über alle vier gerechneten Varianten (Stärke strikt/breit × „fertig" bei
15/20/25 Pips) kein einziges Mal. Belastbar ist vor allem der schlechte Fall (n=30 gegen n=151),
nicht die Spitze (nie mehr als n=14).

Nebenbei beantwortet: Zeile 2 und Zeile 5 sind dasselbe Paar aus beiden Blickrichtungen — 16,1
gegen 7,4. Die stärkere Seite war die richtige Wahl, nicht die zuerst entstandene.

### 3. HTF-Sweep

| | n | Median |
|---|---|---|
| HTF sicher (1H/4H) | 25 | 28,7 |
| unklar | 31 | 17,5 |
| M5 | 199 | 11,3 |

„Unklar" = `ls_pivot_time` liegt auf einer vollen Stunde, aber keines der HTF-Merkmale greift.
Enthält echte M5-Pivots (rund jeder zwölfte) und 1H-Level, deren Zeile in `liquidity_levels` nicht
mehr existiert. Über die Minutenverteilung geschätzt liegt die echte HTF-Zahl bei ~38 von 255.

### 4. Sweep-Alter — höchster Median, kleinste Stichprobe

| | n | Median |
|---|---|---|
| Major (≥120 h) | 8 | 29,2 |
| Medium (24–120 h) | 10 | 29,3 |
| Minor (<24 h) | 237 | 11,9 |

Major und Medium sind **nicht unterscheidbar**. Die nützliche Trennung ist binär: Sweep-Level
älter als 24 h — ja/nein. Das Alter wirkt zusätzlich zur Herkunft: innerhalb der HTF-Gruppe kommen
die gealterten auf 28,7 bzw. 29,3, die frischen nur auf 17,5. Praktisch selten: 90 % aller Sweeps
sind jünger als 19 Stunden (Median 1,8 h).

## find_targets: taugen die vorgeschlagenen Ziele?

Zu jeder der 255 DRs wurde `find_targets` zum DR-Startzeitpunkt (`ob_start_time` + 2 M5-Kerzen) mit
der DR-Richtung aufgerufen und jeder gelieferte Kandidat auf die **nahe OB-Kante** umgerechnet —
dieselbe Referenz wie die Reichweite. Erreicht heißt: Reichweite ≥ Distanz, also vor der
Invalidierung berührt.

### Das Angebot stimmt

255 von 255 DRs bekamen eine volle Liste (5 Liquiditäts-Kandidaten + 3 OB-Kanten, 2021 insgesamt).
Kein einziger leerer Fall, und nur **1 von 2021** Kandidaten lag hinter der nahen OB-Kante und wäre
als Ziel wertlos gewesen. Die Kandidatensuche selbst ist also nicht das Problem.

### Trefferquote je Rang

| | n | erreicht | Distanz-Median | RR-Median |
|---|---|---|---|---|
| OB #1 | 255 | 65 % | 8,6 | 2,10 |
| LQ #1 | 255 | 55 % | 10,8 | 2,41 |
| OB #2 | 255 | 46 % | 14,4 | 3,35 |
| LQ #2 | 253 | 39 % | 16,1 | 3,89 |
| OB #3 | 255 | 36 % | 20,7 | 4,69 |
| LQ #3 | 251 | 27 % | 22,1 | 5,31 |
| LQ #4 | 250 | 24 % | 28,7 | 6,61 |
| LQ #5 | 247 | 19 % | 36,3 | 8,46 |

Bei **70 %** der DRs wurde mindestens ein angebotener Kandidat erreicht. Weil die Liste nach
Distanz sortiert ist, ist das gleichzeitig die Trefferquote des nächsten Kandidaten und die
Obergrenze für jede Auswahlregel.

### Die Auswahl ist erwartungswert-neutral

R-Rechnung der **Idee**, nicht einer Ausführung: Referenz ist die nahe OB-Kante, Risiko der Weg von
dort zum Extrem-Fraktal, RR bei 10 gedeckelt. Ein nicht erreichtes Ziel zählt nur als −1 R, wenn
die DR binnen 24 h auch wirklich invalidiert wurde.

| Regel | n | Quote | Distanz-Median | EV |
|---|---|---|---|---|
| nächster OB-Kandidat | 255 | 66 % | 8,6 | +1,15 R |
| nächster Kandidat (Status quo) | 255 | 70 % | 7,0 | +1,05 R |
| nächster mit ≥ 15 Pips | 248 | 43 % | 17,7 | +1,18 R |
| nächster mit RR ≥ 2 | 252 | 52 % | 11,7 | +1,04 R |
| nächster mit ≥ 20 Pips | 235 | 32 % | 23,4 | +0,87 R |
| weitester ohne `tooFar` | 255 | 21 % | 34,9 | +0,60 R |

Alle brauchbaren Regeln liegen zwischen +0,99 und +1,18 R. Der gepaarte Bootstrap (5000 Ziehungen)
sagt zur besten davon: +0,13 R gegenüber „nächster", 95 %-Intervall **[−0,16, +0,43]** — der
Unterschied ist von Rauschen nicht zu trennen. Näher heißt öfter getroffen bei schlechterem RR,
weiter heißt seltener bei besserem, und beides gleicht sich fast exakt aus.

**Das ist die eigentliche Antwort:** an der Ziel-*auswahl* innerhalb der angebotenen Liste ist kein
Vorteil zu holen. Nur die Extremvariante (immer das weiteste noch erlaubte Ziel) verliert deutlich.

### Zwei Nebenbefunde

`tooFar` (> 50 Pips zum aktuellen Preis) trennt sauber: 3 von 132 markierten Kandidaten wurden
erreicht (2 %) gegen 789 von 1889 unmarkierten (42 %). Die Konstante `MAX_TARGET_DISTANCE_PIPS`
sitzt richtig, an ihr ist nichts zu ändern.

Die Handelszeit wirkt auch hier, und zwar auf die zulässige Ziel-Weite:

| | nächster | ≥ 15 Pips | ≥ 25 Pips |
|---|---|---|---|
| im Fenster 08:00–18:00 (n=176) | +1,13 R | +1,32 R | +1,02 R |
| außerhalb (n=79) | +0,88 R | +0,87 R | +0,01 R |

Außerhalb des Handelsfensters bricht das ambitionierte Ziel zusammen, im Fenster trägt es. Das ist
derselbe Effekt wie bei Filter 1, hier nur von der Ziel-Seite gesehen.

### Gegenprobe

Die Grundmessung nimmt den Docht der invalidierenden Kerze noch in die Reichweite auf; liegen Ziel
und Invalidierung in derselben M5-Kerze, gilt das Ziel als erreicht — `trade_setup_outcomes` wertet
denselben Fall als Verlust. Betroffen sind **6 von 255** DRs, der EV der Status-quo-Regel fällt
dadurch von +1,05 auf +1,01 R. Der Unterschied trägt keine der Aussagen oben.

## Winrate

Nach Philips Definition — Target erreicht, bevor der Invalidierungspunkt erreicht wird. Daraus
folgt sofort: **die** Winrate gibt es nicht, sie hängt am gesetzten Ziel. Deshalb steht hier nie
eine Quote ohne ihr RR (`winrate.py`, Ausgabe in `ergebnis-winrate.txt`).

| Ziel | alle 255 | im Fenster 08–18 (176) | + keine Gegen-DR (102) | + HTF-Sweep (30) |
|---|---|---|---|---|
| nächster Kandidat | 70 % @ RR 1,7 | 74 % @ 1,5 | 74 % @ 1,7 | 70 % @ 1,7 |
| ≥10 Pips | 49 % @ 3,0 | 55 % @ 2,5 | 57 % @ 2,4 | 60 % @ 2,2 |
| ≥15 Pips | 43 % @ 4,3 | 49 % @ 3,8 | 51 % @ 3,6 | 60 % @ 3,4 |
| ≥20 Pips | 32 % @ 5,5 | 38 % @ 4,6 | 38 % @ 4,4 | 47 % @ 4,2 |
| ≥30 Pips | 23 % @ 8,3 | 28 % @ 6,7 | 26 % @ 6,2 | 16 % @ 7,0 |

Gezählt werden nur **entschiedene** Dealing Ranges (Ziel erreicht oder invalidiert); eine DR, die
binnen 24 h weder das eine noch das andere getan hat, gehört in keine Quote. Die Filter stapeln in
der Reihenfolge ihrer Belegstärke, die letzte Spalte ist mit n=30 ein Ausblick, kein Ergebnis.

**Nicht zu verwechseln mit `get_trade_setup_winrate`** (50 %, 167:169 auf 336 Zeilen). Das Tool
rechnet je *Setup-Zeile* gegen ein festes 2,5-RR-Ziel mit bei 6 Pips gedeckeltem Stopp, zählt also
die Path-A/B-Zwillinge doppelt und benutzt eine andere Erfolgsdefinition. Beide Zahlen stimmen, sie
beantworten verschiedene Fragen.

## Wahrscheinlichkeit je Strecke — Pips oder R?

Vorarbeit für eine Anzeige in der UI (`leiterPipsVsR.py`, Ausgabe `ergebnis-leiter.txt`): Wie oft
wurde eine gegebene Strecke erreicht, bevor die DR invalidierte?

| | 1 R | 2 R | 3 R | 4 R | 5 R | 8 R |
|---|---|---|---|---|---|---|
| alle 255 DRs | 87 % | 65 % | 48 % | 38 % | 32 % | 16 % |

| | 5 P | 10 P | 15 P | 20 P | 25 P | 30 P | 40 P |
|---|---|---|---|---|---|---|---|
| alle 255 DRs | 80 % | 61 % | 46 % | 35 % | 29 % | 24 % | 17 % |

**Die Einheit entscheidet.** Über Risiko-Terzile gerechnet läuft die Pip-Leiter weit auseinander —
„≥15 Pips" trifft bei den DRs mit kleinem Risiko (Median 2,6 P) nur 27 %, bei denen mit großem
(7,3 P) aber 61 %. In R ist dieselbe Spreizung deutlich kleiner: mittlere Spannweite 13 Punkte
gegen 28. Eine **einzelne Pip-Leiter für alle Dealing Ranges wäre also irreführend**, eine R-Leiter
ist vertretbar.

Nebenbefund, der der Intuition widerspricht: die DRs mit dem kleinsten Risiko erreichen die
wenigsten Pips, sind aber in R die besten (91/68/49 % bei 1/2/3 R gegen 75/55/44 % bei großem
Risiko). Eine enge Dealing Range ist das bessere Geschäft, nicht das schlechtere.

## Trendlage: kein messbarer Unterschied

Nachgezogen am 19.09.2026, weil die Grundmessung und alle vier Filter den Trend gar nicht kannten
— ihre Zahlen waren Mittelwerte über eine ungetrennte Mischung. Gemessen wird der **1H-Market-
Structure-Trend zum DR-Startzeitpunkt** (`get_data_export`, `structure1h.trend`); „mit dem Trend"
heißt Uptrend + Long bzw. Downtrend + Short.

Möglich wurde das erst durch Commit `740375f`: `get_data_export` starb für jeden Replay-Zeitpunkt,
der weiter zurück lag als der neueste Daily-Pivot, an `cTrader error INVALID_REQUEST: Count must be
bigger than ZERO`. Alle 255 Abfragen laufen seitdem fehlerfrei.

| | n | Median | p75 | nie invalidiert | ≥20 P |
|---|---|---|---|---|---|
| mit dem Trend | 123 | 12,5 | 28,9 | 30 | 44 |
| gegen den Trend | 132 | 13,1 | 29,7 | 37 | 46 |

Bootstrap über 5000 Ziehungen: Differenz **0,0 Pips**, 95 %-Intervall [−5,4, +5,7], „mit dem Trend"
größer in genau 50 % der Ziehungen. Die Hälften des Zeitraums drehen das Vorzeichen (12,7 vs. 11,7
in der ersten, 12,2 vs. 14,7 in der zweiten). Auch Invalidierungsquote und Zeit bis zur
Invalidierung (105 gegen 100 Minuten) unterscheiden sich nicht.

Kein Filter wird durch die Trennung schärfer, und bei den find_targets-Regeln liegt jeder
Unterschied im Rauschen — die auffälligste Zahl (ambitioniertes Ziel ≥25 Pips: +0,95 R gegen den
Trend, +0,44 R mit ihm) hat ein 95 %-Intervall von [−0,36, +1,32].

Drei Gegenproben, bevor daraus ein Befund wird:

- **Innerer Trend** (`nestedTrend`, wo vorhanden, n=94): 11,2 mit gegen 15,0 gegen — wenn
  überhaupt, das umgekehrte Vorzeichen.
- **Längeres Fenster**, falls ein Trade mit dem Trend nur mehr Zeit braucht: bei 72 Stunden und bei
  7 Tagen steht der Median „mit dem Trend" unverändert bei 12,5.
- **Richtungs-Bias der Erkennung**: keiner. Im Uptrend entstehen 81 Short- und 76 Long-DRs, im
  Downtrend 47 zu 51.

**Was das heißt und was nicht.** In diesen Daten trennt der 1H-Strukturtrend gute nicht von
schlechten Dealing Ranges — anders als Handelszeit, Gegenkraft und Sweep-Herkunft, die alle einen
Effekt zeigen. Das ist keine Aussage über „Trend" allgemein: gemessen ist **eine bestimmte
Definition** davon, der 1H-Algo mit Daily-Pivot-Anker, der sich nur alle ein bis drei Wochen
bewegt. Der M5-Trend (Task `10-10-nur-im-m5-trend`) ist damit nicht gemessen, und eine Dealing
Range entsteht per Konstruktion nach einem Liquidity Sweep, also häufig gegen die laufende
Bewegung — die Trendlage beschreibt ihren Kontext vielleicht einfach schlecht.

## Was daraus gebaut wurde

`poi-watcher` schreibt die Sweep-Herkunft seit dem 19.09.2026 direkt beim Erkennen mit
(`trade_setups.ls_timeframe`, Migration `20260919140000`) — die Rekonstruktion aus
`liquidity_levels` war nur eine Näherung und fällt damit weg. Herkunft, Alter und eine Warnung bei
lebender Gegen-DR stehen seitdem im Telegram-Alarmtext.

Bewusst **kein Filter**: bei n=25–56 in den interessanten Gruppen ist Markieren reversibel,
Wegwerfen nicht.

## Grenzen

Nur GBPUSD, zwei Monate. Die HTF-Klassifikation ist eine Untergrenze: `liquidity_levels` führt nur
1H/4H, aber ältere Zeilen fehlen dort (6 Juli-Fälle nachweislich). Die breite Variante zählt
zusätzlich jeden `ls_pivot` auf voller Stunde als HTF und labelt damit rund 18 echte M5-Fälle
falsch — das verwässert das Gefälle, erzeugt es aber nicht. Die gut besetzten Aussagen sind
belastbar (n=151 bzw. n=30), die Spitzenwerte nicht (nie mehr als n=14).

**Die vier Filter wurden nur einzeln ausgewertet, nie kombiniert.** Sie überlappen sich mit
Sicherheit — HTF-Sweeps sind vermutlich öfter gealtert, NY-Stunden öfter ohne Gegen-DR. Die
Einzeleffekte stehen, ihre Summe nicht. Eine kombinierte Auswertung scheitert an den Stichproben:
die Töpfe werden sofort zu klein.

Das 24-Stunden-Fenster untertreibt eher: bei 67 DRs wurde die Invalidierung darin nie getroffen,
deren Reichweite ist also nach unten begrenzt gemessen. Reichweite wird per Docht gemessen, ein
Target gilt also als erreicht, sobald es berührt wurde.

Für die find_targets-Auswertung kommen zwei Grenzen dazu. Erstens baut der Kandidaten-Pool auf dem
**heutigen** Stand von `liquidity_levels`/`ob_zones` auf (as-of auf den DR-Zeitpunkt gefiltert, aber
seither gelöschte Zeilen fehlen) — dieselbe Einschränkung wie bei Filter 1. Zweitens ist das R die
R der Idee: Einstieg an der nahen OB-Kante, Stopp am Extrem-Fraktal. Philip führt selbst aus, sein
realer Entry liegt woanders — die EV-Zahlen vergleichen die Regeln miteinander, sie sagen nicht
voraus, was ein echter Trade abwirft.
