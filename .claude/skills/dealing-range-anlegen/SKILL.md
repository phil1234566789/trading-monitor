---
name: dealing-range-anlegen
description: Checkliste zum Journalisieren einer bestätigten Dealing Range über den TSC-Weg (trading-monitor MCP) - create_dealing_range legt nur die Idee an, JEDE Bestätigung/jedes Zusatzargument/jede Anti-Confluence aus dem laufenden Ablauf braucht einen eigenen add_trade_confirmation-Call, sonst fehlt sie im TSC/Journal/Chart. Aufrufen, sobald Philip eine bestätigte Dealing Range anlegen lassen will (z.B. "leg die Dealing Range an", "Short Dealing Range anlegen").
---

# Dealing Range anlegen

Bug-Beispiel 19.08.2026 (GBPUSD, damals noch über `create_trade`): drei Bestätigungen nur in
`reasoning` als Fließtext erwähnt, nicht per `add_trade_confirmation` verknüpft — fehlten dadurch im
Journal/Chart. Philip: „ergebnis korrigieren reicht nicht" (drei Fehlerwiederholungen am selben Tag,
bis der Skill hier entstand). Gilt unverändert: eine Bestätigung im Text erwähnen ersetzt NIE den
eigenen Tool-Call.

Seit 2026-08-29 nur noch der TSC-Weg (siehe `claude-project-instructions.md`,
05-markt-beobachten.md, 06-anti-confluence.md) — `create_trade` (Range+Position in einem Call) nicht
mehr für diesen Skill verwenden, auch nicht im Backtest.

## Ablauf

1. **Erst `get_tsc_range(instrument)` prüfen**, ob für dieses Instrument schon eine aktive Idee
   existiert (kein Duplikat anlegen). Existiert keine: **`create_dealing_range(instrument,
   direction)`** — nur die Idee, `direction` aus dem bislang eindeutigsten Signal (ein OB korrigiert
   die Richtung später automatisch, siehe Punkt 2).

