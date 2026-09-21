# Journal GBPUSD — Sicherung vor dem Quellenwechsel

Stand **21.09.2026**, gezogen aus `dealing_ranges` + `trade_positions` + `trade_setups`.
Alle Zeiten Europe/Berlin. **18 Dealing Ranges, 38 Positionen.**

Zweck: die cTrader-abgeleiteten Daten sollen gelöscht werden. Alles, was am Journal hängt und
beim Löschen mitginge, steht hier — damit es von Hand wieder eingetragen werden kann.

Was hier **nicht** drinsteht, weil es aus den Kerzen neu entsteht: die Chart-Objekte selbst
(`ob_zones`, `liquidity_levels`, `trade_setups`). Was hier drinsteht und **nicht** automatisch
wiederkommt: die Verknüpfung Trade → Setup, die Invalidierung der Idee und der Sweep, auf den
sie sich bezog.

---

## 27.07.2026 · Short · DR#11

| | |
|---|---|
| Richtung | **Short** |
| Invalidierung der Idee | 1,33183 |
| **Liquidity Sweep** | 1,33195 — Level entstand 27.07. 13:30, gesweept 27.07. 15:30 (**2.0 h alt**) |
| M5-Orderblock | 1,33161 – 1,33183, ab 27.07. 15:50 |
| verknüpftes Setup | `trade_setups#105` |

| Pos | Entry | Stop | Exit | Ergebnis | R | Quelle |
|---|---|---|---|---|---|---|
| #2 | 1,33146<br><sub>27.07. 16:17</sub> | 1,33182 | 1,32992<br><sub>27.07. 16:57</sub> | Gewinn | 4,28 | live |
| #3 | 1,33101<br><sub>27.07. 16:41</sub> | 1,33139 | 1,32992<br><sub>27.07. 16:57</sub> | Gewinn | 2,87 | live |

> **#2:** Split-Entry Teil 1 von 2 (16:17 Europe/Berlin).
> **#3:** Split-Entry Teil 2 von 2 (16:41 Europe/Berlin).

## 30.07.2026 · Long · DR#18

| | |
|---|---|
| Richtung | **Long** |
| Invalidierung der Idee | — |
| **Liquidity Sweep** | — (kein Setup verknüpft) |

| Pos | Entry | Stop | Exit | Ergebnis | R | Quelle |
|---|---|---|---|---|---|---|
| #18 | 1,33386<br><sub>30.07. 09:32</sub> | — | 1,33390<br><sub>30.07. 09:55</sub> | Gewinn | — | live |
| #19 | 1,33446<br><sub>30.07. 10:05</sub> | — | 1,33568<br><sub>30.07. 10:28</sub> | Gewinn | — | live |
| #20 | 1,33460<br><sub>30.07. 10:05</sub> | — | 1,33600<br><sub>30.07. 11:05</sub> | Gewinn | — | live |

## 31.07.2026 · Short · DR#23

| | |
|---|---|
| Richtung | **Short** |
| Invalidierung der Idee | — |
| **Liquidity Sweep** | — (kein Setup verknüpft) |

| Pos | Entry | Stop | Exit | Ergebnis | R | Quelle |
|---|---|---|---|---|---|---|
| #24 | 1,34063<br><sub>31.07. 16:09</sub> | — | 1,34342<br><sub>31.07. 16:37</sub> | Verlust | — | live |
| #25 | 1,34268<br><sub>31.07. 16:34</sub> | 1,34315 | 1,34332<br><sub>31.07. 16:37</sub> | Verlust | — | live |

> **#24:** so ne geile 4h OB Reaktion (FOREXCOM) und ich shorte dagegen, ich dummbatz
> **#25:** so ne geile 4h OB Reaktion (FOREXCOM) und ich shorte dagegen, ich dummbatz

## 31.07.2026 · Long · DR#24

| | |
|---|---|
| Richtung | **Long** |
| Invalidierung der Idee | — |
| **Liquidity Sweep** | — (kein Setup verknüpft) |

| Pos | Entry | Stop | Exit | Ergebnis | R | Quelle |
|---|---|---|---|---|---|---|
| #26 | —<br><sub>31.07. 17:57</sub> | — | —<br><sub>—</sub> | Gewinn | — | live |

> **#26:** so ne geile 4h OB Reaktion (FOREXCOM) und ich shorte dagegen, ich dummbatz

