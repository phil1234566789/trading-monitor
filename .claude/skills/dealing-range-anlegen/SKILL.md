---
name: dealing-range-anlegen
description: Checkliste zum Journalisieren einer bestätigten Dealing Range (trading-monitor MCP) - create_trade legt nur die Idee an, JEDE Bestätigung aus Schritt 5 braucht einen eigenen add_trade_confirmation-Call, sonst fehlen sie im Journal/Chart. Aufrufen, sobald Philip eine bestätigte Dealing Range anlegen lassen will (z.B. "leg die Dealing Range an", "Short Dealing Range anlegen").
---

# Dealing Range anlegen

Bug-Beispiel 19.08.2026 (GBPUSD): `create_trade` aufgerufen, die drei Bestätigungen aus Schritt 5
(zwei Medium-Inducement-Sweeps + M5-OB) aber nur in `reasoning` als Fließtext erwähnt, nicht per
`add_trade_confirmation` verknüpft — fehlten dadurch im Journal/Chart. Philip: „ergebnis
korrigieren reicht nicht" (drei Fehlerwiederholungen am selben Tag, bis der Skill hier entstand).

## Ablauf

1. **`create_trade`** — nur die Idee: `instrument`, `direction`, `source`, `tradingAccountId`
   (bei Unklarheit nachfragen, siehe `.claude/commands/l.md` Punkt 6), `invalidation`, `targets`.
   `entryPrice`/`stopLoss` NUR setzen, wenn tatsächlich schon ein Entry vorliegt — sonst leer
   lassen (Dealing Range ohne Position ist ein normaler Zustand, kein Fehler).

2. **Pro Bestätigung aus Schritt 5 ein eigener `add_trade_confirmation`-Call**, `level="range"`,
   `id=<dealingRangeId aus Schritt 1>`. NICHT im `reasoning`-Text von `create_trade`
   zusammenfassen — das reicht dem Tool nicht, die Bestätigung bleibt sonst im Chart unsichtbar.
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
   - **Vor jedem `kind="pivot"`-Call explizit prüfen: ist das wirklich ein Sweep (antippen +
     umkehren), oder ein BOS/Bruch (Kerzenschluss durch das Level + Fortsetzung in dieselbe
     Richtung)?** Ein BOS ist die entgegengesetzte Mechanik zu einem Sweep (Fortsetzungssignal,
     kein Reversal) und hat KEINEN passenden `kind` in diesem Tool — nicht ersatzweise unter
     `kind="pivot"` eintragen, das erzeugt ein invertiertes, verwirrendes Bild (ein "Sweep" eines
     Tiefs sieht dann wie eine bullische Bestätigung aus, obwohl es als Short-Beleg gemeint war).
     Passt keiner der drei `kind`-Werte (`pivot`/`ob`/`fib`) zur eigentlichen Bestätigung aus
     Schritt 5 (z. B. BOS, EMA-Kreuzung, RSI-Level), bleibt sie nur im Reasoning-Text erwähnt, statt
     sie in einen falschen `kind` zu zwingen — siehe milk-city-Task
     `confluence-tracking-bei-dealing-ranges-add-trade-confirmation-kind-confluence` für den noch
     fehlenden `kind` für genau solche Fälle. Bug-Beispiel 24.08.2026 (EURUSD, Dealing Range #45):
     ein echter BOS (1H-HL 1,16867 mit Kerzenschluss gebrochen) wurde fälschlich als
     `kind="pivot"` (= Sweep) eingetragen — Philip im Journal-UI: „wie kann eine
     Short-Bestätigung im unteren Bereich liegen" (zu Recht, ein gesweeptes Tief wäre bullisch
     gewesen). Es gab zudem kein Tool, den Fehler danach selbst zu korrigieren (kein
     `delete_trade_confirmation`) — Philip musste die Zeile manuell im Journal-UI löschen.

3. **Verifizieren per `get_journal`**, dass die Dealing Range mit allen Bestätigungen UND dem
   Target auftaucht, bevor die Aufgabe als erledigt gilt — nicht nur auf die Tool-Response von
   Schritt 1 vertrauen.

## Warum ein eigener Skill (nicht nur eine Doku-Zeile)

Der Fehler ist kein Wissens-, sondern ein Vergessens-Problem — die Info stand schon in
`trading-monitor-mcp`s Tool-Beschreibungen. Ein Skill wird beim Anlegen einer Dealing Range aktiv
geladen (anders als eine Zeile in einer selten neu gelesenen Doku-Datei) und wirkt damit wie eine
Checkliste im richtigen Moment.
