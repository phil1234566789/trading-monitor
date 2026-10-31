# Entry Pattern 1

## Aktuelle Regel

Entry-Version `countertrend-entry-model-1-v11`, Setup-Version `countertrend-entry-model-1-v24`.

Ein bestätigter kausaler M5-BOS in Setup-Richtung ist Pflicht. Sein Ursprung muss zur relevanten M5-Countertrend-Range passen; ein BOS einer beliebigen Parent-Ebene genügt nicht. BOS und M1-Pivotbruch dürfen in beliebiger Reihenfolge entstehen, müssen aber spätestens zur FVG-Bestätigung bekannt sein. Fehlender, falscher oder erst später bestätigter BOS erlaubt keinen Entry und keinen halbgroßen Risky-Pfad.

Die übrigen Gates bleiben bestehen: validierte aktive DR, auswertbare native Historie, M1-Pivotbruch ab Sweep, passender M5-OB-Retest, erste gleichgerichtete M1-FVG nach Retest sowie das zentrale Handelszeiten-/Session-/News-Gate. Die Pflicht gilt ausschließlich für Entry Pattern 1.

Neue Entries erhalten die Kategorie Full und Faktor 1. Risiko, Lot-Abrundung, Stops, Targets und Exits folgen den bestehenden Helfern.

## Gemeinsame Ausführung und Alarme

- [entryPattern1Conditions.js](../src/entryPattern1Conditions.js): kausale Bedingungen und Strukturkategorie für Frontend, Batch und Live.
- [countertrendEntryPattern1.js](../src/countertrendEntryPattern1.js): Erkennung; [tradeSetup2EntrySizing.js](../src/tradeSetup2EntrySizing.js): eingefrorene Größe.
- [events.js](../services/setup2/events.js): Frühwarnung erst mit bekanntem M5-BOS und M1-Pivotbruch. Ein neuer Retest benötigt die bereits bekannte Strukturfreigabe. Der Entry-Alarm prüft zusätzlich die Bedingungen des tatsächlichen Entries. Alle Stufen bleiben an die zentralen Handelszeiten gebunden.
- [TradeSetup2Rules.vue](../src/views/TradeSetup2Rules.vue): sichtbare Fachregeln unter H. Der private fachliche Entscheidungsbaum wird vom Requirements-Chat gepflegt.

## Historische Belege

Entry-v10 behält seine damalige optionale BOS-Regel und die gespeicherten Full-/Risky-Kategorien. Archivreader, Größenmetadaten und frühere Run-Konfigurationen werden nicht umgeschrieben. Neue Konfigurationen und Memo-Identitäten verwenden v11/v24; die Regeländerung startet keinen Statistiklauf.

Regressionen: [t87M5BosRequired.test.js](../test/t87M5BosRequired.test.js), [entryPattern1M5Bos.test.js](../test/entryPattern1M5Bos.test.js), [t70RiskyEntry.test.js](../test/t70RiskyEntry.test.js) und die native historische Referenz [t70OriginalDr9312.test.js](../test/t70OriginalDr9312.test.js).
