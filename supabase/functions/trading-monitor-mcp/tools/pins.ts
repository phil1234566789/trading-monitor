import { z } from "npm:zod@3.24.1";
import type { McpServer } from "npm:@modelcontextprotocol/sdk@^1.12.0/server/mcp.js";
import { getPinContext, addPinEntry, addPinM5ObEntry, addPinM5LiquidityEntry, addPinRsiDivergenceEntry, removePinEntry } from "../db.ts";

function json(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

// War bis Chat 2026-08-17 read-only ("Philip entfernt Einträge selbst im Pin-Modal, kein
// Lösch-/Konsum-Tool von Lana-Seite nötig") — Philip wollte danach explizit, dass Lana relevante
// Chart-Stellen (OB-Zonen/Liquiditäts-Level/Trade-Setups/M5-OBs/M5-LQ-Linien/RSI-Divergenzen)
// selbst pinnen UND wieder entfernen kann, siehe Task "Pin-Kontext: MCP-Write, fehlende
// Chart-Highlights, Touch-Alarm". trade_position/trade_confirmation bleiben bewusst außen vor
// (Journal-Einträge, kein Chart-Highlight) — dafür bleibt der Rechtsklick-Weg im Browser der
// einzige.
const PIN_KIND_WITH_REF_ID = z.enum(["ob_zone", "trade_setup", "liquidity_level"]);

export function registerPinTools(server: McpServer) {
  server.registerTool(
    "get_pin_context",
    {
      title: "Pin-Kontext",
      description:
        "Die trade_positions, OB-Zonen, Trade-Setups, Trade-Bestätigungen, Liquiditäts-Level, " +
        "M5-OB-Boxen und RSI-Divergenz-Konnektoren, die Philip gerade per Rechtsklick " +
        "(Trades-Tabelle, Chart-Trade-Marker, Chart-OB-Zone, die '#<id>'-Box am ursprünglichen " +
        "M5-Setup eines geloggten Trades, die '✔ ...'-Bestätigungs-Box, eine LQ-Level-Linie, eine " +
        "M5-OB-Box oder eine RSI-Divergenz-Linie) 'an dich übergeben' hat, samt optionaler Notiz " +
        "und voller Daten (bei kind='trade_position': dealing_range/targets/partial exits; bei " +
        "kind='ob_zone': die volle ob_zones-Zeile; bei kind='trade_setup': die volle trade_setups-" +
        "Zeile; bei kind='trade_confirmation': die volle trade_confirmations-Zeile; bei " +
        "kind='liquidity_level': die volle liquidity_levels-Zeile (nur 1h-Chart, echte DB-Zeile); " +
        "bei kind='m5_ob': die volle ob_zones-Zeile wie bei kind='ob_zone' (timeframe='5M') — beim " +
        "Pinnen per find-or-create angelegt, falls noch nicht vorhanden; touched/invalidated werden " +
        "für M5-Zeilen aber nie live nachverfolgt, bleiben also auf ihrem Insert-Default; bei " +
        "kind='m5_liquidity_level': reiner Rohdaten-Snapshot einer Liquiditäts-Level-Linie auf " +
        "einem Nicht-1h-Chart-Timeframe (m5_liquidity_instrument/_timeframe/_direction/_price/" +
        "_pivot_time); bei kind='rsi_divergence': reiner Rohdaten-Snapshot eines RSI(14)-Divergenz-" +
        "Konnektors (rsi_divergence_instrument/_type ['bearish'|'bullish']/_from_time/_to_time/" +
        "_from_price/_to_price/_from_rsi/_to_rsi) — Divergenzen werden nie persistiert " +
        "(detectRsiDivergence()/detectRsiDivergenceHistory() in src/rsi.js rechnen live) — bei " +
        "allen drei Snapshot-Arten können touched/invalidated bzw. die aktuelle RSI-Lage seit dem " +
        "Snapshot-Zeitpunkt abgewichen sein, da es keine spätere Aktualisierung gibt). Ruf dieses " +
        "Tool proaktiv auf, wenn Philip sagt 'schau dir das mal an' o.ä., statt auf eine " +
        "Beschreibung per Text zu warten — das ist genau der Zweck dieses Tools.",
      inputSchema: {},
    },
    async () => json(await getPinContext()),
  );

  server.registerTool(
    "add_pin_entry",
    {
      title: "Chart-Stelle pinnen",
      description:
        "Pinnt eine relevante Chart-Stelle für Philip — dieselbe Aktion wie sein Rechtsklick → " +
        "'Anpinnen' im Chart, jetzt auch dir selbst verfügbar. NUR für Chart-POIs, NICHT für " +
        "trade_position/trade_confirmation (Journal-Einträge bleiben Philip-only, dafür bleibt " +
        "der Rechtsklick-Weg im Browser der einzige Weg). Fünf kind-Werte, jeweils mit eigenen " +
        "Pflichtfeldern: 'ob_zone'/'trade_setup'/'liquidity_level' brauchen `refId` (die echte " +
        "DB-id aus get_ob_zones/get_trade_setups/get_near_relevant_liquidity_levels); 'm5_ob' braucht `m5Ob` " +
        "(M5-Orderblock — Rohdaten statt id, weil poi-watcher M5 nie live erkennt/persistiert; wird " +
        "beim Pinnen per find-or-create in ob_zones angelegt); 'm5_liquidity_level' " +
        "braucht `m5Liquidity` (Liquiditäts-Level auf einem Nicht-1h-Timeframe, ebenfalls nie " +
        "persistiert); 'rsi_divergence' braucht `instrument` + `divergence` (aus " +
        "get_forex_rsi/detectRsiDivergence). Ein zweiter Aufruf für dieselbe Stelle aktualisiert " +
        "nur die Notiz (Upsert), legt keinen Zweiteintrag an. Zeitfelder sind Unix-Sekunden.",
      inputSchema: {
        kind: z.enum(["ob_zone", "trade_setup", "liquidity_level", "m5_ob", "m5_liquidity_level", "rsi_divergence"]),
        note: z.string().optional(),
        refId: z.number().optional().describe("Pflicht bei kind='ob_zone'|'trade_setup'|'liquidity_level' — die echte DB-id."),
        m5Ob: z
          .object({
            instrument: z.enum(["GBPUSD", "EURUSD"]),
            direction: z.enum(["long", "short"]),
            top: z.number(),
            bottom: z.number(),
            startTimeUnixSec: z.number(),
          })
          .optional()
          .describe("Pflicht bei kind='m5_ob'."),
        m5Liquidity: z
          .object({
            instrument: z.enum(["GBPUSD", "EURUSD"]),
            timeframe: z.string().describe('z.B. "5m"'),
            direction: z.enum(["high", "low"]),
            price: z.number(),
            pivotTimeUnixSec: z.number(),
          })
          .optional()
          .describe("Pflicht bei kind='m5_liquidity_level'."),
        instrument: z.enum(["GBPUSD", "EURUSD"]).optional().describe("Pflicht (zusammen mit divergence) bei kind='rsi_divergence'."),
        divergence: z
          .object({
            type: z.enum(["bearish", "bullish"]),
            fromTimeUnixSec: z.number(),
            toTimeUnixSec: z.number(),
            fromPrice: z.number(),
            toPrice: z.number(),
            fromRsi: z.number(),
            toRsi: z.number(),
          })
          .optional()
          .describe("Pflicht (zusammen mit instrument) bei kind='rsi_divergence'."),
      },
    },
    async ({ kind, note, refId, m5Ob, m5Liquidity, instrument, divergence }) => {
      if (PIN_KIND_WITH_REF_ID.safeParse(kind).success) {
        if (refId == null) throw new Error(`refId ist Pflicht bei kind='${kind}'.`);
        return json(await addPinEntry(kind as "ob_zone" | "trade_setup" | "liquidity_level", refId, note));
      }
      if (kind === "m5_ob") {
        if (!m5Ob) throw new Error("m5Ob ist Pflicht bei kind='m5_ob'.");
        return json(await addPinM5ObEntry(m5Ob, note));
      }
      if (kind === "m5_liquidity_level") {
        if (!m5Liquidity) throw new Error("m5Liquidity ist Pflicht bei kind='m5_liquidity_level'.");
        return json(await addPinM5LiquidityEntry(m5Liquidity, note));
      }
      if (!instrument || !divergence) throw new Error("instrument und divergence sind Pflicht bei kind='rsi_divergence'.");
      return json(await addPinRsiDivergenceEntry(instrument, divergence, note));
    },
  );

  server.registerTool(
    "remove_pin_entry",
    {
      title: "Pin entfernen",
      description: "Entfernt einen Pin-Kontext-Eintrag wieder (per id aus get_pin_context) — Pendant zum 🗑 im Pin-Panel.",
      inputSchema: { id: z.number() },
    },
    async ({ id }) => {
      await removePinEntry(id);
      return json({ removed: id });
    },
  );
}
