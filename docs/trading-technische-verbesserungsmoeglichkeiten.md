Technische Verbesserungsideen rund um Lana/Automatisierung, gesammelt aus Chat-Diskussionen
(nicht der Ort für den eigentlichen Build-Stand — dafür der milk-city-Task "Lana Auto-Analyse:
automatischer, periodischer Chart-Check statt manuellem Nachfragen", Projekt `trading-monitor`).

## Session-Signale vs. serverseitige Auto-Analyse (2026-08-19)

Zwei unterschiedliche Automatisierungs-Ideen, die sich ergänzen statt zu konkurrieren:

| | Session-Signale (`CronCreate`) | Serverseitige Auto-Analyse |
|---|---|---|
| Läuft wo | In der laufenden Claude-Code-Session (lokal, dieser Rechner) | Supabase Edge Function, `pg_cron`-getriggert |
| Braucht Build | Nein, sofort nutzbar über `CronCreate`-Tool | Ja — neue Edge Function, eigener Anthropic-API-Key |
| Dauer | Nur für die aktuelle Session (session-only stirbt beim Schließen; durable übersteht Neustart, feuert aber nur, solange irgendwann wieder eine Session in diesem Repo läuft) | Dauerhaft, unabhängig davon ob der Rechner läuft |
| Zweck | In einer laufenden, langen Analyse-Session proaktiv auf dem Laufenden halten (z.B. EUR-Beobachtung über den ganzen Handelstag) | Überhaupt erst benachrichtigen, wenn Philip gar nicht am Chart sitzt |

Deckt sich inhaltlich mit Schritt 5 "Markt beobachten" aus `trading/00-trading-steps/` — beides ist
im Kern derselbe Warte-Loop, nur mit unterschiedlicher Laufzeit-Umgebung.

## Wichtige Einschränkung der serverseitigen Variante: kein Reasoning-Agent

Ein roher Claude-API-Call (wie ihn eine Edge Function machen würde) ist ein einzelner
Request→Response-Call — kein autonomer Tool-Loop, keine Subagents, kein MCP-Client, anders als
Claude Code hier. Für den Lana-Auto-Analyse-Fall ist das kein Blocker: die Edge Function baut den
kompletten Datensnapshot selbst per normalem TypeScript-Code zusammen (dieselben DB-Queries wie im
MCP-Server), bündelt alles in EINEN Prompt (genau wie `get_data_export` es für die MCP-Tools tut),
und Claude bekommt nur noch die reine Urteilsaufgabe ("ist hier was meldenswert?") — keine
Tool-Nutzung durch Claude selbst nötig.

Würde erst zum Problem, wenn die Server-Lana mal explorativ arbeiten müsste (z.B. selbst
entscheiden "ich brauch noch mehr historischen Kontext") — dann bräuchte es einen echten
Tool-Use-Loop in der Edge Function (Claude API unterstützt Tool Use, die Ausführungsschleife
müsste aber selbst gebaut werden, das macht Claude Code nicht automatisch server-seitig mit). Für
eine erste Version (fixer Snapshot rein, Urteil raus) nicht nötig.

## Kosten & Optimierung (2026-08-19)

Grobe Schätzung für 8-17 Uhr, alle 5 Min (108 Calls/Tag, davon ~24 "echte Analyse" bei
interessanten POIs, Rest billige Candle-Checks), pro Instrument: ~1€/Tag bei einer Haiku
(billige Checks)/Sonnet (echte Analyse)-Kombi — vernachlässigbar, kein Blocker fürs Feature.

Zwei Hebel, die trotzdem sinnvoll sind, nicht wegen der Kosten selbst, sondern weil sie das
Feature technisch sauberer machen:

- **Prompt Caching** für den wiederkehrenden Teil des Prompts (Lana-Persona/System-Prompt bleibt
  über alle 108 Calls/Tag gleich) — Cache-Read kostet nur ~10% vom normalen Input-Preis.
- **Checks außerhalb interessanter Zonen reduzieren** statt stur alle 5 Min ein LLM aufzuwecken —
  mechanisch (ohne LLM) vorfiltern, ob gerade überhaupt was in der Nähe einer Zone/eines Levels
  passiert. `poi-watcher` liefert im Prinzip genau dieses Signal (welche Zonen/Levels gerade
  relevant sind), ist aber selbst noch nicht ausgereift genug dafür — muss erst nachgebessert
  werden, bevor man die Auto-Analyse darauf aufbaut.

## Modellwahl: kein automatisches Routing

Es gibt kein eingebautes "Claude entscheidet selbst, welches Modell für diesen Call passt" — die
Edge Function muss selbst (in normalem Code, vor dem API-Call) festlegen, ob ein billiger
Candle-Check (Haiku) oder eine echte Analyse (Sonnet/Opus) vorliegt, und dann das passende
`model`-Feld im Request setzen. Diese Entscheidung selbst ist wieder mechanisch ableitbar (z.B.
"ist der Preis gerade nah an einer bekannten Zone" — genau das Signal, das oben schon als
Voraussetzung für den zweiten Kostenhebel genannt ist) — hängt also am selben `poi-watcher`-
Nachbesserungsbedarf.

## Bezug zu 00-trading-steps

Auch wenn das Feature technisch in `trading-monitor` gebaut wird (neue Edge Function), gehört es
inhaltlich zu `trading/00-trading-steps/` Schritt 5 "Markt beobachten" — es verstärkt genau diese
Funktionalität (automatisiertes Warten/Beobachten), nur serverseitig statt nur session-gebunden.
