# DR-Reichweite — was taugen die erkannten Setups?

Auswertung vom **20.09.2026**, GBPUSD, **915 Dealing Ranges** über **Januar bis September 2026**.
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

| Ziel | 10 P | 15 P | 20 P | 25 P | 30 P | 35 P | 40 P | 2 R | 3 R | 4 R | 5 R | 6 R |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| alle 915 | 74 % | **59 %** | 47 % | 40 % | 35 % | 31 % | 28 % | 70 % | 55 % | 44 % | 37 % | 31 % |

Weitere Eckwerte: Reichweiten-Median 18,6 Pips (p25 9,7 / p75 43,2 / max 241,9), Risiko-Median
5,4 (p25 3,8 / p75 8,2 / p90 11,1 / max 40,1). 665 binnen 24 h invalidiert, 250 nie. Zeit bis zur
Invalidierung: Median 115 Minuten. Short 470 DRs, Long 445 — kein Richtungs-Unterschied.

Kein 1 R in der Tabelle — Philip, 20.09.2026: *„1R macht keinen sinn ich mache keinen Trade um 1R
zu gewinnen. 2R ist minimum, aber 3R ist laut strategie eigentlich minimum."*

## Woher die 915 kommen

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
  bestätigender M5-OB), **nicht** jeder beliebige M5-OB. Zeilen desselben OB werden zu einer DR
  zusammengefasst (1233 Zeilen → 915 DRs, alle auswertbar).
- **Referenz für alles**: die nahe OB-Kante (`ob_bottom` bei Short, `ob_top` bei Long).
- **Invalidierung**: Berührung der **fernen** OB-Kante — das Sweep-Extrem, das `widenObForSweep`
  beim Erkennen aufzieht. Seit dem 20.09.2026 dieselbe Definition wie im Produktivcode
  (`deriveSetupEntryInvalidation`, Migration `20260920140000`).
- **Risiko / 1 R**: nahe → ferne OB-Kante.
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
| `quotenTabelle.py` | **Haupttabelle**: Trefferquote je Merkmal, 10–40 Pips und 2–6 R |
| `baenderTabellen.py` | die vier Tabellen für die UI-Anzeige (feste Risiko-Bänder, EV, Deckel) |
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
| Januar | 106 | 82 % | 65 % | 46 % | 36 % | 29 % | 74 % | 57 % |
| Februar | 95 | 73 % | 64 % | 59 % | 41 % | 34 % | 68 % | 57 % |
| **März** | 91 | **85 %** | **71 %** | **62 %** | 49 % | 38 % | 68 % | 60 % |
| April | 104 | 74 % | 61 % | 53 % | 36 % | 32 % | 70 % | 54 % |
| Mai | 99 | 77 % | 60 % | 45 % | 32 % | 26 % | 72 % | 53 % |
| Juni | 112 | 80 % | 62 % | 44 % | 37 % | 33 % | 73 % | 63 % |
| Juli | 118 | 66 % | 52 % | 42 % | 36 % | 22 % | 66 % | 54 % |
| **August** | 126 | **63 %** | **45 %** | **37 %** | 21 % | 16 % | 69 % | 48 % |
| September | 64 | 67 % | 53 % | 41 % | 30 % | 23 % | 69 % | 47 % |

Halbjahre: Januar–Juni 78 / 64 / 51 % bei 10 / 15 / 20 Pips, Juli–September 65 / 49 / 40 %.

Bootstrap März gegen August: bei 15 Pips **26 Punkte, 95 %-Intervall [13, 39]**. Bei 10, 20, 25,
30, 35 und 40 Pips ebenso — **kein einziges Intervall enthält die Null**. Halbjahr gegen Halbjahr:
14 Punkte bei 15 Pips, Intervall [8, 21].

**Aber es ist zum großen Teil Volatilität.** In R gerechnet liegen alle neun Monate bei 2 R zwischen
66 und 74 %, bei 3 R zwischen 47 und 63 %. Das Risiko wandert nämlich mit: Median 7,9 Pips im März,
4,2 im August — eine März-DR ist fast doppelt so weit aufgespannt. Über alle Monate: Reichweite
Faktor 2,0, Risiko Faktor 1,9, in R nur noch Faktor 1,4.

**Praktisch:** mit festem 15-Pip-Ziel ist der August deutlich schlechter. Skaliert man das Ziel am
Risiko der jeweiligen DR, ist er fast genauso gut. Das feste Pip-Ziel erzeugt die Saisonalität,
nicht die Setup-Qualität.

