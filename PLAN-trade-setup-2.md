# Trade Setup 2.0 — Trade Setup Checklist

## Ziel und Arbeitsweise

Mehrere Setups anhand genau definierter Checklisten algorithmisch prüfen. Wir beginnen mit einem Setup und spezifizieren jeden Checkpunkt gemeinsam. Vorhandene Elemente wiederverwenden; bisherige Trade Setups, Trade Setup Cockpit und Trade Setup Bewertung bleiben erhalten.

Dieser Chat dient der fachlichen Planung. Implementationsarbeit wird über separate Milkyland Tasks vergeben.

## Festgelegte Oberfläche

Im Menü unter **Trades**:

- `Trades TSC` wird zu **Trade Setup Cockpit**.
- `Trades TSB` wird zu **Trade Setup Bewertung**.
- Neuer Menüpunkt **Trade Setup Checklist** mit Toggle.

Der Checklist-Toggle blendet einen eigenen Bereich ein beziehungsweise aus, analog zu den vorhandenen Bereichen für Cockpit und Bewertung.

### Gespeicherte Trade Setups 2.0

Ein eigener Toggle **Trade Setups 2.0** zeigt die letzten N simulierten Positionen je Richtung als kompakte Entry→Exit-Linien. Weiter und enger SL sind getrennt auswählbare Alternativen. Ein T1-Teilverkauf darf eine kleine Marke erhalten. Unklare Verläufe erhalten keinen erfundenen Exit; vor ihrem Erkennungsschluss erscheinen weder T1 noch Exit oder Ergebnis im Replay.

Ein Klick auf eine Positionslinie oder die Auswahl lädt genau einen gespeicherten Setup-Stand mit seiner damaligen Checklist A–J und den zugehörigen Preis-/Zeitbelegen. Dieser Stand bleibt nach T1, Neuladen und direkten Replay-Sprüngen abrufbar. Einzelne Indikator-Toggles sind keine Voraussetzung für seine Zeichnungen. Während der Detailansicht ersetzen gespeicherte Struktur-/Zonen-/Levelbelege die überlagernden aktuellen Zeichnungen; „Zur Übersicht“ stellt die vorherigen Toggles wieder her.

Kandidaten werden auch ohne Entry gespeichert. Entry-Snapshots entstehen am tatsächlichen Bestätigungsschluss und enthalten die damaligen Prüfergebnisse, Referenzen, Struktur, Sweep, Reaktions-OB, Targets, zugeordnete Divergenzen, M1-Signale, Retest und FVG. Sie sind serialisierbare Fachobjekte ohne Canvas-Koordinaten und werden nachträglich nicht durch einen späteren Marktstand überschrieben. Auf M5 werden M1-Ereignisse zeitlich innerhalb der vorhandenen Kerze projiziert; RSI-Belege bleiben an ihren Timeframe gebunden.

Simulationen bleiben von echten Journalpositionen getrennt. Festes Modell: 50.000 Dollar Konto, höchstens 500 Dollar Risiko, Startgröße auf ganze Lots abgerundet, Hälfte an T1, Rest mit BE-Stop bis T2 oder BE. Der bestehende Entry-1-Trigger gilt ohne neues Gesamt-GO; das Ende des aktiven Setups an T1/Invalidierung beendet keine bereits simulierte Position. Speichermodell und Jahresauswertung stehen im [Statistikplan](PLAN-trade-setup-2-statistik.md).

### Zeitangaben in der Checklist

Kalenderdatum und Bewertungszeit stehen im Kopf. Alle sichtbaren Details A–J einschließlich
M1-Stand zeigen ausschließlich knappe Berlin-Uhrzeiten (`um HH:mm`, Zeitspannen `HH:mm → HH:mm`,
Wartezeiten `bis HH:mm`), keine wiederholten Kalenderdaten. `formatBerlinTime` aus `berlinTime.js`
wiederverwenden; die fachliche Wahl zwischen Kerzenzeit und Erkennungszeit bleibt erhalten.
Preise, Levelalter und Dauern bleiben stehen. Datenmodell und erklärende Tooltips dürfen vollständige
Zeitstempel enthalten. Neue Detailzeilen müssen die UI-Regressionsprüfung ohne sichtbare Kalenderdaten bestehen.

## Fachliche Ausrichtung

Das Cockpit wurde ursprünglich dafür aufgebaut, dass Lana es befüllt. Die neue Checklist soll zunächst ohne Lana arbeiten: Ein Algorithmus prüft die Checkpunkte der Reihe nach und hakt sie bei Erfüllung ab.

Die konkreten Bedingungen, Reihenfolge und Bedeutung der Checkpunkte folgen von Philip und werden hier gemeinsam präzisiert. Bis dahin keine Erkennungsregeln vorwegnehmen.

Die Checkliste ist **automatisch und nicht manuell editierbar**. Ihr Ergebnis richtet sich nach dem betrachteten Chart-/Replay-Zeitpunkt. Ein Zeitwechsel berechnet die Punkte neu; es wird keine manuell festgehaltene TSC-Idee übernommen. Im Live-Betrieb aktualisiert eine neu verfügbare, abgeschlossene M5-Kerze die Marktanalyse. Session-/News-Grenzen werden zusätzlich zeitgerecht geprüft. Technische Machbarkeit und offene Definitionen stehen am Ende dieses Plans.

**Festgelegte Auswahl und Gültigkeit:** Es zählt der **älteste zulässige Sweep**, mit derselben Alterspriorität wie in der bestehenden Trade-Setup-Erkennung (Alter des Levels bis zu seinem Sweep, nicht die am längsten zurückliegende Berührung). Das Setup endet, sobald das **Invalidierungslevel oder das erste Target angelaufen** wird. Das zweite Target ist optional und verlängert die Gültigkeit nicht. Bullische und bärische Setups können gleichzeitig bestehen. Die Hauptcheckliste betrachtet nur die zur aktuellen bestätigten H1-Richtung aus A passende Richtung; das gegenläufige Setup beziehungsweise dessen Sweep fließt in **E — Anti Confluences** ein. Keine pauschale gegenseitige Löschung der beiden Richtungen.

## Prüfbeispiel

**Dealing Range 114 in GBPUSD**, laut Philip bereits im Journal und im TSC vorhanden. An diesem Beispiel soll die erste Checkliste nachvollzogen und abgetestet werden. Im Journal bestätigt: Short, Position 135, verknüpftes Trade Setup 3088, Handelszeitpunkt 09.09.2026 um 09:20 Uhr (Europe/Berlin). Die Einzelmerkmale werden schrittweise geprüft; siehe Punkt D.

## Späterer Vergleich

Ergebnisse der bisherigen und neuen Trade Setups vergleichen, insbesondere die Winrate. Vergleichszeitraum, Zuordnung und weitere Kennzahlen sind noch zu definieren.

## Implementationsaufgaben

- Menübezeichnungen ausschreiben: `trades-men-trade-setup-cockpit-und-trade-setup-bewertung-ausschreiben`.
- Checklist-Toggle und eigenen Bereich ergänzen: `trade-setup-checklist-eigener-men-toggle-und-bereich`.

Weitere offene Milkyland-Arbeitspakete, nach technischer Prüfung angelegt:

1. Zeitbasis und automatische Auswertung: `trade-setup-checklist-gemeinsame-zeitbasis-und-automatische-auswertung`.
2. B/C — Sweep und Reaktion: `trade-setup-checklist-b-c-sweep-zuordnen-und-m5-reaktion-pr-fen`.
3. D — Targets: `trade-setup-checklist-d-p2-und-p5-targets-automatisch-bestimmen`.
4. E/G — Gegenargumente und Zusatzargumente: `trade-setup-checklist-e-g-gegenargumente-und-zusatzargumente-zuordnen`.
5. F — Session/News: `trade-setup-checklist-f-session-und-news-zum-bewertungszeitpunkt`.
6. H — frühere M5-Drehung: `trade-setup-checklist-h-fr-he-m5-drehung-anhand-von-schlusskursen`.
7. Späterer Vergleich: `trade-setup-2-0-reproduzierbaren-ergebnisvergleich-vorbereiten`.

Die Tasks enthalten Abhängigkeiten, offene fachliche Entscheidungen und Abnahmekriterien. Die Umsetzung wird in separaten Codex-Chats vergeben, siehe Parallelisierungsplan am Ende. H verwendet die in Abschnitt H festgelegten frühen Schlusskurssignale; I zeigt die Einzelprüfungen aus Abschnitt I. Eine endgültige Setup-Freigabe setzt die noch offenen Pflichtregeln voraus.

## Checkliste des ersten Setups

### A / #1 — 1-Stunden-Trend

Als Erstes die **aktuelle bestätigte 1-Stunden-Strukturrichtung** prüfen. Sie bestimmt die Richtung der Checkliste und steht vor der Sweep-Bestätigung.

Maßgeblich ist die **tiefste aktuell bestätigte Ebene** der aktiven Kette Outer → Nested → Nested … aus der vorhandenen H1-Strukturerkennung, analog M1. Unbestätigte (`unknown`) Kandidaten und archivierte Ebenen zählen nicht. Ohne bestätigte Nested-Ebene gilt der Outer-Trend. Bei der Übernahme einer Nested-Ebene zum Outer bleibt die Richtung gleich; äußere Ebenen werden als Kontext angezeigt.

