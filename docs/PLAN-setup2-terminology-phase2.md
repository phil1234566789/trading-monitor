# Phase 2: gespeicherte DR-Begriffe (zur Freigabe)

Phase 1 ändert nur Anzeigen und Texte neuer Bewertungen. Keine vorhandenen Läufe oder Pins werden geschrieben, keine Algorithmus-Zustände geändert. Die historischen Statuswerte bleiben unverändert; insbesondere bedeutet `invalidated` je nach gespeichertem Grund Validierungsscheitern oder Preisende. Altstände bleiben unklassifiziert.

## Vorgeschlagene Änderung nach Freigabe

- Neue Stufenversion für Countertrend und das historische ABC-Modell einführen. Nur F/G-Showstopper verwenden künftig `disqualified`; ein Preisende bleibt Lifecycle-Ausgang (`invalidation`, `target1`, `both`), keine Disqualifikation. Die genaue Stufe beim Preisende muss vor Umsetzung fachlich festgelegt werden. Das ist eine Zustandsänderung und derzeit nicht autorisiert.
- Betroffene Schreib-/Lesepfade: `tradeSetup2DealingRange.js`, `countertrendDealingRange.js`, Snapshot-Erzeugung/Run-Konfiguration, `tradeSetup2Review.js`, `simulationRunComparison.js`, `tradeSetup2HistoryItems.js`, Checkliste, Filter/URL-Parameter sowie `simulationPinSnapshot.js` und Pin-Kontext. Gespeichert sind DR-Version, Status, Reason, Showstopper-Listen, Details und Pin-Stufe/Ausgang inklusive Label. SQL-Constraints und Backend-Validierungen vor Umsetzung auf feste Statuslisten prüfen.
- Alte Versionen ausschließlich versioniert lesen: `invalidated` mit `h1CounterDivergence`, `antiConfluence` oder `targetsUnavailable` als historische Validierungsentscheidung anzeigen; `priceInvalidation` als historisches Preisende. Fehlende/unbekannte Gründe nicht nachträglich fachlich klassifizieren. Unversionierte Altstände bleiben `legacy`. Keine Migration oder Neuberechnung alter Snapshots/Pins.
- Den gespeicherten Regel-Schalter `invalidates` nur in neuen Regelversionen zu `disqualifies` umbenennen; alte Regeln versioniert lesen. Reason-Werte bezeichnen Ursachen und können unverändert bleiben. `dealing_ranges.invalidation`, OB-/Trend-/Level-Zustände und Entry-Ausgänge bleiben unverändert.
- Pin-Kontext für neue Pins versionieren; alte Kontext-Snapshots lesen, ohne sie zu überschreiben. Anzeige-Labels aus belegten Statuswerten ableiten. Bestehende URLs mit `stage=invalidated` weiter lesbar halten; neue Filter nur nach festgelegter versionierter Semantik.

## Absicherung

Fixture-Tests für jede alte/neue Stufenversion, unbekannte Gründe und `legacy`; F/G-Fund versus Preisende (auch gleiche Kerze); gespeicherte Run- und Pin-JSONs vor/nach Lesen byte-identisch; Filter, Trichter, Karten, Kreuztabelle und Pin-Anzeige; Serienlauf mit erwarteten neuen Werten, getrennt vom Performance-v12-Vergleich. `npm run test` und `npm run build`.

## Reihenfolge

Phase 1 bleibt auf `codex/setup2-terminology`. Kein Merge/Push auf main, bevor Philip den Push der Performance-Arbeit bestätigt. Phase 2 wird erst nach Philips ausdrücklicher Freigabe dieses Plans umgesetzt. Keine Nachricht an einen anderen Chat ohne Philips Autorisierung.
