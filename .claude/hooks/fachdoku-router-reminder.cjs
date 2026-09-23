// PreToolUse-Hook: erinnert an den fachdoku-router-Skill, sobald eine Datei angefasst wird, fuer
// die die Router-Tabelle eine vertiefende Doku fuehrt.
//
// Warum: die Skill-Beschreibung nennt ihre Trigger-Dateien praezise ("sobald an
// src/marketStructureAnalysis.ts gearbeitet wird"), aber eine Beschreibung ist nur ein Angebot —
// wer die Datei direkt liest, ruft den Skill nicht auf und uebersieht die Doku. Genau so passiert
// am 23.09.2026: aus dem Fehlen der Deno-Kopie in CLAUDE.md wurde auf eine Doku-Luecke geschlossen,
// obwohl marketStructureAnalysis.notes.md sie woertlich beschreibt.
//
// Matcht bewusst AUCH Bash und Grep, nicht nur Read/Write/Edit: derselbe Fehler entstand ueber
// `cat`/`grep` im Bash-Tool, ein reiner file_path-Matcher haette nie gefeuert.
//
// Die Pfade werden aus der Router-Tabelle selbst gelesen — keine zweite Liste, die driften kann.
// Absichtlich eigene Datei statt Inline-Command in settings.json (siehe
// handbuch-check-reminder.js: node -e ist auf Windows/Git-Bash unzuverlaessig).

const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const SKILL = join(__dirname, "..", "skills", "fachdoku-router", "SKILL.md");

// Zeilen der Router-Tabelle: | Thema | Trigger | [`datei`](pfad) |
// Aus der Trigger-Spalte alle Backtick-Werte ziehen, die wie ein Pfad aussehen; aus der
// Ziel-Spalte den Link-Text. Trigger ohne Pfad ("Philip schickt einen Screenshot") fallen weg.
function readRoutes() {
  const rows = [];
  for (const line of readFileSync(SKILL, "utf8").split("\n")) {
    if (!line.startsWith("|")) continue;
    const cols = line.split("|").map((s) => s.trim());
    if (cols.length < 5) continue;
    const ziel = /\[`?([^`\]]+)`?\]/.exec(cols[3]);
    if (!ziel) continue;
    const pfade = [...cols[2].matchAll(/`([^`]+)`/g)]
      .map((m) => m[1])
      .filter((p) => p.includes("/") || /\.(ts|js|vue|md|json)$/.test(p));
    if (pfade.length > 0) rows.push({ pfade, doku: ziel[1] });
  }
  return rows;
}

let data = "";
process.stdin.on("data", (c) => (data += c));
process.stdin.on("end", () => {
  let input;
  try {
    input = JSON.parse(data);
  } catch {
    process.exit(0);
  }

  const ti = input.tool_input || {};
  // Alles zusammenwerfen, worin ein Pfad stecken kann — file_path (Read/Write/Edit),
  // command (Bash), pattern/path/glob (Grep/Glob).
  const haystack = [ti.file_path, ti.command, ti.pattern, ti.path, ti.glob]
    .filter((x) => typeof x === "string")
    .join("\n")
    .replace(/\\/g, "/");
  if (!haystack) process.exit(0);

  let routes;
  try {
    routes = readRoutes();
  } catch {
    process.exit(0); // Router-Tabelle nicht lesbar -> nie blockieren
  }

  const treffer = [];
  for (const r of routes) {
    const passend = r.pfade.filter((p) => haystack.includes(p));
    if (passend.length > 0) treffer.push({ datei: passend[0], doku: r.doku });
  }
  if (treffer.length === 0) process.exit(0);

  const liste = treffer.map((t) => `${t.datei} -> ${t.doku}`).join("; ");
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        additionalContext:
          "Fuer diese Datei fuehrt die fachdoku-router-Tabelle eine vertiefende Doku: " +
          liste +
          ". Diese Doku lesen, BEVOR aus dem Code oder aus CLAUDE.md auf eine Luecke oder ein " +
          "fehlendes Konzept geschlossen wird — CLAUDE.md haelt solche Details bewusst nicht " +
          "(globales CLAUDE.md: Ladekosten passend zur Abruf-Haeufigkeit).",
      },
    })
  );
});