Für Short muss diese aktuelle Richtung bärisch sein, für Long bullisch. Gespeicherte Läufe mit der früheren Outer-Regel bleiben unverändert zum Vergleich erhalten; die neue Regel erhält eine eigene Laufversion.

Philip möchte grundsätzlich mit dem 1-Stunden-Trend handeln. Trades gegen diesen Trend sollen höchstens sehr selten vorkommen, möglichst gar nicht. Für diese Checkliste ist keine Gegentrend-Ausnahme definiert. Der Punkt wird anhand des erkannten Trends geprüft, nicht pauschal als erfüllt markiert.

### B / #2 — Liquidity Sweep

**Kurzbezeichnung in der Checklist:** Liquidity Sweep.

#### Fachliche Bedingung

Ein Inducement (hier gleichbedeutend mit Liquidity Sweep) in der **aktuellen bestätigten H1-Richtung aus A** bildet die Sweep-Bestätigung. Die Level-Erkennung nutzt weiterhin den vollständigen bestätigten Strukturbaum.

Historische Einordnung von DR 114 unter der früheren Outer-Regel (keine Ausnahme für den neuen Lauf):

- 1-Stunden-Struktur-Trend: **Downtrend**.
- Nested-Struktur-Trend: **Uptrend**.
- Der kurzfristige Aufwärtstrend erreicht das High und führt zum **Major Inducement**. Der Sweep gehört zum Setup in Richtung des übergeordneten Downtrends.

Ein **Major Inducement** ist zulässig, ebenso ein **Medium Inducement**. Als weitere Möglichkeit nennt Philip einen Liquidity Sweep eines älteren Levels, vorläufig beispielsweise **über 10 Stunden**. Diese Altersschwelle ist noch nicht festgelegt und darf noch nicht als feste Regel implementiert werden.

#### Anzeige am Prüfbeispiel

- Checklistenpunkt: **B / #2 — Liquidity Sweep**.
- Detailbeschreibung: **New York High Major Sweep — 6 Tage und 19 Stunden**.

Die Checklist soll den konkreten Sweep samt Alter anzeigen. Die Beispielwerte stammen aus Philips Beschreibung; sie wurden noch nicht anhand der gespeicherten Daten geprüft.

#### Technischer Anknüpfungspunkt

Laut Philip bringt der vorhandene 1-Stunden-Strukturalgorithmus die erforderlichen Elemente bereits mit: den übergeordneten Downtrend, den Nested-Struktur-Trend sowie die Pivot-Struktur und deren Sweep. Diese vorhandenen Ergebnisse sollen verwendet werden. Die genaue technische Zuordnung und der Zeitpunkt, ab dem die Bedingung erkannt werden kann, werden später geprüft.

#### Noch zu präzisieren

- Mindestalter und genaue Zulässigkeit eines Sweeps außerhalb der Major-/Medium-Einstufung.
- Vorhandene Altersdefinition verwenden: vom Pivot bis zum Sweep-Touch, wochenendbereinigt. Es gewinnt der älteste zulässige Sweep; das Setup bleibt bis zum Anlaufen seiner Invalidierung oder seines ersten Targets gültig.
- Exakter Erkennungs-/Bestätigungszeitpunkt der Bedingung.

### C / #3 — Reaktion aus Liquidity Sweep

#### Fachliche Bedingung

Auf den Liquidity Sweep aus Punkt B soll eine ordentliche bärische Reaktion folgen. Sie zeigt im Beispiel, dass das Major Inducement eine Reaktion hervorruft.

Für die erste Version dient ein **bärischer M5-Orderblock** als Reaktionsnachweis. Dazu werden die zugehörige **Fair Value Gap (FVG) samt ihrer Stärke** und das **Risikoband des Orderblocks** angezeigt. Diese Merkmale reichen Philip zunächst zur Beschreibung der Reaktion.

#### Anzeige am Prüfbeispiel

- Checklistenpunkt: **C / #3 — Reaktion aus Liquidity Sweep**.
- Checkbox: **M5-bärischer Orderblock**.
- Detail: **Fair Value Gap mit ihrer Stärke**.
- Detail: **Risikoband des Orderblocks**.

Konkrete Werte für FVG-Stärke und Risikoband wurden noch nicht angegeben oder anhand von DR 114 geprüft. Zusätzliche Checkboxen oder Mindestwerte für diese beiden Details sind bislang nicht festgelegt.

#### Technischer Anknüpfungspunkt und spätere Erweiterungen

Philips Festlegung: C ist erfüllt, wenn die bestehende Trade-Setup-Erkennung einen Sweep samt OB erkennt und der ausgewählte B-Sweep zu dessen zugeordneten Sweeps gehört. Die Identität umfasst Quelle, Richtung, Pivotzeit, Preis und Touchzeit; Preisgleichheit allein reicht nicht. Bei Mehrfach-Sweeps zählt jeder zugeordnete Sweep. B wird nicht ausgetauscht, nur damit C erfüllt ist. OB, FVG und strukturelles Risikoband stammen aus der bestehenden Erkennung; Long gilt spiegelbildlich. Nur geschlossene Präfixe verwenden, keine heutigen persistierten Setups im Replay.

Die Reaktionsbewertung kann später um **Wicks (Dochte)** oder **Closes (Schlusskurse)** erweitert werden. Diese Erweiterungen gehören noch nicht zur ersten Version.

### D / #4 — Targets bestimmen

#### Fachliche Beschreibung

Die Ziele werden aus den bestätigten, unberührten M5-Liquiditätspivots der relevanten Sessions bestimmt. Für Short zählt der **tiefste zulässige Pivot je Session**, für Long spiegelbildlich der **höchste**. Die bestehende Pivot-Erkennung und der Filter für ignorierte Sessions bleiben maßgeblich. Rohkerzenextrema, Cluster-Abstände und RSI sind keine zusätzlichen Auswahlkriterien. Die H1-Strukturperioden bestimmen die Targets nicht.

**Target 1** ist das nächste Session-Pivotextrem in Zielpreisrichtung. **Target 2** stammt aus einer anderen Session und liegt weiter in derselben Zielpreisrichtung; es ist optional. Eine zeitlich vorherige Session kann auf der falschen Preisseite liegen. Keine fest codierten Sessionnamen, Preise oder Datums-Ausnahmen. Bei gleichem Preis innerhalb derselben Session bleibt der ältere Pivot erhalten.

**Fixierung:** Sobald C mit Sweep und zugehörigem OB tatsächlich bekannt ist, werden beide Targets aus dem bis dahin geschlossenen M5-Präfix bestimmt. Referenz ist dessen letzter nicht ignorierter Schlusskurs. Preise, Pivotquellen und Auswahlzeit bleiben danach fest. Ein bereits aus geschlossener H1-Struktur bekanntes Level kann innerhalb der laufenden Stunde durch geschlossene M5-Kerzen gesweept werden; zukünftige H1-Kurse werden dafür nicht verwendet. Für DR 114 ist B um 09:15 Uhr bekannt und C am 09.09.2026 um **09:30 Uhr (Europe/Berlin)** bestätigt, entsprechend Replay 09:25. Hier werden die Targets fixiert. Vor C bleiben aktuelle Zielkandidaten eine Vorschau. Die Statistikversion `session-targets-at-c-m5-sweep-v2` hält diese früheren Auswahlzeitpunkte getrennt von den bisherigen Beobachtungen; vorhandene Daten werden nicht überschrieben.

