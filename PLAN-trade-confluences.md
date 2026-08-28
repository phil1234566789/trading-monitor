# Plan: Trade-Journal — Konfluenzen & Kontext je Trade

Ziel: Jeder Trade im Journal (`signals`) soll festhalten, **warum** er genommen wurde, nicht nur
was passiert ist (Entry/SL/Exit) — als Grundlage für spätere Statistik (z.B. "Winrate mit vs.
gegen den Trend", "Winrate nach Anzahl Bestätigungen"). Wird Stück für Stück abgearbeitet, ggf.
über mehrere Sessions verteilt. Checkboxen markieren den Fortschritt.

Bewusst **ausgeschlossen**: der volle Marktkontext (welche Sweeps vorher schon passiert sind, wie
sich die Struktur bis zu diesem Punkt entwickelt hat, etc.) — genau das macht Trading laut Philip
schwer, aber es ist (Stand jetzt) nicht klar, wie sich das sinnvoll programmatisch erfassen ließe.
Die Punkte unten sind die Teile, die sich konkret als Datenpunkt festhalten lassen.

---

## 1. Bestätigungen (Sweeps & OBs) — aktuell dran

Von welchen Sweeps/OBs kam die Kraft für die Long/Short-Bewegung? Gleicher Interaktions-
Mechanismus wie Targets (2026-07-28): Trade-Modus, Linie/Zone im Chart anklicken.

Testszenario: Short #105 — die auslösende OB ist über `trade_setup_id` verlinkt, aber der
vorangehende LQ-Sweep (der Setup-eigene `ls`) ist bisher nirgends als eigenständige Bestätigung
festgehalten.

- [x] `trade_confirmations`-Tabelle (Pivot/Sweep oder OB, sonst wie `trade_targets` aufgebaut:
      price/source_time/touched_time)
- [x] Klick-Mechanismus wiederverwenden (`findClickedTarget` in PriceChart.vue ist schon generisch
      für Pivot-Linie ODER OB-Zone) — dritter Arm-Zustand in Dashboard.vue neben Link/Target
- [x] Chart-Zeichnung (eigene Farbe, analog zu `tradeTarget`)
- [x] TradeEditModal.vue: Abschnitt "Bestätigungen" (Liste + hinzufügen/entfernen)
- [ ] **Später:** automatischer Übertrag statt manueller Nachpflege (Chat 2026-07-28: "ich mach
      jetzt per Klick die manuelle Nachpflege — später mal wird das automatisch übertragen") — wenn
      ein Trade direkt aus einem Trade-Setup übernommen wird (`createTradeFromSetup`), den
      Setup-eigenen `ls` (den auslösenden LQ-Sweep) automatisch als erste Bestätigung mit anlegen.
- [ ] **Offen:** Invalidation-Level (`signals.invalidation`, schon vorhanden, aus dem OB abgeleitet)
      wird bisher nirgends explizit angezeigt — weder als eigener Wert im Bearbeiten-Panel noch als
      eigene Chart-Linie, nur implizit als eine Kante der verlinkten Setup-OB-Box. Noch nicht
      entschieden, ob/wie das eine eigene Darstellung braucht.

**Status 2026-08-28:** `trade_confirmations` in `trade_evidence` umbenannt, mit generierter
`category`-Spalte — Confirmation (`kind` Pivot/OB, gibt das GO) vs. Confluence (`kind` Fib/
RSI-Divergenz, gibt nur Sicherheit ohne GO), siehe CLAUDE.md und `trading`-Repo
`trade-from-poi.md#confirmation-confluence-und-anti-confluence--wie-eine-dealing-range-go-bekommt`.
TSC UND TradeEditModal zeigen jetzt beide Kategorien als getrennte Sektionen
("Bestätigungen"/"Zusatzargumente"), auf beiden Ebenen (Idee/Entry).

## 2. Trend-Kontext

Mit dem Trend traden ist besser (bessere Targets/RR möglich) als gegen den Trend (braucht mehr/
bessere Bestätigungen, defensivere Targets). Beim Anlegen des Trades den `MarketStructureState`-
Trend (siehe `marketStructureAnalysis.ts`) einfrieren: war der Trade mit oder gegen den 1h-Trend?

- [ ] Feld auf `signals` (z.B. `trend_alignment`: `with` | `against` | `unknown`)
- [ ] Beim Übernehmen eines Setups (Trade-Modus) automatisch aus dem aktuellen
      `marketStructureState` ableiten, wie schon in `computeCockpitState`/TSC
- [ ] Anzeige in TradesTable/TradeEditModal

## 3. Session

Zu bestimmten Uhrzeiten kommt mehr Liquidität/Volatilität in den Markt. Beim Anlegen des Trades
festhalten, welche Session (`sessions.js`/`trading_schedules`) zum Entry-Zeitpunkt aktiv war.

- [ ] Feld auf `signals` (z.B. `session_label` — Snapshot, kein Live-Join, damit sich eine später
      umbenannte/gelöschte Session nicht rückwirkend auf alte Trades auswirkt)
- [ ] Automatisch aus `currentSessionDanger`/der Sessions-Liste beim Anlegen ableiten

## 4. Anti-Confluences

Es spricht fast immer auch etwas gegen den Trade — man muss abwägen, wie viel. TSC berechnet das
schon live (`computeAntiConfluences` in `tradeSetupCockpit.ts`, No-Go/Gewichtung). Beim Anlegen
des Trades den aktuellen Stand einfrieren.

- [ ] Feld auf `signals` (JSON-Snapshot der `AntiConfluence[]` zum Entry-Zeitpunkt, oder eigene
      1:n-Tabelle wie `trade_targets` — Entscheidung folgt, wenn Punkt 1-3 stehen)
- [ ] Anzeige in TradeEditModal

---

Reihenfolge 2-4 ist vorläufig — kann sich verschieben, je nachdem was sich beim Bauen von Punkt 1
als nächster sinnvoller Schritt zeigt.
