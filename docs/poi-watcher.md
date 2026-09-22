# `poi-watcher`: FXCM-Auswertung und Alarme

Die Function liest geschlossene FXCM-Kerzen für GBPUSD/EURUSD. Sie läuft alle fünf Minuten
mit einer Minute Abstand zum M5-Schluss, innerhalb der konfigurierten Alarmfenster einschließlich
Vorlauf. Außerhalb des Fensters erfolgt keine Auswertung, außer bei einem Wartungsaufruf mit
`forceH1Refresh`.

M5 wird jedes Mal ausgewertet. H1/H4 werden nur neu erkannt, wenn ihre letzte archivierte
Kerzenzeit vom erfolgreich verarbeiteten Stand in `forex_h1_cache` abweicht. Entscheidend ist
die native FXCM-Kerzenzeit, keine feste UTC-H4-Grenze. Der Cache wird erst nach einem vollständig
erfolgreichen Lauf aktualisiert. Ein M5-Stand älter als 15 Minuten bricht den Lauf ab.

Die HTF-Touch-Prüfung verwendet auch zwischen H1/H4-Schlüssen die jüngsten geschlossenen
M5-Kerzen (`liveTouch.ts`), damit zwischenzeitliche Dochte erfasst werden. Bestandslesungen sind
paginiert, neue Zonen/Level werden gebündelt gespeichert. Telegram-Nachrichten folgen erst nach
erfolgreicher Speicherung; Alarm-Schalter und Session-Gates bleiben wirksam.

Betrieb, historische Abdeckung und Wiederherstellung: [FXCM-Feed](fxcm-feed.md).