## Die Filter

### Sweep-Herkunft — der stärkste, und er hält

| | n | 10 P | 15 P | 20 P | 30 P | 2 R | 3 R |
|---|---|---|---|---|---|---|---|
| 1H-Sweep | 100 | 92 % | **81 %** | 69 % | 52 % | 74 % | 61 % |
| M5-Sweep | 815 | 72 % | 56 % | 45 % | 33 % | 69 % | 54 % |

Erste Fassung: n=25 plus eine Restgruppe „unklar", weil die Herkunft nachträglich geschätzt werden
musste. Jetzt steht sie exakt in `trade_setups.ls_timeframe` — die Gruppe „unklar" gibt es nicht
mehr. In R sind die beiden Gruppen fast gleich (74 gegen 69 % bei 2 R), der Vorteil ist also auch
hier zum guten Teil Volatilität.

### Sweep-Alter — der größte Effekt

| Klasse | n | 10 P | 15 P | 20 P | 30 P | 2 R | 3 R |
|---|---|---|---|---|---|---|---|
| Major (≥ 120 h) | 30 | **97 %** | 87 % | 77 % | 57 % | 87 % | 73 % |
| Medium (24–120 h) | 45 | 87 % | 78 % | 64 % | 49 % | 69 % | 58 % |
| Minor (< 24 h) | 840 | 72 % | 57 % | 45 % | 33 % | 69 % | 54 % |

29 der 30 Major-DRs erreichten 10 Pips. Anders als bei der Herkunft hält der Vorsprung **auch in R**
(87 gegen 69 % bei 2 R) — das ist echte Qualität, keine Volatilität. Nur selten: rund 3 % aller
Dealing Ranges. In der ersten Fassung stand das auf n=8 und n=10.

### Gegenkraft — teilweise gekippt

| Konstellation | n | 10 P | 15 P | 20 P | 30 P | 2 R |
|---|---|---|---|---|---|---|
| keine lebende Gegen-DR | 646 | 81 % | 64 % | 52 % | 39 % | 73 % |
| **beide M5** | 242 | **56 %** | **44 %** | 36 % | 26 % | 63 % |
| ich M5, Gegner HTF | 18 | 78 % | 50 % | 33 % | 22 % | 67 % |
| ich HTF, Gegner M5 | 9 | 78 % | 78 % | 67 % | 56 % | 67 % |

In der ersten Fassung war „ich M5, Gegner HTF" mit 7,4 Pips Median der klar schlechteste Fall
(n=30) — **das reproduziert sich nicht**. Belegt ist jetzt stattdessen der Fall **beide M5**: 242
Ranges, über die ganze Reihe 10 bis 25 Punkte schlechter als ohne Gegner. Die beiden HTF-Zeilen
sind mit n=9 und n=18 zu dünn für eine Aussage.

### Handelszeit — als Fenster tot, als Stunde lebendig

| | n | 10 P | 15 P | 20 P | 2 R | 3 R |
|---|---|---|---|---|---|---|
| im Fenster 08:00–18:00 | 677 | 74 % | 58 % | 47 % | 66 % | 51 % |
| außerhalb | 238 | 74 % | 61 % | 48 % | 81 % | 67 % |

Die erste Fassung hatte hier 16,4 gegen 7,1 Pips Median auf 176 zu 79 Ranges — und darauf wurde am
19.09. das Alarmfenster von 07:00 auf 08:00 gezogen (Migration `20260919141000`). **Mit 915 Ranges
ist von dem Unterschied nichts übrig.** Die Änderung schadet nicht, ihre Begründung trägt aber
nicht mehr.

Nach *Stunde* gibt es den Effekt sehr wohl — nur trennt das Fenster ihn nicht: Reichweiten-Median
33,8 um 17:00 und 28,7 um 16:00 (NY) gegen 13,3 um 07:00 und 14,6 um 12:00. Das Fenster 08–18
enthält die besten und die schlechtesten Stunden gleichzeitig.

## Enge der DR — warum beide Einheiten nötig sind

Dieselben 915 Ranges, nach eigenem Risiko in drei gleich große Gruppen geteilt:

