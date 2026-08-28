# Market-Structure-Algorithmus: Entwickler-Notizen

Die "1h-Range" Trend/Protected-Low/LQ-Sweep-Logik (`marketStructureAnalysis.ts`) bestätigt
Aufwärtstrends aus H1-Pivots, trackt ein rollierendes Protected-Low und reklassifiziert
gesweepte Lows.

## Regeln-Doku pflegen

Die Regeln sind indexiert in
[`marketStructureAnalysis.rules.md`](marketStructureAnalysis.rules.md) — ein Satz pro Regel plus
Verweis auf den Test, der sie verifiziert; keine Nacherzählung der Logik (das würde driften).
**Bei jeder inhaltlichen Regeländerung (nicht bei reinem Refactoring) die passende Zeile in
`marketStructureAnalysis.rules.md` in derselben Änderung nachziehen** — neue Zeile für eine neue
Regel, Formulierung anpassen bei einer geänderten, Test-Referenz ergänzen sobald ein neuer Test
existiert.

## Datei-Trennung: Algorithmus vs. Rendering

`marketStructureAnalysis.ts` enthält NUR den reinen Algorithmus (kein Chart-Drawing, keine
Browser-only-Imports) — dadurch bleibt sie außerhalb des Browsers importierbar (siehe
`docs/mcp-server.md` → `get_data_export`s Structure-Trend, dort jetzt die alleinige Deno-Kopie in
`supabase/functions/trading-monitor-mcp/`). Die State-zu-Chart-Primitives-
Rendering-Logik (`renderMarketStructureAnalysis` und Verwandte) liegt in
`marketStructureRendering.ts`. Keinen neuen rendering-bezogenen Import (Chart-Farben,
Linienbreiten, lightweight-charts-Primitives) zurück in `marketStructureAnalysis.ts` einbauen —
das gehört in die Rendering-Datei.
