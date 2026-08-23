# Plan: Forex-Chart-Objekte — Datengrundlage für Lana verbessern

Ziel: Lana (Laniakea) macht bei Trading-Analysen wiederholt Fehler. `docs/steerabilty-vs-wrong-ai-outputs.md`
und `docs/ai-fluency-4d.md` liefern dafür ein Vokabular statt nur "Lana hat wieder was übersehen" —
insbesondere das diagnostische Paar **Working Memory + Steerability → Drift in langen Sessions**.
Erste Idee (Philip, 2026-08-20/21): die Datengrundlage der Chart-Objekte (Order Blocks, Liquidity-
Level, Trade-Setups, RSI-Divergenzen) fest machen und wo möglich reduzieren, statt sie zu erweitern
— weniger mehrdeutige/mehrfache Repräsentationen desselben Objekts senken die Chance, dass Lana das
falsche/veraltete/doppelte Bild aufgreift.

BTC ist aus diesem Plan raus: Philip tradet es mit der aktuellen Strategie nicht mehr, komplette
Entfernung (Code, Cron, DB inkl. Journal-Historie) läuft als eigener milk-city-Task
(`btc-komplettes-rausschmeißen-code-cron-db-inkl-journal-historie`). Das war nebenbei der größte
konkrete Fall von "gleiches Objekt, andere Quelle je nach Kontext" (OB-Zonen: BTC = DB-Read über
`props.poiZones`, Forex = Live-Recompute in `collectObsZones()`, `PriceChart.vue`) — sobald der
BTC-Task erledigt ist, entfällt dieser Instrument-Branch von selbst. Dieser Plan hier ist der Rest:
was bleibt an Mehrfach-Repräsentation übrig, wenn nur noch Forex existiert.

---

## 1. Bestandsaufnahme: Erzeugung / Persistierung / Rendering / Referenzierung

Aus einer Code-Recherche 2026-08-20 (Explore-Agent über `src/`, `supabase/functions/`, `mcp-server/`).

| Objekttyp | Erzeugung | Persistierung | Rendering | Referenzierung |
|---|---|---|---|---|
| OB-Zone 1H/4H (Indikator) | `detectOrderBlocks()` — `src/orderBlockDetection.js` / `_shared/orderBlocks.ts`, Timeframe `1H`/`4H` | `ob_zones` (nur 1H/4H), Writer: `poi-watcher` alle 5min | `PriceChart.vue` `collectObsZones()` — für Forex live neu berechnet, nicht aus der DB gelesen | `pin_context.ob_zone_id` (FK) |
| OB M5 (Indikator-Overlay-Toggle) | dieselbe `detectOrderBlocks()`, Timeframe `"5m"` | keine (außer einmaligem Backfill-Script für Backtests, nicht laufender Cron) | gleicher Renderpfad wie 1H/4H, immer live | `pin_context.m5_ob_*` (Snapshot, keine FK) |
| Trade-Setup-OB (Teil des M5-Setups) | seit 2026-07-29 dieselbe `detectOrderBlocks(candles,"5m")`, aufgerufen aus `detectSetupObs()` in `tradeSetup.js` — davor eigene Logik, jetzt bewusst vereinheitlicht | `trade_setups.ob_top/ob_bottom/ob_start_time` — eigene Spalten, **keine FK auf `ob_zones`**, trotz identischer Erkennungsfunktion | eigener Renderpass `tradeSetupPrimitives`/`obBox`, **plus** ein dritter Pass `tradeSetupLinkPrimitives` für bereits geloggte Trades | `pin_context.trade_setup_id` (FK), `dealing_ranges.trade_setup_id` (FK) |
| Liquidity-Level 1H | `detectLiquidityLevels()` — `liquidityDetection.js` / `_shared/liquidity.ts` | `liquidity_levels` (nur 1H), Writer: `poi-watcher` | `filterRelevantLevels()` — reiner Anzeigefilter auf derselben Menge, kein Zweit-Query | `pin_context.liquidity_level_id` (FK) |
| Liquidity-Level M5/andere TF | gleiche Funktion, live auf angezeigtem Timeframe | keine | gleicher Renderer, live statt DB | `pin_context.m5_liquidity_*` (Snapshot) |
| RSI-Divergenz | `detectRsiDivergence()`/`...History()` — live, nie persistiert | keine | zwei Primitive-Beine (Preis + RSI-Pane); "History" + "Live" können dieselbe Divergenz absichtlich doppelt zeichnen (Code-Kommentar bestätigt das als bewusst) | `pin_context.rsi_divergence_*` (Snapshot) |
| Trade-Confirmation `kind='ob'` | aus angeklicktem Live-Objekt | `trade_confirmations.price`/`range_low`/`range_high` — Preis-Snapshot, keine FK | eigener vierter Renderpass `tradeConfirmationLinkPrimitives` | — |

