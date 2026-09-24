# XAUUSD: begrenzter FXCM-H1-Kontotest, 24.09.2026

## Ergebnis und Umfang

**Erfolgreich im bestehenden Demokonto abgerufen:** native XAU/USD-H1-Bid-Kerzen über
ForexConnect 1.6.43 im vorhandenen VPS-Image. Testfenster: 07.09.2026 00:00 bis
21.09.2026 00:00 Europe/Berlin (exklusive Endgrenze). Keine M5-Validierung, keine
Strategie-Freigabe und kein Nachweis einer tieferen Historienverfügbarkeit.

Separater kurzlebiger Docker-Container, zwei Siebentages-Abfragen pro Instrument.
GBP/USD wurde ausschließlich als H1-Vergleich gelesen. Keine Orders, keine Uploads,
kein Mount der produktiven SQLite-Datenbank, keine Änderungen an Collector, Ingest,
Sessions, Handelszeiten oder Strategie. Geheimnisse wurden nur aus dem bestehenden
read-only Secret-Mount gelesen, nicht in die Ergebnisdateien geschrieben.

## Datenprüfung

- Gold: **230 Kerzen**, zehn Handelstage mit jeweils 23 H1-Kerzen.
- Erste Startzeit: 07.09. 00:00, letzte: 18.09. 22:00, jeweils Europe/Berlin.
- Alle OHLC positiv, endlich und konsistent: Low ≤ Open/Close ≤ High.
- Eindeutige, streng aufsteigende Stunden-Startzeiten; keine offene Kerze im Ergebnis.
- An der Siebentages-Grenze lieferte die API einen überlappenden Datensatz; nach
  Zeitstempel dedupliziert. Keine Aggregation aus M1 oder anderen Zeitrahmen.
- SDK-Angebotsdaten: `digits=2`, `point_size=0.01`; alle OHLC auf dem 0,01-Raster.
  Preisformat daher zwei Nachkommastellen, Chart-Schritt 0,01 USD; 1 FXCM-Punkt =
  0,01 USD Preisbewegung. Dies ist kein Geldwert je Lot; Kontraktgröße und Kontowährung
  wären für eine spätere Positionsgrößen-/PnL-Berechnung separat zu prüfen.
- Beobachtete Preisspanne: 4234,86–4442,90 USD je Feinunze.
- Beispiel erste Kerze: O 4430,15 / H 4435,29 / L 4416,81 / C 4429,24.
- GBP-Vergleich: 244 Kerzen im selben Kalenderfenster, wegen anderer Marktöffnungen.

### Handelspausen

Gold besitzt im Test keine H1-Kerze mit Start 23:00 Europe/Berlin. Auf 22:00 folgt
am nächsten Handelstag 00:00; Freitag 22:00 folgt Montag 00:00. Keine weiteren
Stundenlücken innerhalb der beobachteten Handelstage.

