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

Die `ergebnis-*.txt` sind die abgelegten Ausgaben dieser Läufe.

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
