---
description: "Nur milk-city Task/Feature/Project-Datenpflege (list/get/create/update/set_status) -- KEIN Code schreiben, ausser bei explizitem '/task do <task>'-Praefix (dann: referenzierten Task tatsaechlich umsetzen). '/task new <text>' legt sofort einen neuen Task an, ohne dass Philip das erst ausformulieren muss. '/task refine <task-oder-idee>' plant erst gemeinsam im Chat, bevor Task-Daten angelegt/geaendert werden -- fuer den Fall, dass Philip selbst noch nicht weiss, wie etwas umgesetzt werden soll."
---

## Modus "/task new <text>": Sofort einen neuen Task anlegen

Prüfe, ob Philips Anfrage mit `new ` beginnt (z.B. `/task new RSI-Tooltip fehlt bei Hover auf
Divergenz-Marker`). Falls ja: Philip will direkt einen neuen Task anlegen, ohne das erst in Worten
("leg mir bitte einen neuen Task an...") einleiten zu müssen — der Text nach `new ` IST die
Rohbeschreibung des gewünschten Tasks, nicht eine Frage oder ein anderer Befehl. Verfahre wie folgt:

1. Lies den Text nach `new ` als Ist-Zustand/Problem/Ziel des neuen Tasks. Geht daraus nicht klar
   hervor, WAS konkret gemacht werden soll (nur ein Problem beschrieben, aber kein Ansatz; mehrere
   plausible Lesarten; eine für eine spätere Implementierung ohne Rückfrage nötige Angabe fehlt):
   nicht raten und nicht mit einer vagen Beschreibung anlegen — sofort auf Deutsch nachfragen und ab
   da wie im `refine`-Modus unten gemeinsam klären, bis ein konkreter Ansatz steht. Erst dann mit
   Schritt 2 weiter.
2. `projectId`: Standardmäßig das Repo, in dem diese Session gerade läuft (cwd) — außer der Text
   nennt explizit ein anderes Projekt (z.B. "unter milk-city", "in trading"). Bei Unklarheit lieber
   kurz auf Deutsch nachfragen als raten.
3. Titel und Beschreibung nach den selben Regeln formulieren wie im Rest dieses Dokuments (nicht
   1:1 übernehmen, umformulieren, KI-optimiert, vorher `list_tasks` auf Stil/Länge prüfen) — dieser
   Modus ändert nur, DASS sofort angelegt wird, nicht WIE Titel/Beschreibung entstehen.
4. Status bleibt `open` (Default von `create_task`), es sei denn Philip sagt im selben Atemzug,
   dass sofort losgelegt werden soll — dann zusätzlich `set_task_status(id, "work in progress")`.
5. `new` legt nur die Task-Daten an, implementiert nichts — dafür ist der `do`-Modus unten da (ein
   bestehender, bereits angelegter Task).

## Modus "/task refine <task-oder-idee>": Erst gemeinsam planen, bevor Task-Daten entstehen

Prüfe, ob Philips Anfrage mit `refine ` beginnt (z.B. `/task refine Tile-Editor Undo`, `/task
refine Sprite soll nach links schauen können`). Dieser Modus ist für den Fall, dass Philip selbst
noch nicht weiß, WIE etwas umgesetzt werden soll — Ziel ist ein gemeinsames Durchdenken im Chat.
**Wie die normale Datenpflege-Regel unten gilt auch hier: keine Implementierung, unter keinen
Umständen** — anders als `do` gibt es in `refine` keine Ausnahme davon, auch nicht auf Zuruf
("leg direkt los"). Will Philip nach dem Klären tatsächlich sofort umsetzen, ist das ein separater,
expliziter `/task do <task>`-Aufruf danach, nicht Teil von `refine` selbst.

1. Prüfe per `list_tasks`/`get_task`, ob der Text auf einen bestehenden Task passt (gleicher
   Fuzzy-Match wie im `do`-Modus). Zwei Fälle:
   - **Bestehender Task gefunden**: dessen aktuelle Beschreibung ist die Diskussionsgrundlage,
     wird aber NICHT sofort verändert.
   - **Kein passender Task**: Philip bringt ein neues Thema/eine neue Idee ein, die noch gar nicht
     als Task existiert — der Normalfall, wenn er selbst noch keinen Ansatz hat. Auch hier: noch
     nichts anlegen.
2. Führe ein echtes Planungsgespräch statt Task-Daten zu schreiben: Ist-Zustand kurz einordnen
   (Code lesen/grep bei Bedarf, wie in der Beschreibungs-Regel unten — reine Recherche, keine
   Implementierung), mögliche Ansätze samt Trade-offs nennen, offene Fragen konkret stellen. Kein
   Rätselraten und keine stillschweigenden Annahmen — lieber eine Frage zu viel als eine falsche
   Annahme, die Philip erst hinterher korrigieren muss.
