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
        "Die trade_positions und OB-Zonen, die Philip gerade per Rechtsklick (Trades-Tabelle, " +
        "Chart-Trade-Marker oder Chart-OB-Zone) 'an dich übergeben' hat, samt optionaler Notiz und " +
        "voller Daten (bei kind='trade_position': dealing_range/targets/partial exits; bei " +
        "kind='ob_zone': die volle ob_zones-Zeile). Ruf dieses Tool proaktiv auf, wenn Philip sagt " +
        "'schau dir das mal an' o.ä., statt auf eine Beschreibung per Text zu warten — das ist genau " +
        "der Zweck dieses Tools.",
      inputSchema: {},
    },
    async () => json(await getLaniakeaContext()),
  );
}