## 31.07.2026 · Short · DR#26

| | |
|---|---|
| Richtung | **Short** |
| Invalidierung der Idee | — |
| **Liquidity Sweep** | — (kein Setup verknüpft) |

| Pos | Entry | Stop | Exit | Ergebnis | R | Quelle |
|---|---|---|---|---|---|---|
| #36 | 1,34505<br><sub>31.07. 09:30</sub> | — | 1,34616<br><sub>31.07. 09:48</sub> | Verlust | — | live |
| #37 | 1,34378<br><sub>31.07. 10:25</sub> | — | 1,34576<br><sub>31.07. 10:55</sub> | Verlust | — | live |
| #38 | 1,34383<br><sub>31.07. 10:30</sub> | — | 1,34625<br><sub>31.07. 10:57</sub> | Verlust | — | live |

> **#36:** Wollte dieselbe Korrektur-Short-Idee wie später erfolgreich auf EUR spielen, aber GBP lief durchgehend gegen mich — danach auf EUR gewechselt, wo es funktioniert hat.
> **#37:** Re-Entry auf dieselbe Korrektur-Idee, GBP weiter gegen mich gelaufen.
> **#38:** Letzter Versuch auf denselben Short, danach abgebrochen und auf EUR gewechselt.

## 03.08.2026 · Short · DR#27

| | |
|---|---|
| Richtung | **Short** |
| Invalidierung der Idee | 1,34722 |
| **Liquidity Sweep** | 1,34709 — Level entstand 03.08. 09:35, gesweept 03.08. 14:35 (**5.0 h alt**) |
| M5-Orderblock | 1,34660 – 1,34722, ab 03.08. 14:40 |
| verknüpftes Setup | `trade_setups#170` |

| Pos | Entry | Stop | Exit | Ergebnis | R | Quelle |
|---|---|---|---|---|---|---|
| #39 | 1,34648<br><sub>03.08. 09:42</sub> | — | 1,34647<br><sub>03.08. 09:42</sub> | Verlust | — | live |
| #40 | 1,34639<br><sub>03.08. 09:43</sub> | — | 1,34526<br><sub>03.08. 11:02</sub> | Gewinn | — | live |
| #41 | 1,34639<br><sub>03.08. 09:43</sub> | — | 1,34600<br><sub>03.08. 12:44</sub> | Gewinn | — | live |
| #42 | 1,34602<br><sub>03.08. 10:08</sub> | — | 1,34529<br><sub>03.08. 11:02</sub> | Gewinn | — | live |
| #43 | 1,34602<br><sub>03.08. 10:08</sub> | — | 1,34601<br><sub>03.08. 12:34</sub> | Verlust | — | live |
| #44 | 1,34571<br><sub>03.08. 10:22</sub> | — | 1,34591<br><sub>03.08. 10:23</sub> | Verlust | — | live |
| #45 | 1,34549<br><sub>03.08. 12:25</sub> | — | 1,34571<br><sub>03.08. 12:28</sub> | Verlust | — | live |
| #46 | 1,34612<br><sub>03.08. 14:50</sub> | — | 1,34669<br><sub>03.08. 15:05</sub> | Verlust | — | live |
| #47 | 1,34621<br><sub>03.08. 14:55</sub> | — | 1,34669<br><sub>03.08. 15:05</sub> | Verlust | — | live |
| #48 | 1,34618<br><sub>03.08. 14:57</sub> | — | 1,34669<br><sub>03.08. 15:05</sub> | Verlust | — | live |
| #49 | 1,34606<br><sub>03.08. 15:14</sub> | — | 1,34481<br><sub>03.08. 15:54</sub> | Gewinn | — | live |
| #50 | 1,34606<br><sub>03.08. 15:14</sub> | — | 1,34534<br><sub>03.08. 16:02</sub> | Gewinn | — | live |

