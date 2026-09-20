# PLAN: DR-Statistik in der UI anzeigen

Status: Konzept steht, kein Code. Umsetzung in einer eigenen Session.
Vorarbeit: `analysis/dr-reichweite/` (255 GBPUSD-Dealing-Ranges, 15.07.–16.09.2026).
milk-city-Task: `tsc-historische-dr-statistik-zur-aktuellen-dealing-range-anzeigen`.

## Was angezeigt werden soll

Zu einer **laufenden** Dealing Range: wie sich vergleichbare DRs historisch verhalten haben.
Philip will **beides** nebeneinander, nicht eins von beidem:

1. **Die R-Leiter** — „wie oft wurde 1 R / 2 R / 3 R erreicht, bevor die DR invalidierte".
   Gilt für jede DR gleichermaßen, weil sie am eigenen Risiko normiert ist.
2. **Die Pip-Leiter, aufgeteilt nach der Enge der DR** — „wie oft wurden 10 / 15 / 20 Pips
   erreicht, bei DRs mit ähnlich viel Risiko wie dieser hier".

Philips Begründung für die zweite (19.09.2026): *„a) die DR ist eng, dann sinkt die
Wahrscheinlichkeit für ne weite Strecke über 15 Pips. b) Weite DR, ok 61 % Chance auf 15 Pips, kann
man mal wagen."*

Das ist der Punkt, an dem die Aufteilung nötig wird: **ungeteilt wäre die Pip-Leiter irreführend.**
„≥ 15 Pips" liegt über alle 255 DRs bei 46 %, aber bei den engen nur bei 27 % und bei den weiten
bei 61 %. Der Durchschnitt trifft auf keine einzelne DR zu. In R verschwindet die Spreizung
(49 / 51 / 44 %) — deshalb braucht die R-Leiter keine Aufteilung und die Pip-Leiter zwingend eine.

## Die Zahlen (Stand 19.09.2026, GBPUSD, n=255)

Terzile nach Risiko (= Abstand nahe OB-Kante → Extrem-Fraktal):

| Gruppe | n | Risiko | ≥5 P | ≥10 P | ≥15 P | ≥20 P | ≥25 P | ≥30 P | ≥40 P |
|---|---|---|---|---|---|---|---|---|---|
| eng | 85 | 0,8–3,5 | 62 % | 42 % | 27 % | 22 % | 13 % | 12 % | 7 % |
| mittel | 85 | 3,5–5,6 | 91 % | 71 % | 49 % | 33 % | 31 % | 27 % | 21 % |
| weit | 85 | 5,7–26,3 | 87 % | 69 % | 61 % | 51 % | 42 % | 33 % | 22 % |
| **alle** | **255** | 0,8–26,3 | **80 %** | **61 %** | **46 %** | **35 %** | **29 %** | **24 %** | **17 %** |

Dieselben Gruppen in R:

| Gruppe | 1 R | 2 R | 3 R | 4 R | 5 R | 8 R |
|---|---|---|---|---|---|---|
| eng | 91 % | 68 % | 49 % | 41 % | 35 % | 21 % |
| mittel | 95 % | 72 % | 51 % | 39 % | 34 % | 24 % |
| weit | 75 % | 55 % | 44 % | 34 % | 26 % | 5 % |
| **alle** | **87 %** | **65 %** | **48 %** | **38 %** | **32 %** | **16 %** |

Erzeugt von `analysis/dr-reichweite/leiterPipsVsR.py`; die Terzil-Grenzen und alle Zwischenwerte
stehen in `ergebnis-leiter.txt`.

## Offene Design-Entscheidungen

### 1. Terzile oder feste Risiko-Bänder?

Terzile sind immer gleich besetzt, verschieben aber ihre Grenzen, sobald die Stichprobe wächst —
eine DR könnte morgen in einer anderen Gruppe landen als heute. Feste Bänder (< 3 / 3–5 / 5–7 /
> 7 Pips) sind stabil, dafür ungleich besetzt (heute 66 / 88 / 52 / 49).

Empfehlung: **feste Bänder**, weil die Anzeige sonst nach jedem Backfill andere Zahlen für dieselbe
DR zeigt. Die Ungleichverteilung ist das kleinere Übel.

### 2. Das n-Problem — blockiert die Pip-Leiter vorerst

Philips eigene Regel: **keine Prozentzahl unter 100 entschiedenen Fällen.** Heute hat *keine*
Risikogruppe 100 DRs — Terzile 85, feste Bänder 49 bis 88. Damit gilt:

