// UserPromptSubmit-Hook: zieht das trading-Repo (Lanas .md-Handbuch) per `git pull --ff-only`,
// sobald eine Nachricht mit /l beginnt (Laniakea-Aktivierung) -- Philip, 29.08.2026: "Lana wird
// ggf. auf verschiedenen Rechnern geupdated. Lana soll nicht mit veralteten .md Files benutzt
// werden." --ff-only statt eines vollen `pull` (kein automatischer Merge-Commit/keine
// unbeaufsichtigte Konfliktaufloesung in einem Hook, der bei JEDER /l-Nachricht laeuft) --
// schlaegt der Fast-Forward fehl (z.B. divergierte lokale Commits), wird das Claude als
// additionalContext gemeldet statt den Prompt zu blockieren, damit eine Netzwerk-/Merge-Situation
// nie eine ganze Lana-Session verhindert.
// Eigene Datei statt Inline-Command (siehe handbuch-check-reminder.js) -- selbe Windows/Git-Bash-
// Escaping-Problematik bei node -e mit Backslash-Pfaden. .cjs statt .js, weil package.json dieses
// Repos "type": "module" setzt -- ein normaler require()-Aufruf in einer .js-Datei wuerde sonst als
// ES-Module geladen und mit "require is not defined" abbrechen.
const { execFileSync } = require("child_process");
const path = require("path");

// Sibling-Repo-Layout (siehe CLAUDE.md "Additional working directories") -- .claude/hooks liegt in
// trading-monitor/.claude/hooks, drei Ebenen hoch landet im gemeinsamen Elternordner beider Repos,
// von dort relativ ins trading-Repo. Ueberlebt so einen anderen Laufwerksbuchstaben/Benutzernamen
// auf einem anderen Rechner, solange die Ordnerstruktur (git/trading-monitor + git/trading
// nebeneinander) dieselbe bleibt.
const TRADING_REPO = path.resolve(__dirname, "..", "..", "..", "trading");

let data = "";
process.stdin.on("data", (chunk) => (data += chunk));
process.stdin.on("end", () => {
  let input;
  try {
    input = JSON.parse(data);
  } catch (e) {
    process.exit(0);
  }

  const prompt = (input.prompt || "").trim();
  // /l am Anfang der Nachricht (Slash-Command-Aufruf), optional gefolgt von Argumenten -- Wortgrenze
  // nach "l", damit z.B. ein zukuenftiges "/list"-Command nicht faelschlich matcht.
  if (!/^\/l(\s|$)/.test(prompt)) {
    process.exit(0);
  }

  let context;
  try {
    // --no-rebase erzwingt eine Merge- statt Rebase-Pull unabhaengig von Philips globaler
    // pull.rebase-Konfiguration -- eine Rebase-Pull verweigert bei JEDER unstaged Aenderung im
    // Repo (auch in unbeteiligten Dateien), waehrend eine Merge-Pull mit --ff-only nur bei einem
    // tatsaechlichen Zeilenkonflikt scheitert (Bug gefunden beim Pipe-Test: Philip/Lana haben
    // haeufig unstaged Handbuch-Aenderungen offen, eine Rebase-Pull haette den Hook praktisch immer
    // scheitern lassen).
    const output = execFileSync("git", ["pull", "--no-rebase", "--ff-only"], { cwd: TRADING_REPO, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    context = `trading-Repo (Lanas .md-Handbuch) aktualisiert: ${output.trim() || "bereits aktuell"}.`;
  } catch (err) {
    context =
      `WARNUNG: \`git pull --ff-only\` im trading-Repo (${TRADING_REPO}) ist fehlgeschlagen -- Lana ` +
      `arbeitet moeglicherweise mit veralteten .md-Dateien. Fehler: ${(err.stderr || err.message || "").toString().trim()}. ` +
      `Philip aktiv darauf hinweisen und ggf. manuell pruefen/pullen.`;
  }

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "UserPromptSubmit",
        additionalContext: context,
      },
    }),
  );
});
