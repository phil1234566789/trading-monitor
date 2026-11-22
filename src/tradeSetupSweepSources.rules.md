# LS-Reaktion: Sweep-Quellen und Ablösung

Das Profil `ts11-ob-edge-p5-supersession-v1` ergänzt die bestehende TS1-Erkennung ausschließlich für LS-Reaktion. Ohne Opt-in bleiben TS2, Legacy-Kandidaten und Alarme unverändert.

- Eine bestätigte bärische M5-OB-Oberkante ist eine Short-Sweep-Quelle; eine bullische M5-OB-Unterkante entsprechend eine Long-Quelle. Formation bestimmt das Alter, der Schluss der tatsächlich folgenden FVG-Kerze die Verfügbarkeit. Quelle und echtes Williams-Fraktal bleiben unterschiedliche Typen.
- Ein M5-P5-LS A wird erst abgelöst, wenn ein eigenständiger gleichgerichteter M5-P5-LS B nach A's erstem Touch entstanden, kausal bestätigt und später selbst gesweept worden ist. B muss für Short höher, für Long tiefer liegen. `validUntil` ist der Schluss dieser späteren Sweep-Kerze.
- Ein weiterer Docht oder eine zweite Kerze derselben Sweep-Bewegung genügt nicht. Insbesondere ist das Hoch/Tief der ersten Touch-Kerze kein separat beauftragter Halteanker. Auch eine P2-, Reclaim- oder Kerzenzahl-Heuristik darf diese Datensatzrelation nicht ersetzen.
- Gleichzeitige Touches verdrängen einander nicht. H1-/Major-Level sowie OB-Kanten als ablösende oder abgelöste Quelle erhalten hier keine neue Ablöseregel. Der vorhandene Fortsetzungs-FVG-Filter bleibt unverändert.
- Kausale Auswertung endet bei der nativen Setup-Bestätigung. Später bekannte Pivots oder Touches dürfen diesen früheren Wissensstand nicht ändern; fehlende notwendige Daten werden unbekannt.
- Alle geeigneten Bestätigungen bleiben für den Trend-/Range-Herkunftsbeleg verfügbar. Die Anzeige enthält weiterhin höchstens drei, nach bestehendem Handelszeit-Alter sortiert. Ein separater `goWitness` nennt den tatsächlichen GO-Beleg; der älteste angezeigte Sweep muss nicht dieser Beleg sein.
- Die Roh-OB-Geometrie wird vor Bestätigungsablösung und Anzeigeauswahl bestimmt. Trend-Ranges werden nicht mit künstlichen OB-Pivots verändert. Die OB-Quellenprüfung verwendet die originale, mit `ignored` markierte Kerzenfolge, damit ausgelassene Kerzen keine neue FVG erzeugen.

Die Abgrenzung ist nötig, weil mehrere Kerzen zu einer Sweep-Bewegung gehören können. Ein Einzelkerzen-Haltefilter würde bestätigte Referenzen ungewollt ausschließen. Native Referenzen und Spiegel-/Präfixfälle: `test/tradeSetupObSweepReferences.test.js`, `test/tradeSetupSweepSources.test.js`; Laufzeitparität: `test/tradeSetupSweepParity.test.js`.
