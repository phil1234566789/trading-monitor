import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { mkdirSync, writeFileSync } from "node:fs";
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
// Endpoint gar nicht, braucht dort auch niemand. Immer dieselbe Datei überschrieben (keine
// Historie) — es geht nur um den JEWEILS aktuellen Stand zum Nachlesen, nicht um ein Archiv.
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
            mkdirSync(DEBUG_DIR, { recursive: true });
            writeFileSync(DEBUG_FILE, Buffer.concat(chunks));
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
});
