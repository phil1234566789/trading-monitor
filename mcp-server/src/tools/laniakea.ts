import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getLaniakeaContext } from "../db.js";

function json(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

// Read-only (Chat 2026-08-01) — Philip entfernt Einträge selbst im Laniakea-Modal
// (LaniakeaPanel.vue), kein Lösch-/Konsum-Tool von Lana-Seite nötig, siehe PLAN
// "Laniakea-Kontext" 2026-08-01.
export function registerLaniakeaTools(server: McpServer) {
  server.registerTool(
    "get_laniakea_context",
    {
      title: "Laniakea-Kontext",
      description:
        "Die trade_positions, die Philip gerade per Rechtsklick (Trades-Tabelle oder Chart-Marker) " +
        "'an dich übergeben' hat, samt optionaler Notiz und voller Trade-Daten (dealing_range, " +
        "targets, partial exits). Ruf dieses Tool proaktiv auf, wenn Philip sagt 'schau dir das mal " +
        "an' o.ä., statt auf eine Beschreibung per Text zu warten — das ist genau der Zweck dieses " +
        "Tools.",
      inputSchema: {},
    },
    async () => json(await getLaniakeaContext()),
  );
}
