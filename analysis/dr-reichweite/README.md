# DR-Reichweite — was taugen die erkannten Setups?

## Aktueller FXCM-Stand: 2025 und 2026

Die Auswertung umfasst **3282 GBPUSD-Setups**: 1921 vom 08.01.–31.12.2025 und 1361 vom
05.01.–21.09.2026. Ausschließlich native FXCM-Bid-Kerzen, gleicher Erkennungsalgorithmus.
Die ersten sieben Kalendertage 2025 sind M5-Warmup; H1/H4 reichen bis Juni 2024 zurück.
Die Simulation lief mit `BACKFILL_DRY_RUN=1`: keine simulierten Setups und keine Trades ins
Produktivjournal geschrieben. Historische H1-/H4-Zonen wurden ergänzend eingefügt, vorhandene
Zonen dabei nicht geändert und historische Benachrichtigungen unterdrückt.

- Archiv 2025: **74998 GBPUSD- und 75193 EURUSD-M5-Kerzen**, alle zwölf Monate vorhanden.
  Jede vorhandene H1-Stunde enthält M5-Daten; das ist kein Nachweis für jeden einzelnen
  theoretischen Fünf-Minuten-Slot. Details: [Abdeckungsprüfung](fxcm-abdeckung-2025.json).
- Reichweite vor Invalidierung: 10 Pips **71 %**, 15 Pips **57 %**, 20 Pips **47 %**.
  Median 17,8 Pips; strukturelles Risiko im Median 5,7 Pips.
- R-Leiter mit auf 6 Pips gedeckeltem Stopp: gesamte Stichprobe bei 2R **70 %**, 3R **55 %**,
  4R **46 %**. Die Chart-Anzeige verwendet die fünf Risiko-Bänder aus Tabelle 5 in
  [ergebnis-baender.txt](ergebnis-baender.txt), nicht diesen Gesamtdurchschnitt.
- 72 Major- und 116 Medium-Sweeps (zusammen 188 ab 24 Handelsstunden). Kleine, abhängige Untergruppen:
  daraus folgt weiterhin keine belastbare allgemeine Überlegenheit von Major gegenüber Medium.
- Die 24-Stunden-Messung beschreibt historische Kurswege, keine realisierten Trades.
  Spread, Slippage und Gebühren sind nicht abgezogen. 2026 endet im September; Halbjahre
  sind daher unterschiedlich vollständig. Monatliche Unterschiede beweisen keine Saisonalität.

[Visuelle Übersicht](auswertung.html) · [Quoten](ergebnis-quoten.txt) ·
[Monate](ergebnis-saisonalitaet.txt) · [FXCM-Betrieb](../../docs/fxcm-feed.md).

Reproduktion: `backfillTradeSetups.ts` mit `BACKFILL_FROM=2025-01-08`,
`BACKFILL_TO=2026-01-01`, `BACKFILL_INSTRUMENTS=GBPUSD`, `BACKFILL_DRY_RUN=1` und
`BACKFILL_DUMP` ausführen; mit dem 2026-Dump nach Instrument/Richtung/OB-Start deduplizieren.
Die bestehenden OB-/LQ-Backfill-Skripte unterstützen `BACKFILL_INSERT_ONLY=1` für ergänzende
Archivläufe ohne Korrektur bestehender Zeilen. Nach einer Archiv-Erweiterung
`messeFxcmKontext.ts` vollständig neu ausführen; `FXCM_CONTEXT_RESUME=1` nur für die Fortsetzung
bei unverändertem Archiv und Algorithmus verwenden. Danach die Ergebnis-Skripte und
`erstelleUebersicht.py` ausführen. Rohdaten bleiben lokal; abgeleitete Ergebnisse sind versioniert.
Die verwendeten Eingabestände sind über [Prüfsummen und Zeitraum](fxcm-analyse-2025-2026.json)
identifizierbar. Der Target-Lauf lieferte 26056 Kandidaten; drei Setups hatten keine Kandidaten.
149 Setups haben keinen bestimmten H1-Trend und bleiben in der eigenen Gruppe „Trend unklar“;
sie werden weder ausgeschlossen noch einer Richtung zugerechnet.

## Historische Befunde vor dem FXCM-Wechsel

