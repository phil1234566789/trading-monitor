# Anleitung: State-Machine lesen & bedienen

Für alle, die die State-Machine tatsächlich BEDIENEN (Lana im Live-/Backtest-Ablauf, ein
manueller Testlauf) — nicht für Code-Änderungen an der Maschine selbst. Architektur/Rationale/
Implementierungsdetails dafür stehen in [`state-machine.md`](state-machine.md).

## Grundprinzip

`trading_loop_state` hat genau eine permanente Zeile pro `(instrument, date_str)` (Berlin-Datum).
Existiert sie nicht, wurde für diesen Tag+Instrument noch nie `check_pretrade_gates`/
`run_bias_check` aufgerufen — kein Fehler, einfach der Ausgangszustand.

## State lesen, ohne die Maschine zu bewegen

`get_loop_state(instrument, replayUntilSec?)` liefert die komplette Zeile (Status/Knoten/Schritt/
Richtung/Targets/Invalidierung/Watch-Level/Heartbeat-Log). `initialized=false` = noch keine Zeile
für diesen Tag. Alle Zeitfelder (`lastAnalysisTime`, `replayUntil`, jeder Heartbeat-Eintrag)
kommen fertig als `{sec, berlin}` zurück — **niemals `sec` selbst in Berlin-Zeit umrechnen**
(Kopfrechnen, `date`/Bash-TZ-Tricks: Git Bash auf Windows hat keine Europe/Berlin-Zeitzonendaten,
`TZ=Europe/Berlin date -d @...` fällt still auf UTC zurück und beschriftet es trotzdem als "GMT" —
Vorfall 06.09.2026, erst durch Abgleich mit `/loop-status` aufgefallen, 2h daneben).

## Maschine bedienen

`get_next_action(instrument, replayUntilSec?)` IMMER zuerst aufrufen, bei jedem Wiedereinstieg
(neue Session, nach Pause, nach jedem einzelnen Tool-Aufruf). Antwort:

- `tool` — welches MCP-Tool als Nächstes gültig ist, `null` = nichts zu tun (Kein Trade / fertig).
- `judgment` — `true`: echtes Urteil, das nur ein LLM treffen kann, die Maschine parkt hart darauf.
  `false`: der genannte Tool-Aufruf bewegt die Maschine als Nebeneffekt seiner eigentlichen Aufgabe
  mit, keine extra State-Machine-Sorge nötig.
- `hint` — Klartext-Begründung.
- `initialized=false` — zuerst `check_pretrade_gates` aufrufen.

## `replayUntilSec` — der EINE Zeit-Parameter (alle Tools)

Unix-Sekunden UTC. **Weglassen = live „jetzt", angeben = Replay-Zeitpunkt.** Seit 15.09.2026 heißt
er in JEDEM Tool so — vorher gab es fünf Namen für dieselbe Sache (`sec`, `nowSec`,
`currentTimeSec`, `toSec`), und ein Aufruf mit dem falschen Namen fiel stillschweigend auf „jetzt"
zurück, weil zod unbekannte Keys verwirft. So wurde aus einem Backtest-Aufruf für den 09.09. ein
Live-Schreibzugriff auf den 15.09. Die alten Namen sind weiterhin im Schema, aber so typisiert,
dass ein Aufruf damit mit einer Meldung abbricht, statt falsch durchzulaufen.

Nur das daraus abgeleitete Berlin-*Datum* bestimmt, welche Tageszeile gelesen wird — die genaue
Uhrzeit ist für `get_next_action`/`get_loop_state` irrelevant. Ausnahme: Tools, die die Maschine
tatsächlich voranbringen (`run_bias_check`, `run_dealing_range_loop`) übernehmen exakt diesen
Zeitpunkt als neuen `last_analysis_time_sec` — dort MUSS die Uhrzeit stimmen (Backtest-Fortschritt
hängt daran).

**Im Backtest gilt: immer mitgeben.** Tools, die schreiben und ohne den Parameter auf „jetzt"
zurückfallen (`check_pretrade_gates`, `create_dealing_range`, alle `log_*`, die Trade-Tools),
treffen sonst den heutigen Kalendertag statt des Replay-Tages.

Nicht betroffen: `fromTime`/`toTime` beim Kerzen-Archiv und bei `get_news_events` — das sind echte
Zeit*bereiche*, kein „wann ist jetzt".

## Menschlicher Gegencheck

`/loop-status` (Live-Ansicht, aktualisiert alle 8s) und `/trading-flow` (Graph mit hervorgehobenem
`current_node`) zeigen dieselbe Tabelle im Browser — bei Zweifel an einem Tool-Ergebnis dort
querlesen, statt lange im Code zu suchen.

## Ablaufbeispiel

Replay-Tag `T`, Instrument `I`:

1. `get_loop_state(I, T)` — Überblick verschaffen, ohne etwas auszulösen.
2. `get_next_action(I, T)` — sagt den nächsten gültigen Tool-Aufruf.
3. Diesen Aufruf ausführen (bei `judgment=true` erst das eigene Urteil bilden, siehe
   `00-trading-steps/` im `trading`-Repo für die fachliche Regel dahinter).
4. Zurück zu Schritt 2, bis `tool=null`.