Das Hauptsetup endet an Target 1 oder der Invalidierung. Die zusätzliche Target-2-Beobachtung für die Statistik läuft nach Target 1 weiter, bis Target 2 oder die Invalidierung erreicht wird; siehe [Statistik](#6-umsetzung-und-belastbarer-vergleich).

**Bestätigter Beispielabgleich:** Philip akzeptiert vorerst **Target 1 bei 1,35335** und **Target 2 bei 1,35300** nach der Extremregel. Der erste Pivot entstand am 09.09.2026 um 00:00 Uhr und gehört für ihn sinngemäß zur Spread Hour; die bestehende Grenze bleibt dennoch unverändert. Die vorhandene Erkennung und der Produktivchart führen ihn als unberührten M5-Pivot Asia-Low. Die ursprünglichen Pins bei **1,35394** und **1,35300** bleiben als Referenz erhalten. Der separate **TP1 bei 1,35479** ist kein Target-Auswahlkriterium; aus dem Abgleich folgt kein Journal-/Pin-Update und kein TP-Offset.

**Zweites Target korrigiert:** Das bisherige Spread-Hour-Low bei **1,35294** entfällt. Laut Philip ist der betreffende Task abgeschlossen und das neue Target markiert. Der Journal-Abgleich bestätigt den Ersatz durch **1,35300**. Den alten Wert nicht als gültiges Prüfziel übernehmen. Den Backend-/Backfill-Stand gesondert beachten, siehe technische Machbarkeit.

Die Reihenfolge B/C/D entspricht vorerst Philips Notizen. Daraus folgt noch keine technische Ausführungsreihenfolge oder Abhängigkeit der Target-Bestimmung von Punkt C. Die 1-Stunden-Trendprüfung aus Punkt A steht ausdrücklich an erster Stelle.

#### Prüfung am Beispiel DR 114

Lesender Abgleich über `get_journal` und `get_data_export`, GBPUSD, Replay am 09.09.2026 um **09:20 Uhr (Europe/Berlin)**, dem gespeicherten Handelszeitpunkt:

- Aktueller Journal-Abgleich nach Philips Korrektur: **1,35394** (Target 148) und **1,35300** (Target 150). Der zweite Preis ist bestätigt; die Bezeichnung New York Low vom 08.09. stammt aus Philips Zuordnung. Das Journal-Tool liefert keine Objektbezeichnungen.
- 1h-Struktur mit Standardperioden P5/P2: innerer Low-Pivot bei **1,35409**, vom 09.09.2026 um **04:00 Uhr**; zum Prüfzeitpunkt unberührt.
- Der Export lieferte außerdem einen Struktur-Low-Pivot bei **1,35294**, vom 08.09.2026 um **23:00 Uhr**, zum Prüfzeitpunkt unberührt. Dieser Treffer bestätigt nicht die fachliche Zulässigkeit: Philip hat ihn als zu ignorierendes Spread-Hour-Low identifiziert.
- **Asia Mid bei 1,35409 ist mit der Label-Regel vereinbar:** `sessionExtremeSuffix` in `src/sessionOccurrences.js` verwendet einen Bereich von ±20 % der Asia-Range um die rechnerische Mitte. Bei High **1,35501** und Low **1,35335** liegt diese bei **1,35418**; der Pivot liegt innerhalb des Mid-Bereichs. Der Begriff bezeichnet hier nicht zwingend den exakten Mittelpunkt.

Der erneute Archiv-/Journal-Abgleich hat die Objektquellen geklärt: **1,35394** ist ein eigener M5-P5-Low-Pivot vom 09.09.2026 um **01:35 Uhr** (Target 148, Liquiditätslevel 460627). **1,35300** ist ein M5-P5-Low-Pivot vom 08.09.2026 um **18:45 Uhr** (Target 150, Liquiditätslevel 460629) und das tatsächliche NY-Session-Low. In der H1-Struktur ist das zugehörige Low um 18:00 Uhr nur P2, nicht P5. Der nähere linke H1-Tiefpunkt um 13:00 Uhr bei 1,35219 verhindert dort P5. Das frühere algorithmische zweite Ziel **H1-P5 1,35211 / MMM-Low** entspricht daher nicht der korrigierten Auswahl. Keine Journaländerung und keinen TP-Abstand aus diesen unterschiedlichen Objektquellen ableiten.

Labels und Alter folgen dem tatsächlichen Bewertungszeitpunkt und den vorhandenen Session-/Altersregeln. Das unberührte NY-Low vom 08.09. um 18:45 Uhr ist am 09.09. um **09:20 Uhr 14h 35m**, um **10:30 Uhr 15h 45m** und um **10:35 Uhr 15h 50m** alt. `highLowRelevant` steuert Session-High/Low-Zuordnung, `ignoreLiquidity` den Ausschluss der Kerzen aus der Erkennung. Für die Spread Hour sind aktuell `highLowRelevant=false` und `ignoreLiquidity=true` gesetzt; die zwei bestehenden Konfigurationspfade nicht gleichsetzen.

### E / #5 — Anti Confluences

#### Aktueller Umfang

Sweep-/OB-Zuordnung und Stärkevergleich sind zurückgestellt. E bewertet aktuell nur die H1-Gegendivergenz anhand geschlossener Kerzen. Der grüne Haken bestätigt ausschließlich diese Teilprüfung, keine Gesamtfreigabe.

#### Zurückgestellte fachliche Bedingungen

Am **P5-Strukturpunkt des Targets aus D** liegt laut Philip meistens ein **bullischer Liquidity Sweep**. Dieser gegnerische Sweep wird mit dem **bestätigenden Liquidity Sweep aus Punkt B** verglichen.

**Gibt es dort keinen bullischen Liquidity Sweep, muss stattdessen der bullische Orderblock als Ursprung der Gegenreaktion gefunden werden.** Fachliche Begründung nach Philip: Die bullische Gegenreaktion kommt nicht aus dem Nichts. Ein fehlender Sweep bedeutet daher nicht, dass keine Anti-Confluence vorliegt.

Im Beispiel hat Philip die Anti-Confluence im TSC markiert: einen **bullischen M5-Orderblock**. Diese Zuordnung stammt aus seiner Beschreibung; die konkrete TSC-Markierung wurde noch nicht ausgelesen.

**Sofortiges No-Go für das Setup, wenn der gegnerische bullische Sweep sowohl älter als auch stärker als die Bestätigung aus B ist.** Beide Bedingungen müssen gemeinsam erfüllt sein (UND-Verknüpfung).

Zusätzlich prüfen, ob beim **Short-Setup eine bullische 1-Stunden-Divergenz** vorliegt. Sie wird als weitere Anti-Confluence berücksichtigt. Eine eigene sofortige No-Go-Regel für diese Divergenz wurde bislang nicht festgelegt.

#### Darstellung in der Checklist

- Checklistenpunkt: **E / #5 — Anti Confluences**.
- Ausreichende H1-Historie, keine Gegendivergenz: **„keine bullische 1H Divergenz vorhanden“** mit grünem Haken hinter der Zeile. Bei Long symmetrisch „bärische“.
- Erkannte Gegendivergenz konkret als vorhanden anzeigen; Details im Tooltip. Daraus folgt ohne weitere Fachregel kein hartes No-Go.
- Fehlende oder unzureichende Historie bleibt **unbekannt**, ohne grünen Haken.
- Zurückgestellte Sweep-/OB-Prüfungen erscheinen nicht im Haupttext; der Tooltip erklärt den begrenzten Umfang.

#### Noch zu präzisieren und später auszuwerten

- Genaue Bedeutung und Messung von „älter“ und „stärker“, einschließlich des Bezugszeitpunkts für das Alter.
- Einfluss einer bullischen 1h-Divergenz auf die Freigabe des Short-Setups; ihr Vorliegen bei DR 114 wurde noch nicht geprüft.
- Verhalten bei Gleichstand oder nur einer erfüllten Vergleichsbedingung. Aus der bislang definierten No-Go-Regel allein folgt in diesen Fällen noch kein automatisches Go.
- Wie Alter und Stärke eines bullischen Orderblocks mit der Sweep-Bestätigung aus B verglichen werden und wann daraus ein No-Go folgt. Die Sweep-gegen-Sweep-Regel nicht ohne fachliche Präzisierung auf den Orderblock übertragen. Falls weder Sweep noch zugehöriger Orderblock gefunden wird, ist die Gegenreaktion noch ungeklärt.
- Die Grenze später statistisch prüfen und gegebenenfalls verschieben. Die Sweep-/OB-Regeln werden erst nach fachlicher Präzisierung aktiviert; zusätzliche Schwellenwerte sind noch nicht festgelegt.
- Konkreten Abgleich an DR 114 mit dem neu markierten Target **New York Low vom 08.09., 1,35300** durchführen. Das verworfene Spread-Hour-Low aus D nicht dafür verwenden.

### F / #6 — Uhrzeit

#### Session und Handelszeit

Prüfen, in welcher Session und welchem Handelszeitfenster wir uns zum Bewertungszeitpunkt befinden. Alle Uhrzeiten beziehen sich auf **Europe/Berlin**, mit datumsabhängiger Sommer-/Winterzeit.

- Im Beispiel beginnt die **London-Session ab 09:00 Uhr** und ist zulässig. DR 114 liegt mit 09:20 Uhr in dieser Session.
- Bereits dokumentierte gefährliche Sessions berücksichtigen, beispielsweise **MMM**.
- Bereits dokumentierte verbotene Sessions ausschließen, beispielsweise **Asia-Mid-Session**.
- **Ab 18:00 Uhr keine neuen Trades eingehen.**

Die genaue Einteilung und Zeitfenster aus den vorhandenen Dokumenten und Einstellungen übernehmen. Gefährliche und verbotene Sessions getrennt darstellen; die konkrete Folge einer gefährlichen Session wie MMM ist beim Abgleich noch zu präzisieren.

#### News

Zum Bewertungszeitpunkt auch die für das Setup relevanten News prüfen:

- **Ab 30 Minuten vor News keinen neuen Trade eingehen.**
- **Bis 15 Minuten nach den News abwarten.**
- Die anfängliche Angabe von 15 Minuten vor News wurde von Philip auf **30 Minuten davor** korrigiert.

#### Darstellung in der Checklist

- Checklistenpunkt: **F / #6 — Uhrzeit**.
- Session-Detail im Beispiel: **09:20 Uhr — London — OK**.
- Der erfolgreich geladene gepflegte Kalender ist maßgeblich. **Keine News** oder nach abgelaufener Wartezeit relevanter News desselben Berliner Kalendertags **News vorbei**, jeweils mit eigenem grünem Haken, unabhängig von MMM.
- Im 30-Minuten-Vorlauf **News bevorstehend** mit rotem Kreuz; ab Ereignis bis ausschließlich 15 Minuten danach **News – Wartezeit** mit rotem Kreuz und Berliner Warteende. Eine aktive Sperre hat Vorrang vor vergangenen Events; spätere Termine außerhalb des Vorlaufs sperren nicht. Fehlende, laufende oder fehlgeschlagene Kalenderladung bleibt unbekannt. Gefährliche/verbotene Sessions behalten ihre eigene Einstufung.

Die News-Lage für DR 114 wurde noch nicht geprüft; die obige News-Ausgabe beschreibt das gewünschte Anzeigeformat, kein bestätigtes Prüfergebnis.

#### Technischer Anknüpfungspunkt

Vorhandene Session-, Handelszeiten- und News-Prüfungen wiederverwenden. Handelsfenster liegen in `trading_schedules`, Session-Einstufungen in `sessions` (`normal`/`caution`/`forbidden`); keine parallele Sammlung fest codierter Zeitfenster aufbauen. Die vorhandenen Dokumente, Einstellungen und News-Relevanzregeln vor Umsetzung mit den hier festgehaltenen Anforderungen abgleichen. Erkennungszeitpunkt und technische Umsetzung folgen später.

### G / #7 — Weitere Confluences

Beim Short-Setup prüfen, ob eine **bärische M5-Divergenz** vorliegt. Sie ist das erste zusätzliche Argument zugunsten des Setups in diesem Abschnitt.

Zuordnung: Der zweite Preispunkt der Divergenz ist die M5-Kerze, die das ausgewählte Sweep-Level aus B erstmals berührt. Den tatsächlichen M5-Touch innerhalb des H1-Touchbalkens bestimmen; dessen Balkenbeginn ist nicht der Divergenzzeitpunkt. Bestehenden RSI-Detektor verwenden und erst nach Schluss seiner rechten Bestätigungskerzen anzeigen. Für Long spiegelbildlich.

Zusätzlich oben am **Liquidity Sweep aus Punkt B** (im Beispiel dem Major Inducement) prüfen, ob dieselbe Bewegung einen **darüberliegenden Orderblock berührt und mitigiert** hat. Liegen Touch und Mitigation vor, zählt das laut Philip als **besonders starke zusätzliche Confluence** für das Short-Setup. Gemeint ist der Orderblock am oberen Sweep-Bereich; der bärische M5-Reaktions-Orderblock aus Punkt C wird separat erfasst.

#### Darstellung in der Checklist

- Checklistenpunkt: **G / #7 — Weitere Confluences**.
- Zugeordnete Divergenz knapp als **M5 bärische Divergenz** mit Zeitraum und erfülltem Status anzeigen; Preise, RSI und Erkennungszeit im Tooltip. Keine Liste unzugeordneter historischer Divergenzen. Eine offene OB-Mitigation ändert den unabhängigen Divergenzbeleg nicht; fehlende optionale Divergenz ist kein No-Go.
- Weitere Prüfung: **Orderblock oberhalb des Sweeps berührt und mitigiert?** Bei Erfüllung als besonders starke zusätzliche Confluence ausweisen.

Weitere Confluences werden schrittweise gemeinsam ergänzt. **EMA** ist als mögliche spätere Ergänzung vorgemerkt; eine konkrete EMA-Bedingung ist noch nicht definiert. Numerische Gewichtung und Einfluss dieser Zusatzargumente auf die Setup-Freigabe bleiben offen. Für den Orderblock am Sweep sind Timeframe und genaue Mitigationsbedingung noch zu präzisieren; diese OB-Confluence wurde bei DR 114 noch nicht bestätigt.

Validiert an Pin 377 und den archivierten DR114-M5-Kerzen: 09.09.2026 **07:25 → 09:10 Uhr**, Preis **1,35531 → 1,35651**, RSI **74,4 → 69,7**; der zweite Preispunkt berührt das Major-Level **1,35649**. Erkennbar ab **09:30 Uhr**, beim Replay 10:30/Bewertung 10:35 vorhanden (alle Zeiten Europe/Berlin). Pin-ID und Beispielwerte sind ausschließlich Testreferenz, keine produktive Zuordnungsbedingung.

### H / #8 — M5 Trend

#### Fachliche Bedingung

Die M5-Trendrichtung muss das Short-Setup unterstützen. Dieser allgemein geltende Aspekt bekommt einen eigenen Checklistenpunkt.

Nach einem Major oder Medium Inducement ist der M5-Trend laut Philip zunächst bullisch: Der kurzfristige Gegentrend hat zum Inducement geführt und muss sich erst nach unten drehen. Die Checklist soll diese Drehung sichtbar machen. Dafür braucht es ein **bärisches Change of Character (CHoCH)**; ein **bärisches Break of Structure (BOS)** ist stärker. Im Optimalfall liegt bereits ein **bärischer M5-Trend** vor.

Abstufung von schwächerer zu stärkerer Confluence:

1. **Bärisches CHoCH** — der M5-Trend dreht nach unten.
2. **Bärisches BOS** — stärker als das CHoCH.
3. **Bärischer M5-Trend** — stärkste der drei Ausprägungen, Optimalfall.

Ein CHoCH kommt laut Philip in den meisten Fällen vor einem BOS. Die Abstufung beschreibt die fachliche Stärke; sie verlangt nicht, dass alle drei Ausprägungen gleichzeitig vorliegen oder stets dieselbe Ereignisfolge durchlaufen werden.

#### Darstellung in der Checklist

- Checklistenpunkt: **H / #8 — M5 Trend**.
- Drei dauerhafte Details: bestätigter **M5-Trend**, **Change of Character**, **BOS**. Jeder Punkt wird unabhängig in Richtung der H1-Hauptcheckliste geprüft: rotes X vor Nachweis, grüner Haken nach Nachweis, unbekannt bei fehlender Datenbasis. Die Schreibweise lautet BOS.
- Solange der M5-Trend noch bullisch ist und die erforderliche bärische Drehung fehlt, ist dieser Punkt noch nicht erfüllt.

#### Technischer Ansatz: M5-Struktur und Trendphasen

Auf dem bereits begonnenen **M5-Strukturalgorithmus** und dem vorhandenen **M5-Trendphasenindikator** aufbauen. Beide spielen für diesen Checklistenpunkt eine Rolle; nötige Anpassungen werden separat umgesetzt.

`buildStructureWithPhases` liefert zusätzlich eine frühe Close-Reaktion aus `m5CloseReaction.js`. H verwendet diese Erweiterung des vorhandenen Strukturkerns. Die bisherigen Pivotbestätigungen, rückdatierten Chartbänder und TSC-Regeln bleiben erhalten; der bestätigte Trend wird nicht durch ein frühes CHoCH ersetzt.

Der Toggle „M5-Struktur“ zeichnet dieselben aktuellen CHoCH-/BOS-Level schon vor dem Bruch durchgezogen mit „offen“. Beim ersten bestätigenden M5-Schluss wechselt die Linie sofort auf die bestehende gestrichelte Darstellung und endet an der Signalkerze. Ersetzte oder invalidierte offene Level verschwinden; bestehende historische Strukturlinien bleiben erhalten. Chart und Checklist verwenden dieselbe Schlussgrenze, auch im Replay. H1- und M1-Zeichnung bleiben bei ihren bisherigen Regeln.

Für Short genügt jeweils ein strikter Schluss unter dem bereits bekannten Level: CHoCH unter dem zweiten Ankerpivot des bestehenden Nested-Kandidaten, BOS unter dem geschützten Tief derselben bullischen Strukturebene. Long ist gespiegelt. Dochtberührung oder Gleichheit reichen nicht. Der BOS-Nachweis benötigt keinen vorherigen CHoCH-Haken. Ein vorheriger Docht am geschützten Punkt beseitigt dessen Schutzfunktion nicht, solange kein neuer geschützter Punkt ihn ersetzt.

#### Zeitbasis und Abnahme

Die Levelzugehörigkeit wird am damaligen geschlossenen Kerzenpräfix mit dem bestehenden Algorithmus überprüft. Ereignisse tragen Richtung, Strukturebene, Ursprung, Pivotlevel, Kerzenzeit und tatsächlichen Erkennungsschluss. Es zählt die aktuelle Strukturbewegung; ein Schluss jenseits ihres Ursprungs widerlegt ihre Signale. Spätere Bestätigungspivots oder rückdatierte Bandanfänge erzeugen keine früheren Checklist-Haken. Unzureichende Historie bis zum M5-Anker bleibt unbekannt. H ist eine Einzelprüfung, keine endgültige Setup-Freigabe.

Geprüft mit geschlossenen FXCM-Bid-Kerzen für GBPUSD am 09.09.2026 (alle Zeiten Europe/Berlin):

| Sichtbare Replay-Kerze | Bewertungsstand | Bestätigter M5-Trend | CHoCH | BOS |
|---|---|---|---|---|
| 09:45 | 09:50 | bullisch | X | X |
| 09:50 | 09:55 | bullisch | Haken, Level 1,35576 | X |
| 09:55 | 10:00 | bullisch | Haken bleibt | X |
| 10:00 | 10:05 | bullisch | Haken bleibt | Haken, Level 1,35554 |

Die 10:20-Kerze liefert später die bestehende Pivotbestätigung des bärischen Nested-Trends. Die Tests decken zusätzlich Docht/Close, Gleichheit, Long-Spiegelung, unabhängigen BOS, Invalidierung, ignorierte Kerzen, fehlende Daten und Replay vorwärts/rückwärts ab.

### I / #9 — M1

**Struktur und Einzelprüfungen umgesetzt; Entry 1 siehe J, Gesamtfreigabe weiterhin offen.** Eigener Toggle „M1-Struktur“ im Structure-Menü, ausschließlich Periode-5-Pivots. P2 geht weder in CHoCH/BOS/Nested noch in andere M1-Strukturentscheidungen ein; der gemeinsame Kern erhält eine leere Inner-Pivotliste. Debug zeigt dieselben P5-Pivots. Die M1-Periodenregler entfallen; alte gespeicherte Werte werden nicht mehr gelesen. M5/H1 bleiben bei ihren bisherigen Einstellungen und Regeln. Strukturkern, Linien, Marker und M5-Styles werden wiederverwendet.

- **Aktivierung:** Toggle an und A, B, C für das aktuelle Setup am Bewertungszeitpunkt bestätigt. Vorher keine M1-Abrufe für diese Funktion. H/BOS ist kein zusätzliches Gate.
- **Anker:** der bekannte protected-Pivot der passenden aktuellen M5-Ebene, von dem die BOS-Linie ausgeht; nach BOS dieselbe Pivotidentität. DR114: 1,35554, M5-Pivotkerze 09.09.2026 um 08:45 Berlin. Kein fest codierter Preis und kein beliebiger alter BOS. Fehlt ein eindeutiger bekannter Anker, bleibt M1 ausstehend.
- **Zeit:** M1-Struktur ab der M5-Pivotzeit mit Fraktal-Vorlauf. Die Pivotzeit ist der Beginn der M5-Kerze, keine erfundene sekundengenaue Extremzeit. A–I verwenden den Schluss der tatsächlich vorhandenen, geschlossenen sichtbaren Chartkerze als gemeinsamen Replay-Horizont. I zeigt zusätzlich den letzten tatsächlich vorhandenen M1-Schluss bis zu dieser Grenze. ABC und M5-Anker werden dort erneut geprüft, damit fehlende M1-Kerzen keine Freigabe aus einem späteren Stand übernehmen. Zeitrahmenwechsel verwerfen den alten Chart-Horizont, bis passende Kerzen vorliegen; Cache-Lookahead erweitert ihn nicht.
- **Daten:** eigener nativer FXCM-M1-Archivabruf über Pagination und den bestehenden Cache, unabhängig vom sichtbaren Chart-Zeitrahmen. Der bestehende Lookahead-Deckel bleibt erhalten. Live nutzt M1 den vorhandenen Poll-Abstand, ohne dadurch H1/M5 neu zu berechnen. Status im Chart zeigt Anker und tatsächlichen letzten M1-Schluss.
- **Ladeende:** bestehender Setup-Lifecycle an Invalidierung oder Target 1; Target 2 verlängert den M1-Bezug nicht. Bei Ende/Setupwechsel/Rücksprung verschwinden überholte Zeichnungen, verspätete Antworten werden verworfen. Replay zurück in die aktive Phase kann erneut laden. Andere M1-Verbraucher bleiben unabhängig.
- **Feedprüfung:** Collector-Uploads am 28.09.2026 um 23:43:12,7 (GBPUSD) und 23:43:14,6 (EURUSD) Berlin nach Minutenschluss beobachtet. Hinzu kommen Chart-Poll und Netzwerk; keine feste Sekunden- oder Minutengarantie. Gold hat derzeit keine native M1-Historie und meldet fehlenden Vorlauf.

I zeigt vor Aktivierung den konkreten Wartegrund (ABC, Anker, Daten oder ausgeschalteter Toggle). Danach stehen Haupttrend und bestätigte Nested-Ebenen getrennt, gefolgt von richtungsbezogenem CHoCH und BOS. Gültige Parent-Signale bleiben sichtbar, auch wenn eine tiefere Ebene eine Gegenreaktion hat. Negative Details erhalten das bestehende rote ✕ und fett orange-roten Text, positive den einfachen grünen Haken. Unbekannte Daten sind kein negatives Signal.

Zusätzlich zeigt I den jüngsten aktuell als `LQ-sweep` klassifizierten internen M1-Sweep aus demselben P5-Strukturbaum wie der Chart. Preis und Zeit stammen vom Level und seiner Touch-Kerze, nicht vom Pivotursprung. Gleichzeitige Levels bleiben sichtbar, Nested-Kopien werden dedupliziert; ohne Sweep entfällt die Zeile, ohne neues Pflicht-/GO-Kriterium. DR114: „M1 interner LQ Sweep 1.35476 um 11:27“ mit Haken ab Schluss 11:28; Pivotursprung 10:34. Spätere Reklassifizierung folgt dem Chart, statt eine eigene Sweep-Historie festzuhalten.

Der Retest ist die erste Berührung **des M5-Orderblocks aus C** nach dessen bestätigter Entstehung, geprüft an geschlossenen nativen M1-Kerzen. Die erste anschließend bestätigte gleichgerichtete M1-FVG erfüllt den separaten FVG-Check; bestehender Detektor einschließlich M1-Mindestgröße gilt. Erst bei Bestätigung wird deren Impulskerze mit dem vorhandenen goldenen FVG-Token eingefärbt, ausschließlich im M1-Chart. M5-Aggregatkerzen werden dafür nicht umgedeutet. Diese Einzelbeobachtungen sind kein Gesamt-Go.

DR114 am 09.09.2026, alle Zeiten Berlin, auf dem M1-Chart: Replay 09:30 → Stand 09:31, Uptrend, kein bärischer CHoCH/BOS. Replay 09:35 → Stand 09:36, CHoCH/BOS der 09:33-Kerze bestätigt; Nested noch nicht bestätigt. Der P5-Nested-Downtrend ist erst ab Schluss 09:39 bekannt. Replay 09:46 → Stand 09:47, OB-Berührung der 09:46-Kerze, noch keine Folge-FVG. Replay 09:49 → Stand 09:50, FVG bestätigt und Impulskerze 09:48 gold. Auf M5 kennt Replay 09:25 bereits Schluss 09:30: ABC bestätigt und I aktiv. Auf M1 kennt dieselbe Eingabe erst 09:26: C und I warten beide noch.

Module: `m1Structure.js`, `usePriceChartM1Structure.js`, gemeinsames `structureOverlay.js`. Tests prüfen Anker vor/nach BOS, A/B/C-Gate, geschlossene Kerzen, Vorlauf, Replay, Zeitrahmenwechsel, Debug, Pagination und veraltete Antworten nach Setupende.

### J / #10 — Entry

Das erste bestätigte M1-FVG-Ereignis nach dem Retest des C-M5-OB liefert einmal pro Setup **Entry 1**. Es benötigt keine zusätzliche Gesamtfreigabe aller A–I-Punkte. J zeigt „Entry 1“, sobald das Ereignis bekannt ist. Im M1-Chart beginnt eine preisverankerte Linie an der tatsächlichen Bestätigungskerze und führt nach rechts zu einem Kasten „Entry 1“. Linienpreis ist deren Schlusskurs. DR114 am 09.09.2026 Berlin: Impuls 09:48, Bestätigungskerze 09:49, bekannt ab Schluss 09:50, Entry 1,35615.

Zwei nebeneinanderliegende Skalen verwenden denselben Entry und eigene, beim Entry eingefrorene Stopps:

- **Weit:** Oberkante des zu C gehörenden M5-OB für Short, Unterkante für Long; DR114 1,35675.
- **Eng:** höchstes High aller geschlossenen M1-Kerzen ab erster Berührung dieses OB bis einschließlich FVG-Bestätigungskerze; für Long tiefstes Low. Zwischenextreme zählen mit. DR114 1,35648 aus 09:46. Dafür ist kein P5-Pivotstatus nötig: dessen spätere rechte Bestätigungskerzen wären am Entry noch unbekannt.
- Beide Skalen zeigen Stopp, 3R/6R/10R und die bestehenden festen T1-/optional T2-Preise mit ihrem jeweiligen RR. J zeigt zusätzlich beide Entry-Stopp-Abstände über den Instrument-Pip-Helper: DR114 „Weiter SL: 6,0 Pips“ / „Enger SL: 3,3 Pips“. Risiko = gerichteter Abstand zwischen Entry und Stopp; RR = gerichteter Zielabstand geteilt durch dieses Risiko. Kein Puffer oder Stoppdeckel. Fehlende/falschseitige Preise liefern kein erfundenes RR. Der Preisbereich wird durch die Skalen nicht automatisch erweitert; die RR-Zusammenfassung bleibt auch für Ziele außerhalb des sichtbaren Ausschnitts lesbar.

Replay vor der Bestätigung zeigt weder Annotation noch Entry 1; danach bleiben Ereignisidentität, Entry, Stopps und Targets für denselben Setup-Präfix stabil. Rücksprünge entfernen das Ereignis und stellen es vorwärts deterministisch wieder her. Die Berechnung bleibt vom sichtbaren Timeframe unabhängig; M1 und M5 zeichnen denselben Snapshot. Auf M5 liegt die echte M1-Zeit anteilig innerhalb der vorhandenen M5-Kerze, ohne Rückdatierung auf deren Open oder Interpolation über Datenlücken. Der Tooltip nennt M1-Bestätigungskerze und Erkennungszeit in Europe/Berlin. Toggle, Symbol-/Setupwechsel und bestehender T1-/Invalidierungs-Lifecycle gelten weiter. Weitere Entry-Nummern, Ausführungen, Journalwrites, Positionsgrößen, Kostenannahmen und Winrate-Regeln sind nicht definiert.

Module: `m1Entry.js`, `entryRisk.js`, `m1EntryRendering.js`; gemeinsame Skalenzeichnung aus `scaleRendering.js`. Tests prüfen Bestätigungsgrenze, feste Identität, Retest-Zwischenextreme, Long-Spiegelung, Stopp-/Zielgeometrie und Neuprojektion bei Pan/Zoom.

## Technische Machbarkeit — geprüft am 27.09.2026

**Ergebnis: umsetzbar.** Datenversorgung, Strukturerkennung, Sweeps, Orderblocks, FVG, Divergenzen und Zeitprüfungen sind vorhanden. Neu ist vor allem ihre automatische, zeitlich konsistente Zuordnung zu einem bestimmten Setup. Die schwierigen Stellen sind Sweep-Auswahl/Gültigkeit, historische Erkennbarkeit und die fachliche Definition der frühen M5-Drehung. Es wurde Quellcode geprüft und bestehende Tests ausgeführt; noch kein neuer Evaluator implementiert oder vermessen.

### 1. Zeitmodell und automatische Aktualisierung

- Eine reine Auswertung erhält Instrument, Bewertungszeit, Regel-/Einstellungsstand und die zu diesem Zeitpunkt verfügbaren Daten. Gleiche Eingaben ergeben dasselbe Ergebnis, auch nach Replay vorwärts/rückwärts oder Neuladen.
- Bestehende M5-Datenversorgung verwenden: `usePriceChartTradeSetups.js`, `PriceChart.vue` (`loadTradeSetupM5Internal`, M5-Poll) und `candlePolling.js`. Sie läuft unabhängig vom sichtbaren Chart-Timeframe und berücksichtigt verspätete Daten. Kein zusätzlicher starrer Fünf-Minuten-Timer nötig; bei jeder neuen geschlossenen M5-Kerze neu auswerten, beim Replay-Wechsel sofort mit dem neuen Datenstand.
- H1-Nachladen, Änderungen an Regeln/Sessions/News und Live-/Replay-Wechsel lösen die passende Neuberechnung aus. Session-/News-Sperren auch ohne neue Kerze am jeweiligen Grenzzeitpunkt aktualisieren.
- Rohdaten für die Analyse vollständig laden, auch wenn Liquidität, OBs oder Trendlinien ausgeblendet sind. `getCurrentLiquidityLevels()` ist eine begrenzte Render-/Klickliste und dafür ungeeignet.
- Ein gemeinsamer Schlüssel aus Instrument, Bewertungszeit und Einstellungen verhindert, dass verspätete Antworten alte Ergebnisse einblenden. Während unvollständiger/alter Daten ausdrücklich „lädt“, „Daten fehlen“ oder „Daten veraltet“ anzeigen.

**Replay-Entscheidung: Schluss der sichtbaren geschlossenen Chartkerze**

Aktuell bezeichnet die Kerzenzeit den Beginn der Kerze. `clipReplay` in `PriceChart.vue` nimmt `c.time <= replayUntil`; `replayFetchToMs` lädt die ausgewählte Kerze vollständig. Der H1-Strukturpfad hat keine zusätzliche Schlusszeitgrenze. Bei Replay 09:20 Uhr kann deshalb bereits die vollständige H1-Kerze von 09:00 bis 10:00 Uhr in der Analyse stecken. Für die neue Checklist ist dieser bestehende Chart-State nicht ohne weitere Prüfung verwendbar.

„Bewertungsstand“ ist für A–I gemeinsam der Schluss der letzten tatsächlich vorhandenen, im sichtbaren Chart-Timeframe durch Replay freigegebenen und inzwischen geschlossenen Kerze. Eine sichtbare M5-Kerze mit Beginn 09:25 Uhr steht für Wissen bis 09:30 Uhr; auf M1 kennt dieselbe Replay-Eingabe erst 09:26 Uhr. Ohne diese Kerze darf ihre Dauer nicht pauschal addiert werden; dann zählt der letzte vorhandene Schluss, ohne passende Chartkerze bleibt die Datenzeit unbekannt. Analysekerzen aus anderen Timeframes müssen bis zu dieser Grenze ebenfalls geschlossen sein. I kann wegen fehlender M1-Kerzen einen älteren tatsächlichen Datenstand haben und prüft seine Voraussetzungen dort erneut, siehe Abschnitt I. Live bleibt die zeitgerechte Aktualisierung über vorhandene Kerzenpolls und Session-/News-Grenzen erhalten.

### 2. Liquidity Sweep: Ereignis und Setup-Zuordnung

Der Sweep muss nicht genau auf der aktuellen M5-Kerze stattfinden. Ein zum Bewertungszeitpunkt bereits bekannter Sweep kann weiterhin Punkt B erfüllen, während C oder H erst später hinzukommen. Das lässt sich bei jedem Aufruf aus der Historie rekonstruieren; manuelles Festhalten einer TSC-Idee ist dafür nicht nötig.

Vorhandene Bausteine:

- `collectStructureLqLevels` in `marketStructureRendering.ts` liefert berührte Strukturpunkte mit Pivotpreis, Pivotzeit und Touchzeit. Herkunft, Richtung und Ebene beim Übergang in den Evaluator erhalten; der Helper enthält einen bekannten Restfall um nach Trendwechsel umbenannte `LQ-sweep`-Punkte.
- `tradeSetup.js` ordnet bereits Sweeps und M5-OBs zu. `collectObSweeps` sammelt mehrere Sweeps derselben Reaktion und priorisiert das beim Touch älteste Level. Diese gemeinsame Logik bei Bedarf extrahieren, nicht innerhalb einer Runtime duplizieren.
- Das Alter ist mit `businessSecondsBetween` / `ageReferenceTime` definiert: Pivot bis Touch, danach eingefroren. `classifyAge` unterscheidet Minor <1 Handelstag, Medium ab1 und Major ab5 Handelstagen. Diese Einstufung ist altersbasiert und noch kein unabhängiges Maß für „stärker“ in E.
- Der schnelle bestehende Setup-Pfad benötigt kein zusätzlich bestätigtes M5-Fraktal. Ein fertiges altes Trade-Setup benötigt aber schon den OB; nur diese Ergebnisse auszuwerten würde B vor C unsichtbar machen.

**Neu nötig:** Sweep-Kandidaten schon vor dem OB bilden, stabil identifizieren und nachfolgende Reaktion, Targets und Trendmerkmale dem gleichen Kandidaten zuordnen. Gespeicherte alte Setups und deren heutige Felder sind kein Ersatz für eine Rekonstruktion des damaligen Wissensstands.

**Festgelegt:** Unter den zulässigen, noch nicht beendeten Kandidaten zählt der älteste Sweep wie in der vorhandenen Erkennung. Die Invalidierung oder Target 1 beendet das Setup beim Anlaufen; Target 2 ist optional. Gegenläufige Kandidaten bleiben für E erhalten, während die Hauptansicht der 1h-Trendrichtung folgt.

**Noch zu präzisieren:** Sweep-Quellen außerhalb der 1h-Struktur. Die Ziel-Fixierung bei bekanntem C steht in D. Für C gelten ausdrücklich die vorhandenen Zuordnungsregeln der Trade-Setup-Erkennung und deren Invalidierung aus der erweiterten OB-Zone (siehe C). Deren Suchfenster sind keine zusätzliche Ablaufzeit der Checklist: Ein einmal belegter Zusammenhang bleibt bis Invalidierung oder Target 1 bestehen. Bei einer Kerze, die Target und Invalidierung beide erreicht, ohne feinere Daten keine Reihenfolge für die spätere Statistik erfinden.

Damit nicht ein alter Major-Sweep mit einer völlig anderen aktuellen M5-Reaktion kombiniert wird, müssen diese Beziehungen explizit sein. Den gesamten geladenen Chart einfach nach beliebigen grünen Einzelmerkmalen abzusuchen reicht nicht.

### 3. Wiederverwendung je Checklistenpunkt

| Punkt | Vorhandene Basis | Ergänzung oder Entscheidung |
|---|---|---|
| A — 1h-Trend | `buildMarketStructureState`, `deriveTrendReaction`, `computeTrendChain` | Tiefste aktive bestätigte Ebene aus geschlossenen H1-Daten bestimmt die Richtung; Parent-Ebenen bleiben Kontext. |
| B — Sweep | Strukturpunkte, Touchzeiten, Altersklassen, Mehrfach-Sweeps | Kandidat vor OB-Bestätigung; ältester zulässiger Sweep bis Invalidierung/Target 1. Gegenrichtung für E erhalten. |
| C — Reaktion | `detectOrderBlocks` / `detectSetupObs`, `obFvg`, `scaleAnchor` / strukturelles `bandRisk` | Reaktion mit B verknüpfen; FVG erst bei ihrer tatsächlichen Bestätigung. FVG-Bänder aus `drQuoten.js` sind vorhandene historische Bewertungen, keine neue 2.0-Winrate. |
| D — Targets | `findTargets.js`, äußere/innere Strukturpunkte, Session-Labels | P2/P5 gezielt statt allgemeiner sichtbarer LQ-Liste auswählen; Pivot-Level und verschobenen Journal-TP auseinanderhalten. |
| E — Anti Confluences | `findAntiConfluences.js`, RSI- und OB-Erkennung | Ursprung der Gegenreaktion am P5-Target zuordnen; Stärkevergleich und OB-Alternative präzisieren; H1-RSI explizit auf H1 rechnen. |
| F — Uhrzeit | `sessions`, `trading_schedules`, News-Relevanz/Gates | Einheitlich Berlin und 30/15-News-Fenster; Kalenderabdeckung und Grenzfälle behandeln. |
| G — Zusatzargumente | `detectRsiDivergenceHistory`, OB-Touch/Retest | M5-Divergenz zum damaligen Stand; Mitigation und Zuordnung zur Sweep-Bewegung definieren. |
| H — M5-Trend | M5-Strukturkern, `trendPhases.js`, `m5CloseReaction.js` | Frühe Close-Auswertung samt Richtung und Erkennungszeit; Regeln und Abnahme in Abschnitt H. |
| I — M1 | Struktur sichtbar | Ab A+B+C mit Toggle; Gesamtfreigabe weiterhin offen. |
| J — Entry | Entry 1 und zwei Risikoskalen | Erste bestätigte M1-FVG nach C-OB-Retest, feste Entry-/Stopppreise gemäß Abschnitt J. |

Die Anzeige braucht mehr als einen pauschalen Haken: erfüllt, noch nicht erfüllt, No-Go und Daten unbekannt müssen unterscheidbar sein. Fehlende optionale Zusatzargumente aus G bedeuten nicht automatisch No-Go. Die Verknüpfung zu einem endgültigen Gesamt-Go bleibt bis zur Klärung aller Pflicht-/Zusatzregeln offen.

### 4. M5-Trendphasen: früher anzeigen ist nicht früher erkennen

`trendPhases.js` benutzt bereits Closes, wird aber derzeit nur nach verarbeiteten/bestätigten Pivots aufgerufen. CHoCH-Bänder werden danach auf die frühere Dochtberührung zurückdatiert. Ein bestehender Test vom 09.09. zeigt: erkannt um **10:20 Uhr**, Bandbeginn **09:50 Uhr** (Europe/Berlin). Die Checklist darf daraus um 09:50 Uhr kein damals bereits vorhandenes Signal ableiten.

Zusätzlich kombiniert `deriveTrendReaction` die innerste Trendrichtung mit der jüngsten CHoCH/BOS-Reaktion aus mehreren Ebenen. Ein angezeigtes BOS ist damit nicht automatisch bärisch. Für H muss jedes Signal seine Richtung, Ebene, Referenz und echte Erkennungszeit tragen.

Umgesetzt als zusätzliche Close-Reaktion des bestehenden M5-Struktur-/Phasenbausteins. Die Checklist prüft die aktuellen geschlossenen Kerzen gegen damals bekannte Strukturlevel; die konkreten Regeln stehen in Abschnitt H. H1-Algorithmus und bisherige Setup-Regeln bleiben erhalten.

**Kein Gesamt-Go:** Die getrennten H-Details belegen einzelne Strukturmerkmale. Offene Pflicht-/Zusatzregeln werden dadurch nicht ersetzt.

### 5. Weitere geprüfte Zeit- und Datenfallen

- **Divergenzen:** Der RSI-Detektor braucht standardmäßig drei rechte Bestätigungskerzen. Sein Pivotzeitpunkt ist nicht der Zeitpunkt, ab dem die Divergenz bekannt war. Aus dem jeweiligen Kerzenpräfix rechnen; heutige Ergebnisse nur nach Pivotzeit zu filtern reicht nicht.
- **Orderblocks:** `touched`, `invalidated`, `retested` und `retestedAt` existieren. M5-Retest verlangt eine spätere gleichgerichtete FVG; HTF-Retest einen späteren Schluss außerhalb der Zone. Ob „mitigiert“ in G genau diesen Retest meint, bleibt fachlich offen. Auch `retestedAt` kann einen früheren OB-Start statt des Bestätigungsschlusses bezeichnen.
- **News:** Frontend `currentNewsNoGo` sperrt derzeit ±30 Minuten; Backend `evaluateNewsGate` verwendet 30 davor/15 danach, mit abweichender Grenzinklusion bei exakt 30 Minuten davor. Für die Checklist eine reine gemeinsame Auswertung mit den gewünschten Grenzen vorsehen; das bisherige TSC-Verhalten nicht beiläufig umstellen. Keine State-Machine-Tools als vermeintlich lesende Prüfung aufrufen.
- **Kalenderstatus:** Die beschlossene F-Policy oben verwendet den gepflegten Kalender als maßgeblich. Den tatsächlichen Ladezustand aus dem News-Store übernehmen; kein zusätzlicher Abdeckungsnachweis nötig.
- **Zeitzone:** Einige bestehende Frontend-Aufrufer reichen die Gerätezeitzone weiter. Die Checklist muss Europe/Berlin ausdrücklich verwenden.
- **Spread Hours:** Frontend-Task ist released; Philip hat sein zweites Target neu markiert. Zum Zeitpunkt dieser Prüfung steht der separate Task `spread-hour-auch-im-backend-ignorieren-poi-watcher-backfill-mcp-exporte` noch auf open. In den geprüften Backend-Aufrufern fehlt die Markierung weiterhin. Vor Backend-Auswertung/Statistik deren tatsächlichen Abschluss und den Bestandsdaten-/Backfill-Stand prüfen; Frontend-Korrektur nicht mit korrigiertem gesamten Datenbestand gleichsetzen. Fraktale/Struktur dürfen ignorierte Kerzen herausfiltern, FVG-Fenster mit ignorierten Kerzen müssen ganz ausfallen, damit keine künstlichen Gaps entstehen.

### 6. Umsetzung und belastbarer Vergleich

Zuerst Zeitbasis plus sichtbares A/B/C-Gerüst mit DR 114 verifizieren. Dann Targets und weitere Prüfungen anschließen; Session/News lässt sich nach der Zeitbasis unabhängig bearbeiten. Die frühe M5-Schlusskursregel ist ein eigenes Arbeitspaket. Jeder Umsetzungstask prüft seinen Teil; an den gemeinsamen Übergängen den vollständigen Ablauf erneut abnehmen.

Für die spätere Statistik denselben Evaluator über historische Kerzenpräfixe laufen lassen. Regelversion, Session-/Handelszeitenkonfiguration, Datenstand und Kandidatenidentität festhalten. Pro Setup beziehungsweise Freigabeereignis zählen, nicht jeden Fünf-Minuten-Aufruf als neuen Trade. Reine Frontend-Auswertung funktioniert nur bei geöffneter App; lückenlose Live-Erfassung bei geschlossener App wäre ein späterer Backend-Schritt. Historische Auswertung kann separat erfolgen.

**Target-Beobachtungen:** `checklist_target_observations` speichert separat vom Journal/TSC genau einen Datensatz pro Kandidat, Regelversion und relevanter Struktur-/Sessionkonfiguration. Er enthält die feste Auswahl samt Zeitpunkt und Pivotquellen, Invalidierung, C-/Sweep-Quelle und den zuletzt ausgewerteten Stand. Das ist eine Stichprobe bestätigter C-Kandidaten, keine Liste freigegebener Trades. Die atomare Schreibfunktion erhält die erste Auswahl und verhindert das Überschreiben neuerer Ergebnisse durch ältere Replay-Antworten.

Target 2 wird **bis zur Invalidierung** beobachtet: `reached` mit Treffer-/Erkennungszeit bei T2 zuerst, `notReached` bei Invalidierung zuerst, `open` bei noch laufender Beobachtung, `unknown` bei fehlender Historie oder unbelegter Reihenfolge innerhalb derselben Kerze. Ohne zweites Ziel gilt `notApplicable`. Fehlende Historie wird nicht als Fehlschlag gezählt. Bereits beendete Hauptkandidaten werden für T2 weiterhin aus der separaten Ablage gelesen; nur das geschlossene Präfix des aktuellen Bewertungsstands wird neu ausgewertet. Die gespeicherten späteren Ergebnisse fließen nicht in eine frühere Replay-Anzeige ein. Fehlt der vollständige Verlauf in den geladenen Kerzen, bleibt die neue Beobachtung unbekannt; belegte ältere Ergebnisse werden dadurch nicht gelöscht. Bei geschlossener App gibt es keinen neuen Beobachtungslauf.

**Winrate braucht zusätzliche Definitionen:** Das visuelle Entry-1-Signal und zwei Stoppvarianten sind in J festgelegt; Ausführung, Target-/Teilausstiegsregeln, Re-Entries, Kosten und Auswertungshorizont bleiben offen. Alte und neue Setups unter denselben Ausführungsannahmen vergleichen. Vorhandene `analysis/dr-reichweite`-Werkzeuge prüfen, die bisherigen Journal-/TSC-Daten und bisherigen Erkennungsregeln erhalten.

### 7. Prüfung und spätere Abnahme

Bei dieser Machbarkeitsprüfung bestanden die vorhandenen gezielten Sweep-/Pipeline-/Label-Tests (8 Testdateien, 108 Tests) sowie die M5-Struktur-/Historien-Tests (3 Testdateien, 29 Tests). Das belegt vorhandene Bausteine; der neue Evaluator ist noch nicht implementiert oder auf Laufzeit getestet.

Für die Umsetzung erforderlich: DR 114 vor/während/nach Sweep und Reaktion, Replay vorwärts/rückwärts, keine zukünftigen H1/M5-Kerzen oder Bestätigungspivots, konkurrierende Sweeps, verlorene/verspätete Daten, ignorierte Spread Hours, Wechsel von Instrument/Timeframe/Toggles, exakte News-/Session-Grenzen sowie Gleichheit von historischer und schrittweiser Auswertung bei gleichen Eingaben. Die korrigierten Targets und tatsächlich markierten Gegenargumente als Referenz verwenden; die alten MCP-Werte allein sind wegen Zeitmodell und Spread-Hour-Stand keine fertige Soll-Fixture.

## Parallelisierungsplan

### Runde 1 — drei getrennte Chats

Gestartete Codex-Chats (zugehörige Milkyland-Tasks auf `work in progress`):

- Oberfläche: `01a0e478-2db9-7c40-b8ca-fcbf9730f8b2` (Menüumbenennung + Bereich).
- Zeitbasis: `01a0e478-3f7a-7983-bbdf-7fb313b37ea9`.
- Session/News: `01a0e478-4e99-77d1-b180-3148f2dca19a`.

1. **Oberfläche:** Menübezeichnungen UND Checklist-Bereich gemeinsam. Beide ändern `Dashboard.vue`, deshalb ein gemeinsamer Besitzer. Eigene Checklist-Komponente, A–I-Anzeige und Ein-/Ausblenden. Keine fachliche Erkennung erfinden.
2. **Zeitbasis/Auswertung:** reine Zeit-/Datenbasis, as-of H1-Auswertung für A, Lade-/Fehlerzustände und Anschluss an `PriceChart.vue`. Dieser Chat besitzt `PriceChart.vue` und die neuen Evaluator-/Datenadapterdateien. `Dashboard.vue` bleibt beim UI-Chat. Die Replay-Zeitbedeutung ist im Zeitmodell oben festgelegt.
3. **Session/News:** reine F-Auswertung für eine explizit übergebene Bewertungszeit, Session-/Handelsfenster und Kalenderdaten; eigene Datei und Tests. Keine Änderungen an `Dashboard.vue`, `PriceChart.vue` oder am Zeitadapter. Dadurch kann die Logik bereits parallel entstehen; die tatsächliche Anbindung folgt nach der Zeitbasis.

Minimaler Übergabevertrag für diese Runde: UI bekommt einen optionalen `checklistState` mit `instrument`, `evaluatedAt` (Unix-Sekunden), Gesamt-Datenstatus und `checks` nach stabilen Schlüsseln `h1Trend`, `liquiditySweep`, `reaction`, `targets`, `antiConfluences`, `time`, `confluences`, `m5Trend`, `m1`. Ein Prüfergebnis enthält `status` (`passed`, `pending`, `blocked`, `unknown`, `deferred`) und `details` als Textliste. Gesamt-Datenstatus (`loading`, `ready`, `missing`, `stale`, `error`) ist kein Gesamt-Go. Beschriftungen A–I besitzt die UI. F liefert das Ergebnis für `time`. Der Chart übergibt Ergebnisse per `checklist-state-change`; der UI-Chat verdrahtet Event und Panel, der Zeitbasis-Chat erzeugt das Event. Der Panel-Toggle wird als `showTradeSetupChecklist` an den Chart weitergereicht.

Alle Chats arbeiten im gemeinsamen lokalen Checkout mit dieser Dateiaufteilung. Keine fremden Änderungen zurücksetzen oder pauschal stagen. Jeder Task meldet sein geprüftes Ergebnis in Milkyland als `review`. Philip hat Pushes ausdrücklich freigegeben und testet auf Prod. Der Zeitbasis-Chat übernimmt deshalb zentral Integration, geprüfte Commits, Push und Deployment-Prüfung; die übrigen Chats führen keine parallelen Git-Mutationen aus. Nach erfolgreichem Push setzt der veröffentlichende Chat die betroffenen Tasks auf `released`. Diese Plan-Datei bleibt bei der Planung und darf im abgestimmten Release aufgenommen werden.

### Runde 2 — nach der gemeinsamen Zeitbasis

Die reinen B/C- und D-Module wurden zur parallelen Umsetzung gestartet; die zentrale Anbindung bleibt beim Zeitbasis-Chat:

- Sweep/Reaktion: `01a0e480-9689-7983-9112-5425bdc04ed2`.
- Target-Auswahl: `01a0e480-a96b-78c1-9d54-42db692fa2f9`.

- **B/C — Sweep und Reaktion** sowie **D — Target-Auswahl** können auf vereinbarten Kandidaten-/Pivoteingaben in getrennten Dateien parallel entstehen. Zuerst die kleine Kandidatenübergabe festhalten; danach muss der Target-Algorithmus nicht auf die komplette B/C-Implementierung warten.
- **Setup-Gültigkeit integrieren**, sobald B/C die Invalidierung und D das erste Target liefern. Das beendet den Kandidaten bei Target-1-/Invalidierungstouch und muss konsistent über Replay-Schritte rekonstruiert werden. Dieser gemeinsame Abschluss wartet auf beide Ergebnisse.
- **F anschließen**, sobald Zeitbasis und reine F-Auswertung fertig sind. Gemeinsame Chart-/Dashboard-Anpassungen seriell durch die jeweiligen Besitzer ausführen.

### Runde 3 — nach Sweep-Zuordnung und Targets

- E/G-Chat gestartet: `01a0e487-5aa1-7f50-a1b8-6642b75f4f22`. Er setzt die belegbaren Kandidaten und Divergenzberechnung bereits um; ungeklärte Vergleichs-/Zuordnungsregeln bleiben ausdrücklich unbekannt.

- **E/G:** Zuordnung der Gegenargumente und Zusatzargumente wartet auf die tatsächlichen B/C- und D-Ergebnisse. Reine Divergenzberechnung wäre vorziehbar, die fachlich korrekte Zuordnung und Vergleichsregel noch nicht.
- **H:** frühe Close-Regeln und DR-114-Abnahme umgesetzt, siehe Abschnitt H.
- **I:** zuletzt, wie vereinbart.
- **Statistik:** nach stabilen Erkennungs-/Ausführungsregeln und korrekter zeitlicher Auswertung. Keine frühzeitigen Winrate-Versprechen aus einem unvollständigen Ablauf.

## Veröffentlichter Stand und verbleibende Grenzen

Erster Release: `1ab1e0b`, GitHub-Pages-Deployment erfolgreich (Run `36347808770`). Enthält Menübezeichnungen, eigenen Checklist-Bereich, automatische Zeit-/Datenbasis, A sowie F. Bestehender TSC bleibt erhalten. Die Oberfläche zeigt neun automatisch befüllte Prüfpunkte ohne manuelle Checkboxänderungen und ohne endgültiges Gesamt-Go.

- Replay verwendet den im Zeitmodell festgelegten tatsächlichen Chart-Schluss. Fehlende Kerzen bleiben ausdrücklich unbekannt.
- Im Live-Modus führt fehlender aktueller Kerzenschluss konservativ zu veralteten Daten; das betrifft auch Marktschließungen. Daraus wird kein aktuelles Handelssignal abgeleitet.
- F verwendet den maßgeblichen gepflegten Kalender und dessen tatsächlichen Ladezustand gemäß News-Policy oben.
- B/C und D sind in separaten Modulen implementiert: älteste Major-/Medium-H1-Sweeps, automatische Reaktionszuordnung über identische Sweeps der bestehenden Erkennung und Zielvorschau. Die feste historische Target-Auswahl bleibt offen. Eine aktuelle Target-Vorschau darf kein vergangenes Setup verlängern.
- H ist inzwischen ergänzt, siehe Abschnitt H. I bleibt zurückgestellt. E/G dürfen ohne geklärten Stärkevergleich und Mitigationsbegriff kein endgültiges Go/No-Go erfinden.
- Ergänzung zum damaligen Spread-Hour-Audit: Backend inzwischen mit `ac59f73` veröffentlicht; die drei betroffenen Funktionen sind deployed. Der Re-Backfill bleibt laut eigenem Task Philip vorbehalten. Keine Rückrechnung oder Journaländerung wird in dieser Checklist-Runde gestartet.

### DR 114: Abgleich mit echten historischen Daten

Das Journal nennt für Position 135 den 09.09.2026 um 09:20 Uhr (Europe/Berlin). Der lesende Abgleich des bis dahin geschlossenen Kerzenpräfixes unterscheidet folgende Quellen:

| Preis | Tatsächliche Herkunft |
|---|---|
| 1,35409 | H1-P2 vom 09.09. um 04:00 Uhr; bestätigt um 07:00 Uhr; Asia Mid. |
| 1,35394 | Gespeichertes erstes Journaltarget (ID 148), eigenes M5-P5-Low vom 09.09. um 01:35 Uhr, Liquiditätslevel 460627. Kein belegter pauschaler Offset von 1,35409. |
| 1,35300 | Gespeichertes zweites Journaltarget (ID 150), M5-P5-Low vom 08.09. um 18:45 Uhr, Liquiditätslevel 460629. In der H1-Struktur P2, nicht P5. |
| 1,35211 | Ziel der überholten H1-P5-Auswahl; Pivot vom 08.09. um 12:00 Uhr, MMM Low. |

Das tiefere H1-Low um 13:00 Uhr am 08.09. bei 1,35219 liegt im linken P5-Fenster des 18:00-Pivots bei 1,35300 und verhindert dessen P5-Einstufung. Das alte Spread-Hour-Level 1,35294 wird mit der aktuellen Konfiguration ausgeschlossen.

Die Auswahl erfolgt inzwischen nach M5-Sessionpivots. Die bestätigte Auswahl 1,35335 / 1,35300 und der bewusst vorerst akzeptierte Mitternachts-Pivot stehen in [Abschnitt D](#d--4--targets-bestimmen). Der explizite Auditzeitpunkt bleibt eine separate historische Prüfung; die Replay-UI-Semantik steht im Zeitmodell oben.

**E/G-Zuordnung:** D sucht unberührte Zielpivots. Ein bereits gesweepter identischer P5-Pivot als Gegenargument passt deshalb nicht ohne Weiteres dazu. Zu klären ist, welcher Ursprung der Gegenreaktion dem Ziel zugeordnet werden soll; eine bloße Preisnähe ersetzt diesen Nachweis nicht.