3. Erst NACHDEM Philip einen konkreten Ansatz bestätigt hat, Task-Daten schreiben (nie vorher):
   - Bestehender Task → `update_task` mit der neu formulierten, jetzt konkreten Beschreibung
     (gleiche Qualitätsregel wie unten: KI-optimiert, Ist-Zustand + Ziel/Ansatz, keine
     1:1-Übernahme von Philips Formulierung).
   - Neue Idee → `create_task` (Status bleibt `open`; `work in progress` NICHT setzen, selbst wenn
     Philip direkt loslegen will — das läuft dann über `/task do`, s.o.).
4. Solange der Ansatz noch nicht steht: keine Tool-Aufrufe, die Task/Feature-Daten verändern
   (`create_task`/`update_task`/`set_task_status`) — dieser Modus lebt vom Gespräch, nicht vom
   frühzeitigen Festschreiben einer halbfertigen Beschreibung.

## Modus "/task do <task>": Ausnahme von der Datenpflege-Regel

Prüfe als nächstes, ob Philips Anfrage (siehe `$ARGUMENTS` ganz unten) mit `do ` beginnt (z.B.
`/task do rsi-divergenz`, `/task do task-xyz`, `/task do Tile-Editor Undo`). Falls ja, gilt ab hier
NICHT die "keine Implementierung"-Regel weiter unten — stattdessen:

1. Finde den gemeinten Task über `list_tasks`/`get_task` (per ID oder Titel-Fuzzy-Match auf den
   Text nach `do `). Bei mehreren plausiblen Treffern oder wenn nichts eindeutig passt: kurz auf
   Deutsch nachfragen statt zu raten, bevor irgendwas verändert wird.
2. Setze `set_task_status(id, "work in progress")` sofort, bevor mit der eigentlichen Arbeit
   begonnen wird (wie in CLAUDE.mds normaler Regel für einen eindeutig passenden Task).
3. Implementiere den Task danach ganz normal im Ziel-Repo — lies `get_task`s Beschreibung als
   Auftrag, schreibe/ändere Code, teste wie sonst auch. Die restlichen Regeln dieses Dokuments
   (Titel-/Beschreibungs-Stil, "keine Datei-Edits" etc.) gelten NUR für die reine
   Datenpflege-Nutzung von `/task` ohne `do`-Präfix, nicht für diesen Modus.
4. Beim Fertigstellen greift wieder die normale CLAUDE.md-Regel: Status auf `review` setzen
   (NICHT `done`) sobald die Implementierung steht, Philip um Review bitten, bei jedem
   Folge-Feedback vor dem Weitermachen zurück auf `work in progress`; erst nach Philips expliziter
   Bestätigung `done`; nach einem eigenen `git push` für diesen Task selbst `released` setzen.

Ist Philips Anfrage weder mit `new `, `refine ` noch mit `do ` eingeleitet, gilt ab hier ausschliesslich die
Datenpflege-Beschreibung im Rest dieses Dokuments — dann will Philip ausschliesslich milk-city-**Tasks**, -**Features** (die
übergeordnete Gruppierung mehrerer Tasks, ein "Raum" im MC-Raster) oder -**Projects** über die
MCP-Tools (`list_tasks`, `get_task`, `create_task`, `update_task`, `set_task_status`,
`list_features`, `get_feature`, `create_feature`, `update_feature`) lesen oder ändern — **keine
Code-Implementierung**, auch wenn die Anfrage inhaltlich nach einer Feature-*Beschreibung* (im
Sinne von "neue Funktionalität") klingt oder zufällig zu einem offenen Task passt. Achtung
Begriffs-Kollision: "Feature anlegen" heisst hier IMMER die milk-city-Entity per `create_feature`
anlegen, nie eine echte Funktionalität im Ziel-Repo bauen.

Konkret:
- Führe nur die Tool-Aufrufe aus, die nötig sind, um Titel/Beschreibung/Projekt-Zuordnung (bei
  Tasks zusätzlich Status) zu lesen oder zu ändern, oder um einen neuen Task/ein neues Feature
  anzulegen — passend zu dem, was Philip in dieser Nachricht sagt.
- Ein Feature hat keinen `status` (nur Tasks haben work in progress/review/done/released) und
  keine MC-Raster-Zellen über MCP — die Zellzuordnung (welche Rasterzellen zum "Raum" gehören)
  läuft ausschliesslich per Drag-Painting im Feature-Editor im Browser, nicht per Tool-Aufruf.
  Ein neu angelegtes Feature erscheint zunächst ohne Zellen und mit zufälliger Farbe; das ist
  erwartetes Verhalten, kein fehlender Schritt.
- Falls Philip ein Feature einem Task zuordnen will ("Task X gehört zu Feature Y"): das läuft
  laut Migration `20260814230000_tasks_add_feature_id.sql` automatisch übers Draggen eines
  Task-Blocks auf die Feature-Zellen im MC-Raster, es gibt bewusst kein manuelles Zuordnungs-Tool
  über MCP — wenn danach gefragt wird, das erklären statt zu versuchen, `feature_id` irgendwie
  selbst zu setzen.
