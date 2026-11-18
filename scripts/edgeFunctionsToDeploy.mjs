// Welche Edge Functions deploy.yml nach einem Push auf main ausrollt, damit Chart und Alarm
// dieselbe Detektor-Version fahren. Aufruf: node scripts/edgeFunctionsToDeploy.mjs <base-sha|''>
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const FUNCTIONS_DIR = "supabase/functions";

// Bündeln Code aus src/ (direkt oder über _shared/dobDelivery.js). test/edgeFunctionsToDeploy.test.js
// prüft die Liste gegen die Imports, eine neue Abhängigkeit fällt dort auf.
export const SRC_DEPENDENT = ["dob-watcher", "trading-monitor-mcp"];

export function functionsToDeploy(changedFiles, { allFunctions, sharedUsers }) {
  const out = new Set();
  for (const file of changedFiles) {
    if (file.startsWith("src/")) SRC_DEPENDENT.forEach((f) => out.add(f));
    const m = file.match(/^supabase\/functions\/([^/]+)\//);
    if (!m) continue;
    if (m[1] === "_shared") sharedUsers.forEach((f) => out.add(f));
    else if (allFunctions.includes(m[1])) out.add(m[1]);
  }
  return [...out].sort();
}

const filesIn = (dir) => readdirSync(dir).flatMap((n) => {
  const p = path.join(dir, n);
  return statSync(p).isDirectory() ? filesIn(p) : /\.(ts|js|mjs)$/.test(n) ? [p] : [];
});
const anyFileMatches = (dir, re) => filesIn(dir).some((f) => re.test(readFileSync(f, "utf-8")));

export const listFunctions = () => readdirSync(FUNCTIONS_DIR)
  .filter((n) => n !== "_shared" && existsSync(path.join(FUNCTIONS_DIR, n, "index.ts")));
export const sharedUsersOf = (fns) => fns.filter((f) => anyFileMatches(path.join(FUNCTIONS_DIR, f), /_shared\//));

if (process.argv[1]?.endsWith("edgeFunctionsToDeploy.mjs")) {
  const base = process.argv[2];
  const allFunctions = listFunctions();
  // Ohne erfolgreichen Vorlauf (erster Lauf) gilt alles unter src/ als geändert: rollt die src-Bündler aus.
  const changed = base
    ? execFileSync("git", ["diff", "--name-only", base, "HEAD"]).toString().split("\n").filter(Boolean)
    : ["src/"];
  console.log(functionsToDeploy(changed, { allFunctions, sharedUsers: sharedUsersOf(allFunctions) }).join(" "));
}
