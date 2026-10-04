# Begriffe: Inventar Phase 1

Datei und Zeile beziehen sich auf den Stand vor der Änderung. Gespeicherte Schlüssel und Werte bleiben unverändert.

| Datei | Zeile | Alter Text | Neuer Text |
|---|---:|---|---|
| `src/tradeSetup2DealingRange.js` | 10 | Invalidierte Dealing Range | Disqualifizierte Dealing Range |
| `src/tradeSetup2DealingRange.js` | 25 | Validierung/Invalidierung der neuen Strategie | Validierung/Disqualifikation der neuen Strategie |
| `src/checklistObservationRules.js` | 43 | invalidiert bei Fund | disqualifiziert bei Fund |
| `src/tradeSetupChecklistConfluences.js` | 162 | Invalidierendes Gegenargument | Disqualifizierendes Gegenargument |
| `src/components/SimulationRunQuality.vue` | 7 | Invalidierung vor T1 | Invalidation vor T1 |
| `src/components/SimulationRunQuality.vue` | 7 | T1 vor Invalidierung | T1 vor Invalidation |
| `src/tradeSetup2SavedRangeOutcome.js` | 32 | Target T1 zuerst erreicht | T1 vor Invalidation |
| `src/tradeSetup2SavedRangeOutcome.js` | 32 | Invalidierung zuerst erreicht | Invalidation vor T1 |
| `src/components/DealingRangeOutcome.vue` | 13 | DR erreichte Invalidierung vor T1 | DR-Ausgang: Invalidation vor T1 |
| `src/simulationRunComparison.js` | 8 | Lief bis T2 | T1 vor Invalidation · T2 erreicht |
| `src/simulationRunComparison.js` | 8 | Lief bis T1, nicht T2 | T1 vor Invalidation · T2 nicht erreicht |
| `src/simulationRunComparison.js` | 8 | Lief in die Invalidierung | Invalidation vor T1 |
| `src/simulationRunComparison.js` | 9 | T1 erreicht · T2 nicht belegt | T1 vor Invalidation · T2 nicht belegt |
| `src/simulationRunComparison.js` | 30 | Invalidierte Kandidaten speichern | Durch Preisende beendete Kandidaten speichern |
| `src/tradeSetup2HistoryItems.js` | 27 | invalidation:'invalidiert',target1:'T1 erreicht' | invalidation:'Invalidation vor T1',target1:'T1 vor Invalidation' |
| `src/tradeSetup2Review.js` | 97 | target1: 'T1 erreicht' | target1: 'T1 vor Invalidation' |
| `src/tradeSetup2Review.js` | 97 | invalidation: 'invalidiert' | invalidation: 'Invalidation vor T1' |
| `src/views/TradeSetup2Rules.vue` | 20 | die DR invalidiert | die DR disqualifiziert |
| `src/views/TradeSetup2Rules.vue` | 24 | validiert oder invalidiert | validiert oder disqualifiziert |
| `src/views/TradeSetup2Rules.vue` | 59 | Invalidierte Dealing Range | Disqualifizierte Dealing Range |
| `src/views/TradeSetup2Rules.vue` | 64 | „Invalidiert“ bezeichnet | „disqualifiziert“ bezeichnet |
| `src/views/TradeSetup2Rules.vue` | 79 | validierte, invalidierte und | validierte, disqualifizierte und |
| `src/views/TradeSetup2Rules.vue` | 88 | ist sie invalidiert | ist sie disqualifiziert |
| `src/views/TradeSetup2Rules.vue` | 89 | Target invalidiert die Range | Target disqualifiziert die Range |

Zusätzliche Anzeigeanpassungen: Preisende mit `reason=priceInvalidation` bekommt einen eigenen Anzeigetext statt Disqualifikation (Checkliste, DR-Karten, Replay-Auswahl, Historie). Pin-Ausgänge werden aus dem gespeicherten Status beschriftet; vorhandene Pin-Snapshots bleiben unverändert.

Bewusst unverändert: OB-/Trend-/Level-Invalidierung, M1-Trend „invalidiert“, Invalidierungslevel/-linien, Entry-Ausgänge, sämtliche Status-/Reason-/Versionswerte und Performance-Dateien. In docs/ und PLAN-notifications.md betreffen die Treffer diese anderen Konzepte, keine F/G-Disqualifikation.

| `src/components/DealingRangeOutcome.vue` | 13 | 👍 Loss verhindert / prevented | Kein Entry gespeichert / without-entry |
| `src/components/SimulationPinList.vue` | 34 | Gespeicherte Ausgangsbeschriftung | Aktuelle Ausgangsbeschriftung anhand des unveränderten Status |

Regelübersicht: der veraltete Hinweis auf eine eingeschaltete F-Sperre wird durch den aktuellen Beobachtungsstand ersetzt. Tests werden an die neuen Anzeigetexte angepasst.

PinPanel.vue:67: rohe historische Stufe / gespeicherter Ausgangstext → Anzeige-Helfer. Ohne gespeicherten Grund wird eine alte Pin-Stufe ausdrücklich nicht als Disqualifikation klassifiziert.

SimulationComparisonFilters.vue:20: DR-Stufenfilter → neue zentrale Beschriftung. Hinweis ergänzt: der unveränderte historische Wert `invalidated` filtert auch Preisenden, während der Trichter ausschließlich belegte Disqualifikationen zählt. Die Filtersemantik wird in Phase 2 versioniert getrennt.
