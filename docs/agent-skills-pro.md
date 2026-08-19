Anthropic Academy — Introduction to Agent Skills:

https://anthropic.skilljar.com/introduction-to-agent-skills

Wir haben bereits mehrere funktionierende Skills (`handbuch-check`, `l`, `task`, `dataviz` u.a.,
siehe `.claude/skills/`). Hier die Konzepte aus dem Kurs, die über "Skill funktioniert" hinausgehen.

## Skills vs. CLAUDE.md vs. Hooks vs. Subagents

Skills sind der richtige Ort für **bedingt** geladenes Wissen/Workflow (nur wenn die Trigger-
Beschreibung passt) — im Unterschied zu CLAUDE.md (immer geladen) und Hooks (deterministisch,
läuft immer bei einem Event, keine Trigger-Beschreibung nötig). Deckt sich mit der globalen
Konvention "Ladekosten passend zur Abruf-Häufigkeit" (siehe `~/.claude/CLAUDE.md`) — Skills sind
genau der Mechanismus dafür.

## Progressive Disclosure

Skill-Verzeichnisse können in mehrere Dateien aufgeteilt werden, wobei `SKILL.md` nur den
Einstiegspunkt/die Trigger-Beschreibung enthält und Details erst bei tatsächlichem Bedarf
nachgeladen werden (z.B. über Verweise auf weitere Dateien im selben Skill-Ordner). Spart Context,
wenn ein Skill mehrere Unterfälle abdeckt, die selten alle gleichzeitig gebraucht werden. Für
`handbuch-check` (aktuell vermutlich eine Datei) einen Blick wert, falls der Skill wächst.

## Konfiguration

- **`allowed-tools`** — schränkt ein, welche Tools der Skill überhaupt nutzen darf. Sinnvoll für
  einen reinen Lese-/Check-Skill wie `handbuch-check`, damit er strukturell gar nicht schreiben
  kann, statt sich nur auf die Beschreibung zu verlassen.
- **Context-freie Scripts** — Skills können Shell-Scripts referenzieren, die ohne LLM-Overhead
  laufen (reine Mechanik statt Prompt-Interpretation). Für rein deterministische Prüfschritte
  (z.B. ein Grep-basierter Konsistenz-Check) potenziell schneller/günstiger als ein vollständiger
  Skill-Durchlauf.

## Skills in Subagents

Skills lassen sich in eigene Subagent-Definitionen einbinden — d.h. ein custom Subagent (siehe
`docs/subagents` bzw. den milk-city-Task dazu) könnte einen Skill fest eingebaut bekommen, statt
dass die Hauptsession ihn separat aufruft.

## Sharing & Troubleshooting

- Verteilung über Repo-Commits (das machen wir schon — Skills liegen in `.claude/skills/` im
  Repo) oder org-weit über Enterprise-Managed-Settings/Plugins (nicht relevant für ein Solo-Repo).
- Häufigste Fehlerquelle laut Kurs: Trigger-Beschreibung matcht nicht zuverlässig — beim Schreiben
  einer neuen Skill-Beschreibung lohnt es sich, sie so konkret wie möglich zu halten (siehe unsere
  bestehenden Skill-Beschreibungen als Vorbild, z.B. wie `handbuch-check` exakt beschreibt,
  *wann* es greifen soll).
