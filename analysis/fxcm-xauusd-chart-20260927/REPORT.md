# Gold: normaler Chart, Livefeed und Historie 2026

Stand 27.09.2026. Betriebsweg und Wiederherstellung stehen in
[docs/fxcm-feed.md](../../docs/fxcm-feed.md), Zugang im Skill `fxcm-vps-probe`.
Der separate September-Test wurde nach Philips visueller Prüfung in den normalen Chart überführt.

## Umfang und Daten

XAUUSD bietet M5, H1, H4 und D1 im normalen Chart einschließlich Replay, Struktur,
Messwerkzeugen, Orderblöcken und Journal. Native geschlossene Bid-Kerzen werden verwendet.
Der Backfill 2026 lieferte folgende verwendbare Kerzen (Stand Wochenende):

| Zeitrahmen | Kerzen nach Lesefilter |
| --- | ---: |
| M5 | 52.150 |
| H1 | 4.363 |
| H4 | 1.141 |
| D1 | 193 |

Die letzte reguläre M5-Kerze beginnt am 25.09. um 22:40 Europe/Berlin.
ForexConnect lieferte zusätzlich drei flache Wochenend-Platzhalter in M5/H1/H4.
Diese Rohzeilen wurden nicht gelöscht. Collector und Archivleser filtern sie konservativ
nur im sicher geschlossenen Wochenend-Kern; normale flache Werktagskerzen bleiben erhalten.
Der M5-Timer zeigt dort Wochenendpause statt einer irreführenden Störungsmeldung.

Archivleser paginieren bis zu einer leeren Seite, auch bei serverseitig gekürzten Seiten.
Gold-Lesefehler werden nicht als vollständiger Cache gespeichert. Cache-Version 13 verwirft
alte unvollständige Einträge. Am Archivbeginn wird die Grenze angezeigt, ohne Broker-Fallback.
H1/H4-OBs verwenden die native Gold-Historie und im Replay nur vollständig geschlossene Bars.
Die lokale Juli–September-Fixture sichert den Vergleich mit abgeschnittener Historie ab.

## Preisabstände

Preisformat und Preis-Punkt: 0,01 USD. Strategieabstände werden unabhängig davon kalibriert.
Der [M5-Vergleich](../fxcm-xauusd-m5-20260924/REPORT.md) ergab aus 4.961 gemeinsamen
September-Kerzen ein Verhältnis medianer True Ranges von rund 15.000 gegenüber GBPUSD.
Dieses Verhältnis überträgt bisherige absolute Forex-Abstände; es ist keine Aussage über
Profitabilität oder vollständige Gleichheit verschiedener Feeds.

| Regel | Gold-Abstand in USD |
| --- | ---: |
| M5 / H1 / H4 Mindest-FVG | 0,75 / 2,53 / 6,19 |
| Setup-Abstand (bisher 0,0005) | 7,50 |
| Sweep-Suchradius (bisher 0,002) | 30 |
| Target-Auswahlradius (bisher 50 Forex-Pips) | 75 |
| R-Skalen-Ausgangsstop (bisher 6 Forex-Pips) | 9 |

Konfiguration: `src/instrumentConfig.js` und bewusst synchron gehaltene Backend-Kopie.
Bestehende Sessions/Handelszeiten wurden nicht neu definiert. Gold-Alarme bleiben ausgeschaltet.

## Betrieb und Abnahme

Gold läuft separat und mit Ressourcenlimit; GBP/EUR-Container wurde nicht ersetzt.
Beide Container meldeten healthy. Gold: 0 Neustarts, rund 59 MiB RAM und 0,16 % CPU
bei der Abschlussmessung; rund 3,2 GiB RAM auf dem VPS verfügbar. Das ist eine Momentaufnahme,
kein Lasttest während des Handels. Gold ist auf 384 MiB und eine halbe CPU begrenzt.

Ingest, Archivleser, poi-watcher und Daily-Pivots wurden deployed. Sechs API-Gegenproben
lieferten HTTP 200; die Daily-Auswertung ergänzte 27 Gold-Pivots. Siehe `rollout-check.json`.
Browserprüfung: März-Replay mit Struktur, nächste M5-Kerze (15:00 → 15:05), H4-Ansicht.
Regressionstests decken native Replay-Grenzen, Pagination, Fehlerweitergabe, Preisabstände,
Schlusszeiten, Wochenendfilter und Timer ab. Python-Tests prüfen die Collector-Normalisierung.

Da die Abnahme am Sonntag erfolgte, ist eine neu eintreffende Schlusskerze nach Marktöffnung
noch nicht beobachtet worden. Kontozugang, historischer Abruf, Import und laufende Collector-Zyklen
funktionieren. Historie vor 2026 und zusätzliche Gold-Zeitrahmen sind nicht Teil dieses Rollouts.
Die spezialisierten MCP-Trading-Tools sind damit nicht automatisch vollständig für Gold validiert.
