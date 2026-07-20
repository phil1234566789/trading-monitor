import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { DEFAULT_CHART_COLORS } from "../src/chartColors.js";

// Bug-Report Philip 2026-07-20: zigzagStructure/zigzagTail blieben nach dem Löschen des alten
// Zigzag-Trendalgorithmus (siehe marketStructureAnalysis.ts) als verwaiste Konfiguration in
// DEFAULT_CHART_COLORS + StyleModal.vue zurück, ohne dass tsc/ESLint das je gemeldet hätten —
// ein Objekt-Key, der nur noch per String gelesen wird, ist für keinen der beiden toter Code,
// nur tote Daten. Diese Tests schließen die Lücke, indem sie den Quelltext direkt nach den
// jeweiligen String-Literalen durchsuchen, statt sich auf Compiler/Linter zu verlassen.

const SRC_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src");
const SOURCE_EXTENSIONS = new Set([".js", ".ts", ".vue"]);
// chartColors.js DEFINIERT die Keys (jeder Key steht dort trivial drin) und StyleModal.vue
// EXPONIERT sie nur als Regler (Zugriff per dynamischem field.key, kein Literal-Aufruf) — beide
// aus dem "wird tatsächlich gelesen"-Scan ausschließen, sonst wäre der Test unabhängig vom Bug
// immer grün.
const EXCLUDED_FROM_USAGE_SCAN = new Set([path.join(SRC_DIR, "chartColors.js"), path.join(SRC_DIR, "components", "StyleModal.vue")]);

function collectSourceFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...collectSourceFiles(full));
    } else if (SOURCE_EXTENSIONS.has(path.extname(entry))) {
      files.push(full);
    }
  }
  return files;
}

const allSourceFiles = collectSourceFiles(SRC_DIR);
const usageSource = allSourceFiles
  .filter((f) => !EXCLUDED_FROM_USAGE_SCAN.has(f))
  .map((f) => readFileSync(f, "utf8"))
  .join("\n");

const styleModalSource = readFileSync(path.join(SRC_DIR, "components", "StyleModal.vue"), "utf8");
const styleModalFieldKeys = [...styleModalSource.matchAll(/key:\s*["'](\w+)["']/g)].map((m) => m[1]);

describe("chartColors config stays in sync with the rest of the app", () => {
  it("scans a non-trivial number of source files (sanity check for the file walker)", () => {
    expect(allSourceFiles.length).toBeGreaterThan(10);
  });

  it("found StyleModal fields (sanity check for the extraction regex)", () => {
    expect(styleModalFieldKeys.length).toBeGreaterThan(0);
  });

  it.each(Object.keys(DEFAULT_CHART_COLORS))("%s is actually read somewhere outside chartColors.js/StyleModal.vue", (key) => {
    const literal = new RegExp(`["'\`]${key}["'\`]`);
    expect(
      usageSource,
      `"${key}" ist in DEFAULT_CHART_COLORS definiert, taucht aber nirgends sonst im Quelltext als String-Literal auf. ` +
        `Vermutlich wurde das zugehörige Feature entfernt, ohne die Farb-Konfiguration mit aufzuräumen — Key aus ` +
        `chartColors.js + StyleModal.vue entfernen.`,
    ).toMatch(literal);
  });

  it.each(styleModalFieldKeys)('StyleModal field "%s" has a matching entry in DEFAULT_CHART_COLORS', (key) => {
    expect(DEFAULT_CHART_COLORS, `StyleModal referenziert Farb-Key "${key}", der in DEFAULT_CHART_COLORS nicht existiert (Tippfehler?).`).toHaveProperty(
      key,
    );
  });

  it("every DEFAULT_CHART_COLORS key is exposed as a StyleModal field", () => {
    const missing = Object.keys(DEFAULT_CHART_COLORS).filter((key) => !styleModalFieldKeys.includes(key));
    expect(missing, "Farb-Keys ohne zugehörigen Regler im Style-Modal (nicht einstellbar für den Nutzer)").toEqual([]);
  });
});