2. **Pro Bestätigung/Zusatzargument/Anti-Confluence aus dem laufenden Ablauf ein eigener
   `add_trade_confirmation`-Call**, `level="range"`, `id=<dealingRangeId aus Punkt 1>`. NICHT im
   `reasoning`-Text zusammenfassen — das reicht dem Tool nicht, sie bleibt sonst im Chart unsichtbar.
   - **`category`**: `kind='pivot'`/`'ob'` → `category='confirmation'` (GO-Signal) — Default, nicht
     mitgeben. `kind='fib'`/`'rsi_divergence'` → `category='confluence'` (zusätzliche Sicherheit,
     kein GO) — ebenfalls Default. Spricht ein Fund GEGEN den Trade (z. B. ein gegenläufiges OB oder
     eine gegenläufige Divergenz), explizit `category='anti_confluence'` mitgeben — sonst wird es
     fälschlich als Confirmation/Confluence gewertet (und ein gegenläufiges OB würde sogar die
     Range-Richtung umdrehen). Volle Begriffsdefinition:
     trade-from-poi.md#confirmation-confluence-und-anti-confluence--wie-eine-dealing-range-go-bekommt.
   - `sourceTime` ist PFLICHT und steht selten im Markdown-Output-Text der Analyse (dort oft nur
     ein grobes Datum wie "10.07., 4 Tage alt") — den exakten ISO-Timestamp aus der zugehörigen
     Pin-Zeile holen (`get_pin_context`, Felder `m5_liquidity_pivot_time`/`ob_zones.start_time` —
     Letzteres deckt auch M5-OB-Pins ab, `kind='m5_ob'` liefert seit Punkt 6 der ob_zones-
     Konsolidierung dieselbe ob_zones-Zeile wie `kind='ob_zone'`), nicht erfinden oder weglassen.
   - `kind="ob"`: `price` = `ob_bottom` bei Short, `ob_top` bei Long; `rangeLow`/`rangeHigh`
     PFLICHT (Zonenkanten); `timeframe` mitgeben (z. B. `"5M"`).
   - `kind="pivot"` bedeutet AUSSCHLIESSLICH Liquiditäts-Sweep, nichts anderes: `price` = der
     gesweepte Pivot-Preis (Kurs hat ihn angetippt/durchstochen und ist DANACH umgekehrt),
     `touchedTime` = wann der Sweep passierte. Ein Sweep ist ein Reversal-Signal in die
     GEGENRICHTUNG des gesweepten Levels (gesweeptes Tief → bullisch, gesweeptes Hoch → bärisch,
     siehe [Liquiditäts-Sweep](../../../../trading/liquidität.md#liquiditäts-sweep--mechanismus)).
   - `kind="rsi_divergence"`: `price`/`sourceTime`/`touchedTime` tragen den geprüften (jüngeren)
     Schwungpunkt (toPrice/toTime), `fromPrice`/`fromRsi`/`toRsi`/`divergenceType` den
     Referenzpunkt + beide RSI-Werte (siehe `get_forex_rsi`) — ohne sie ist die Divergenz später
     nicht mehr als Zwei-Bein-Konnektor nachzeichenbar, aber kein harter Fehler.
   - **Vor jedem `kind="pivot"`-Call explizit prüfen: ist das wirklich ein Sweep (antippen +
     umkehren), oder ein BOS/Bruch (Kerzenschluss durch das Level + Fortsetzung in dieselbe
     Richtung)?** Ein BOS ist die entgegengesetzte Mechanik zu einem Sweep (Fortsetzungssignal,
     kein Reversal) und hat KEINEN passenden `kind` in diesem Tool — nicht ersatzweise unter
     `kind="pivot"` eintragen, das erzeugt ein invertiertes, verwirrendes Bild (ein "Sweep" eines
     Tiefs sieht dann wie eine bullische Bestätigung aus, obwohl es als Short-Beleg gemeint war).
     Passt keiner der vier `kind`-Werte (`pivot`/`ob`/`fib`/`rsi_divergence`) zum eigentlichen Fund
     (z. B. BOS, EMA-Kreuzung, RSI-Level ohne Divergenz, Session-Timing), bleibt er nur im
     Reasoning-Text erwähnt, statt ihn in einen falschen `kind` zu zwingen — Freitext-Confluences
     ohne Chart-Anker sind weiterhin offen, siehe milk-city-Task
     `confluence-tracking-bei-dealing-ranges-add-trade-confirmation-kind-confluence`. Bug-Beispiel
     24.08.2026 (EURUSD, Dealing Range #45): ein echter BOS (1H-HL 1,16867 mit Kerzenschluss
     gebrochen) wurde fälschlich als `kind="pivot"` (= Sweep) eingetragen — Philip im Journal-UI:
     „wie kann eine Short-Bestätigung im unteren Bereich liegen" (zu Recht, ein gesweeptes Tief wäre
     bullisch gewesen). Es gab zudem kein Tool, den Fehler danach selbst zu korrigieren (kein
     `delete_trade_confirmation`) — Philip musste die Zeile manuell im Journal-UI löschen.

3. **Verifizieren per `get_tsc_range(instrument)`**, dass die Range mit allen Bestätigungen/
   Zusatzargumenten/Anti-Confluences UND dem Target auftaucht, bevor die Aufgabe als erledigt gilt —
   nicht nur auf die Tool-Response von Punkt 1 vertrauen. **NICHT `get_journal`** — das zeigt nur
   Ranges MIT `trade_positions`-Zeile, eine reine TSC-Idee (noch kein Entry) taucht dort nicht auf.

4. **Steht später ein echter Entry fest**, übernimmt `add_trade_position` diese Range in eine
   Ausführung — `create_dealing_range` NICHT ein zweites Mal für dieselbe Idee aufrufen.

## Warum ein eigener Skill (nicht nur eine Doku-Zeile)

Der Fehler ist kein Wissens-, sondern ein Vergessens-Problem — die Info stand schon in
`trading-monitor-mcp`s Tool-Beschreibungen. Ein Skill wird beim Anlegen einer Dealing Range aktiv
geladen (anders als eine Zeile in einer selten neu gelesenen Doku-Datei) und wirkt damit wie eine
Checkliste im richtigen Moment.