- **R-Leiter ungeteilt (n=255): sofort als Prozent anzeigbar.**
- **Pip-Leiter je Risikogruppe: heute nur als rohe Zahlen** („23 von 85"), nicht als Prozent.

Das löst sich mit dem Backfill (Task `trade-setups-ber-2026-zur-ck-backfillen-stichprobe-verdreifachen`):
rund 750–800 zusätzliche DRs bringen jede Gruppe deutlich über 100. **Die gruppierte Pip-Leiter
sollte deshalb erst nach dem Backfill scharf geschaltet werden** — vorher rohe Zahlen oder gar nicht.

### 3. Weitere Schnitte

Nach der Auswertung sinnvoll: Sweep-Herkunft (HTF vs. M5, seit 19.09. als
`trade_setups.ls_timeframe` mitgeschrieben) und Gegenkraft-Konstellation. **Nicht** nach Trend
schneiden — der 1H-Trend trennt nachweislich nicht (`filterTrend.py`). Jeder zusätzliche Schnitt
verschärft das n-Problem, also frühestens nach dem Backfill.

## Was serverseitig fehlt

Die Messung existiert heute **nur als einmaliges Python-Skript**. Für eine Live-Anzeige braucht es:

1. **Eigene Tabelle** (Vorschlag `dr_reach`): je Dealing Range `reach_pips`, `risk_pips`,
   `invalidated_at_sec`, `measured_until_sec`. `trade_setup_outcomes` ist am 20.09.2026 gelöscht
   worden (Migration `20260920100000`) — der Forward-Walk muss neu geschrieben werden, diesmal
   direkt gegen Philips Definition. Vorlage: `analysis/dr-reichweite/messeDrReichweite.py`.
2. **Backfill** über den Bestand. Muster: `supabase/functions/trading-monitor-mcp/scripts/backfillObZones.ts`.
3. **Fortschreibung in `poi-watcher`**, an derselben Stelle im Tick wie der frühere Resolve-Pass
   (nach dem `trade_setups`-Upsert) — die M5-Kerzen sind dort ohnehin schon geladen.
4. **Aggregations-Tool/Endpunkt**, das zu einer gegebenen DR die Vergleichsgruppe bildet und beide
   Leitern zurückgibt, inklusive `n` je Gruppe, damit die UI die 100er-Regel selbst durchsetzen kann.

## Wo es in der UI auftaucht

| Ort | Was |
|---|---|
| **TSC** (`TradeSetupCockpit.vue`) | Block an der Dealing Range: beide Leitern untereinander, je Zeile Strecke + Quote (oder rohe Zahl) |
| **Chart** | waagrechte Ticks bei `nahe OB-Kante ± k · Risiko`, beschriftet mit der Quote. Muster: `FibTickPrimitive` in `marketStructureRendering.ts`, Farben aus `chartColors.js` |
| **`find_targets`** | je Kandidat die Distanz in R ab der **OB-Kante** plus „historisch erreicht in N von M vergleichbaren DRs" |

Fallstrick bei `find_targets`: das Tool sortiert nach Distanz zum **aktuellen Preis**, die Statistik
hängt aber an der **OB-Kante**. Beim Anreichern gegen die Kante rechnen, nicht gegen den Preis.

## Definitionen (nicht neu herleiten)

- **Dealing Range** = der M5-Orderblock eines *erkannten* Trade-Setups (`trade_setups`), nicht jeder
  beliebige M5-OB. Path-A- und Path-B-Zeile desselben OB sind eine DR.
- **Referenz für alles** = nahe OB-Kante (`ob_bottom` bei Short, `ob_top` bei Long).
- **Risiko / 1 R** = nahe OB-Kante → Extrem-Fraktal (`fractal_price` der Path-A-Zeile).
- **Invalidierung** = Berührung des Extrem-Fraktals. Nie die OB-Kante.
- **Reichweite** = größte Bewegung in Trade-Richtung vor der Invalidierung. Docht zählt.
- **Start** = `ob_start_time` + 2 M5-Kerzen (600 s) — früher war die FVG nicht bestätigt.
- **Fenster** = 24 h.

## Reihenfolge

1. Backfill 2026 (eigener Task) — hebt alle Gruppen über die 100er-Grenze.
2. Serverseitige Messung + Fortschreibung (Punkte 1–3 oben).
3. R-Leiter im TSC — die geht auch schon ohne Backfill als Prozent.
4. Pip-Leiter je Risikogruppe, Chart-Ticks, `find_targets`-Anreicherung.

## Grenzen, die in die Anzeige gehören

Nur GBPUSD gemessen, EURUSD gar nicht. Zwei Monate, also eine Marktphase. 36 der 255 DRs haben
weniger als die halbe Fensterlänge (Wochenende oder Archivrand). Und: die Quoten sind **historische
Häufigkeiten, keine Wahrscheinlichkeiten** — das sollte an der Anzeige stehen, nicht nur in der
Doku.
