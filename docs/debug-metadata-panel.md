# Debug-Metadata-Panel

`.debug/metadata.json` (gitignored, machine-lokal) hält einen Snapshot vom aktuellen Live-State
des Charts — Symbol, Timeframe, Replay-State und die Daten der gerade aktiven Overlays
(`buildActiveMetadataSnapshot` in `PriceChart.vue`, Gating-Logik in `debugMetadata.js`).

Wird automatisch geschrieben: einmal beim Mount, danach alle 30s (`DEBUG_AUTOSAVE_INTERVAL_MS`)
per POST an eine Dev-only-Vite-Middleware (`vite.config.js`, `saveDebugMetadataLocally`) —
**nur während `vite dev` läuft** (`import.meta.env.DEV`; der Endpoint existiert im
Production-Build nicht). Zusätzlich gibt es einen "📋 kopieren + lokal speichern"-Button im
Debug-Metadata-Panel für einen On-Demand-Clipboard-Copy + Save, bewusst als **eigene** Funktion
getrennt vom Auto-Save, damit der 30s-Timer nie stillschweigend die System-Zwischenablage
überschreibt.

Diese Datei nur lesen statt Philip zu bitten, Zahlen vom Bildschirm abzutippen — reflektiert aber
nur den Stand der zuletzt laufenden `vite dev`-Maschine, also vor dem Vertrauen auf Aktualität
den mtime der Datei prüfen (oder einfach nachfragen).
