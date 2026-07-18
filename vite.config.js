import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  // GitHub Pages liefert dieses Repo unter /trading-monitor/ aus (Project Page, kein
  // username.github.io-Root-Repo) — ohne base würden alle Asset-Pfade im Build von / statt
  // /trading-monitor/ ausgehen und 404en. Hash-History (siehe router.js) macht den Rest der
  // SPA-Navigation davon unabhängig.
  base: "/trading-monitor/",
});