Echte 1:1-Detection-Duplikate (zwei unabhängige Algorithmen für dasselbe Ding) gibt es **nicht mehr**
— OB-Detection ist seit 2026-07-29 vereinheitlicht, "relevant" ist überall eine reine Filterung
derselben Menge. Was bleibt, sind zwei andere Muster:

1. Live-Recompute statt DB-Read fürs Chart-Overlay (Forex) — potenziell abweichend von dem, was
   Lana über MCP (`get_ob_zones` etc., liest `poi-watcher`-persistierte Zeilen) sieht, wenn eine
   Kerze gerade läuft.
2. Mehrfache, unabhängige Zeichenpfade für dieselbe Preis-Fläche (Detail unten).

## 2. Gleiche Fläche, bis zu 4 unabhängige Zeichenpfade

`PriceChart.vue` hat vier separate Primitive-Arrays/Render-Pässe, die dieselbe zugrundeliegende
M5-OB-Fläche zeichnen können:

1. `orderBlockPrimitives` — normale Indikator-Zonen (`renderPersistedZones`, `refreshPoiZonesInternal`,
   `PriceChart.vue:1428-1433`), inkl. Pin-Halo/Select-Rahmen als Teil desselben
   `ZoneRenderer.draw()` (`src/orderBlocks.js:64-85`) — hier **keine** Duplikation, Halo wird im
   selben Primitive mitgezeichnet.
2. `tradeSetupPrimitives` — die Trade-Setup-Box selbst (`obBox`, `PriceChart.vue:2186-2203`), aus
   `computeTradeSetups()`/`detectTradeSetups()` — eigener Render-Pass.
3. `tradeSetupLinkPrimitives` — die "#<id>"-Box am ursprünglichen M5-Setup eines bereits geloggten
   Trades (`refreshTradeSetupLinksInternal`, `PriceChart.vue:882-957`) — Kommentar dort sagt
   explizit: "eigener Rendering-Pfad statt über collectObsZones/orderBlockPrimitives".
4. `tradeConfirmationLinkPrimitives` — die "✔ OB ..."-Bestätigungsbox
   (`refreshTradeConfirmationLinksInternal`, `PriceChart.vue:1099-1157`) — wieder ein eigener
   `OrderBlockPrimitive`, eigenes Array.

Die Überlappung ist im Code selbst schon bekannt: Klick-Handler-Kommentar `PriceChart.vue:2867-2869`
— *"Vor findClickedTarget geprüft, weil die Setup-OB-Box i.d.R. dieselbe Fläche wie eine generische
OB-Zone überdeckt"*. D.h. dieselbe M5-Preisregion kann gleichzeitig als normale Indikator-Zone
(falls `showObsM5` an), als Trade-Setup-Box UND als Trade-Confirmation-Box gezeichnet sein — drei
bis vier unabhängige Draw-Calls übereinander. `findNearbyPinCandidates()`
(`PriceChart.vue:2897-3008`) iteriert konsequent über alle vier Arrays getrennt und dedupliziert
Kandidaten erst nachträglich per `candidateKey()` (Z.2989-3007) — die Mehrfachheit ist also schon
an einer Stelle im Code als Problem behandelt worden, nur lokal (Klick-Zuordnung), nicht strukturell
(eine Fläche = ein Objekt).

Wichtige Einschränkung, bevor daraus eine Lösung wird: diese vier Renderpässe sind reine
**Chart-UI/Visualisierung für Philip** — Lana sieht sie über MCP nicht (die MCP-Tools liefern DB-
Zeilen bzw. einzelne live-erkannte Objekte, keine Zeichen-Primitives). Ob die Vierfach-Zeichnung
selbst ein Lana-Fehlerquelle ist oder "nur" eine visuelle Unschärfe für Philip, ist offen — siehe
Abschnitt 3.

## 3. Offen — wo die 4D/Steerability-Prinzipien konkret ansetzen

Noch nicht entschieden, nur skizziert:

