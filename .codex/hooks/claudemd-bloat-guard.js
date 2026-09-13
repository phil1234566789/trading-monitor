// PreToolUse-Hook (Write|Edit): blockt (soft) grosse Ergaenzungen an einer CLAUDE.md-Datei
// (dieses Repo + verschachtelte Worktree-Kopien). Ausloeser 06.09.2026 (Philip, "das ist schon
// sooooo oft passiert"): Claude hat trotz bereits dokumentierter Ladekosten-Regel (globales
// CLAUDE.md) zweimal versucht, erklaerende Absaetze direkt in CLAUDE.md zu packen statt sie
// ueber den fachdoku-router-Skill nach docs/*.md zu routen. Eine reine Prosa-Regel im Kontext
// reicht nicht (siehe [[feedback_crossrepo_claudemd_scope]] in Claudes eigenem Memory) -- ein
// Hook laeuft mechanisch, unabhaengig davon, ob die Regel gerade "laut genug" im Kontext ist.
//
// Bewusst als eigene Datei statt Erweiterung von handbuch-check-reminder.js: unterschiedliche
// Aktion (deny statt additionalContext-Hinweis) und unterschiedlicher Scope (CLAUDE.md ueberall
// statt nur .md im trading-Repo).

let data = "";
process.stdin.on("data", (chunk) => (data += chunk));
process.stdin.on("end", () => {
  let input;
  try {
    input = JSON.parse(data);
  } catch (e) {
    process.exit(0);
  }

  const filePath = input.tool_input?.file_path || "";
  if (!/CLAUDE\.md$/.test(filePath)) {
    process.exit(0);
  }

  const toolName = input.tool_name;
  let addedLines = [];

  if (toolName === "Edit") {
    const oldString = input.tool_input?.old_string || "";
    const newString = input.tool_input?.new_string || "";
    const oldLines = oldString.length ? oldString.split("\n") : [];
    const newLines = newString.length ? newString.split("\n") : [];
    // Grobe Heuristik statt echtem Diff: reicht, um "ein Satz umformuliert" von "neuer Absatz/
    // Abschnitt eingefuegt" zu unterscheiden -- ein echter Diff waere hier Overkill.
    const netAdded = newLines.length - oldLines.length;
    addedLines = netAdded > 0 ? newLines : [];
    if (netAdded <= 6 && !newLines.some((l) => /^\s*#{2,4}\s/.test(l))) {
      process.exit(0);
    }
  } else if (toolName === "Write") {
    const content = input.tool_input?.content || "";
    const newLines = content.split("\n");
    let oldLineCount = 0;
    try {
      oldLineCount = require("fs").readFileSync(filePath, "utf8").split("\n").length;
    } catch (e) {
      oldLineCount = 0; // Datei existiert noch nicht -- ganzer Inhalt zaehlt als "neu"
    }
    const netAdded = newLines.length - oldLineCount;
    if (netAdded <= 6 && !newLines.some((l) => /^\s*#{2,4}\s/.test(l))) {
      process.exit(0);
    }
    addedLines = newLines;
  } else {
    process.exit(0);
  }

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason:
          "CLAUDE.md muss knapp/operativ bleiben (Ladekosten-Regel, global CLAUDE.md) - " +
          "Fachlichkeit/Erklaerungen gehoeren nach docs/*.md, geroutet ueber den fachdoku-router-" +
          "Skill (.claude/skills/fachdoku-router/SKILL.md), nicht direkt in CLAUDE.md. Vor dem " +
          "Fortfahren pruefen: gehoert das wirklich hierher (kurze, jeden Turn gebrauchte Regel) " +
          "oder in die Router-Tabelle?",
      },
    })
  );
});