> **#39:** Erster Test der Ablehnung an der 1H-Widerstandszone (1,3466-1,3472) — sofort wieder raus. War ein Versehen
> **#40:** Zweiter Versuch derselben Idee, Teil 1 von 2 (0,1 von 0,2 Lot). Kurz nach dem ersten LS-Level (09:35 @ 1,34709).
> **#41:** Zweiter Versuch derselben Idee, Teil 2 von 2 (0,1 von 0,2 Lot), länger gehalten als Teil 1.
> **#42:** Dritter Versuch, Teil 1 von 2 (0,1 von 0,2 Lot), während der Erholung zurück in die Widerstandszone.
> **#43:** Dritter Versuch, Teil 2 von 2 (0,1 von 0,2 Lot), länger gehalten, am Ende ~Breakeven.
> **#44:** Weiterer Versuch, nach 1 Minute direkt gestoppt.
> **#45:** Versuch während der MMM-Session (10:30-13:00) — laut Handbuch mit Vorsicht zu behandeln, hier gestoppt.
> **#46:** Versuch direkt am später offiziell erkannten App-Setup (#172, LS 1,34709 + Fraktal 1,34722 + M5-OB 1,3466-1,34722) — von einem kurzen Spike auf 1,34669 gestoppt, bevor die eigentliche Bewegung losging.
> **#47:** Nachlegen auf denselben Versuch, vom selben Spike auf 1,34669 gestoppt.
> **#48:** Drittes Nachlegen kurz vor dem Fakeout-Spike, ebenfalls auf 1,34669 gestoppt — direkt danach kam der eigentliche Move.
> **#49:** Finaler, erfolgreicher Einstieg nach dem Fakeout. Teil 1 von 2, TP1 (strukturell 1,34486) fast exakt getroffen.
> **#50:** Teil 2 von 2, komplett geschlossen kurz nach der 16-Uhr-ISM-News aus Unsicherheit über Challenge-News-Regeln (siehe lessons.md Lesson 3). TP2 (1,34315) wäre ~1h später noch erreichbar gewesen.

## 07.08.2026 · Short · DR#28

| | |
|---|---|
| Richtung | **Short** |
| Invalidierung der Idee | 1,34578 |
| **Liquidity Sweep** | 1,34569 — Level entstand 06.08. 21:50, gesweept 07.08. 08:20 (**10.5 h alt**) |
| M5-Orderblock | 1,34533 – 1,34578, ab 07.08. 09:00 |
| verknüpftes Setup | `trade_setups#220` |

| Pos | Entry | Stop | Exit | Ergebnis | R | Quelle |
|---|---|---|---|---|---|---|
| #51 | 1,34504<br><sub>07.08. 09:19</sub> | — | 1,34478<br><sub>07.08. 10:33</sub> | Gewinn | — | live |
| #54 | 1,34492<br><sub>07.08. 09:21</sub> | — | 1,34478<br><sub>07.08. 10:33</sub> | Gewinn | — | live |
| #55 | 1,34489<br><sub>07.08. 09:24</sub> | — | 1,34479<br><sub>07.08. 10:33</sub> | Gewinn | — | live |

> **#51:** Short-Idee auf Basis des App-erkannten Setups #221. Schlechter Entry: das M5-OB wurde nicht abgeholt/retested, sondern der Kurs bereits deutlich unterhalb des OB gechased (Entry 1,34504 statt am OB ~1,3453-1,3458). Wegen der bevorstehenden MMM-Session (10:30-13:00) und bullischer LQ-Sweeps aus Angst komplett glattgestellt, obwohl die These nicht invalidiert war — Kurs lief danach weiter in Richtung Short-Target.
> **#54:** Zweite Ausführung derselben Scale-in-Short-Idee (siehe erste Position #51 für vollen Kontext: schlechter Entry, angstgetriebener Ausstieg vor MMM-Session).
> **#55:** Dritte Ausführung derselben Scale-in-Short-Idee (siehe erste Position #51 für vollen Kontext).

## 07.08.2026 · Long · DR#29

| | |
|---|---|
| Richtung | **Long** |
| Invalidierung der Idee | — |
| **Liquidity Sweep** | — (kein Setup verknüpft) |

| Pos | Entry | Stop | Exit | Ergebnis | R | Quelle |
|---|---|---|---|---|---|---|
| #52 | 1,34547<br><sub>07.08. 07:03</sub> | — | 1,34520<br><sub>07.08. 07:29</sub> | Verlust | — | live |

> **#52:** Kein reales Setup — ungeduldiger, regelloser Long-Einstieg direkt zu Handelsbeginn, ohne LS/OB-Bestätigung. Von Philip selbst als "absoluter Degen Quatsch, reines Gambling" eingestuft. Invalidation = Exit-Preis (kein technisches Level, rein deskriptiv).