- [x] Klären: ist die Vierfach-Zeichnung tatsächlich eine Lana-Fehlerquelle oder rein ein
      Philip-seitiges Chart-Klarheits-Thema? — **Beides**: Philip 2026-08-21: "außerdem stört es mich
      selbst wenn orderblöcke 4 mal doppelt und dreifach gezeichnet werden". Nicht nur ein
      Lana-Diagnose-Fall, sondern ein eigenständiger Grund für Konsolidierung — die Vierfach-Zeichnung
      ist damit nicht mehr nur hypothetisch riskant, sondern ein bestätigtes Problem.
- [x] **Description**-Prinzip (4D) — **bestätigt (Philip, 2026-08-21): ja, umsetzen.** Sobald Chart-
      Objekte eine geteilte `ob_zones.id` haben, bekommt `get_data_export` (und wo sinnvoll auch
      `get_ob_zones`/`get_trade_setups`/`get_pin_context`) diese ID mit in die Response, statt dass
      Lana über Preisnähe raten muss, ob zwei gelistete Objekte dieselbe physische OB sind. Kein
      eigener Task — ist der eigentliche Zweck der FK-Konsolidierung, als letzter Schritt im
      bestehenden Task (`chart-objekte-obs-auf-kanonische-ob-zones-id-konsolidieren`) ergänzt.
      Für Philips eigene Chart-Klarheit (s.o.) reicht das allein nicht — dafür braucht es weiterhin
      weniger tatsächlich überlappende Zeichenpfade im Chart selbst.
