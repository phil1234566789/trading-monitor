# Gold H4: begrenzte September-Vorschau

24.09.2026. Nativer ForexConnect-Bid-Abruf über das bestehende Demokonto erfolgreich.
Zugangsweg und Betrieb: [FXCM-Feed](../../docs/fxcm-feed.md). Der persönliche Skill
`fxcm-vps-probe` beschreibt den sicheren Prüfablauf. Keine Zugangsdaten in diesen Artefakten.

## Umfang und Ergebnis

- Separater Container aus dem laufenden Collector-Image, ohne produktiven Datenmount;
  maximal 180 Sekunden, 384 MiB RAM und 0,5 CPU. GBP/EUR-Collector unverändert.
- Fenster 24.08.2026 bis 24.09.2026, Abschlussgrenze 23:00 Europe/Berlin.
  Nur native geschlossene H4-Kerzen, keine Aggregation aus H1.
- 143 XAU/USD-Kerzen: 107 im September, 36 August-Vorlauf. Erste Startzeit
  24.08. 03:00, letzte 24.09. 19:00 Europe/Berlin. Letzte nominale Schlusszeit 23:00.
- OHLC-Invarianten, sortierte eindeutige Zeitstempel, geschlossene Kerzen und
  Preisraster geprüft: keine Fehler. SDK `digits=2`, `point_size=0.01`.
- Native H4-Startstunden im Fenster: 03, 07, 11, 15, 19, 23 Uhr Europe/Berlin.
  Ein Zeitstempel benennt das native Intervall; er ist nicht zwingend die Uhrzeit
  des ersten handelbaren Ticks darin. Insbesondere beginnt die Sonntags-H4-Kerze
  nominal um 23:00, obwohl Gold erst am Montag um 00:00 gehandelt wird.
- Vier Wochenendlücken mit 52 Stunden Startzeitabstand; sonst 4 Stunden.
  Die tägliche Pause liegt innerhalb eines H4-Intervalls und erzeugt keine fehlende H4-Kerze.
  Laut [FXCM-Handelszeiten](https://docs.fxcorporate.com/user-guide/FXCMCFDTradingHours.pdf)
  (Stand 01.09.2026) liegt die tägliche Pause in diesem September bei 23:00–00:00,
  Freitagsschluss bei 22:45 Europe/Berlin. H4 belegt keine minutengenauen letzten Ticks.

## Vorläufige H4-Schwelle

Nur gemeinsame September-Startzeiten vergleichen (107 H4-Paare), August dient als
Vorlauf für die Erkennung. Median True Range: Gold 32,45 USD, GBP/USD 0,00210.
Die bestehende Forex-H4-Schwelle von 4 Pips entspricht 0,0004 Preisabstand.

`0,0004 × (32,45 / 0,00210) = 6,18095… USD`, auf 0,01 USD aufgerundet: **6,19 USD**.

Das ist eine nachvollziehbare Volatilitätsskalierung für diesen Test, keine
abschließende Kalibrierung und kein Profitabilitätsnachweis. Der akzeptierte H1-Wert
2,53 USD bleibt unverändert. Keine Ableitung allein aus der Mengeneinheit Feinunze.

## Speicherung und Darstellung

- Migration `20260924233000` erweitert ausschließlich die Gold-Testfreigabe auf H1/H4.
- 143 Kerzen und 16 H4-Orderblöcke idempotent gespeichert, davon 15 Blöcke im September.
  12 Blöcke sind am Fensterende invalidiert. Alle `notified=true`, keine historischen Alarme.
- Chart zeigt September, August-Vorlauf ist durch Zurückscrollen erreichbar.
  H1 und H4 lesen ihre jeweils eigenen Kerzen und Blöcke. Die gemeinsame Box-Darstellung
  stoppt beim ersten Touch, auch wenn der gespeicherte Endzeitpunkt eine spätere Invalidierung ist.
- H1-Bestand unverändert: 230 Kerzen, 40 Blöcke. Keine Anpassung persönlicher Sessions,
  Handelszeiten, Forex-Schwellen oder produktiver Collector-Konfiguration.

## Betrieb und Grenzen

Vor/nach Abruf Collector healthy, Neustartzähler unverändert 2. Nach Test 3376 MiB RAM
verfügbar, Collector 61,2 MiB und 0,32 % CPU in der Momentaufnahme. Upload-Rückstand 0;
Watchdog aktiv. Keine Hinweise auf Überlastung durch diesen kleinen Test, kein Dauerlastnachweis.
Keine zusätzlichen Abos oder Serverkosten ausgelöst. Demo-Verfügbarkeit bleibt extern abhängig.

Noch kein Gold-Livebetrieb, kein Vollbackfill, keine M5-Validierung. H4-Kanten und
Testschwelle müssen visuell vom Nutzer geprüft werden. Rohdaten, Auswertung und
reproduzierbarer Import liegen neben diesem Bericht; SQL-Arbeitsdateien unter `.debug/`.
