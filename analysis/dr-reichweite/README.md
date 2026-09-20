# DR-Reichweite — was taugen die erkannten Setups?

Auswertung vom **20.09.2026**, GBPUSD, **855 Dealing Ranges** über **Januar bis September 2026**.
Beantwortet die Frage, die vorher nicht beantwortbar war: welche erkannten Setups taugen — gemessen
an Philips eigener Erfolgsdefinition („Target erreicht, bevor der Invalidierungspunkt erreicht
wird").

Kein Produktionscode. Python-Skripte, die lokal gegen abgelegte JSON-Dateien laufen.

> Die erste Fassung vom 19.09.2026 stand auf 255 DRs aus zwei Monaten (15.07.–16.09.). Diese zwei
> Monate waren, wie sich jetzt zeigt, die beiden schwächsten des Jahres — und **zwei ihrer vier
> Befunde haben die größere Stichprobe nicht überlebt**. Was sich geändert hat, steht unten bei
> jedem Filter.

## Leitkennzahl: Trefferquote, nicht Median

Philip, 20.09.2026: *„mir ist doch egal wie weit die Pipstrecken gehen, ich will am ende 10-20 pips
traden und den Gewinn mitnehmen. Ich will ne gute Winrate von Dealing Ranges."* Ein Median lässt
sich von wenigen sehr weiten Läufen hochziehen und beschreibt damit etwas, das für die Entscheidung
„traden oder nicht" keine Rolle spielt. Alle Haupttabellen stehen deshalb als Trefferquote
(`quotenTabelle.py`), der Reichweiten-Median läuft nur noch als Nebenangabe mit.

| Ziel | 10 P | 15 P | 20 P | 25 P | 30 P | 35 P | 40 P | 1 R | 2 R | 3 R | 4 R | 5 R |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| alle 855 | 76 % | **61 %** | 49 % | 41 % | 36 % | 32 % | 29 % | 90 % | 72 % | 58 % | 46 % | 39 % |

Weitere Eckwerte: Reichweiten-Median 19,5 Pips (p25 10,1 / p75 43,9 / max 241,9), Risiko-Median
5,4 (p25 3,7 / p75 8,1 / p90 10,8 / max 40,1). 617 binnen 24 h invalidiert, 238 nie. Zeit bis zur
Invalidierung: Median 125 Minuten. Short 437 DRs, Long 418 — kein Richtungs-Unterschied.

## Woher die 855 kommen

`trade_setups` beginnt erst am 16.07.2026, weil es die Tabelle vorher nicht gab. M5- und 1H-Kerzen
liegen aber für ganz 2026 lückenlos im Archiv. `backfillTradeSetups.ts` (im MCP-Scripts-Ordner)
spielt deshalb poi-watchers Live-Tick über das Archiv nach: für jede M5-Kerze denselben Zustand
herstellen (300 M5-Kerzen, 3000 1H-Kerzen, `nowTime` am Kerzenschluss) und dieselben zwei
`detectTradeSetup`-Aufrufe absetzen.

Zwei Dinge haben den Lauf sonst verfälscht, beide messbar:

- **poi-watcher läuft nicht rund um die Uhr.** Außerhalb des Alarmfensters steigt der Tick aus,
  bevor er Kerzen holt. Ohne dieselbe Sperre fand die Simulation in einer August-Woche 60 Setups
  gegen 36 live, und alle 12 Extras ab 16:00 UTC lagen in Stunden mit null Live-Zeilen.
- **Die 1H-Level brauchen ihren Touch gegen die M5-Kerzen nachgezogen.** Wartet man auf den
  1H-Schluss, kommt ein Sweep bis zu 60 Minuten zu spät — bei `lsMaxLeadSecH1` von 120 Minuten
  fallen dadurch genau die HTF-Setups raus.

Treue gegen drei Wochen mit echten Live-Zeilen: **108 von 112 Setups reproduziert**, 8 % zusätzliche.

### Warum die Auswertung NICHT auf der DB-Tabelle läuft

Die Tabelle ist seit dem Backfill gemischter Herkunft. Über denselben Zeitraum gerechnet liefern
die beiden Verfahren nicht dasselbe: Live-Zeilen kommen auf einen Reichweiten-Median von 12,9 Pips,
simulierte auf 15,2, bei praktisch gleichem Risiko. Die Einzel-Setups stimmen zu 96 % überein, aber
der Live-Cron verpasst Ticks — und wer ein Setup einen Tick später zuerst sieht, paart es mit einem
anderen bestätigenden OB.

Im Monatsverlauf war diese Naht als Juli-Einbruch sichtbar und hätte fast als Saisonalität
durchgehen können. Deshalb läuft alles auf **einem** Verfahren über alle neun Monate
(`daten-setups-sim.json`). Die DB-Tabelle bleibt unangetastet, sie ist die echte Alarm-Historie.

## Definitionen

- **Dealing Range** = der M5-Orderblock eines *erkannten Trade-Setups* (LQ-Sweep + Fraktal +
  bestätigender M5-OB), **nicht** jeder beliebige M5-OB. Path-A- und Path-B-Zeile desselben OB
  werden zu einer DR zusammengefasst (1233 Zeilen → 915 DRs, davon 855 auswertbar).
- **Referenz für alles**: die nahe OB-Kante (`ob_bottom` bei Short, `ob_top` bei Long).
- **Invalidierung**: Berührung des Extrem-Fraktals. Nie die OB-Kante.
- **Risiko / 1 R**: nahe OB-Kante → Extrem-Fraktal.
- **Reichweite**: größte Bewegung in Trade-Richtung vor der Invalidierung. Docht zählt.
- **Start**: `ob_start_time` + 2 M5-Kerzen (600 s). `ob_start_time` ist die Impuls-Kerze; die FVG
  ist erst mit dem Schluss der übernächsten Kerze sichtbar — der früheste Zeitpunkt, zu dem die DR
  live erkennbar war.
- **Fenster**: 24 h.

## Skripte

| Datei | Zweck |
|---|---|
| `zieheDaten.py` | holt Setups, Kerzen und LQ-Level aus Supabase in diesen Ordner |
| `drMerkmale.py` | gemeinsame Merkmale und Datenpfade, alle anderen importieren von hier |
| `messeDrReichweite.py` | Grundmessung, schreibt `punkt1_result.json` |
| `quotenTabelle.py` | **Haupttabelle**: Trefferquote je Merkmal, 10–40 Pips und 1–5 R |
| `saisonalitaet.py` | Monatsvergleich |
| `filterHtfSweep.py` · `filterGegenkraft.py` · `filterAlterUndHandelszeit.py` | die einzelnen Filter |
| `leiterPipsVsR.py` | Wahrscheinlichkeit je Strecke, Pips gegen R |
| `deckelStopp.py` | Risiko-Verteilung und was ein gedeckelter Stopp kostet |
| `messeFindTargets.py` | ruft den echten `find_targets` je DR auf und wertet ihn aus |
| `messeTrendJeDr.py` · `filterTrend.py` | 1H-Trend je DR und die Auswertung darauf |
| `winrate.py` | Winrate je Ziel-Regel und Qualitätsstufe |

Die `ergebnis-*.txt` sind die abgelegten Ausgaben. Die `daten-*.json` sind Rohdaten und bleiben per
`.gitignore` draußen — reproduzierbar sind die Skripte, nicht der Datenstand.

## Saisonalität — der bestbelegte Befund

| Monat | n | 10 P | 15 P | 20 P | 30 P | 40 P | 2 R | 3 R |
|---|---|---|---|---|---|---|---|---|
| Januar | 98 | 85 % | 66 % | 47 % | 37 % | 30 % | 77 % | 59 % |
| Februar | 88 | 76 % | 68 % | 62 % | 44 % | 36 % | 73 % | 61 % |
| **März** | 81 | **85 %** | **75 %** | **64 %** | 51 % | 38 % | 72 % | 64 % |
| April | 97 | 77 % | 65 % | 57 % | 38 % | 34 % | 73 % | 58 % |
| Mai | 93 | 80 % | 62 % | 47 % | 33 % | 28 % | 73 % | 55 % |
| Juni | 109 | 80 % | 61 % | 44 % | 37 % | 33 % | 72 % | 64 % |
| Juli | 107 | 69 % | 54 % | 45 % | 38 % | 24 % | 68 % | 58 % |
| **August** | 121 | **64 %** | **45 %** | **37 %** | 22 % | 17 % | 70 % | 50 % |
| September | 61 | 67 % | 52 % | 39 % | 28 % | 21 % | 69 % | 48 % |

Halbjahre: Januar–Juni 80 / 66 / 53 % bei 10 / 15 / 20 Pips, Juli–September 66 / 50 / 40 %.

Bootstrap März gegen August: bei 15 Pips **30 Punkte, 95 %-Intervall [17, 43]**. Bei 10, 20, 25,
30, 35 und 40 Pips ebenso — **kein einziges Intervall enthält die Null**. Halbjahr gegen Halbjahr:
16 Punkte bei 15 Pips, Intervall [9, 23].

**Aber es ist zum großen Teil Volatilität.** In R gerechnet liegen alle neun Monate bei 1 R zwischen
84 und 96 %, bei 2 R zwischen 64 und 77 %. Erst ab 3 R öffnet sich wieder eine Lücke. Das Risiko
wandert nämlich mit: Median 7,4 Pips im März, 4,1 im August — eine März-DR ist fast doppelt so weit
aufgespannt.

**Praktisch:** mit festem 15-Pip-Ziel ist der August deutlich schlechter. Skaliert man das Ziel am
Risiko der jeweiligen DR, ist er fast genauso gut. Das feste Pip-Ziel erzeugt die Saisonalität,
nicht die Setup-Qualität.

## Die Filter

### Sweep-Herkunft — der stärkste, und er hält

| | n | 10 P | 15 P | 20 P | 30 P | 2 R | 3 R |
|---|---|---|---|---|---|---|---|
| 1H-Sweep | 98 | 93 % | **83 %** | 70 % | 53 % | 74 % | 64 % |
| M5-Sweep | 757 | 73 % | 58 % | 46 % | 34 % | 72 % | 57 % |

Erste Fassung: n=25 plus eine Restgruppe „unklar", weil die Herkunft nachträglich geschätzt werden
musste. Jetzt steht sie exakt in `trade_setups.ls_timeframe` — die Gruppe „unklar" gibt es nicht
mehr. In R sind die beiden Gruppen fast gleich (74 gegen 72 % bei 2 R), der Vorteil ist also auch
hier zum guten Teil Volatilität.

### Sweep-Alter — der größte Effekt

| Klasse | n | 10 P | 15 P | 20 P | 30 P | 2 R | 3 R |
|---|---|---|---|---|---|---|---|
| Major (≥ 120 h) | 28 | **100 %** | 93 % | 82 % | 61 % | 89 % | 79 % |
| Medium (24–120 h) | 45 | 87 % | 78 % | 64 % | 49 % | 69 % | 60 % |
| Minor (< 24 h) | 782 | 74 % | 59 % | 47 % | 35 % | 71 % | 57 % |

Alle 28 Major-DRs erreichten 10 Pips. Anders als bei der Herkunft hält der Vorsprung **auch in R**
(89 gegen 71 % bei 2 R) — das ist echte Qualität, keine Volatilität. Nur selten: rund 3 % aller
Dealing Ranges. In der ersten Fassung stand das auf n=8 und n=10.

### Gegenkraft — teilweise gekippt

| Konstellation | n | 10 P | 15 P | 20 P | 30 P | 2 R |
|---|---|---|---|---|---|---|
| keine lebende Gegen-DR | 614 | 82 % | 66 % | 53 % | 40 % | 75 % |
| **beide M5** | 216 | **56 %** | **44 %** | 36 % | 25 % | 64 % |
| ich M5, Gegner HTF | 16 | 88 % | 56 % | 38 % | 25 % | 75 % |
| ich HTF, Gegner M5 | 9 | 78 % | 78 % | 67 % | 56 % | 67 % |

In der ersten Fassung war „ich M5, Gegner HTF" mit 7,4 Pips Median der klar schlechteste Fall
(n=30) — **das reproduziert sich nicht**. Belegt ist jetzt stattdessen der Fall **beide M5**: 216
Ranges, über die ganze Reihe 20 bis 26 Punkte schlechter als ohne Gegner. Die beiden HTF-Zeilen
sind mit n=9 und n=16 zu dünn für eine Aussage.

### Handelszeit — als Fenster tot, als Stunde lebendig

| | n | 10 P | 15 P | 20 P | 2 R | 3 R |
|---|---|---|---|---|---|---|
| im Fenster 08:00–18:00 | 630 | 76 % | 60 % | 49 % | 69 % | 53 % |
| außerhalb | 225 | 76 % | 61 % | 49 % | 81 % | 69 % |

Die erste Fassung hatte hier 16,4 gegen 7,1 Pips Median auf 176 zu 79 Ranges — und darauf wurde am
19.09. das Alarmfenster von 07:00 auf 08:00 gezogen (Migration `20260919141000`). **Mit 855 Ranges
ist von dem Unterschied nichts übrig.** Die Änderung schadet nicht, ihre Begründung trägt aber
nicht mehr.

Nach *Stunde* gibt es den Effekt sehr wohl — nur trennt das Fenster ihn nicht: Reichweiten-Median
33,8 um 17:00 und 28,7 um 16:00 (NY) gegen 13,3 um 07:00 und 14,6 um 12:00. Das Fenster 08–18
enthält die besten und die schlechtesten Stunden gleichzeitig.

## Enge der DR — warum beide Einheiten nötig sind

Dieselben 855 Ranges, nach eigenem Risiko in drei gleich große Gruppen geteilt:

| Gruppe | n | 10 P | 15 P | 20 P | 30 P | 1 R | 2 R | 3 R | 5 R |
|---|---|---|---|---|---|---|---|---|---|
| eng (bis 4,2 P) | 285 | 67 % | 49 % | 38 % | 26 % | **97 %** | **82 %** | **70 %** | **50 %** |
| mittel (bis 7,0 P) | 285 | 80 % | 63 % | 51 % | 38 % | 94 % | 77 % | 59 % | 41 % |
| weit (ab 7,0 P) | 285 | **80 %** | **70 %** | **58 %** | **44 %** | 78 % | 56 % | 44 % | 27 % |

**Links und rechts drehen die Reihenfolge um, und beides stimmt.** Eine enge Range erreicht selten
30 Pips, aber fast immer 1 R. Eine weite schafft die Pips leichter, tut sich mit ihrem eigenen
Vielfachen aber schwer. Eine Anzeige an der laufenden DR braucht deshalb beide Leitern — siehe
`PLAN-dr-statistik-ui.md` im Repo-Wurzelverzeichnis.

## Risiko-Verteilung und der gedeckelte Stopp

| Risiko | n | Anteil | kumuliert |
|---|---|---|---|
| unter 3 Pips | 136 | 15,9 % | 15,9 % |
| 3–5 Pips | 247 | 28,9 % | 44,8 % |
| 5–7 Pips | 184 | 21,5 % | 66,3 % |
| 7–10 Pips | 174 | 20,4 % | 86,7 % |
| über 10 Pips | 114 | 13,3 % | 100 % |

**42 % aller Ranges tragen mehr als 6 Pips Risiko.** Philips Vorschlag, den Stopp dort zu deckeln,
hält — gerechnet als reine Pfadfrage ohne Entry-Modell, Ziel 15 Pips, nur die betroffene Gruppe:

| Deckel | betroffen | Gewinner vorher → mit Deckel | gekostet | RR | EV |
|---|---|---|---|---|---|
| 6 Pips | 361 | 252 → 232 | 20 | 1,72 → 2,50 | +0,89 → **+1,26 R** |
| 7 Pips | 288 | 200 → 184 | 16 | 1,61 → 2,14 | +0,76 → +1,01 R |

Bei 6 Pips kostet der Deckel 8 % der Gewinner und hebt den Erwartungswert deutlich.

## find_targets

6810 Kandidaten. Das Angebot stimmt: 855 von 855 DRs bekamen eine volle Liste, genau **einer** von
6810 Kandidaten lag hinter der nahen OB-Kante.

| Regel | Quote | Distanz | EV |
|---|---|---|---|
| nächster Kandidat | 73 % | 10,4 | +1,33 R |
| nächster OB-Kandidat | 66 % | 13,5 | +1,40 R |
| nächster ≥ 15 Pips | 51 % | 17,9 | +1,43 R |
| nächster mit RR ≥ 3 | 50 % | 20,0 | +1,45 R |
| weitester ohne `tooFar` | 29 % | 41,1 | +1,20 R |

Alle Regeln zwischen +1,20 und +1,45 R; Bootstrap für die beste: +0,10 R, Intervall [−0,03, +0,24].
**An der Zielwahl innerhalb der Liste ist kaum etwas zu holen** — dasselbe Ergebnis wie auf der
kleinen Stichprobe, nur schärfer. Das `tooFar`-Flag trennt weiter (11 % gegen 48 % Trefferquote),
aber weniger brutal als die 2 gegen 42 % der ersten Fassung.

## Trendlage — kein Unterschied, gesichert

| | n | 10 P | 15 P | 20 P | 30 P | 2 R | 3 R |
|---|---|---|---|---|---|---|---|
| mit dem Trend | 424 | 74 % | 60 % | 49 % | 36 % | 68 % | 55 % |
| gegen den Trend | 427 | 78 % | 61 % | 48 % | 36 % | 76 % | 60 % |

Der 1H-Strukturtrend trennt gute nicht von schlechten Dealing Ranges. Bootstrap: Differenz
**+0,5 Pips, 95 %-Intervall [−3,3, +4,4]**; jede EV-Differenz der Ziel-Regeln liegt bei null. Die
Aufteilung ist mit 424 zu 427 nahezu hälftig — die Erkennung hat keinen Richtungs-Bias.

Drei Gegenproben wie schon auf der kleinen Stichprobe: der innere Trend (`nestedTrend`, n=407)
zeigt eher das umgekehrte Vorzeichen (19,2 mit gegen 23,7 gegen), ein längeres Fenster (72 h,
7 Tage) ändert exakt nichts, und in den Halbjahren dreht das Vorzeichen.

Gemessen ist **eine** Trend-Definition: der 1H-Algo mit Daily-Pivot-Anker, der sich nur alle ein
bis drei Wochen bewegt. Der M5-Trend ist damit nicht gemessen.

## Grenzen

Nur GBPUSD, EURUSD ist ungemessen. Neun Monate **eines** Jahres — dass dieser August schwach war,
heißt nicht, dass jeder August schwach ist. Die Erkennung lief nur im Alarmfenster (07:00–17:45
Berlin), abends entstehende Setups kommen strukturell nicht vor. 24-Stunden-Fenster, Docht zählt;
wer kurz vor Handelsschluss entsteht, hat ein kürzeres Fenster. Und: die Quoten sind **historische
Häufigkeiten, keine Wahrscheinlichkeiten**.

Eine lesbare Aufbereitung aller Zahlen liegt als Artefakt vor (Link im Chat vom 20.09.2026).