- [x] Live-Recompute vs. DB-Read fürs Forex-Chart-Overlay — **entschieden (Philip, 2026-08-21):
      1H/4H-Indikator-Overlay wird auf DB-Read (`ob_zones`) umgestellt, wie bei BTC.** Auslöser war
      ein konkreter, bereits bestehender Bug: die Live-Erkennung läuft über ein fest begrenztes
      Kerzenfenster (`OBS_4H_CANDLE_COUNT = 300` ≈ 50 Tage, `PriceChart.vue:377`; 1H analog über das
      Ranges-Lookback-Fenster begrenzt) — ein OB, der älter als dieses Fenster ist, wird schlicht
      nicht gefunden, weshalb Philip aktuell weit zurückscrollen oder Replay aktivieren muss, um
      alte OBs überhaupt zu sehen. `ob_zones` ist nicht ans geladene Kerzenfenster gebunden (Zonen
      bleiben erhalten, bis invalidiert), löst das Symptom also strukturell mit. M5 bleibt live
      (nur die referenzierte Teilmenge wird persistiert, nicht die volle M5-Historie, siehe
      Abschnitt 5).
      - **Rendering-Falle gefunden, gelöst (2026-08-21)**: DB-Read behebt nur "kennt das System den
        OB" — die Box wird trotzdem nicht gezeichnet, wenn die aktuell geladene Kerzenserie nicht
        bis zum `startTime` der Zone zurückreicht. `ZonePaneView.update()`
        (`src/orderBlocks.js:134`) ruft `snapToBarTime(candles, z.startTime)` auf `allCandles` (der
        geladenen Chart-Kerzenserie, nicht der DB-Zone selbst) auf — findet sich dort kein Balken,
        liefert das `null` → `x: null` → keine Box. **Ziel ist explizit die korrekt geformte Box zu
        sehen, auch wenn die Impuls-Kerze (noch) nicht geladen ist** (Philip: "das Ziel [ist]
        wirklich Monate alte aber relevante Levels und OBs im Chart zu haben, obwohl die
        OB-Entstehungs-Impuls-Candle noch nicht im Chart geladen ist") — ein reines Klemmen auf die
        älteste geladene Kerze (verworfene erste Idee) würde nur eine verkürzte, falsch geformte Box
        liefern, nicht die echte. **Lösung: automatisches Nachladen aus dem persistierten
        `forex_candles`-Archiv** statt Klemmen — kein teurer Live-cTrader-Call nötig (anders als die
        in CLAUDE.md dokumentierten cTrader-Timeout-Probleme), da `forex_candles` schon existiert und
        ein einfacher DB-Read ist ("archive-first"-Pattern, bereits an anderer Stelle etabliert).
        Sobald die DB-Query (s.u.) eine relevante Zone mit `startTime` vor der aktuell geladenen
        Kerzenserie liefert, wird im Hintergrund automatisch genug Archiv-Historie nachgeladen/
        vorangestellt, damit `snapToBarTime` einen echten Balken findet.
      - **Query-Eingrenzung per Pip-Distanz (2026-08-21)**: um nicht pauschal ALLE je erkannten
        Zonen aus `ob_zones`/`liquidity_levels` zu laden, wird serverseitig nach Pip-Abstand vom
        aktuellen Preis gefiltert (`abs(top - preis) <= schwelle OR abs(bottom - preis) <= schwelle`,
        analog für `liquidity_levels.price`) — bei den hier vorliegenden Zeilenzahlen (ein paar
        hundert bis niedrige tausend pro Instrument/Timeframe) rechnerisch vernachlässigbar teuer,
        kein Index nötig. Nutzt den bereits zentralisierten `PIP_SIZE`-Wert (`src/pipConfig.js`,
        gilt gleich für GBPUSD/EURUSD, die einzigen zwei Forex-Instrumente hier). **Wichtig: ersetzt
        NICHT** den bestehenden `touched`/`invalidated`-Filter, der "OBs" von "historische OBs"
        unterscheidet (`filterHistorical()`, `PriceChart.vue:1332-1334`) — Philip: "OBs und
        historische OBs unterscheiden sich fachlich stärker, da reicht ein Pip-Vergleich nicht aus."
        Die Pip-Schwelle grenzt nur ein, WELCHE Kandidaten überhaupt aus der DB geholt werden; ob ein
        Kandidat dann unter "OBs" oder "historische OBs" fällt, bleibt eine reine
        Touched-Zustand-Frage obendrauf, unverändert.
- [x] Falls eine echte Konsolidierung gewollt ist: welche der vier Renderpässe ließen sich
      zusammenlegen? — **Entschieden (Philip, 2026-08-21): strukturelle Konsolidierung, nicht nur
      Zeichen-Layering.** Ein einziger, kanonischer `ob_zones`-Eintrag pro OB (über alle Timeframes
      inkl. M5), überall per FK referenziert statt kopiert. Toggles (OBs, historische OBs,
      Trade-Setups, Dealing-Ranges, Pins) werden zu reinen Anzeigefiltern über dieselbe Menge.

## 4. Konsolidierungs-Ansatz (bestätigt, Details offen)

1. **M5-OBs live persistieren** — `poi-watcher` schreibt M5-Zonen (heute nur 1H/4H) ebenfalls in
   `ob_zones`. Kein Aufwands-/Performance-Problem laut Philip (im Gegensatz zur ursprünglichen
   CLAUDE.md-Doku, die das als bewusst unterlassen dokumentiert hatte — diese Begründung entfällt,
   Doku muss beim Umsetzen entsprechend korrigiert werden).
2. **`trade_setups.ob_top/ob_bottom/ob_start_time` → FK** `ob_zone_id references ob_zones(id)`
   statt kopierter Preis-/Zeit-Werte. Bestätigt: **trade_setups ist technisch eine Teilmenge der
   M5-Indikator-OBs** — `detectSetupObs()` ruft dieselbe `detectOrderBlocks(candles,"5m")` wie das
   M5-Indikator-Overlay auf (seit 2026-07-29 vereinheitlicht), d.h. sobald M5-OBs persistiert
   werden, ist die vom Trade-Setup verwendete OB immer auch ein regulärer Eintrag in `ob_zones` —
   kein Zweitfund nötig, nur ein Lookup per Natural Key (instrument/timeframe/direction/start_time)
   oder direkt die `id` aus demselben Lauf.
3. **`trade_confirmations.kind='ob'` → ebenfalls FK statt Preis-Snapshot** (kippt die bisherige
   bewusste Design-Entscheidung "eigene Tabelle, weil eine Bestätigung bereits passierte Evidenz
   ist" — Philip bestätigt das explizit als gewollt).
4. **`dealing_ranges.trade_setup_id` bleibt wie es ist, wird NICHT zu `ob_id`.** Geklärt in einer
   Diskussionsrunde (2026-08-21):
   - Dass **ein OB von mehreren, unterschiedlichen Sweep-/Fraktal-Events referenziert wird, ist
     ausdrücklich erwünscht**, kein Mangel (Philip: "dann dürfen halt beliebig viele Pivots die
     OB.id verlinkt haben ... genau das ist ein gutes Ergebnis der Datenbereinigung"). Bestätigt im
     Code: `findFirstSetupObAfter()`/`setupKey()` (`src/tradeSetup.js:30-36,139-141`) lassen bereits
     heute zu, dass Path A und Path B unabhängig voneinander auf denselben OB matchen — mit
     `ob_zone_id` als FK wird das nur sichtbar/explizit statt implizit über gleiche Preis-/
     Zeit-Werte.
   - Der eigentliche Grund, `trade_setup_id` zu behalten, ist **nicht** die Sweep-Mehrfachreferenz,
     sondern dass die gezeichnete Setup-Box NICHT die reine OB-Box ist: `tradeSetupObBoxBounds()`
     (`src/tradeSetup.js:221-225`) mischt die Fraktal-Preis-Kante mit nur EINER OB-Kante. Ohne
     `trade_setup_id` ließe sich diese exakte Trigger-Box nicht mehr rekonstruieren, nur noch die
     generische volle OB-Zone.
   - Philips Bedingung dafür erfüllt: **eine Dealing Range muss trotzdem eine einzelne OB direkt
     verlinken können**, unabhängig vom Trade-Setup — das übernimmt Punkt 3 (`trade_confirmations.
     kind='ob'` → `ob_zone_id`-FK), da `trade_confirmations` laut bestehendem Schema bereits
     dual-level ist und direkt an `dealing_range_id` hängen kann (nicht nur an `trade_position_id`).
     `dealing_ranges → trade_setups → ob_zones` UND `dealing_ranges → trade_confirmations →
     ob_zones` existieren damit nebeneinander, für unterschiedliche Zwecke (Ursprungs-Setup vs.
     einzelne bestätigende OB).

## 4a. Semantik "historische OBs"-Toggle + LQ-Levels (Klärung 2026-08-21)

- **"historische OBs" AN = die größtmögliche anzeigbare Gesamtmenge**, mehr geht nicht: alle OBs
  im aktuell geladenen Sichtfeld PLUS (neu, s.o.) alle pip-relevanten, die per Archiv-Nachladen
  ergänzt werden, obwohl ihre Impuls-Kerze ursprünglich nicht geladen war.
- **Beobachtung Philip**: der Toggle macht bei 1H/4H kaum einen sichtbaren Unterschied — er filtert
  in der Praxis fast ausschließlich bei M5-OBs spürbar etwas heraus. Reine Beobachtung, keine
  Konsequenz für den Ansatz oben, nur zur Einordnung, wo der Toggle überhaupt etwas bewirkt.
- **LQ-Levels, analoges Prinzip**: ein altes Level soll gezeichnet werden, wenn `indikator.liquidity`
  es AUCH erkannt/gezeichnet hätte, wären die nötigen Kerzen geladen gewesen — dieselbe
  Archiv-Nachlade-Logik wie bei OBs, kein eigenes Konzept.
- **Notiert, nicht jetzt zu lösen**: der `showSweptLiquidity`-Toggle ("Indikator.liquidity.sweeps")
  zeigt laut Philip zu viele Linien an (aktuell ungefiltert, alle Pivots — siehe
  `PriceChart.vue:1485-1490`). Eigenes, separates Thema, hier nur geparkt.

## 4b. Offen: Relevanz-Kriterium für einen lange zurückliegenden LQ-Sweep

Trivial für unberührte Level: Pip-Range-Check + `untouched`-Flag (wie oben). Für ein LÄNGST
gesweeptes Level ist unklar, wonach sich "noch relevant" richten soll — Pip-Nähe zum jetzigen Preis
ist hier nicht offensichtlich das richtige Kriterium wie bei unberührten Levels.

- [x] **Entschieden (Philip, 2026-08-21)**: bestehendes Muster aus `filterRelevantLevels()`
      (`src/liquidityDetection.js`, hält heute schon "alle unberührten + die letzten
      `RECENT_SWEEP_COUNT=2` berührten") wird zu einer ODER-Verknüpfung erweitert: ein berührtes
      Level zählt als relevant, wenn es ENTWEDER kürzlich gesweept wurde ODER aktuell in
      Pip-Reichweite zum jetzigen Preis liegt (unabhängig vom Alter des Sweeps, z.B. Retest eines
      alten Levels).

## 5. Persistierungs-Umfang (bestätigt, 2026-08-21) — nur die referenzierte Teilmenge, nicht das Universum

Nicht "jede M5-OB der ganzen Historie persistieren", sondern:

- **Indikator-Ebene (M5 OBs + historische OBs) bleibt Live-Recompute**, exakt wie heute — kein
  neuer Persistierungs-Bedarf. `detectOrderBlocks()` ist eine reine Funktion über abgeschlossene
  Kerzen: derselbe M5-Zeitraum liefert deterministisch immer dasselbe Ergebnis, egal ob live oder
  im Backtest neu berechnet — kein Drift-Risiko zwischen Indikator-Anzeige und einer später
  referenzierten Zeile. Deckt auch Lanas Backtesting ab (analog zu `get_data_export`s `m5ObZones`,
  die schon heute live über ein Rolling-Window neu erkennen).
- **Nur die referenzierte Teilmenge wird persistiert**: sobald ein konkreter OB tatsächlich für
  einen Trade-Setup, einen Pin oder eine Confirmation gebraucht wird, wird GENAU dieser eine OB per
  Natural Key (`instrument`/`timeframe='5M'`/`direction`/`start_time`) in `ob_zones` upserted und ab
  da per FK referenziert (Punkte 2+3 oben). `ob_zones` wächst organisch nur mit dem, was wirklich
  gebraucht wird, nicht mit dem gesamten M5-Universum seit 2026-01-01.
- **Altbestand (bestehende Snapshot-Zeilen in `trade_setups`/`trade_confirmations`/`pin_context`)**:
  kein Voll-Backfill, kein Neu-Erkennen nötig — **Prinzip (Philip, 2026-08-21): "wenn die OB
  irgendwann mal als relevant angesehen wurde, dann persistieren — passt so, selbst wenn sich
  `detectOrderBlocks()` später ändert. Die 'alten' OBs galten damals so wie sie erkannt wurden als
  relevant."** Der Nachzieh-Job führt also KEINE Neuberechnung über die Archiv-Kerzen aus (das hätte
  bei einer inzwischen geänderten Erkennungslogik das Risiko gehabt, einen anderen OB zu finden als
  damals) — stattdessen werden die bereits vorhandenen Snapshot-Werte
  (`trade_setups.ob_top/ob_bottom/ob_start_time`, `trade_confirmations.range_low/range_high`)
  unverändert 1:1 als neue `ob_zones`-Zeile übernommen (Upsert), danach die FK gesetzt. Kein
  Matching-Risiko, weil nichts neu erkannt wird — `ob_zones` ist damit teils live erkannt, teils ein
  historisch eingefrorenes Protokoll dessen, was zum jeweiligen Zeitpunkt als relevant galt, nicht
  zwingend das, was ein heutiger Re-Run liefern würde. Konsistent mit dem bereits bestehenden
  Verhalten von `poi-watcher` selbst (persistiert bei Erkennung, nie rückwirkend neu berechnet).
- [x] **Nebeneffekt, umgesetzt 2026-08-23 (Migration 20260823120000)**: `pin_context.kind='m5_ob'`
      (vorher eigene Snapshot-Spalten, siehe Abschnitt 1) nutzt jetzt `ob_zone_id` wie `ob_zone`/
      `trade_setup`/`liquidity_level` — eine Unterscheidung weniger im Pin-Schema. Beim Pinnen wird
      per find-or-create (dieselbe Funktion, die `trade_setups`/`trade_confirmations` schon nutzen)
      eine `ob_zones`-Zeile mit `timeframe='5M'` angelegt/gefunden, danach ein ganz normaler
      `kind='ob_zone'`-Pin gesetzt. `m5_ob` bleibt nur noch als clientseitiger Kandidaten-/Tool-
      Input-Wert übrig (Chart-Rechtsklick-Kandidat, `add_pin_entry`-Parameter) — nicht mehr als
      eigener DB-Wert. Einzige Nebenwirkung: `poi-watcher` erkennt/aktualisiert `touched`/
      `invalidated` weiterhin nur für 1H/4H live (M5 bleibt Live-Recompute-only fürs Indikator-
      Overlay, siehe Persistierungs-Umfang oben) — der Pin-Touch-Alarm (`resolvePinTouch`) und die
      Chart-Darstellung (`Dashboard.vue`: `pinnedObZones`) behandeln eine `timeframe==='5M'`-Zeile
      deshalb weiterhin wie vorher den Rohdaten-Snapshot (direkter Preis-Grenzen-Vergleich bzw.
      `touched: null` zum Self-Heal gegen geladene Kerzen), statt den nie aktualisierten DB-Wert zu
      glauben.
