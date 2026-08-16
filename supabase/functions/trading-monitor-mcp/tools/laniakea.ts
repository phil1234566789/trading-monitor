import type { McpServer } from "npm:@modelcontextprotocol/sdk@1.12.0/server/mcp.js";
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
        "Die trade_positions, OB-Zonen, Trade-Setups, Trade-Bestätigungen, Liquiditäts-Level, " +
        "M5-OB-Boxen und RSI-Divergenz-Konnektoren, die Philip gerade per Rechtsklick " +
        "(Trades-Tabelle, Chart-Trade-Marker, Chart-OB-Zone, die '#<id>'-Box am ursprünglichen " +
        "M5-Setup eines geloggten Trades, die '✔ ...'-Bestätigungs-Box, eine LQ-Level-Linie, eine " +
        "M5-OB-Box oder eine RSI-Divergenz-Linie) 'an dich übergeben' hat, samt optionaler Notiz " +
        "und voller Daten (bei kind='trade_position': dealing_range/targets/partial exits; bei " +
        "kind='ob_zone': die volle ob_zones-Zeile; bei kind='trade_setup': die volle trade_setups-" +
        "Zeile; bei kind='trade_confirmation': die volle trade_confirmations-Zeile; bei " +
        "kind='liquidity_level': die volle liquidity_levels-Zeile (nur 1h-Chart, echte DB-Zeile); " +
        "bei kind='m5_ob': reiner Rohdaten-Snapshot — m5_ob_instrument/_direction/_top/_bottom/" +
        "_start_time, keine eigene Tabelle, da M5-OBs nie persistiert werden; bei " +
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
    async () => json(await getLaniakeaContext()),
  );
}
