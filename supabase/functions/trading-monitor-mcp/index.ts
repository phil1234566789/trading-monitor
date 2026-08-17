// trading-monitor MCP-Server als Supabase Edge Function (Deno) — Port des bisherigen lokalen
// stdio-Servers (mcp-server/, jetzt nur noch Basis für die einmaligen Wartungsskripte in
// mcp-server/src/scripts/, siehe dessen package.json). Grund: auf dem DATEV-Firmenrechner
// scheitert `npx tsx mcp-server/src/index.ts` an der dortigen TLS-Inspection, während eine
// deployte Edge Function ganz normal per HTTPS erreichbar ist — kein lokaler Node-Prozess mehr
// nötig, funktioniert von jedem Rechner/Client aus (Claude Web, VS Code, ...), analog zu
// milk-city (siehe dessen supabase/functions/mcp/index.ts, 1:1 Vorbild für Transport+Auth-Muster
// hier).
//
// Transport: WebStandardStreamableHTTPServerTransport statt der Node-spezifischen
// StreamableHTTPServerTransport (die der alte stdio-Server via StdioServerTransport nutzte) — vom
// SDK selbst als Deno-taugliche Web-Standard-Variante ausgewiesen, passt 1:1 zum Deno.serve-
// Handler-Muster der anderen Edge Functions in diesem Repo. Stateless (sessionIdGenerator:
// undefined): Edge-Function-Instanzen sind nicht langlebig genug für sitzungsgebundenen State
// zwischen Requests — pro Request ein frisches Server+Transport-Paar.
//
// Auth: eigenes Bearer-Token-Schema (TRADING_MONITOR_MCP_TOKEN als Function Secret), KEIN
// Supabase-JWT (siehe supabase/config.toml [functions.trading-monitor-mcp] verify_jwt=false) —
// Einzelnutzer-App (nur Philip), deshalb ein einziges Token statt milk-citys Token->Character-Map.
import { McpServer } from "npm:@modelcontextprotocol/sdk@^1.12.0/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "npm:@modelcontextprotocol/sdk@^1.12.0/server/webStandardStreamableHttp.js";
import { registerReadTools } from "./tools/reads.ts";
import { registerAnnotationTools } from "./tools/annotations.ts";
import { registerTradeTools } from "./tools/trades.ts";
import { registerPinTools } from "./tools/pins.ts";

const MCP_TOKEN = Deno.env.get("TRADING_MONITOR_MCP_TOKEN");

function authenticate(req: Request): boolean {
  if (!MCP_TOKEN) return false;
  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  return token === MCP_TOKEN;
}

function buildServer() {
  const server = new McpServer({ name: "trading-monitor", version: "0.1.0" });
  registerReadTools(server);
  registerAnnotationTools(server);
  registerTradeTools(server);
  registerPinTools(server);
  return server;
}

Deno.serve(async (req) => {
  if (!authenticate(req)) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const server = buildServer();
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await server.connect(transport);
  return transport.handleRequest(req);
});