## 07.08.2026 · Short · DR#30

| | |
|---|---|
| Richtung | **Short** |
| Invalidierung der Idee | — |
| **Liquidity Sweep** | — (kein Setup verknüpft) |

| Pos | Entry | Stop | Exit | Ergebnis | R | Quelle |
|---|---|---|---|---|---|---|
| #53 | 1,34526<br><sub>07.08. 07:43</sub> | — | 1,34540<br><sub>07.08. 07:50</sub> | Verlust | — | live |

> **#53:** Kein reales Setup — zweiter impulsiver Einstieg direkt nach dem ersten Verlust, wieder ohne Bestätigung. Von Philip selbst als ungeduldig/regellos eingestuft (Gambling). Invalidation = Exit-Preis (kein technisches Level, rein deskriptiv).

## 03.06.2026 · Short · DR#40

| | |
|---|---|
| Richtung | **Short** |
| Invalidierung der Idee | 1,34634 |
| **Liquidity Sweep** | — (kein Setup verknüpft) |

| Pos | Entry | Stop | Exit | Ergebnis | R | Quelle |
|---|---|---|---|---|---|---|
| #68 | —<br><sub>03.06. 09:45</sub> | — | —<br><sub>—</sub> | offen | — | backtest |

> **#68:** Reaktion an bestehendem M5-OB (1,34604-1,34634) + Asia-Mid (1,34611) im Kontext eines eine Ebene höher bestätigten 1H-Downtrends. Kein frischer 1H/M5-Sweep an dieser Zone (Bedingung 1 nicht im engen Sinn erfüllt), daher Kraft-Abwägung statt klassischem Trade-from-POI. Entry noch offen. Siehe trade-from-poi-beispiele.md Beispiel 5.

## 10.08.2026 · Short · DR#41

| | |
|---|---|
| Richtung | **Short** |
| Invalidierung der Idee | 1,35068 |
| **Liquidity Sweep** | 1,35057 — Level entstand 10.08. 10:15, gesweept 10.08. 11:10 (**0.9 h alt**) |
| M5-Orderblock | 1,35042 – 1,35068, ab 10.08. 11:30 |
| verknüpftes Setup | `trade_setups#236` |

| Pos | Entry | Stop | Exit | Ergebnis | R | Quelle |
|---|---|---|---|---|---|---|
| #69 | —<br><sub>10.08. 13:18</sub> | 1,35068 | —<br><sub>—</sub> | Gewinn | — | live |

> **#69:** Short-Idee auf Basis des App-erkannten Setups #236 — Sweep des HTF-Doppel-Widerstands (Wiederholungs-Sweep von 1,35062, 1,35088 nie erreicht), Reversal zusätzlich bestätigt durch M5-FVG, EMA50-Verlust und RSI-Kollaps (siehe Schritt-5-Chart-Notiz).

## 14.07.2026 · Short · DR#44

| | |
|---|---|
| Richtung | **Short** |
| Invalidierung der Idee | 1,34380 |
| **Liquidity Sweep** | — (kein Setup verknüpft) |

| Pos | Entry | Stop | Exit | Ergebnis | R | Quelle |
|---|---|---|---|---|---|---|
| #72 | 1,34030<br><sub>14.07. 17:18</sub> | — | 1,33866<br><sub>14.07. 17:41</sub> | Gewinn | — | backtest |

> **#72:** Short Dealing Range — BSL-Sweep zweier Medium Inducements (1,34377/1,34366, 10.07., 4 Tage alt) beim CPI-Spike, bärische M5-OB (1,34228–1,3438) direkt danach gebildet und beim ersten Retest (16:05) gehalten, seither stetig tiefere Hochs/Tiefs. 1H-Kerze 16:00–17:00 bestätigt bärisch unter 1,34113 geschlossen — Short läuft mit dem reaktivierten 1H-Bias (Trendrichtung, nicht Korrektur). Noch kein Entry/Trade-Position festgelegt (zurückgestellt).

## 25.08.2026 · Long · DR#46

| | |
|---|---|
| Richtung | **Long** |
| Invalidierung der Idee | 1,36219 |
| **Liquidity Sweep** | 1,36229 — Level entstand 24.08. 13:00, gesweept 25.08. 07:50 (**18.8 h alt**) |
| M5-Orderblock | 1,36219 – 1,36266, ab 25.08. 08:55 |
| verknüpftes Setup | `trade_setups#396` |

