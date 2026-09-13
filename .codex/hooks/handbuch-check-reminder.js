// PreToolUse-Hook (Write|Edit): erinnert VOR jeder .md-Aenderung im trading-Repo (Handbuch)
// daran, nach dem Schreiben den handbuch-check-Skill aufzurufen. Bewusst PreToolUse statt
// PostToolUse (Philip, 18.08.2026) und bewusst NUR Write|Edit, nicht Read -- Lana liest
// .md-Dateien im trading-Repo staendig (Handbuch nachschlagen), ein Read-Match wuerde bei
// jeder Nachschlage-Aktion feuern, nicht nur bei tatsaechlichen Doku-Aenderungen.
// Absichtlich als eigene Datei statt Inline-Command in settings.json -- node -e mit
// escaped Backslashes ist auf Windows/Git-Bash unzuverlaessig (Argument-Mangling beim
// Aufruf nativer .exe-Programme durch die Shell).

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

  // Matcht .md-Dateien im trading-Repo (Handbuch), NICHT trading-monitor (dieses Repo).
  // "trading" muss direkt von einem Pfadtrenner gefolgt sein, damit "trading-monitor"
  // nicht faelschlich matcht.
  const isTradingRepoDoc = /[\\/]trading[\\/].*\.md$/i.test(filePath);

  if (isTradingRepoDoc) {
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          additionalContext:
            "BEVOR diese Aenderung an einer Doku-Datei im trading-Repo (" +
            filePath +
            ") ausgefuehrt wird: Skill handbuch-check aufrufen und die geplante Aenderung selbst " +
            "pruefen (Ablage-Ort Konzept vs. Step-Datei, Duplikate, Glossar-Sektion, Querverweise, " +
            "Pin-Pflicht) -- nicht erst danach.",
        },
      })
    );
  }
});
