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

## Forbidden-Session-Gate für Trade-Setup-Alarme

Der Chart versteckt Trade-Setups, deren bestätigender M5-OB in einer `danger='forbidden'`-Session
entstanden ist (Asia, Spread Hour, Weekend Gap — Sessions-Modal). `poi-watcher` kannte die
`sessions`-Tabelle lange nicht und alarmierte sie trotzdem: 40 von 432 alarmierten Zeilen im
Bestand (22.09.2026), weil ein in Asia entstandenes Setup erst beim ersten Tick im Alarmfenster
gemeldet wird — `ob_start_time` liegt dann im verbotenen Fenster, `notified_at` nicht.

Seit 09/2026 gated `forbiddenSessionAt` (`_shared/forbiddenSession.ts`) den `alertNow`-Zweig über
`ob_start_time`, exakt wie `notForbidden` in `usePriceChartTradeSetups.js`. Die `trade_setups`-Zeile
entsteht weiterhin (`analysis/dr-reichweite/` wertet den Bestand aus, ein stilles Loch darin wäre
schlimmer als ein stiller Alarm) — nur `notified` bleibt `false`. Das Run-Summary zählt die
unterdrückten Setups unter `tradeSetups.forbiddenSession`.

`caution` (MMM) zählt bewusst nicht als Sperre. Das Gate gilt nur für Trade-Setups, nicht für die
`ob_zones`/`liquidity_levels`-Touch-Alarme — der Chart filtert dort ebenfalls nicht.
