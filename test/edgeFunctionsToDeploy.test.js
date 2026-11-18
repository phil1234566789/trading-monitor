import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { SRC_DEPENDENT, functionsToDeploy, listFunctions, sharedUsersOf } from "../scripts/edgeFunctionsToDeploy.mjs";

const files = (dir) => readdirSync(dir).flatMap((n) => {
  const p = path.join(dir, n);
  return statSync(p).isDirectory() ? files(p) : /\.(ts|js|mjs)$/.test(n) ? [p] : [];
});
const SRC_IMPORT = /from\s+['"](\.\.\/)+src\//;

describe("edgeFunctionsToDeploy", () => {
  const opts = { allFunctions: ["dob-watcher", "poi-watcher", "trading-monitor-mcp"], sharedUsers: ["dob-watcher", "poi-watcher"] };

  it("leitet betroffene Functions aus geänderten Dateien ab", () => {
    expect(functionsToDeploy(["src/dobAlarm.js"], opts)).toEqual(SRC_DEPENDENT);
    expect(functionsToDeploy(["supabase/functions/poi-watcher/index.ts"], opts)).toEqual(["poi-watcher"]);
    expect(functionsToDeploy(["supabase/functions/_shared/x.ts"], opts)).toEqual(["dob-watcher", "poi-watcher"]);
    expect(functionsToDeploy(["README.md", "supabase/migrations/1.sql", "supabase/functions/gone/index.ts"], opts)).toEqual([]);
  });

  // Wächter: die Liste muss zu den echten src-Imports passen (direkt oder über eine _shared-Datei).
  it("SRC_DEPENDENT entspricht den Imports", () => {
    const sharedWithSrc = files("supabase/functions/_shared").filter((f) => SRC_IMPORT.test(readFileSync(f, "utf-8"))).map((f) => path.basename(f));
    const bundlesSrc = (fn) => files(path.join("supabase/functions", fn)).some((f) => {
      const code = readFileSync(f, "utf-8");
      return SRC_IMPORT.test(code) || sharedWithSrc.some((s) => code.includes(`_shared/${s}`));
    });
    expect(listFunctions().filter(bundlesSrc).sort()).toEqual([...SRC_DEPENDENT].sort());
    expect(sharedUsersOf(listFunctions())).toContain("dob-watcher");
  });
});
