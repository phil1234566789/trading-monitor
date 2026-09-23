import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, relative, basename, extname } from "node:path";
import { expect, it } from "vitest";

// Frontend (Browser/Vite) und Backend (Deno Edge Functions) teilen keinen Build-Schritt: es gibt
// keine deno.json/import_map.json, und `npx supabase functions deploy` bundelt nur den
// supabase/functions/-Baum. Ein Import aus src/ bricht beim Deploy. docs/mcp-server.md nennt den
// eigentlichen Grund: buildDataExport und transitiv liquidity.js/chartColors.js/sessions.js fassen
// localStorage und import.meta.env zur MODUL-LADEZEIT an und crashen ausserhalb des Browsers.
// Deshalb liegen "kleine, stabile, dependency-freie Stuecke in Deno-sicherer Form dupliziert" —
// mit der Regel: "Wird eines der Originale geaendert, pruefen ob der Port hier denselben Fix
// braucht."
//
// Diese Regel stand bisher nur als Prosa in der Doku. Dieser Test ist die Mechanik dazu: er
// vergleicht die Voll-Kopien selbst, statt sich darauf zu verlassen, dass jemand die Doku liest.
// Vorbild ist supabaseRowCapGuard.test.js — dieselbe Erfahrung dahinter (eine Regel, die nur
// dokumentiert ist, wird beim Zweizeiler nicht gelesen).
const ROOT = fileURLToPath(new URL("..", import.meta.url));

// VOLL-Kopien: derselbe Code zweimal, nur fuer die andere Runtime. Eine Aenderung an der einen
// Seite gehoert IMMER auch in die andere. Am 23.09.2026 waren alle sieben nach der Normalisierung
// unten deckungsgleich (0 abweichende Code-Zeilen).
const VOLL_KOPIEN = [
  ["src/marketStructureAnalysis.ts", "supabase/functions/trading-monitor-mcp/marketStructureAnalysis.ts"],
  ["src/rsi.js", "supabase/functions/trading-monitor-mcp/rsi.js"],
  ["src/sessionOccurrences.js", "supabase/functions/_shared/sessionOccurrences.js"],
  ["src/orderBlockDetection.js", "supabase/functions/trading-monitor-mcp/orderBlockDetection.js"],
  ["src/rsiDivergenceOutcome.js", "supabase/functions/trading-monitor-mcp/rsiDivergenceOutcome.js"],
  ["src/ema.js", "supabase/functions/trading-monitor-mcp/ema.js"],
  ["src/pipConfig.js", "supabase/functions/_shared/pipConfig.js"],
];

// TEILPORTS: gleicher Dateiname auf beiden Seiten, aber bewusst NICHT derselbe Inhalt — die
// Backend-Seite portiert nur die Deno-sicheren Stuecke oder loest dieselbe Aufgabe anders (z.B.
// db.ts liest persistierte Tabellen statt aus Kerzen neu zu detektieren, siehe docs/mcp-server.md).
// Diese Liste ist kein Freibrief, sondern die Aussage "hier ist Abweichung erwartet" — sie haelt
// den Vollstaendigkeits-Test unten scharf, damit eine NEUE, unbemerkte Voll-Kopie auffaellt.
const TEILPORTS = [
  "ageTier",
  "annotations",
  "berlinTime",
  "forexCandles",
  "liquidity",
  "loopState",
  "orderBlocks",
  "stateMachineLog",
  "supabaseClient",
  "timeframes",
  "tradeSetup",
  "trades",
  // liquidityDetection: der Fraktal-Kern (detectLiquidityLevels/isUpFractal/isDownFractal/
  // buildLevel) ist funktional identisch, nur mit TS-Typen versehen — geprueft im Extra-Test unten,
  // weil computeRangesPivots (marketStructureAnalysis.ts) genau darauf aufsetzt. Die Datei als
  // GANZES weicht ab: filterRelevantLevels hat im Frontend zwei zusaetzliche Parameter
  // (currentPrice/priceThreshold) und einen isPriceRelevant-Zweig, und selectRelevantHtfLevels
  // fehlt im Backend komplett. Beides wird von computeRangesPivots nicht benutzt.
  "liquidityDetection",
];

