# Trade Setups 2.0: historische Positionen und Statistik

## Ziel und Grenzen

Die Erkennung aus [Trade Setup 2.0](PLAN-trade-setup-2.md) liefert unveränderliche Snapshots beim tatsächlichen M1-Entry. Ein reproduzierbarer historischer Lauf speichert diese und berechnet zwei alternative Stopvarianten. Journal, TSC und Brokerpositionen bleiben eigenständige Daten.

Referenzkonto: 50.000 USD. Risikobudget je Entry: immer 500 USD, ohne Zinseszins. Für GBPUSD und EURUSD beträgt die Standardlotgröße 100.000 Basiseinheiten. Startlots werden auf ganze Lots abgerundet; tatsächliches Risiko wird gesondert gespeichert. Unter einem Lot ist das Signal nicht ausführbar. Gold benötigt einen eigenen Vertrag und wird nicht mit dieser Berechnung simuliert.

## Berechnung

- Entry: Schluss der FVG-Bestätigungskerze. Exitprüfung beginnt mit der nächsten M1-Kerze.
- `wide`: Rand des zu C gehörigen erweiterten M5-OB. `narrow`: Extrem zwischen erstem C-OB-Retest und FVG-Bestätigung einschließlich.
- Vor T1 gilt der volle initiale Stop. T1 schließt exakt die Hälfte der Startlots; für die andere Hälfte gilt sofort Break-even am Entry. Danach T2 oder Break-even.
- T1 plus Break-even ergibt einen positiven Gesamtertrag. R bezieht sich auf das tatsächliche Anfangsrisiko nach Lotrundung.
- Gleichzeitige mögliche Ausgänge einer M1-Kerze bleiben uneindeutig. Fehlende Historie wird nicht als Verlust interpretiert. Ohne T2 bleibt die Restposition bis Break-even oder Auswertungsende offen.
- Berechnung auf Bid-OHLC, brutto ohne Spread, Gebühren, Slippage oder Aussage zur Margin-Verfügbarkeit.

## Gemeinsamer Datenvertrag

`src/tradeSetupSimulation.js` stellt Version, Sizing und reine chronologische Exitberechnung bereit. `src/tradeSetupSimulationRepository.js` kapselt den Datenbankzugriff. Zeitwerte sind Unixsekunden; UI-Daten und Filter werden in Europe/Berlin angezeigt.

Ein Run enthält `id, version, configuration, from, to, evaluatedAt, status, progress, coverage, provenance`. Die deterministische ID bindet Regelversion, Konfiguration, Zeitraum und Feedstand. Der Runner setzt die tatsächliche Obergrenze höchstens auf die letzte vollständig verfügbare Historie. Coverage beschreibt Lücken und unzureichenden Vorlauf auch bei null Entries. Wiederaufnahme verwendet dieselbe Run-ID.

Ein Entry enthält den unveränderlichen Snapshot des Domain-Moduls (`id, schemaVersion, instrument, setupKey, direction, knownAt, entry, checklist, m1Check, evidence`) und die zwei alternativen Ergebnisse. Lauf und Entry-ID bilden den Speicherschlüssel. Snapshots werden beim erneuten Speichern auf Gleichheit geprüft; Ergebnisstände dürfen nur vorwärts laufen. Die Ergebnisliste lädt kompakte Daten; vollständige Snapshots werden einzeln nachgeladen.

Repository: `saveRun(run)`, `saveEntries(runId, records)` mit `records=[{snapshot,outcomes}]`, `listRuns()`, `listResults({runId,instrument,variant,from,to})`, `getSnapshot(runId,entryId)`. Datumsfilter sind am Entryzeitpunkt unten inklusiv und oben exklusiv. Sämtliche Listen werden bis zur leeren Seite paginiert.

Erkannte Setups ohne Entry werden mit `saveSetups(runId,snapshots)` beim ersten beobachteten Stand gespeichert. `listSetups({runId,instrument})` zählt den ganzen Lauf unabhängig vom Entrydatumsfilter; `getSetupSnapshot(runId,setupId)` liefert den Detailstand. Setup- und Entryzahlen bleiben getrennt.

`listResults` akzeptiert zusätzlich `asOf`: T1 und Exit sind erst ab `t1RecognizedAt` beziehungsweise `exitRecognizedAt` sichtbar. `t1Time`/`exitTime` bezeichnen die zugehörige Kerzenöffnung. `t1PnlUsd` hält den gesicherten Teilgewinn, `realizedPnlUsd` den insgesamt bisher realisierten Betrag. Offene Restpositionen zählen nicht zur Winrate. `target1Price`/`target2Price` stehen für kompakte Chartmarkierungen ohne Snapshotabruf bereit.

Unklarheit wird ab `ambiguityRecognizedAt` sichtbar: bei einer widersprüchlichen M1-Kerze ab deren Schluss, bei einer Datenlücke ab dem ersten fehlenden Minutenabschluss. Explizit belegte Schließungsintervalle werden vorher übersprungen. Der spätere Auswertungshorizont datiert diese Ereignisse nicht um.

Ergebnis: `status` (`closed`, `open`, `ambiguous`, `notExecutable`), `reason`, `outcome` (`slBeforeT1`, `t1Be`, `t2` oder null), `variant`, `entryId`, `entryTime`, `entryPrice`, `stopPrice`, `lots`, `t1Lots`, `actualRisk`, `riskBudget`, `pnlUsd`, `rMultiple`, `t1Time`, `exitTime`, `exitPrice`, `evaluatedAt`. Unbekannte oder offene Gesamtergebnisse haben keinen erfundenen PnL.

## Oberfläche und historische Details

