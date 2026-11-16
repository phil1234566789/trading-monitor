import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEBUG_DIR = path.join(__dirname, ".debug");
const DEBUG_FILE = path.join(DEBUG_DIR, "metadata.json");

// Dev-only Endpoint fürs Debug-Metadaten-Panel (siehe PriceChart.vue: "📋 kopieren + lokal
// speichern") — Chat 2026-07-21: "du siehst nicht alle daten, weil mein Text abgeschnitten wird"
// (das Prompt-Fenster kappt sehr lange Pasten, z.B. hunderte Kerzen). Statt den JSON-Blob durchs
// Chat-Fenster zu schicken, POSTet der Button ihn zusätzlich zum Clipboard-Copy hierher — nur im
// `vite dev`-Server aktiv (configureServer), im Production-Build (GitHub Pages) gibt's diesen
// Endpoint gar nicht, braucht dort auch niemand.
// Seit Chat 2026-07-27: Body ist {section, data} (siehe debugMetadata.js: saveDebugMetadataSection),
// serverseitig in die BESTEHENDE Datei gemergt (nicht mehr komplett überschrieben) — zwei
// unabhängige Schreiber (PriceChart.vue-Autosave unter "chart", DataExportModal.vue unter
// "dataExport") sollen sich nicht gegenseitig wegräumen; Philip will beide gleichzeitig
// nachlesen können, um eine Diskrepanz zwischen Chart-State und Daten-Export zu debuggen. Kein
// Merge INNERHALB einer Sektion (die wird komplett ersetzt) — es geht weiterhin nur um den JEWEILS
// aktuellen Stand pro Sektion, nicht um ein Archiv.
function debugMetadataWriter() {
  return {
    name: "debug-metadata-writer",
    configureServer(server) {
      server.middlewares.use("/__debug-metadata", (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end();
          return;
        }
        const chunks = [];
        req.on("data", (chunk) => chunks.push(chunk));
        req.on("end", () => {
          try {
            const { section, data } = JSON.parse(Buffer.concat(chunks).toString("utf-8"));
            let existing = {};
            try {
              existing = JSON.parse(readFileSync(DEBUG_FILE, "utf-8"));
            } catch {
              existing = {}; // Datei fehlt noch oder ist kein gültiges JSON -> frisch anfangen
            }
            existing[section] = data;
            mkdirSync(DEBUG_DIR, { recursive: true });
            writeFileSync(DEBUG_FILE, JSON.stringify(existing, null, 2));
            res.statusCode = 200;
            res.end("ok");
          } catch (err) {
            console.error("debug-metadata-writer: Schreiben fehlgeschlagen:", err);
            res.statusCode = 500;
            res.end(String(err));
          }
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [vue(), debugMetadataWriter()],
  // GitHub Pages liefert dieses Repo unter /trading-monitor/ aus (Project Page, kein
  // username.github.io-Root-Repo) — ohne base würden alle Asset-Pfade im Build von / statt
  // /trading-monitor/ ausgehen und 404en. Hash-History (siehe router.js) macht den Rest der
  // SPA-Navigation davon unabhängig.
  base: "/trading-monitor/",
  // Tests laufen ohne .env (CI hat keine Secrets): supabaseClient.js wirft sonst schon beim
  // Import "supabaseUrl is required". Feste Dummy-Werte statt der lokalen .env, damit kein Test
  // versehentlich gegen die echte DB läuft. SUPABASE_* braucht der Edge-Function-Client, den
  // die *.test.ts über die MCP-Tools importieren (wirft sonst schon beim Import).
  test: {
    env: {
      VITE_SUPABASE_URL: "http://localhost:54321",
      VITE_SUPABASE_ANON_KEY: "vitest-dummy-anon-key",
      SUPABASE_URL: "http://localhost:54321",
      SUPABASE_ANON_KEY: "vitest-dummy-anon-key",
    },
    setupFiles: ["test/setup/denoStub.js"],
    // Deno-Specifier "npm:paket@version/pfad" auf das gleichnamige node_modules-Paket abbilden.
    // Versionen stimmen nur, solange package.json dieselben Pins führt (zod exakt 3.24.1).
    alias: [{ find: /^npm:((?:@[^/@]+\/)?[^/@]+)(?:@[^/]+)?(\/.*)?$/, replacement: "$1$2" }],
  },
});