| Gruppe | n | 10 P | 15 P | 20 P | 30 P | 2 R | 3 R | 4 R | 5 R | 6 R |
|---|---|---|---|---|---|---|---|---|---|---|
| eng (bis 4,2 P) | 305 | 63 % | 46 % | 35 % | 24 % | **79 %** | **65 %** | **54 %** | **47 %** | **41 %** |
| mittel (bis 7,1 P) | 305 | 78 % | 62 % | 49 % | 36 % | 75 % | 58 % | 45 % | 38 % | 33 % |
| weit (ab 7,2 P) | 305 | **81 %** | **69 %** | **57 %** | **45 %** | 56 % | 42 % | 33 % | 26 % | 19 % |

**Links und rechts drehen die Reihenfolge um, und beides stimmt.** Eine enge Range erreicht selten
30 Pips, schafft aber ihr eigenes Vielfaches deutlich häufiger. Eine weite schafft die Pips
leichter, tut sich mit ihrem eigenen Vielfachen aber schwer. Die Spannweite über die drei Gruppen
ist in beiden Einheiten gleich groß (21 Punkte im Mittel) — **keine der beiden Leitern kommt ohne
Gruppierung aus**. Eine Anzeige an der laufenden DR braucht deshalb beide Leitern — siehe
`PLAN-dr-statistik-ui.md` im Repo-Wurzelverzeichnis.

## Risiko-Verteilung und der gedeckelte Stopp

| Risiko | n | Anteil | kumuliert |
|---|---|---|---|
| unter 3 Pips | 136 | 14,9 % | 14,9 % |
| 3–5 Pips | 269 | 29,4 % | 44,3 % |
| 5–7 Pips | 194 | 21,2 % | 65,5 % |
| 7–10 Pips | 182 | 19,9 % | 85,4 % |
| über 10 Pips | 134 | 14,6 % | 100 % |

**43 % aller Ranges tragen mehr als 6 Pips Risiko.** Philips Vorschlag, den Stopp dort zu deckeln,
hält — gerechnet als reine Pfadfrage ohne Entry-Modell, Ziel 15 Pips, nur die betroffene Gruppe:

| Deckel | betroffen | Gewinner vorher → mit Deckel | gekostet | RR | EV |
|---|---|---|---|---|---|
| 6 Pips | 395 | 270 → 248 | 22 | 1,72 → 2,50 | +0,84 → **+1,20 R** |
| 7 Pips | 316 | 215 → 199 | 16 | 1,58 → 2,14 | +0,71 → +0,98 R |

Bei 6 Pips kostet der Deckel 8 % der Gewinner und hebt den Erwartungswert deutlich.

## find_targets

7288 Kandidaten. Das Angebot stimmt: 915 von 915 DRs bekamen eine Liste, genau **zwei** von 7288
Kandidaten lagen hinter der nahen OB-Kante.

| Regel | Quote | Distanz | EV |
|---|---|---|---|
| nächster Kandidat | 71 % | 10,3 | +1,22 R |
| nächster OB-Kandidat | 64 % | 13,5 | +1,28 R |
| nächster ≥ 15 Pips | 50 % | 17,9 | +1,31 R |
| nächster mit RR ≥ 3 | 48 % | 20,2 | +1,32 R |
| weitester ohne `tooFar` | 27 % | 41,1 | +1,09 R |

Alle Regeln zwischen +1,09 und +1,32 R; Bootstrap für die beste: +0,09 R, Intervall [−0,04, +0,22].
**An der Zielwahl innerhalb der Liste ist kaum etwas zu holen** — dasselbe Ergebnis wie auf der
kleinen Stichprobe, nur schärfer. Das `tooFar`-Flag trennt weiter (11 % gegen 46 % Trefferquote),
aber weniger brutal als die 2 gegen 42 % der ersten Fassung.

## Trendlage — kein Unterschied, gesichert

| | n | 10 P | 15 P | 20 P | 30 P | 2 R | 3 R |
|---|---|---|---|---|---|---|---|
| mit dem Trend | 453 | 74 % | 59 % | 48 % | 35 % | 68 % | 54 % |
| gegen den Trend | 458 | 76 % | 60 % | 47 % | 35 % | 74 % | 58 % |

Der 1H-Strukturtrend trennt gute nicht von schlechten Dealing Ranges. Bootstrap: Differenz
**+0,4 Pips, 95 %-Intervall [−3,2, +3,8]**; jede EV-Differenz der Ziel-Regeln liegt bei null. Die
Aufteilung ist mit 453 zu 458 nahezu hälftig — die Erkennung hat keinen Richtungs-Bias.
(Für 4 der 915 DRs lieferte `get_data_export` keinen Trend, sie fehlen hier.)

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