Neue Route `/statistik`: Lauf, Instrument, Entrydatum und genau eine Stopvariante filtern. Konto, Budget, tatsächliches Risiko, Rundung, Bruttoberechnung, Fortschritt und Coverage sind sichtbar. Rohzählungen unterscheiden SL vor T1, T1 plus BE, T2, offen, uneindeutig und nicht ausführbar. Winrate: positive Ergebnisse unter eindeutig geschlossenen ausführbaren Positionen; Nenner immer sichtbar, Prozentanzeige ab 50 Fällen. Kennzahlen gelten für den vollständigen Filterbestand.

Die Chartübersicht zeigt kompakte Entry-Exit-Linien und kleine T1-Marker für eine Variante. Klick lädt genau einen historischen Setup-Snapshot einschließlich Checkliste und Belegen, unabhängig von Indikatortoggles. Offene Linien enden am Auswertungsstand. Linkvertrag: `/?setup2=<snapshot.id>&run=<runId>&variant=wide|narrow`.

## Historischer Runner

Aufruf: `node scripts/tradeSetup2YearRun.mjs --settings=JSON --output=Verzeichnis [--publish=true]`. Der bestätigte Standardmodus `historical-d1-p4` verwendet jeweils damals bestätigte D1-P4-Pivots und die bestehende `resolveStructureStartTime` auf den damals verfügbaren H1-Kerzen. Ein älterer, manuell gewählter H1-Start gehört zur jeweiligen Replay-Konfiguration; daraus folgt kein allgemeines 21-Tage-Fenster. Der Datenvorlauf umfasst mindestens die konfigurierten 30 Kalendertage und sieben Tage vor dem benötigten historischen H1-Anker. Dieser Datenvorlauf ist von der fachlichen Anker-Auswahl getrennt.

Archivabfragen paginieren per Zeitcursor bis zur leeren Seite. Ein unveränderliches Manifest hält Sessions, News, Handelszeiten und Feedgrenzen fest. Lokale Kerzencaches, Downloadzwischenstände und tägliche Scancheckpoints ermöglichen Wiederaufnahme; die Run-ID bindet Quellcode, Konfiguration und Feedstand. Der gemeinsame Scanner prüft M5, anschließend aktive ABC-Kontexte und dort M1. Er speichert Kandidaten auch ohne Entry und Entry-Snapshots beim ersten tatsächlichen Erkennen. Die beiden Positionsergebnisse werden danach getrennt auf M1 bis zum Laufende berechnet.

Grenzen: Aktuelle Sessions werden rückwirkend angewandt; die historische Vollständigkeit des Newsarchivs ist nicht garantiert. Lücken einschließlich unbelegter Marktschließungen bleiben konservativ unklar. Gold ist ohne M1-Archiv ausgeschlossen. Der Archivstand des Pilotlaufs bietet M1 für GBPUSD und EURUSD ab 02.01.2026 um 07:31 Uhr Europe/Berlin, mit vorhandenem D1/H1/M5-Vorlauf; der Jahreslauf muss seine tatsächlich nutzbare Abdeckung gesondert ausweisen.

Referenzprüfung DR 114 mit der damaligen manuell fixierten Replay-H1-Konfiguration (`cutoff=1787302800`): sechs Kandidatensnapshots einschließlich des Entry-Setups, ein Entry am 09.09.2026 um 09:50 Uhr Europe/Berlin bei 1,35615, mit 8 beziehungsweise 15 Lots. Bei identischer Konfiguration ist die Übereinstimmung des gemeinsamen Erkennungskerns bestätigt. Der Standardmodus `historical-d1-p4` wählt einen anderen H1-Anker und liefert zwischen 09:25 und 10:00 Uhr an diesem Tag keinen Entry. Wegen der unterschiedlichen Konfigurationen ist kein identisches Entry-Ergebnis gefordert. Der Pilot bleibt ein separater Replay-Test und liefert keine fertigen Jahreskennzahlen.

## Zuständigkeit und Reihenfolge

1. Target/Statistik: Datenvertrag, Sizing/Exit-Tests, Repository und additive Migration. Milk-Task `trade-setup-2-0-reproduzierbaren-ergebnisvergleich-vorbereiten`.
2. M1/Domain: Entry-Snapshots, gemeinsame historische Erkennung und Chartdetails. Hauptplan bleibt dort; keine zweite Erkennungsimplementierung im Runner.
3. Zeitbasis/Runner: deterministischer, wiederaufnehmbarer Jahreslauf 2026, Coverage und Provenienz. Milk-Task `trade-setups-2-0-reproduzierbarer-jahreslauf-2026-aus-fxcm-archiv`.
4. UI: Statistikroute, vollständige Filterauswertung und historische Links. Milk-Task `trade-setups-2-0-statistikseite-mit-stopvarianten-und-teilausstiegen`.

Git-, Graph- und Datenbankänderungen werden zwischen den Besitzern abgestimmt. Fortschritt wird in Milk gepflegt.

## Abnahme

Sizing beweist 8 Lots bei 6 Pips (480 USD Risiko) und 15 Lots bei 3,3 Pips (495 USD); Teilmengen 4 bzw. 7,5 Lots. Tests decken beide Richtungen, Stopvarianten, SL vor T1, T1/BE, T2, Gleichkerzen-Unklarheit, Datenlücken, Entrykerzenausschluss und offene Restpositionen ab. Speicherung muss Wiederholungen, unveränderliche Snapshots und Pagination nachweisen. Der historische Lauf muss Grenzen und Lücken sichtbar machen; Stichproben im Chart müssen denselben Entrystand zeigen. Build, relevante Tests, Migration und veröffentlichte UI werden geprüft.
