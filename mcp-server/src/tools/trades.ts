import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createTrade, addTradePosition, updateTradePosition, updateDealingRange, addTradeConfirmation, addTradeTarget, updateTradeTarget, deleteTradeTarget } from "../db.js";

function json(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

const INSTRUMENT = z.enum(["GBPUSD", "EURUSD"]);
const DIRECTION = z.enum(["long", "short"]);
const SOURCE = z.enum(["backtest", "paper", "live"]);
const OUTCOME = z.enum(["win", "loss", "open"]);

// Gemeinsame Felder einer Ausführung (trade_positions) — für create_trade UND add_trade_position,
// damit beide Tools garantiert dieselben Namen/Beschreibungen haben (siehe db.ts: TradePositionInput,
// insertTradePosition).
const TRADE_POSITION_FIELDS = {
  source: SOURCE,
  entryPrice: z.number().optional().describe("Füllpreis, falls schon bekannt"),
  stopLoss: z.number().optional(),
  triggeredAt: z.string().optional().describe("ISO-Zeitstempel des Einstiegs, Default: jetzt"),
  reasoning: z.string().optional(),
  outcome: OUTCOME.optional().describe("Default (nicht gesetzt): offen/unbekannt"),
  rMultiple: z.number().optional(),
  exitPrice: z.number().optional(),
  exitTime: z.string().optional().describe("ISO-Zeitstempel"),
  tradingAccountId: z.number().int().optional().describe("siehe get_trading_accounts"),
  zoneId: z.number().int().optional().describe("Link zu einer ob_zones-Zeile, falls der Trade aus einer Zone kam"),
  // Broker-Ausführungsdetails (Chat 2026-07-31) — eigene Felder statt sie wie bisher in reasoning
  // hineinzuschreiben ("Menge 0,5, Netto P/L $27.00").
  size: z.number().optional().describe("Positionsgröße, aktuell immer Forex-Lots (z.B. 0.1, 0.5, 1)"),
  netPl: z.number().optional().describe("Netto Gewinn/Verlust in Kontowährung, z.B. 13.0 oder -14.4"),
  commission: z.number().optional().describe("Gebühr, i.d.R. negativ oder 0"),
};

// Trade-Journal-Write-Tools (Philip 2026-07-31: "Trades, die ich heut gemacht hab einpflegen").
// Die "Trade Entity" besteht laut Umbau in supabase/migrations/
// 20260731120000_dealing_ranges_trade_positions.sql aus zwei Tabellen: dealing_ranges (die Idee,
// 1) + trade_positions (die Ausführung, 1-n) — siehe db.ts für die Feld-Zuordnung. Anders als
// post_chart_annotations bewusst NICHT allow-gelistet (Journal-Korrektheit wiegt schwerer als eine
// Chart-Zeichnung) — falls Philip das auch freischalten will, sagt er's wie bei den Annotationen.
export function registerTradeTools(server: McpServer) {
  server.registerTool(
    "create_trade",
    {
      title: "Trade anlegen",
      description:
        "Legt eine NEUE dealing_range (die Idee — Instrument/Richtung/Invalidation/optionaler " +
        "Setup-Link) PLUS ihre erste trade_position (Ausführung) an, optional mit Zielen (targets). " +
        "Für eine WEITERE Ausführung auf eine bereits bestehende Idee (Re-Entry, oder erster " +
        "tatsächlicher Fill nach einer zunächst nicht abgeholten Limit-Order) stattdessen " +
        "add_trade_position nutzen — NICHT create_trade nochmal aufrufen, das würde fälschlich eine " +
        "zweite, unabhängige Idee anlegen. Konto über tradingAccountId (siehe " +
        "get_trading_accounts), Setup-Link über tradeSetupId (siehe get_trade_setups).",
      inputSchema: {
        instrument: INSTRUMENT,
        direction: DIRECTION,
        ...TRADE_POSITION_FIELDS,
        invalidation: z.number().optional().describe("Preis, an dem sich die IDEE als falsch erweist"),
        tradeSetupId: z.number().int().optional(),
        targets: z
          .array(
            z.object({
              price: z.number(),
              rangeLow: z.number().optional().describe("Für OB-Ziele: Zonen-Unterkante"),
              rangeHigh: z.number().optional().describe("Für OB-Ziele: Zonen-Oberkante"),
            }),
          )
          .optional()
          .describe("Geplante Ziele (TP1/TP2/...), gehören zur Idee, nicht zur einzelnen Ausführung"),
      },
    },
    async (args) => json(await createTrade(args)),
  );

  server.registerTool(
    "add_trade_position",
    {
      title: "Weitere Ausführung zu einer bestehenden Idee hinzufügen",
      description:
        "Fügt einer BEREITS BESTEHENDEN dealing_range (der Idee, z.B. 'Long#18' im Chart/Journal) " +
        "eine weitere trade_position hinzu — für Re-Entries oder wenn eine Limit-Order zunächst " +
        "nicht abgeholt wurde und der eigentliche Fill erst später/zu einem anderen Preis kam. " +
        "dealingRangeId ist die id der Idee (siehe get_journal, Feld dealing_ranges.id, oder Philip " +
        "nennt sie direkt, z.B. 'zu Long#18 hinzufügen').",
      inputSchema: {
        dealingRangeId: z.number().int(),
        ...TRADE_POSITION_FIELDS,
      },
    },
    async ({ dealingRangeId, ...fields }) => json(await addTradePosition(dealingRangeId, fields)),
  );

  server.registerTool(
    "update_trade_position",
    {
      title: "Trade-Ausführung bearbeiten",
      description:
        "Bearbeitet eine bestehende trade_position (Entry/Stop/Exit/Outcome/R-Multiple/Reasoning/" +
        "Konto) über ihre id (siehe get_journal für die ids). Nur übergebene Felder werden geändert " +
        "— ein Feld explizit auf null setzen, um es zu leeren.",
      inputSchema: {
        id: z.number().int(),
        entryPrice: z.number().nullable().optional(),
        stopLoss: z.number().nullable().optional(),
        triggeredAt: z.string().optional(),
        reasoning: z.string().nullable().optional(),
        outcome: OUTCOME.nullable().optional(),
        rMultiple: z.number().nullable().optional(),
        exitPrice: z.number().nullable().optional(),
        exitTime: z.string().nullable().optional(),
        tradingAccountId: z.number().int().nullable().optional(),
        zoneId: z.number().int().nullable().optional(),
        size: z.number().nullable().optional(),
        netPl: z.number().nullable().optional(),
        commission: z.number().nullable().optional(),
      },
    },
    async ({ id, ...fields }) => json(await updateTradePosition(id, fields)),
  );

  server.registerTool(
    "update_dealing_range",
    {
      title: "Trade-Idee bearbeiten",
      description:
        "Bearbeitet eine bestehende dealing_range (Instrument/Richtung/Invalidation/Setup-Link/" +
        "Lesson-Verknüpfung/Favorit-Markierung) über ihre id (siehe get_journal, Feld " +
        "dealing_ranges.id). Nur übergebene Felder werden geändert. lessonDealingRangeId verlinkt " +
        "eine ANDERE dealing_range als 'das wäre der richtige Trade gewesen' (z.B. nach einem " +
        "Fehler-Trade oder einer falsch bestimmten Range) — null setzt eine bestehende Verknüpfung " +
        "zurück. setupType markiert die Idee als Top-Setup für Philips Strategie ('10/10-Trade' — " +
        "aktuell der einzige Wert, weitere Kategorien kommen erst mit einer zweiten Strategie) — " +
        "null entfernt die Markierung wieder.",
      inputSchema: {
        id: z.number().int(),
        instrument: INSTRUMENT.optional(),
        direction: DIRECTION.optional(),
        invalidation: z.number().nullable().optional(),
        tradeSetupId: z.number().int().nullable().optional(),
        lessonDealingRangeId: z.number().int().nullable().optional(),
        setupType: z.enum(["10/10-Trade"]).nullable().optional(),
      },
    },
    async ({ id, ...fields }) => json(await updateDealingRange(id, fields)),
  );

  server.registerTool(
    "add_trade_confirmation",
    {
      title: "Bestätigung hinzufügen",
      description:
        "Fügt eine Bestätigung (Sweep/Pivot, M5-OB-Kante oder Fib-Level — bereits passierte Evidenz " +
        "für die Idee, nicht ein zukünftiges Ziel wie ein Target) zu einer dealing_range ('GO für die " +
        "Idee', level='range', id=dealing_range_id) oder einer einzelnen trade_position ('GO für " +
        "diesen Entry', level='position', id=trade_position_id) hinzu. Bei einem setup-verlinkten " +
        "Trade (tradeSetupId auf create_trade/update_dealing_range) NICHT automatisch angelegt — " +
        "explizit nachziehen, sonst zeigt das Edit-Modal trotz Setup-Link keine Bestätigung (siehe " +
        "get_trade_setups fürs Ableiten von price/sourceTime: bei kind='ob' price = ob_bottom bei " +
        "Short-Setups bzw. ob_top bei Long-Setups, sourceTime = ob_start_time, rangeLow/rangeHigh = " +
        "ob_bottom/ob_top, timeframe='5M'; bei kind='pivot' price = ls_price, sourceTime = " +
        "ls_pivot_time, touchedTime = ls_touched_time).",
      inputSchema: {
        level: z.enum(["range", "position"]),
        id: z.number().int().describe("dealing_range_id bei level='range', trade_position_id bei level='position'"),
        kind: z.enum(["pivot", "ob", "fib"]),
        price: z.number(),
        sourceTime: z.string().nullable().optional().describe("ISO-Zeitstempel, z.B. Pivot-/OB-Startzeit"),
        touchedTime: z.string().nullable().optional().describe("ISO-Zeitstempel, falls bereits (an)getestet"),
        rangeLow: z.number().nullable().optional().describe("Bei kind='ob'/'fib': untere Ankerkante"),
        rangeHigh: z.number().nullable().optional().describe("Bei kind='ob'/'fib': obere Ankerkante"),
        timeframe: z.string().nullable().optional().describe("Bei kind='ob': Zeitebene der Zone, z.B. '5M'/'1H'/'4H'"),
      },
    },
    async ({ level, id, ...fields }) => json(await addTradeConfirmation({ level, id, ...fields })),
  );

  server.registerTool(
    "add_trade_target",
    {
      title: "Target zu einer Dealing Range hinzufügen",
      description:
        "Fügt einer BEREITS BESTEHENDEN dealing_range ein weiteres Target (TP1/TP2/TP3/...) hinzu — " +
        "für eine initiale Anlage siehe stattdessen `targets` auf create_trade. dealingRangeId ist die " +
        "id der Idee (siehe get_journal, Feld dealing_ranges.id). sourceTime angeben, wenn bekannt " +
        "(z.B. Pivot-/OB-Zeitpunkt) — ohne sourceTime bleibt das Target im Chart unsichtbar, auch " +
        "wenn die DB-Zeile existiert.",
      inputSchema: {
        dealingRangeId: z.number().int(),
        price: z.number(),
        rangeLow: z.number().nullable().optional().describe("Für OB-Ziele: Zonen-Unterkante"),
        rangeHigh: z.number().nullable().optional().describe("Für OB-Ziele: Zonen-Oberkante"),
        sourceTime: z.string().nullable().optional().describe("ISO-Zeitstempel, z.B. Pivot-/OB-Zeitpunkt"),
      },
    },
    async ({ dealingRangeId, ...fields }) => json(await addTradeTarget(dealingRangeId, fields)),
  );

  server.registerTool(
    "update_trade_target",
    {
      title: "Target bearbeiten",
      description:
        "Bearbeitet ein bestehendes Target (Preis/Zonen-Kanten/Quellzeit) über seine id (siehe " +
        "get_journal, eingebettet unter dealing_ranges.trade_targets — dort aktuell nur price " +
        "sichtbar, für die id ggf. get_pin_context oder direkt nachfragen). Nur übergebene " +
        "Felder werden geändert.",
      inputSchema: {
        id: z.number().int(),
        price: z.number().optional(),
        rangeLow: z.number().nullable().optional(),
        rangeHigh: z.number().nullable().optional(),
        sourceTime: z.string().nullable().optional(),
      },
    },
    async ({ id, ...fields }) => json(await updateTradeTarget(id, fields)),
  );

  server.registerTool(
    "delete_trade_target",
    {
      title: "Target löschen",
      description: "Löscht ein Target über seine id — z.B. wenn TP1/TP2 falsch gesetzt wurden und neu sollen statt nur überschrieben zu werden.",
      inputSchema: {
        id: z.number().int(),
      },
    },
    async ({ id }) => json(await deleteTradeTarget(id)),
  );
}
