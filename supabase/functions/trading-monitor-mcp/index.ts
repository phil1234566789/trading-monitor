import { McpServer } from "npm:@modelcontextprotocol/sdk@1.12.0/server/mcp.js";
import type { Transport, JSONRPCMessage } from "npm:@modelcontextprotocol/sdk@1.12.0/types.js";
import { registerReadTools } from "./tools/reads.js";
import { registerAnnotationTools } from "./tools/annotations.js";
import { registerTradeTools } from "./tools/trades.js";
import { registerLaniakeaTools } from "./tools/laniakea.js";

class HttpTransport implements Transport {
  private onMessage: (msg: JSONRPCMessage) => void = () => {};
  private onError: (error: Error) => void = () => {};
  private onClose: () => void = () => {};
  private responseDeferreds = new Map<string, (msg: JSONRPCMessage) => void>();

  async send(message: JSONRPCMessage): Promise<void> {
    const msg = message as JSONRPCMessage & { _id?: string };
    const id = msg._id;
    if (id) {
      const resolve = this.responseDeferreds.get(id);
      if (resolve) {
        resolve(message);
      }
    }
  }

  async close(): Promise<void> {
    this.onClose();
  }

  setMessageHandler(callback: (msg: JSONRPCMessage) => void): void {
    this.onMessage = callback;
  }

  setErrorHandler(callback: (error: Error) => void): void {
    this.onError = callback;
  }

  setCloseHandler(callback: () => void): void {
    this.onClose = callback;
  }
}

const server = new McpServer({ name: "trading-monitor", version: "0.1.0" });
const transport = new HttpTransport();

registerReadTools(server);
registerAnnotationTools(server);
registerTradeTools(server);
registerLaniakeaTools(server);

await server.connect(transport);

Deno.serve({ port: 3000 }, async (req: Request) => {
  if (req.method === "POST" && req.url.includes("/rpc")) {
    try {
      const message = await req.json() as JSONRPCMessage & { _id?: string };
      const id = crypto.randomUUID();
      message._id = id;

      return await new Promise<Response>((resolve) => {
        const timeout = setTimeout(() => {
          transport["responseDeferreds"].delete(id);
          resolve(
            new Response(
              JSON.stringify({
                jsonrpc: "2.0",
                error: { code: -32000, message: "Timeout" },
                id: (message as any).id,
              }),
              { status: 500, headers: { "Content-Type": "application/json" } }
            )
          );
        }, 30000);

        transport["responseDeferreds"].set(id, (response) => {
          clearTimeout(timeout);
          transport["responseDeferreds"].delete(id);
          resolve(
            new Response(JSON.stringify(response), {
              headers: { "Content-Type": "application/json" },
            })
          );
        });

        transport.setMessageHandler((msg) => server["requestHandler"](msg));
        transport["onMessage"](message);
      });
    } catch (err) {
      return new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          error: { code: -32700, message: "Parse error" },
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  return new Response("OK");
});
