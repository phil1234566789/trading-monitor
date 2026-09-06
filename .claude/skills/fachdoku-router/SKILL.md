---
name: fachdoku-router
description: Router zu vertiefenden Fachlichkeits-Doku-Dateien, die bewusst NICHT in CLAUDE.md stehen (nur bei tatsächlichem Bedarf laden, siehe globales CLAUDE.md "Ladekosten passend zur Abruf-Häufigkeit"). Aufrufen, sobald an supabase/functions/trading-monitor-mcp/ gearbeitet wird (MCP-Tools, Pin-Tool, Trade-Journal-Write-Tools, Candle-Archiv, Backfill-Scripts), an src/marketStructureAnalysis.ts oder src/marketStructureRendering.ts gearbeitet wird (1h-Range-Trend-Algorithmus), Philip einen ForexFactory-Kalender-Screenshot schickt (news_events seeden), an supabase/functions/poi-watcher/ gearbeitet wird (Alert-Cron-Throttling), das Debug-Metadata-Panel/.debug/metadata.json relevant wird, an src/chartColors.js/src/sessions.js oder einem neuen aehnlich synchronisierten Settings-Store gearbeitet wird, an src/tradeSetupCockpit.ts / den TSC No-Gos/Anti-Confluences gearbeitet wird, die State-Machine tatsächlich BEDIENT/getestet werden soll (get_next_action/get_loop_state aufrufen, ein Handelstag soll durchgespielt werden, Lana/ein Testlauf fragt "was ist zu tun"), an tradingMachine.ts/dealingRangeLoop.ts/tradingMachineGraph.js/TradingFlow.vue/nextActionMap.ts/tools/nextAction.ts/tools/getLoopState.ts CODE gearbeitet wird, oder eine Frage zur State-Machine-Architektur/Auto-Loop-/Cron-Mechanik (CronCreate/CronDelete, Schritt 1-8, Fall 1-4) ansteht.
---

# Fachdoku-Router

Kein eigener Inhalt hier — nur die Zuordnung Thema → Datei. Die verlinkte Datei lesen, sobald das
Thema tatsächlich relevant wird.

| Thema | Wann relevant | Datei |
|---|---|---|
| MCP-Server (Tools, Auth, Pin, Trade-Journal-Write-Tools, Candle-Archiv, Backfill-Scripts) | Arbeit an `supabase/functions/trading-monitor-mcp/` | [`docs/mcp-server.md`](../../../docs/mcp-server.md) |
| Market-Structure-Algorithmus (Regeln-Doku-Pflicht, Algorithmus/Rendering-Split) | Arbeit an `src/marketStructureAnalysis.ts`, `src/marketStructureRendering.ts` oder `src/marketStructureAnalysis.rules.md` | [`src/marketStructureAnalysis.notes.md`](../../../src/marketStructureAnalysis.notes.md) |
| News Events seeden (ForexFactory-Screenshot-Workflow) | Philip schickt einen Kalender-Screenshot oder fragt nach kommenden News | [`docs/news-events.md`](../../../docs/news-events.md) |
| `poi-watcher`-Throttling-Tiers (4H/1H/M5-Refresh-Ticks) | Arbeit an `supabase/functions/poi-watcher/` | [`docs/poi-watcher.md`](../../../docs/poi-watcher.md) |
| Debug-Metadata-Panel (Auto-Save/Manual-Save, was gecaptured wird) | Live-Chart-State debuggen, `.debug/metadata.json` relevant | [`docs/debug-metadata-panel.md`](../../../docs/debug-metadata-panel.md) |
| Settings-Sync-Pattern (localStorage-first, 4-Schritte-Flow) | Arbeit an `src/chartColors.js`/`src/sessions.js` oder neuer ähnlich synchronisierter Store | [`docs/settings-sync.md`](../../../docs/settings-sync.md) |
| TSC No-Gos/Anti-Confluences (isNoGo-Hard-Block, News-No-Go-Quelle) | Arbeit an `src/tradeSetupCockpit.ts` oder den No-Go-Regeln | [`docs/tsc-anti-confluences.md`](../../../docs/tsc-anti-confluences.md) |
| State-Machine bedienen (get_next_action/get_loop_state, Handelstag durchspielen) | Lana/ein Testlauf soll die Maschine tatsächlich benutzen, nicht Code daran ändern | [`docs/state-machine-anleitung.md`](../../../docs/state-machine-anleitung.md) |
| State-Machine V2 Architektur (Schritt 1-8, Fall 1-4, Live-Auto-Loop via `CronCreate`/`CronDelete`) | Arbeit (Code-Änderung) an `tradingMachine.ts`/`dealingRangeLoop.ts`/`tradingMachineGraph.js`/`TradingFlow.vue`, oder Fragen zur Auto-Loop-/Cron-Mechanik/Historie der State-Machine | [`docs/state-machine.md`](../../../docs/state-machine.md) |

Neue Fachlichkeits-Doku hier als weitere Zeile eintragen, statt einen eigenen Skill dafür
anzulegen (max. ein Router-Skill, kein Skill pro Thema).
