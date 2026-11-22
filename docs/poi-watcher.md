# `poi-watcher`: FXCM-Auswertung und Alarme

Die Function liest geschlossene FXCM-Kerzen für GBPUSD/EURUSD. Sie läuft alle fünf Minuten
mit einer Minute Abstand zum M5-Schluss, durchgehend. Erkennung und Persistierung (Zonen, Level,
Setups) hängen nicht am Alarmfenster — nur der Telegram-Versand tut das. Fehlen frische M5-Kerzen
(Wochenende, Feiertag), überspringt der Lauf das Instrument still; innerhalb des Alarmfensters
bricht derselbe Zustand als Feed-Ausfall ab.

M5 wird jedes Mal ausgewertet. H1/H4/M15 werden nur neu erkannt, wenn ihre letzte archivierte
Kerzenzeit vom erfolgreich verarbeiteten Stand in `forex_h1_cache` abweicht. Entscheidend ist
die native FXCM-Kerzenzeit, keine feste UTC-H4-Grenze. Der Cache wird erst nach einem vollständig
erfolgreichen Lauf aktualisiert.

Die HTF-Touch-Prüfung verwendet auch zwischen H1/H4-Schlüssen die jüngsten geschlossenen
M5-Kerzen (`liveTouch.ts`), damit zwischenzeitliche Dochte erfasst werden. Bestandslesungen sind
paginiert, neue Zonen/Level werden gebündelt gespeichert. Telegram-Nachrichten folgen erst nach
erfolgreicher Speicherung; Alarm-Schalter und Session-Gates bleiben wirksam.

OB-Zonen pflegt der Watcher für `WATCHED_OB_TIMEFRAMES` (`_shared/obTimeframes.js`: 4H/1H/15M),
Liquiditäts-Level nur für 4H/1H. M15 ist optional: fehlen 15m-Kerzen eines Instruments, läuft der
Rest normal weiter. Der Alarm `ob_zone_15m` startet ausgeschaltet.

Betrieb, historische Abdeckung und Wiederherstellung: [FXCM-Feed](fxcm-feed.md).

## Trade-Setups: speichern, nicht alarmieren

`poi-watcher` erkennt Setups mit derselben Pipeline wie der Chart (`src/setup1Detection.js` über
`_shared/setup1Live.ts`) und speichert sie in `trade_setups`: die Setup-1-Erkennung plus die
LS-Reaktion-Kandidaten, die erst die OB-Sweep-Quellen finden. Die Zeilen sind die Basis für LS-Reaktion (Chart,
`dob-watcher`-LQ-Sweep-POI, MCP `get_trade_setups`/`get_data_snapshot`, Alarm-Protokoll). Einen
eigenen Telegram für diese Setups gibt es nicht; das LS-Reaktion-Urteil cacht `dob-watcher` in
`ls_reaction_verdicts`.