Die [offizielle FXCM-Handelszeitentabelle](https://docs.fxcorporate.com/user-guide/FXCMCFDTradingHours.pdf)
(Stand 01.09.2026) entspricht für diesen Zeitraum einer täglichen Pause 23:00–00:00
und einem Freitagsschluss um 22:45 Europe/Berlin. Eine H1-Kerze um 22:00 kann deshalb
eine verkürzte Handelsspanne enthalten. Aus H1 allein sind der minutengenaue letzte Tick
und Feiertags-Sonderzeiten nicht belegbar. Keine DST-Grenze im Testfenster;
Pausen später zeitzonenbewusst behandeln und nicht als Strategie-Session übernehmen.

## Übertragung der Preisabstände: Vorschlag, nicht aktiviert

Die [FXCM-Instrumentspezifikation](https://www.fxcm.com/eu/help/commodities-xau-usd-gold/)
bestätigt die Punktposition 0,01. Das definiert die Anzeigeeinheit, **keine sinnvolle
Erkennungsschwelle**. Die Notierung je Feinunze bestimmt keine OB-/Sweep-Abstände.

Als nachvollziehbarer H1-Ausgangspunkt wurden die True Ranges zeitgleicher Kerzen
verglichen: `max(H-L, abs(H-C_vorher), abs(L-C_vorher))`. Auf 229 gemeinsamen
Zeitstempeln beträgt der Median für GBPUSD 0,00098 und für Gold 16,50 USD.
Das Verhältnis der Medianwerte beträgt **16836,73**. Das ist eine kleine, aktuelle
Stichprobe; kein universeller Umrechnungsfaktor und keine profitable Kalibrierung.

| Bestehende Schwelle / Code | Befund / Gold-Vorschlag |
|---|---|
| `src/pipConfig.js`, `_shared/pipConfig.js`: 0,0001 | Instrumentabhängige Anzeige-/Punktgröße; Gold 0,01. GBP/EUR unverändert. |
| H1-FVG-Minimum 1,5 Pip = 0,00015, `src/orderBlockDetection.js` | Entspricht 15,31 % des gemessenen GBP-H1-TR-Medians. Gleicher Anteil bei Gold: 2,5255 USD, nach oben auf Raster **2,53 USD = 253 Punkte**. Nur Kandidat zur Prüfung an Gold-H1-Beispielen. |
| H4-FVG 4 Pip; M1/M3 1 Pip; M5 0,5 Pip | Nicht mit H1-Faktor freigeben. Je Zeitrahmen eigene Daten und Validierung nötig. |
| Fallback `IRRELEVANT_PCT=0.05` | Bei Gold um 4400 ergibt das etwa 2,20 USD; zufällige Nähe zum H1-Kandidaten, keine Validierung und kein Grund für stillen Wechsel auf den Nicht-Forex-Pfad. |
| `priceChartConstants.js`, `_shared/tradeSetup.ts`: M5-Abstand 5 Pip, Sweep-Abstand 20 Pip | 0,0005 bzw. 0,002 sind Forex-Preisabstände. Auch Sweep-Zuordnungen mit H1-Leveln münden im M5-Setup; erst mit M5-Daten kalibrieren. Keine Gold-Werte aktiviert. |
| `findTargets.js`: 50 Pip; Protected-Fib-Abstand 50 Pip (siehe `PIP-SETTINGS.md`) | Instrumentabhängige Strategieabstände erforderlich; H1-Skalierung allein validiert den Target-/Fib-Ablauf nicht. |
| `rScale.js`: Stoppdeckel 6 Pip; `pipScale.js`: 10–40 Pip | Risiko-/Ziellogik, keine Formatierung. Separat anhand Gold-Setups und Risikokonvention prüfen; 6 Gold-Punkte = 0,06 USD ist kein begründeter Ersatz. |
| `toFixed(5)` und Chart-Preisformatierung | Instrumentmetadaten verwenden; nicht alle Preise pauschal auf Forex-Präzision lassen. |

Erst Anzeigeeinheit und strategische Abstände voneinander trennen. Für eine spätere
Kalibrierung zunächst längeres H1-Sample mit verschiedenen Volatilitätsphasen und
geprüften OB-Beispielen verwenden; Kandidaten z. B. um 0,5×/1×/2× des H1-Ausgangswertes
vergleichen. Eine feste instrumentabhängige Konfiguration ist transparenter als eine
unbemerkt dynamische ATR-Regel, die die Strategie ändern würde. Zeit-/Fraktalregeln,
Sessions und Benutzer-Handelszeiten bleiben wie gewünscht bestehen.

## Noch offen für vollständige Anbindung

1. Collector-Instrumentliste, Ingest-Validierung, Archivleser und DB-Constraint um Gold
   erweitern; keinerlei bestehende GBP/EUR-Daten ersetzen.
2. Instrumentkonfiguration für Preisraster, Anzeige, Pip-/Punktumrechnung und getrennte
   Erkennungsschwellen einführen. Alle drei OB-Kopien berücksichtigen:
   Frontend, `_shared/orderBlocks.ts`, `trading-monitor-mcp/orderBlockDetection.js`.
3. Dashboard, Journal, Watcher, Daily-Pivots und MCP-Instrumentlisten sowie Ziel-/Risiko-
   und Statistikdarstellung prüfen. GBP-Erfolgsquoten nicht für Gold anzeigen.
4. Weitere Zeitrahmen und Historientiefe separat testen, besonders M5. Danach erst
   begrenzter Gold-Backfill, laufender Collector und Replay-/Live-Abnahme.
5. Brokerpausen für Feed-Aktualitätswarnungen berücksichtigen; vorhandene persönliche
   Handelszeiten und Sessions unverändert lassen. DST/Feiertage gesondert prüfen.

## Nachkontrolle und Artefakte

### H1-Order-Block-Prefill nach Testfreigabe

Philip hat die Kerzen visuell bestätigt und H1-Order-Blöcke für das vorhandene
Fenster angefordert. Dafür wird der oben hergeleitete Kandidat **2,53 USD** jetzt
explizit als Testparameter verwendet, nicht als produktiv validierte Schwelle.
`prefill-obs.mjs` nutzt die vorhandene Erkennung mit einem absoluten Mindest-Gap;
die drei Algorithmuskopien unterstützen denselben optionalen Parameter, ohne ihre
Forex-Defaults zu ändern. Ein Grenzwert-/Paritätstest prüft alle drei Kopien.

Ergebnis: **40 XAUUSD-H1-Blöcke**, davon 30 bis zum Ende des Testfensters invalidiert.
Idempotent in `ob_zones` gespeichert (`notified=true`, kein historischer Alarmversand).
Zustand ausschließlich aus den geladenen 230 Kerzen, ohne Vorhistorie und ohne
Fortschreibung nach dem 18. September. Die Vorschau zeigt zur visuellen Prüfung
auch beendete Zonen, jeweils bis zum gespeicherten Ende. M5 bleibt unvalidiert.
Rohbefund: [order-blocks.json](order-blocks.json).

### Nachträglich autorisierte DB-/UI-Vorbereitung

Philip hat nach erfolgreichem Test die Datenbank- und UI-Vorbereitung freigegeben.
Migration `20260924214000_fxcm_gold_h1_preview.sql` ist angewendet: das bestehende
Archiv erlaubt XAUUSD, mit zusätzlicher Beschränkung auf H1. Die 230 geprüften
Kerzen wurden einmalig idempotent eingefügt und die Anzahl per SQL nachgeprüft.
Kein neuer regelmäßiger Gold-Abruf; Collector und Ingest bleiben unverändert.

Der lokale Dashboard-Reiter XAUUSD neben EURUSD zeigt ausschließlich dieses
historische Testfenster. Kennzeichnung ohne Live-Feed/Setup-Signale; getrennte
Chart-Komponente vermeidet unkalibrierte Forex-Erkennung und GBP-Quoten für Gold.
Forex-Auswahl, Zeitrahmen und persönliche Sessions/Handelszeiten werden nicht geändert.
Browserprüfung: 230 Gold-Kerzen sichtbar, Rückwechsel zu GBPUSD mit Werkzeugen,
Cockpit und Journal möglich. Bestehende Vue-Warnung `onMeasureStart` im Forex-Dashboard
beobachtet, keine neue Gold-Ladefehlermeldung. UI noch nicht veröffentlicht.

### Kosten und Kapazität

Der vorhandene Demo-Zugang lieferte die Daten ohne neues Datenabo. Keine Zusage zu
unbegrenzten Abrufen, langfristiger Demokonto-Gültigkeit oder künftigen FXCM-Konditionen.
Momentaufnahme nach Test: VPS 3919 MiB RAM, davon 3395 MiB verfügbar;
Collector 60,54 MiB RAM bei 0,40 % CPU; Datenträger 118 GiB frei. Kein Upload-Rückstand
und kein zusätzlicher Collector-Neustart. Dies ist keine Messung der Test-Lastspitze
und kein Dauerlasttest. Prüfcontainer war auf 512 MiB und 180 Sekunden begrenzt.

H1 allein entspricht ungefähr 115 Gold-Kerzen pro regulärer Woche. Alle Zeitrahmen
zusammen verursachen wesentlich mehr Daten und Requests. Vor Vollbetrieb Abrufdauer,
Speicherverbrauch, API-Fehler/Begrenzungen, Upload-Rückstand und Supabase-Speicher/Egress
messen; bei wachsendem Rückstand oder Verdrängung der GBP/EUR-Abrufe warnen und den
Gold-Ausbau begrenzen. Der Testchart liest Supabase und belastet den VPS nicht zusätzlich.

Collector vor und nach Test `running healthy`, Neustartzähler unverändert 2.
Nachher GBPUSD/EURUSD bis 24.09.2026 21:30 Europe/Berlin im lokalen Puffer,
Upload-Rückstand 0. Keine Gold-Zeilen in der produktiven SQLite-Instrumentliste.

- [SDK-Ergebnis mit Kerzen und Metadaten](candles.json)
- [Maschinelle Prüfung und alle Pausen](summary.json)
- [Gold-Kerzen](XAUUSD-H1.csv), [GBP-H1-Vergleich](GBPUSD-H1.csv)
- [Begrenztes Abrufskript](probe.py), [lokale Auswertung](analyze.py)

SSH-/Betriebsdetails bleiben zentral in [docs/fxcm-feed.md](../../docs/fxcm-feed.md).
Der wiederverwendbare lokale Skill heißt `fxcm-vps-probe` unter
`C:/Users/Philip/.codex/skills/fxcm-vps-probe/SKILL.md`.