| Pos | Entry | Stop | Exit | Ergebnis | R | Quelle |
|---|---|---|---|---|---|---|
| #75 | —<br><sub>25.08. 08:55</sub> | — | —<br><sub>—</sub> | Gewinn | — | backtest |

> **#75:** Long-Idee auf Basis des App-erkannten Setups #396 (Schritt 5, Fall b).

## 25.08.2026 · Short · DR#56

| | |
|---|---|
| Richtung | **Short** |
| Invalidierung der Idee | 1,36528 |
| **Liquidity Sweep** | — (kein Setup verknüpft) |

| Pos | Entry | Stop | Exit | Ergebnis | R | Quelle |
|---|---|---|---|---|---|---|
| #83 | —<br><sub>25.08. 15:10</sub> | — | —<br><sub>—</sub> | Gewinn | — | live |

## 26.08.2026 · Short · DR#60

| | |
|---|---|
| Richtung | **Short** |
| Invalidierung der Idee | 1,36028 |
| **Liquidity Sweep** | 1,35988 — Level entstand 26.08. 17:40, gesweept 27.08. 15:20 (**21.7 h alt**) |
| M5-Orderblock | 1,35966 – 1,36028, ab 27.08. 15:40 |
| verknüpftes Setup | `trade_setups#434` |

| Pos | Entry | Stop | Exit | Ergebnis | R | Quelle |
|---|---|---|---|---|---|---|
| #87 | —<br><sub>26.08. 16:00</sub> | — | —<br><sub>—</sub> | Gewinn | — | live |

## 25.08.2026 · Short · DR#61

| | |
|---|---|
| Richtung | **Short** |
| Invalidierung der Idee | 1,36494 |
| **Liquidity Sweep** | 1,36446 — Level entstand 24.08. 17:25, gesweept 25.08. 11:00 (**17.6 h alt**) |
| M5-Orderblock | 1,36447 – 1,36494, ab 25.08. 11:20 |
| verknüpftes Setup | `trade_setups#401` |

| Pos | Entry | Stop | Exit | Ergebnis | R | Quelle |
|---|---|---|---|---|---|---|
| #88 | —<br><sub>25.08. 11:20</sub> | — | —<br><sub>—</sub> | Gewinn | — | live |

## 28.08.2026 · Short · DR#71

| | |
|---|---|
| Richtung | **Short** |
| Invalidierung der Idee | 1,35950 |
| **Liquidity Sweep** | — (kein Setup verknüpft) |

| Pos | Entry | Stop | Exit | Ergebnis | R | Quelle |
|---|---|---|---|---|---|---|
| #90 | 1,35876<br><sub>28.08. 10:03</sub> | 1,35950 | 1,35802<br><sub>28.08. 12:00</sub> | Gewinn | 1,00 | live |
| #91 | 1,35876<br><sub>28.08. 10:03</sub> | 1,35876 | 1,35876<br><sub>28.08. 12:30</sub> | Gewinn | 0,00 | backtest |

> **#90:** Setup #438, siehe dealing_range #71. 50%-Teilausstieg bei TP1 (1,35802) -- zweite Hälfte separat als eigene trade_position (Break-Even-Exit).
> **#91:** Setup #438, siehe dealing_range #71. Zweite Hälfte, SL auf Break-Even nach TP1-Treffer (10:00 Uhr) nachgezogen -- bei Rücklauf auf Entry-Niveau um 10:30 Uhr glatt (0R) rausgegangen, bevor der News-Spike um 16:00 Uhr kam.

## 28.08.2026 · Short · DR#78

| | |
|---|---|
| Richtung | **Short** |
| Invalidierung der Idee | 1,35976 |
| **Liquidity Sweep** | — (kein Setup verknüpft) |

| Pos | Entry | Stop | Exit | Ergebnis | R | Quelle |
|---|---|---|---|---|---|---|
| #92 | 1,35708<br><sub>28.08. 17:00</sub> | 1,35976 | 1,35372<br><sub>28.08. 19:10</sub> | Gewinn | 1,25 | live |

> **#92:** Entry im Pullback in die M5-OB-Zone (dealing_range #78), SL = Invalidierung. TP bei 1,35372 getroffen.