// Kommentare duerfen abweichen (die MCP-Kopien verweisen auf andere Nachbardateien), Import-Pfade
// muessen es (./ vs ../_shared/, .js vs .ts). Beides wird rausnormalisiert. Bewusst NUR ganze
// Kommentarzeilen, keine Inline-Kommentare: ein `//` in einem String-Literal (URL) wuerde sonst
// Code zerstoeren. Driftet doch mal ein Inline-Kommentar auseinander, wird der Test rot — dann die
// beiden Zeilen angleichen, nicht die Normalisierung aufweichen.
function normalisieren(quelltext) {
  return quelltext
    .split("\n")
    .filter((z) => !/^\s*\/\//.test(z) && z.trim() !== "")
    .map((z) => z.replace(/from\s+"[^"]*"/g, 'from "X"').replace(/\s+$/, ""))
    .join("\n");
}

const lies = (p) => readFileSync(join(ROOT, p), "utf8");

for (const [vorne, hinten] of VOLL_KOPIEN) {
  it(`${basename(vorne)}: Frontend- und Backend-Kopie sind deckungsgleich`, () => {
    // Nicht toEqual auf die ganzen Strings: bei 1136 Zeilen ist die Vitest-Ausgabe unlesbar.
    // Stattdessen die abweichenden Zeilen selbst benennen.
    const a = normalisieren(lies(vorne)).split("\n");
    const b = normalisieren(lies(hinten)).split("\n");
    const abweichungen = [];
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      if (a[i] !== b[i]) abweichungen.push(`  Zeile ${i + 1}:\n    ${vorne}: ${a[i] ?? "(fehlt)"}\n    ${hinten}: ${b[i] ?? "(fehlt)"}`);
      if (abweichungen.length >= 5) break;
    }
    expect(
      abweichungen,
      `${vorne} und ${hinten} sind Voll-Kopien fuereinander und muessen denselben Code enthalten ` +
        `(siehe Kopfkommentar). Abweichungen:\n${abweichungen.join("\n")}`,
    ).toEqual([]);
  });
}

// Der Fraktal-Kern von liquidityDetection ist die Pivot-Quelle BEIDER Runtimes
// (computeRangesPivots -> detectLiquidityLevels). Driftet der, rechnen Frontend-Chart und
// MCP-Export/Alerting mit unterschiedlichen Pivots — ein Fehler, der niemandem auffaellt, weil
// beide Seiten fuer sich plausibel aussehen. Die Datei als Ganzes darf abweichen (siehe
// TEILPORTS), dieser Kern nicht.
// Verglichen wird das VERHALTEN, nicht der Text: die Backend-Seite ist typisiertes TS, die
// Frontend-Seite plain JS — ein Textvergleich braeuchte einen TS-Parser, und eine Regex-Naeherung
// scheitert schon am Rueckgabetyp `: { highs: LiquidityLevel[]; lows: ... }`. Dieselben Kerzen
// durch beide Implementierungen zu schicken prueft genau das, worauf es ankommt.
it("liquidityDetection: beide Runtimes erkennen dieselben Pivots", async () => {
  const [vorne, hinten] = await Promise.all([
    import("../src/liquidityDetection.js"),
    import("../supabase/functions/_shared/liquidityDetection.ts"),
  ]);

  // Deterministische Pseudo-Kerzen (fester Seed) — echte Fixtures braucht es hier nicht, nur
  // genug Auf und Ab, damit beide Fraktal-Richtungen und die Touch-Erkennung anspringen.
  let seed = 20260923;
  const zufall = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const kerzen = [];
  let kurs = 1.33;
  for (let i = 0; i < 600; i++) {
    const open = kurs;
    kurs += (zufall() - 0.5) * 0.0018;
    const hoch = Math.max(open, kurs) + zufall() * 0.0006;
    const tief = Math.min(open, kurs) - zufall() * 0.0006;
    kerzen.push({ time: 1785000000 + i * 300, open, high: hoch, low: tief, close: kurs });
  }

  for (const periode of [2, 5, 10]) {
    const a = vorne.detectLiquidityLevels(kerzen, periode);
    const b = hinten.detectLiquidityLevels(kerzen, periode);
    expect(
      b,
      `Der Fraktal-Kern von liquidityDetection ist auseinandergelaufen (Periode ${periode}) — ` +
        "Frontend-Chart und MCP-Export/Alerting wuerden dann unterschiedliche Pivots erkennen, " +
        "und beide Seiten sehen fuer sich plausibel aus (siehe Kommentar oben).",
    ).toEqual(a);
    expect(a.highs.length + a.lows.length, `Periode ${periode} liefert keine Pivots — Testdaten pruefen`).toBeGreaterThan(0);
  }
});

// Vollstaendigkeit: jede Datei, die es unter demselben Namen in src/ UND supabase/functions/ gibt,
// muss entweder als Voll-Kopie gelistet (und damit geprueft) oder als Teilport erklaert sein. Ohne
// diesen Test entsteht die achte Voll-Kopie unbemerkt und ist ab Tag eins ungeschuetzt — genau das
// Risiko beim geplanten M5-Umbau (PLAN-m5-trend.md), der resolveStructureStartTime auch im
// Frontend braucht.
it("keine unbekannte Datei-Kollision zwischen src/ und supabase/functions/", () => {
  const sammle = (verzeichnis, treffer = []) => {
    for (const eintrag of readdirSync(join(ROOT, verzeichnis))) {
      const p = `${verzeichnis}/${eintrag}`;
      if (statSync(join(ROOT, p)).isDirectory()) sammle(p, treffer);
      else if (/\.(js|ts)$/.test(eintrag)) treffer.push(p);
    }
    return treffer;
  };
  const stamm = (p) => basename(p, extname(p));
  const backendStaemme = new Set(sammle("supabase/functions").map(stamm));
  const bekannt = new Set([...VOLL_KOPIEN.map(([v]) => stamm(v)), ...TEILPORTS]);

  const unbekannt = sammle("src")
    .map(stamm)
    .filter((s) => backendStaemme.has(s) && !bekannt.has(s));

  expect(
    [...new Set(unbekannt)],
    "Neue Datei, die es in beiden Runtimes gibt. Entweder in VOLL_KOPIEN aufnehmen (dann wird sie " +
      "auf Deckungsgleichheit geprueft) oder in TEILPORTS mit Begruendung, warum sie abweichen darf.",
  ).toEqual([]);
});
