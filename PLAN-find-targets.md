# PLAN: find_targets Algorithmus

Status: Refinement-Phase, noch kein Code, noch kein Task angelegt.

## Problem
Lana tut sich schwer, bei einer Long/Short Dealing Range die richtigen Targets zu finden.
Ziel: Datenaufbereitung, die Targets besser vorschlägt.

## Bisher geklärt
- Long: Target > aktueller Preis. Short: Target < aktueller Preis.
- Unterscheidung Trend vs. Countertrend (Trend kommt vorerst als Funktionsparameter rein, keine
  eigene Trend-Berechnung im Algorithmus).
- Countertrend: **1-2** Targets (Auswahlregel unter Kandidaten — OB vs. LQ Präferenz — noch offen;
  Korrektur 2026-08-27, vorher "ein Target").
- Trend: geordnete Kandidatenliste (Distanz), Lana/Philip wählen manuell.
- Target-Kandidaten:
  - OB-Kanten: Long -> Unterkante bärische OB. Short -> Oberkante bullische OB.
  - LQ-Levels.
- Verwendung: doppelt — visuell im Chart UND von Lana nutzbar (dieselbe Funktion/Logik).
- Chart-Integration: über neuen Button im TSC (Trade-Setup-Cockpit), nicht automatisch.
- Datenquelle (get_ob_zones/orderBlocks.js vs. get_near_relevant_liquidity_levels/liquidity.js
  vs. eigene Basis): noch offen.

## Vorbedingung: TSC-Neuaufbau
TSC ist veraltet und wird zuerst frisch gemacht, bevor an find_targets weitergearbeitet wird.

- TSC-Card (TradeSetupCockpit.vue) geleert: nur noch Karte + Header ("Trade-Setup-Cockpit" jetzt
  optisch als echter Header abgesetzt) + Trade-Modus-Icon. Alter Trend/LQ-Sweep/M5-Setup/
  Anti-Confluence-Inhalt raus. tradeSetupCockpit.ts (Datenaufbereitung/computeCockpitState) bleibt
  unverändert, nur die Darstellung ist leer.
- Neuer Umfang, den der TSC künftig monitort: **Bestätigungen (Confirmations)**, **Confluences**,
  **Anti-Confluences**, **Targets**.
- Vorgehen: Schritt für Schritt, Philip sagt an, was als Nächstes drankommt.