- Keine Datei-Edits, kein Bash zum Bauen/Testen, keine Implementierung. Das gilt auch dann, wenn
  CLAUDE.mds übliche Regel ("passt eindeutig zu einem offenen Task -> sofort `carried` setzen und
  loslegen") das sonst nahelegen würde — dieser Command überschreibt das für die aktuelle Anfrage.
  Status bleibt entsprechend unangetastet (kein `carried`), es sei denn Philip sagt explizit, dass
  jetzt losgelegt werden soll.
- Wenn unklar ist, welcher Task oder welches Projekt gemeint ist, oder wenn Philips Anfrage
  inhaltlich mehrdeutig ist (mehrere plausible Lesarten, fehlende Angabe die für eine spätere
  Implementierung nötig wäre, widersprüchliche Angaben): kurz auf Deutsch nachfragen statt zu
  raten oder eine Annahme stillschweigend in die Formulierung einzubauen. Erst nach Antwort
  schreiben/anlegen.
- Kurze Bestätigung am Ende reicht (was geändert wurde) — keine ausführliche Zusammenfassung.

**Titel und Beschreibung NIE 1:1 aus Philips Formulierung übernehmen — immer umformulieren:**
- Titel: kurz, aber "kurz" heisst NICHT "möglichst wenig Wörter um jeden Preis" — ein Titel, der
  nur noch die Kategorie nennt (z.B. nur "Bereich: Unterbereich/Unterbereich") und die
  eigentliche Aussage (was pro Teilpunkt passiert) weglässt, ist zu kurz und muss nachgebessert
  werden, auch wenn er kürzer "aussieht". Ziel ist die kürzeste Formulierung, die noch aussagt,
  WAS gemacht wird — nicht die kürzeste Formulierung überhaupt. Hat die Anfrage mehrere
  eigenständige Teilpunkte, dürfen die im Titel knapp benannt werden (Vorbild: "MC-Raster: nur
  bei aktivem Tile-Editor + größer + neue Farben" — auch das ist ein "kurzer" Titel im Sinne
  dieser Regel, trotz drei Teilpunkten). Stil: kein ganzer Satz, im Stil der bestehenden Tasks
  (z.B. "Tile-Editor: Undo (Strg+Z)", "RSI-Divergenz fertigstellen", "Task-UI: Rechtsklick-Modal
  statt Canvas-Hover") — Bereich/Komponente knapp benennen, kein Nachplappern von Philips
  Wortlaut. Vorher kurz mit `list_tasks` (bzw. `list_features` bei einem neuen Feature) auf
  ähnliche/vorhandene Titel schauen, damit Stil, Schreibweise UND Längen-Kalibrierung konsistent
  bleiben.
- Beschreibung: KI-optimiert für spätere direkte Implementierung durch einen Coding-Agenten ohne
  Rückfrage — d.h. konkret, eindeutig, mit Ist-Zustand/Problem UND dem gewünschten Ziel/Ansatz,
  nicht nur Philips Formulierung nacherzählt. Technische Begriffe/Dateinamen aus dem Repo
  verwenden, wenn bekannt (grep/Read bei Bedarf kurz zur Orientierung, aber ohne Implementierung
  anzufangen). Selbe Sorgfalt wie CLAUDE.mds Regel für `create_task` aus einer bestätigten Idee
  ("konkreter Ansatz, nicht nur das nacherzählte Problem"). Wenn Philip explizit Formulierungen
  oder Details vorgibt, die inhaltlich wichtig sind, diese sinngemäß erhalten, nicht wegkürzen.

Bug-Report 2026-08-14: Philip wollte nur die Beschreibung des `tile-editor-undo-strg-z`-Tasks um
einen Zusatzpunkt ("Buttons für Undo und Redo") ergänzen, es wurde aber direkt mit der
Implementierung losgelegt, weil die Anfrage wie eine normale Feature-Anfrage klang. `/task` ist
genau für diesen Fall da: explizit signalisieren "nur die Task-Daten anfassen, nicht bauen".
Weiterer Punkt 2026-08-14: Titel/Beschreibung wurden bis dahin 1:1 aus Philips Rohtext
übernommen — jetzt stattdessen umformuliert (kürzerer Titel, KI-optimierte Beschreibung) und bei
inhaltlicher Unklarheit nachgefragt statt geraten.

Bug-Report 2026-08-15: erster Titel-Vorschlag war zu lang (nannte alle drei Teilpunkte
ausformuliert), Korrektur schoss übers Ziel hinaus ("Sprite-Editor: Tasks/Features/Projekt-Box" —
zu kurz, sagte nichts mehr über den Inhalt aus), erst der dritte Versuch ("Sprite-Editor: Tasks
gemeinsam, Features einzeln, Projekt-Box kleiner") passte. Titel-Regel oben entsprechend
präzisiert: kürzeste Formulierung, die die Aussage noch trägt — nicht die kürzeste Formulierung
überhaupt.

Philips Anfrage: $ARGUMENTS