Die nachfolgenden ausformulierten Befunde dokumentieren den früheren
cTrader-Stand vom 21.09.; sie sind keine aktuellen FXCM-Ergebnisse. Die historische Close-Check-Schwellenstudie bleibt ausdrücklich auf dem alten Feed. Datenfluss und Vergleich:
[FXCM-Feed](../../docs/fxcm-feed.md).

Auswertung vom **21.09.2026**, GBPUSD, **1314 Dealing Ranges** über **Januar bis September 2026**.
Beantwortet die Frage, die vorher nicht beantwortbar war: welche erkannten Setups taugen — gemessen
an Philips eigener Erfolgsdefinition („Target erreicht, bevor der Invalidierungspunkt erreicht
wird").

Kein Produktionscode. Python-Skripte, die lokal gegen abgelegte JSON-Dateien laufen.

> Die erste Fassung vom 19.09.2026 stand auf 255 DRs aus zwei Monaten (15.07.–16.09.). Diese zwei
> Monate waren, wie sich jetzt zeigt, die beiden schwächsten des Jahres — und **zwei ihrer vier
> Befunde haben die größere Stichprobe nicht überlebt**. Was sich geändert hat, steht unten bei
> jedem Filter.
>
> Die zweite Fassung vom 20.09.2026 stand auf 915 DRs. Am 21.09.2026 hat die Erkennung aufgehört,
> auf die period-5-Fraktal-Bestätigung zu warten (Task „Alarm sobald die FVG steht") — dieselben
> neun Monate liefern damit **1314 statt 915** Dealing Ranges. Die Quoten sinken dadurch um 3
> Punkte, die Reihenfolge aller Filter bleibt. Details unter „Woher die 1314 kommen".

## Leitkennzahl: Trefferquote, nicht Median

Philip, 20.09.2026: *„mir ist doch egal wie weit die Pipstrecken gehen, ich will am ende 10-20 pips
traden und den Gewinn mitnehmen. Ich will ne gute Winrate von Dealing Ranges."* Ein Median lässt
sich von wenigen sehr weiten Läufen hochziehen und beschreibt damit etwas, das für die Entscheidung
„traden oder nicht" keine Rolle spielt. Alle Haupttabellen stehen deshalb als Trefferquote
(`quotenTabelle.py`), der Reichweiten-Median läuft nur noch als Nebenangabe mit.

| Ziel | 10 P | 15 P | 20 P | 25 P | 30 P | 35 P | 40 P | 2 R | 3 R | 4 R | 5 R | 6 R |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| alle 1314 | 71 % | **56 %** | 46 % | 39 % | 34 % | 29 % | 27 % | 67 % | 53 % | 42 % | 34 % | 29 % |

Weitere Eckwerte: Reichweiten-Median 17,5 Pips (p25 8,8 / p75 42,1 / max 241,9), Risiko-Median
5,4 (p25 3,7 / p75 8,2 / p90 11,2 / max 40,1). 985 binnen 24 h invalidiert, 329 nie. Zeit bis zur
Invalidierung: Median 95 Minuten. Short 666 DRs, Long 648 — kein Richtungs-Unterschied.

Kein 1 R in der Tabelle — Philip, 20.09.2026: *„1R macht keinen sinn ich mache keinen Trade um 1R
zu gewinnen. 2R ist minimum, aber 3R ist laut strategie eigentlich minimum."*

## Woher die 1314 kommen

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

Treue gegen drei Wochen mit echten Live-Zeilen: **108 von 112 Setups reproduziert**, 8 % zusätzliche
(gemessen am 20.09., vor der Erkennungsumstellung).

### Warum es 1314 statt 915 sind (21.09.2026)

Die Erkennung wartet nicht mehr auf ein bestätigtes period-5-Fraktal, sondern meldet, sobald Sweep
und FVG stehen — im Live-Betrieb 15 Minuten früher, in der Simulation 399 Dealing Ranges mehr.
Möglich wurde das, weil `closesBeyondLevel` den schnellen Pfad nicht mehr unbegrenzt sperrt: ein
Sweep-and-Reclaim fiel dadurch immer durch.

Die Alters-Schwelle dieses Checks ist **gemessen, nicht geschätzt** (`vergleicheCloseCheck.py`,
`ergebnis-close-check.txt`): derselbe Zeitraum mit den Schwellen „Check immer an", 24 h, 8 h, 4 h,
2 h und „aus". Ergebnis — das Alter trennt die zusätzlich gefundenen DRs **nicht**:

| Randband (Alter des gesweepten Levels) | n | 10 P | 15 P | 20 P | 2 R | 3 R |
|---|---|---|---|---|---|---|
| ≥ 24 h | 5 | 80 % | 40 % | 40 % | 40 % | 40 % |
| 8–24 h | 58 | 55 % | 45 % | 40 % | 53 % | 40 % |
| 4–8 h | 47 | 53 % | 38 % | 32 % | 57 % | 45 % |
| 2–4 h | 81 | 70 % | 53 % | 35 % | 67 % | 47 % |
| < 2 h | 232 | 59 % | 50 % | 42 % | 62 % | 50 % |
| Basis (Check immer an) | 930 | 74 % | 59 % | 48 % | 70 % | 55 % |

Kein Alterstrend: das älteste Band ist bei 15 Pips das schlechteste. Ein Reclaim-Kriterium statt des
Alters trennt genauso wenig (zurückerobert 51 % gegen noch gebrochen 52 % bei 15 Pips). Der Check
kostet also 43 % der Setups und bringt dafür 3 Punkte — deshalb steht `closeCheckMaxAgeSec` auf 0.
Die Schwelle bleibt als Stellschraube stehen; auf `Infinity` ist das Verhalten vom 20.09. zurück.

Zwei Nebenwirkungen der früheren Erkennung, beide gemessen: die **Invalidierung ist identisch** (bei
allen 918 DRs, die beide Verfahren kennen, exakt dieselben OB-Kanten — die frühere Erkennung sieht
nie ein engeres Sweep-Extrem), aber **16 Setups tragen jetzt „M5" statt „1H"** als Sweep-Herkunft:
ein H1-Pivot braucht 10 H1-Kerzen Bestätigung, wer 15 Minuten früher zugreift, kennt ihn noch nicht.

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
  zusammengefasst — seit dem 21.09.2026 gibt es je OB ohnehin nur noch EINE Zeile (1314 Zeilen,
  1314 DRs, alle auswertbar; vorher 1233 Zeilen → 915 DRs).
- **Referenz für alles**: die nahe OB-Kante (`ob_bottom` bei Short, `ob_top` bei Long).
- **Invalidierung**: Berührung der **fernen** OB-Kante — das Sweep-Extrem, das `widenObForSweep`
  beim Erkennen aufzieht, gemessen ab dem **frühesten** Touch aller Sweeps dieses OB (seit
  21.09.2026, damit sie nie zu eng liegt). Seit dem 20.09.2026 dieselbe Definition wie im
  Produktivcode (`deriveSetupEntryInvalidation`, Migration `20260920140000`).
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
| `fvgBaender.py` | FVG-Größe je DR, absolut und relativ zur OB-Höhe, beide Entry-Modelle |
| `saisonalitaet.py` | Monatsvergleich |
| `filterHtfSweep.py` · `filterGegenkraft.py` · `filterAlterUndHandelszeit.py` | die einzelnen Filter |
| `leiterPipsVsR.py` | Wahrscheinlichkeit je Strecke, Pips gegen R |
| `deckelStopp.py` | Risiko-Verteilung und was ein gedeckelter Stopp kostet |
| `messeFindTargets.py` | ruft den echten `find_targets` je DR auf und wertet ihn aus |
| `messeTrendJeDr.py` · `filterTrend.py` | 1H-Trend je DR und die Auswertung darauf |
| `vergleicheCloseCheck.py` | Abnahmelauf der Close-Check-Schwelle (braucht `daten-setups-sim-<v>.json` je Schwelle) |
| `winrate.py` | Winrate je Ziel-Regel und Qualitätsstufe |

Die `ergebnis-*.txt` sind die abgelegten Ausgaben. Die `daten-*.json` sind Rohdaten und bleiben per
`.gitignore` draußen — reproduzierbar sind die Skripte, nicht der Datenstand.

## Saisonalität — der bestbelegte Befund

| Monat | n | 10 P | 15 P | 20 P | 30 P | 40 P | 2 R | 3 R |
|---|---|---|---|---|---|---|---|---|
| Januar | 150 | 80 % | 67 % | 51 % | 38 % | 31 % | 74 % | 59 % |
| Februar | 135 | 66 % | 59 % | 52 % | 36 % | 30 % | 64 % | 53 % |
| **März** | 165 | **81 %** | **67 %** | **59 %** | 47 % | 37 % | 66 % | 56 % |
| April | 158 | 72 % | 58 % | 46 % | 30 % | 25 % | 66 % | 51 % |
| Mai | 151 | 70 % | 54 % | 42 % | 31 % | 24 % | 66 % | 48 % |
| Juni | 156 | 73 % | 56 % | 42 % | 34 % | 28 % | 70 % | 60 % |
| Juli | 167 | 65 % | 51 % | 41 % | 34 % | 23 % | 63 % | 52 % |
| **August** | 149 | **60 %** | **42 %** | **35 %** | 22 % | 16 % | 71 % | 48 % |
| September | 83 | 63 % | 51 % | 40 % | 28 % | 23 % | 66 % | 47 % |

Halbjahre: Januar–Juni 74 / 60 / 49 % bei 10 / 15 / 20 Pips, Juli–September 63 / 48 / 38 %.

Bootstrap März gegen August: bei 15 Pips **25 Punkte, 95 %-Intervall [14, 36]**. Bei 10, 20, 25,
30, 35 und 40 Pips ebenso — **kein einziges Intervall enthält die Null**. Halbjahr gegen Halbjahr:
12 Punkte bei 15 Pips, Intervall [6, 18].

**Aber es ist zum großen Teil Volatilität.** In R gerechnet liegen alle neun Monate bei 2 R zwischen
63 und 74 %, bei 3 R zwischen 47 und 60 %. Das Risiko wandert nämlich mit: Median 8,1 Pips im März,
4,2 im August — eine März-DR ist fast doppelt so weit aufgespannt. Über alle Monate: Reichweite
Faktor 2,2, Risiko Faktor 1,9, in R nur noch Faktor 1,3.

**Praktisch:** mit festem 15-Pip-Ziel ist der August deutlich schlechter. Skaliert man das Ziel am
Risiko der jeweiligen DR, ist er fast genauso gut. Das feste Pip-Ziel erzeugt die Saisonalität,
nicht die Setup-Qualität.

## Die Filter

### Sweep-Herkunft — der stärkste, und er hält

| | n | 10 P | 15 P | 20 P | 30 P | 2 R | 3 R |
|---|---|---|---|---|---|---|---|
| 1H-Sweep | 78 | 91 % | **82 %** | 71 % | 53 % | 76 % | 63 % |
| M5-Sweep | 1236 | 69 % | 55 % | 44 % | 33 % | 67 % | 52 % |

Erste Fassung: n=25 plus eine Restgruppe „unklar", weil die Herkunft nachträglich geschätzt werden
musste. Jetzt steht sie exakt in `trade_setups.ls_timeframe` — die Gruppe „unklar" gibt es nicht
mehr. In R sind die beiden Gruppen fast gleich (76 gegen 67 % bei 2 R), der Vorteil ist also auch
hier zum guten Teil Volatilität. Dass es 78 statt 100 sind, liegt an der früheren Erkennung (siehe
„Warum es 1314 statt 915 sind").

### Sweep-Alter — der größte Effekt

| Klasse | n | 10 P | 15 P | 20 P | 30 P | 2 R | 3 R |
|---|---|---|---|---|---|---|---|
| Major (≥ 120 h) | 30 | **97 %** | 87 % | 77 % | 53 % | 87 % | 73 % |
| Medium (24–120 h) | 40 | 88 % | 78 % | 62 % | 45 % | 65 % | 55 % |
| Minor (< 24 h) | 1244 | 69 % | 55 % | 44 % | 33 % | 67 % | 52 % |

29 der 30 Major-DRs erreichten 10 Pips. Anders als bei der Herkunft hält der Vorsprung **auch in R**
(87 gegen 67 % bei 2 R) — das ist echte Qualität, keine Volatilität. Nur selten: rund 2 % aller
Dealing Ranges. In der ersten Fassung stand das auf n=8 und n=10.

### Gegenkraft — teilweise gekippt

| Konstellation | n | 10 P | 15 P | 20 P | 30 P | 2 R |
|---|---|---|---|---|---|---|
| keine lebende Gegen-DR | 914 | 76 % | 61 % | 49 % | 37 % | 69 % |
| **beide M5** | 379 | **58 %** | **45 %** | 36 % | 26 % | 64 % |
| ich M5, Gegner HTF | 14 | 79 % | 57 % | 43 % | 29 % | 79 % |
| ich HTF, Gegner M5 | 7 | 86 % | 86 % | 71 % | 57 % | 71 % |

In der ersten Fassung war „ich M5, Gegner HTF" mit 7,4 Pips Median der klar schlechteste Fall
(n=30) — **das reproduziert sich nicht**. Belegt ist jetzt stattdessen der Fall **beide M5**: 379
Ranges, über die ganze Reihe 11 bis 18 Punkte schlechter als ohne Gegner. Die beiden HTF-Zeilen
sind mit n=7 und n=14 zu dünn für eine Aussage.

### Handelszeit — als Fenster tot, als Stunde lebendig

| | n | 10 P | 15 P | 20 P | 2 R | 3 R |
|---|---|---|---|---|---|---|
| im Fenster 08:00–18:00 | 962 | 74 % | 59 % | 48 % | 66 % | 51 % |
| außerhalb | 352 | 62 % | 50 % | 39 % | 71 % | 57 % |

Die erste Fassung hatte hier 16,4 gegen 7,1 Pips Median auf 176 zu 79 Ranges — und darauf wurde am
19.09. das Alarmfenster von 07:00 auf 08:00 gezogen (Migration `20260919141000`). **Die Richtung ist
damit wieder da, in Pips: 12 Punkte bei 10 Pips.** In R dreht sie sich aber um (71 gegen 66 % bei
2 R) — außerhalb entstehen engere Ranges, die ihr eigenes Vielfaches öfter schaffen. Als Begründung
für das Fenster trägt das nicht, siehe die Leitern weiter unten.

Nach *Stunde* gibt es den Effekt deutlicher — nur trennt das Fenster ihn nicht: Reichweiten-Median
25,3 um 17:00 und 25,2 um 16:00 (NY) gegen 14,0 um 08:00 und 14,6 um 12:00. Das Fenster 08–18
enthält die besten und die schlechtesten Stunden gleichzeitig.

## Enge der DR — warum beide Einheiten nötig sind

Dieselben 1314 Ranges, nach eigenem Risiko in drei gleich große Gruppen geteilt:

| Gruppe | n | 10 P | 15 P | 20 P | 30 P | 2 R | 3 R | 4 R | 5 R | 6 R |
|---|---|---|---|---|---|---|---|---|---|---|
| eng (bis 4,3 P) | 438 | 56 % | 41 % | 31 % | 22 % | **74 %** | **59 %** | **48 %** | **40 %** | **35 %** |
| mittel (bis 7,1 P) | 438 | 75 % | 60 % | 49 % | 35 % | 73 % | 57 % | 45 % | 37 % | 32 % |
| weit (ab 7,1 P) | 438 | **81 %** | **68 %** | **57 %** | **45 %** | 55 % | 43 % | 32 % | 25 % | 19 % |

**Links und rechts drehen die Reihenfolge um, und beides stimmt.** Eine enge Range erreicht selten
30 Pips, schafft aber ihr eigenes Vielfaches deutlich häufiger. Eine weite schafft die Pips
leichter, tut sich mit ihrem eigenen Vielfachen aber schwer. Die Spannweite über die drei Gruppen
ist in Pips größer (~26 Punkte) als in R (~16), aber **keine der beiden Leitern kommt ohne
Gruppierung aus**. Eine Anzeige an der laufenden DR braucht deshalb beide Leitern — siehe
`PLAN-dr-statistik-ui.md` im Repo-Wurzelverzeichnis.

## Risiko-Verteilung und der gedeckelte Stopp

| Risiko | n | Anteil | kumuliert |
|---|---|---|---|
| unter 3 Pips | 198 | 15,1 % | 15,1 % |
| 3–5 Pips | 385 | 29,3 % | 44,4 % |
| 5–7 Pips | 288 | 21,9 % | 66,3 % |
| 7–10 Pips | 247 | 18,8 % | 85,1 % |
| über 10 Pips | 196 | 14,9 % | 100 % |

**42 % aller Ranges tragen mehr als 6 Pips Risiko.** Philips Vorschlag, den Stopp dort zu deckeln,
hält — gerechnet als reine Pfadfrage ohne Entry-Modell, Ziel 15 Pips, nur die betroffene Gruppe:

| Deckel | betroffen | Gewinner vorher → mit Deckel | gekostet | RR | EV |
|---|---|---|---|---|---|
| 6 Pips | 555 | 374 → 345 | 29 | 1,70 → 2,50 | +0,79 → **+1,18 R** |
| 7 Pips | 443 | 301 → 280 | 21 | 1,56 → 2,14 | +0,69 → +0,99 R |

Bei 6 Pips kostet der Deckel 8 % der Gewinner und hebt den Erwartungswert deutlich.

## find_targets

10467 Kandidaten. Das Angebot stimmt: 1314 von 1314 DRs bekamen eine Liste, genau **drei** von
10467 Kandidaten lagen hinter der nahen OB-Kante.

| Regel | Quote | Distanz | EV |
|---|---|---|---|
| nächster Kandidat | 67 % | 10,6 | +1,12 R |
| nächster OB-Kandidat | 61 % | 13,3 | +1,15 R |
| nächster ≥ 15 Pips | 47 % | 18,0 | +1,16 R |
| nächster mit RR ≥ 3 | 45 % | 20,3 | +1,17 R |
| weitester ohne `tooFar` | 26 % | 42,2 | +0,95 R |

Alle Regeln zwischen +0,95 und +1,17 R; Bootstrap für die beste gegen den Status quo: +0,04 R,
Intervall [−0,06, +0,14]. **An der Zielwahl innerhalb der Liste ist kaum etwas zu holen** — auf
dreimal so vielen DRs wie in der ersten Fassung dasselbe Ergebnis. Das `tooFar`-Flag trennt weiter
(10 % gegen 43 % Trefferquote), aber weniger brutal als die 2 gegen 42 % der ersten Fassung.

## Trendlage — kein Unterschied, gesichert

| | n | 10 P | 15 P | 20 P | 30 P | 2 R | 3 R |
|---|---|---|---|---|---|---|---|
| mit dem Trend | 633 | 69 % | 56 % | 45 % | 33 % | 64 % | 52 % |
| gegen den Trend | 673 | 72 % | 57 % | 46 % | 35 % | 70 % | 54 % |

Der 1H-Strukturtrend trennt gute nicht von schlechten Dealing Ranges — auf der größeren Stichprobe
sogar noch flacher als vorher (1 Punkt bei 15 Pips). Die Aufteilung ist mit 633 zu 673 nahezu
hälftig — die Erkennung hat keinen Richtungs-Bias.
(Für 8 der 1314 DRs lieferte `get_data_export` keinen Trend, sie fehlen hier.)

Drei Gegenproben wie schon auf der kleinen Stichprobe: der innere Trend (`nestedTrend`, n=407)
zeigt eher das umgekehrte Vorzeichen (19,2 mit gegen 23,7 gegen), ein längeres Fenster (72 h,
7 Tage) ändert exakt nichts, und in den Halbjahren dreht das Vorzeichen.

Gemessen ist **eine** Trend-Definition: der 1H-Algo mit Daily-Pivot-Anker, der sich nur alle ein
bis drei Wochen bewegt. Der M5-Trend ist damit nicht gemessen.

## FVG-Größe — sieht nach dem stärksten Filter aus, ist aber ein Messartefakt

Anlass: Philip, 23.09.2026, zu Setup #2936 — *„die FVG ist 0,5 Pip. viel zu schwach. koennten wir
ueberlegen sowas rauszufiltern."* Gemessen mit `fvgBaender.py`, volle Tabellen in
[ergebnis-fvg.txt](ergebnis-fvg.txt).

Die Lücke steht nirgends in den Daten, ist aber exakt rekonstruierbar: die FVG-anknüpfende OB-Kante
ist C1, und `widenObForSweep` zieht immer nur die gegenüberliegende auf. Gegenprobe: das Minimum
über alle 3282 Zeilen ist exakt 0,5000 Pip — die Schwelle der Erkennung. Seit dem 23.09.2026 führt
`detectOrderBlocks` die Lücke zusätzlich als `gap` mit, ein neuer Dump trägt sie als `ob_gap`.

| FVG | n | Anteil | Risiko-Median | Vorsprung-Median | 3 R Standard | 3 R **Retest** | ohne Retest |
|---|---|---|---|---|---|---|---|
| unter 1 Pip | 972 | 29,6 % | 4,9 P | 2,7 P | 47 % | 30 % | 5 % |
| 1–2 Pips | 963 | 29,3 % | 5,4 P | 3,8 P | 52 % | 26 % | 9 % |
| 2–3 Pips | 539 | 16,4 % | 5,8 P | 5,1 P | 57 % | 28 % | 11 % |
| 3–5 Pips | 493 | 15,0 % | 7,0 P | 7,1 P | 61 % | 23 % | 15 % |
| 5–8 Pips | 217 | 6,6 % | 7,2 P | 9,5 P | 75 % | 28 % | 19 % |
| über 8 Pips | 98 | 3,0 % | 8,3 P | 18,0 P | **91 %** | 26 % | **31 %** |

Die Standard-Spalte steigt von 47 auf 91 % — der sauberste Verlauf im ganzen Datensatz, deutlich
stärker als Sweep-Alter oder Gegenkraft, und er hält scheinbar auch in R. **Er ist trotzdem kein
Qualitätsmerkmal.** Der Grund steht in der Spalte daneben: alle bisherigen Tabellen unterstellen
einen Entry an der nahen OB-Kante ab FVG-Bestätigung, ohne zu prüfen, ob der Preis je dorthin
zurückkommt. Die FVG **ist** genau der Abstand, den der Preis zu diesem Zeitpunkt schon
zurückgelegt hat — ein 10-Pip-Setup startet den Pfad 18 Pips im Plus. Ein Schnitt nach FVG-Größe
misst damit den Vorsprung, nicht das Setup.

Zählt man erst ab der Kerze, die die OB-Kante tatsächlich wieder berührt (`lauf(retest=True)` —
Philips realer Entry), bleibt **nichts** übrig: 30 / 26 / 28 / 23 / 28 / 26 % bei 3 R, kein Trend.
Bootstrap für das größte gegen das kleinste Band bei 3 R: Standard-Entry **+37 bis +50 Punkte**,
Retest-Entry **−13 bis +8** — enthält die Null. Die relative FVG (Lücke / OB-Höhe) trennt genauso
wenig: 26 / 29 / 25 / 28 / 29 %.

Und die einzige Richtung, in der die große Lücke messbar wirkt, ist die falsche: **je größer die
FVG, desto öfter kommt der Preis nie zurück** — 5 % ohne Retest unter 1 Pip gegen 31 % über 8 Pips.

**Also kein Filter.** Setup #2936 mit seinen 0,5 Pip ist price-action unschön, aber nicht messbar
schlechter als eine 8-Pip-Lücke. Eine DB-Spalte auf `trade_setups` und ein Live-Filter bleiben
damit ungebaut (Task-Schritt 4). Wer die Frage später neu stellt, muss es gegen den Retest-Entry
messen — nicht gegen das Standardmodell.

> Der Vorsprung-Effekt trifft **nur** Schnitte nach einer Größe, die selbst am Abstand zur Entry-
> Kante hängt. Risiko-Bänder, Sweep-Alter, Gegenkraft und Monat sind davon nicht betroffen.

## Grenzen

Nur GBPUSD, EURUSD ist ungemessen. Neun Monate **eines** Jahres — dass dieser August schwach war,
heißt nicht, dass jeder August schwach ist. Die Erkennung lief nur im Alarmfenster (07:00–17:45
Berlin), abends entstehende Setups kommen strukturell nicht vor. 24-Stunden-Fenster, Docht zählt;
wer kurz vor Handelsschluss entsteht, hat ein kürzeres Fenster. Und: die Quoten sind **historische
Häufigkeiten, keine Wahrscheinlichkeiten**.

Eine lesbare Aufbereitung aller Zahlen liegt als Artefakt vor (Link im Chat vom 20.09.2026).
