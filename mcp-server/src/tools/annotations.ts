import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { postChartAnnotations } from "../db.js";

// Validierung analog validateAnnotationList (src/claudeAnnotations.js:31-48) — hier dupliziert
// statt importiert, weil claudeAnnotations.js transitiv "lightweight-charts" (Browser-Canvas-Lib)
// mitzieht, siehe CLAUDE.md "MCP-Server". Reiner Format-Check, keine Erkennungslogik — geringes
// Duplikations-Risiko, der Vertrag (welche Felder ein Annotation-JSON braucht) ist stabil.
const VALID_TYPES = new Set(["label", "marker", "line", "hline"]);
const HEX_COLOR_RE = /^#[0-9a-f]{6}$/i;

function validateAnnotations(list: unknown[]) {
  list.forEach((raw, i) => {
    const a = raw as Record<string, unknown>;
    if (!VALID_TYPES.has(a?.type as string)) throw new Error(`Annotation ${i}: unbekannter type "${a?.type}".`);
    if (a.type === "line") {
      const from = a.from as Record<string, unknown> | undefined;
      const to = a.to as Record<string, unknown> | undefined;
      if (typeof from?.price !== "number" || typeof to?.price !== "number") {
        throw new Error(`Annotation ${i} (line): from.price und to.price sind Pflicht.`);
      }
    } else if (typeof a.price !== "number") {
      throw new Error(`Annotation ${i} (${a.type}): price fehlt.`);
    }
    if (a.color !== undefined && !HEX_COLOR_RE.test(a.color as string)) {
      throw new Error(`Annotation ${i}: color muss ein Hex-String sein (z.B. "#e74c3c"), nicht "${a.color}".`);
    }
    if (a.pointer !== undefined && typeof a.pointer !== "boolean") {
      throw new Error(`Annotation ${i}: pointer muss ein Boolean sein, nicht "${a.pointer}".`);
    }
  });
}

const ANNOTATION_SCHEMA = z
  .object({
    type: z.enum(["label", "marker", "line", "hline"]),
    text: z.string().optional(),
    time: z.string().optional().describe('"HH:mm" (Tag = date-Argument) oder "YYYY-MM-DD HH:mm"'),
    price: z.number().optional().describe("Pflicht außer bei type=line"),
    from: z.object({ price: z.number(), time: z.string().optional() }).optional().describe("Pflicht bei type=line"),
    to: z.object({ price: z.number(), time: z.string().optional() }).optional().describe("Pflicht bei type=line"),
    color: z.string().optional().describe("Hex, z.B. #e74c3c"),
    pointer: z.boolean().optional(),
  })
  .passthrough();

// Write-Tool (siehe CLAUDE.md "MCP-Server") — Philip hat es 2026-07-31 explizit in
// .claude/settings.local.json allow-gelistet ("L darf jetzt immer zeichnen, brauch kein go von
// mir"), läuft also OHNE Bestätigungsprompt. Die Trade-Journal-Write-Tools (trades.ts) sind
// bewusst NICHT mit-allow-gelistet — nur weil Chart-Zeichnungen freigegeben wurden, heißt das
// nicht automatisch dasselbe fürs Journal.
export function registerAnnotationTools(server: McpServer) {
  server.registerTool(
    "post_chart_annotations",
    {
      title: "Chart-Annotationen schreiben",
      description:
        "Schreibt eine Zeichnung (Preis-Level/Marker/Linien mit Text) direkt in die claude_annotations-" +
        "Tabelle, sichtbar im Chart unter 'Claude-Notizen' — ersetzt das manuelle Copy/Paste ins " +
        "Import-Modal. Nutze dasselbe JSON-Format wie beim manuellen Paste (siehe trading/trading-" +
        "ablauf.md).",
      inputSchema: {
        instrument: z.enum(["GBPUSD", "EURUSD"]),
        date: z.string().describe("YYYY-MM-DD (Europe/Berlin), auf das sich die Zeichnung bezieht"),
        annotations: z.array(ANNOTATION_SCHEMA).min(1),
        title: z.string().optional().describe('Default: "Claude-Notizen" + Zeitstempel'),
      },
    },
    async ({ instrument, date, annotations, title }) => {
      validateAnnotations(annotations);
      const row = await postChartAnnotations(instrument, date, annotations, title);
      return { content: [{ type: "text" as const, text: JSON.stringify(row, null, 2) }] };
    },
  );
}
