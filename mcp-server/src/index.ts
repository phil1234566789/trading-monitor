import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerReadTools } from "./tools/reads.js";
import { registerAnnotationTools } from "./tools/annotations.js";

const server = new McpServer({ name: "trading-monitor", version: "0.1.0" });

registerReadTools(server);
registerAnnotationTools(server);

await server.connect(new StdioServerTransport());
