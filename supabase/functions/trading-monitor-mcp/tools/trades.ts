import { z } from "npm:zod@3.24.1";
import type { McpServer } from "npm:@modelcontextprotocol/sdk@^1.12.0/server/mcp.js";
import { createTrade, addTradePosition, updateTradePosition, updateDealingRange, addTradeConfirmation, addTradeTarget, updateTradeTarget, deleteTradeTarget, getDealingRangeById } from "../db.ts";
import { findTargetCandidates } from "../findTargetCandidates.js";
import { flattenTargetCandidates, findUnexplainedNearerTargets, unexplainedNearerTargetsError } from "../targetChoiceGuard.ts";
import { REPLAY_UNTIL_SEC, deprecatedTimeParam } from "../toolParams.ts";
import { hasExplicitOffset, missingOffsetError } from "../isoOffsetGuard.ts";
import { json } from "../jsonResponse.ts";

// Hier statt in db.ts: addTradeTarget, obwohl es dort für alle Aufrufer gälte — findTargetCandidates.js
// importiert db.ts, ein Rückimport wäre ein Zirkel. addTradeTarget hat ohnehin nur diesen einen
// Aufrufer. Warum der Guard überhaupt existiert: siehe targetChoiceGuard.ts.
async function assertTargetChoiceFromCandidates(args: { dealingRangeId: number; price: number; sec?: number; skippedCandidates?: string[] | null }) {
  const range = await getDealingRangeById(args.dealingRangeId);
  // Ohne Instrument/Richtung lassen sich keine Kandidaten holen — dann lieber durchlassen als den
  // Call an einer Datenlücke scheitern lassen (addTradeTarget wirft für eine fehlende Range selbst).
  if (!range?.instrument || !range?.direction) return;
  const result = await findTargetCandidates({ instrument: range.instrument, direction: range.direction, currentTimeSec: args.sec });
  if (result.currentPrice == null) return;
  const unexplained = findUnexplainedNearerTargets(flattenTargetCandidates(result), {
    price: args.price,
    currentPrice: result.currentPrice,
    skippedCandidates: args.skippedCandidates,
  });
  if (unexplained.length > 0) throw new Error(unexplainedNearerTargetsError(unexplained, result.currentPrice));
}

const INSTRUMENT = z.enum(["GBPUSD", "EURUSD"]);
const DIRECTION = z.enum(["long", "short"]);
const SOURCE = z.enum(["backtest", "paper", "live"]);
const OUTCOME = z.enum(["win", "loss", "open"]);

// Siehe isoOffsetGuard.ts: ein Zeitstempel ohne Offset ist mehrdeutig und wird deshalb abgelehnt,
// statt still als UTC in die Spalte zu wandern.
const ISO_WITH_OFFSET = z.string().refine(hasExplicitOffset, (value) => ({ message: missingOffsetError(value) }));

// Gemeinsame Felder einer Ausführung (trade_positions) — für create_trade UND add_trade_position,
// damit beide Tools garantiert dieselben Namen/Beschreibungen haben (siehe db.ts: TradePositionInput,
// insertTradePosition).
const TRADE_POSITION_FIELDS = {
  replayUntilSec: REPLAY_UNTIL_SEC,
  sec: deprecatedTimeParam("sec"),
  source: SOURCE,
  entryPrice: z.number().optional().describe("Füllpreis, falls schon bekannt"),
  stopLoss: z.number().optional(),
  triggeredAt: ISO_WITH_OFFSET.optional().describe("ISO-Zeitstempel des Einstiegs MIT Zeitzone (Z oder ±HH:MM), Default: jetzt"),
  reasoning: z.string().optional(),
  outcome: OUTCOME.optional().describe("Default (nicht gesetzt): offen/unbekannt"),
  rMultiple: z.number().optional(),
  exitPrice: z.number().optional(),
  exitTime: ISO_WITH_OFFSET.optional().describe("ISO-Zeitstempel MIT Zeitzone (Z oder ±HH:MM)"),
  // Pflicht, obwohl die Spalte nullable ist: eine trade_positions-Zeile ohne Konto rendert weder im
  // Journal noch im Chart — der Call meldete bisher Erfolg und der Trade blieb trotzdem unsichtbar.
  tradingAccountId: z.number().int().describe("Pflicht — ohne Konto ist die Position in Journal/Chart unsichtbar. Siehe get_trading_accounts"),
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
              instrument: INSTRUMENT.optional().describe("Nur bei reinen Pivot-Zielen (kein rangeLow/rangeHigh): löst per find-or-create eine liquidity_levels-Zeile auf, siehe add_trade_target"),
              timeframe: z.string().optional().describe("Nur bei reinen Pivot-Zielen: '1H' oder '4H'"),
              direction: z.enum(["high", "low"]).optional().describe("Nur bei reinen Pivot-Zielen"),
            }),
          )
          .optional()
          .describe("Geplante Ziele (TP1/TP2/...), gehören zur Idee, nicht zur einzelnen Ausführung"),
      },
    },
    async ({ replayUntilSec, sec: _sec, ...rest }) => json(await createTrade({ ...rest, sec: replayUntilSec })),
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
    async ({ dealingRangeId, replayUntilSec, sec: _sec, ...fields }) => json(await addTradePosition(dealingRangeId, { ...fields, sec: replayUntilSec })),
  );

  server.registerTool(
    "update_trade_position",
    {
      title: "Trade-Ausführung bearbeiten",
      description:
        "Bearbeitet eine bestehende trade_position (Entry/Stop/Exit/Outcome/R-Multiple/Reasoning/" +
        "Konto) über ihre id (siehe get_journal für die ids). Nur übergebene Felder werden geändert " +
        "— ein Feld explizit auf null setzen, um es zu leeren. sec optional für einen Backtest/" +
        "Replay-Zeitpunkt (Default: jetzt) — nur relevant bei outcome='win'/'loss' (löst " +
        "POSITION_CLOSED aus), sonst ohne Wirkung.",
      inputSchema: {
        id: z.number().int(),
        replayUntilSec: REPLAY_UNTIL_SEC,
        sec: deprecatedTimeParam("sec"),
        entryPrice: z.number().nullable().optional(),
        stopLoss: z.number().nullable().optional(),
        triggeredAt: ISO_WITH_OFFSET.optional(),
        reasoning: z.string().nullable().optional(),
        outcome: OUTCOME.nullable().optional(),
        rMultiple: z.number().nullable().optional(),
        exitPrice: z.number().nullable().optional(),
        exitTime: ISO_WITH_OFFSET.nullable().optional(),
        tradingAccountId: z.number().int().nullable().optional(),
        zoneId: z.number().int().nullable().optional(),
        size: z.number().nullable().optional(),
        netPl: z.number().nullable().optional(),
        commission: z.number().nullable().optional(),
      },
    },
    async ({ id, replayUntilSec, sec: _sec, ...fields }) => json(await updateTradePosition(id, fields, replayUntilSec)),
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
        "Fügt eine Bestätigung ODER ein Zusatzargument (Sweep/Pivot, M5-OB-Kante, Fib-Level oder " +
        "RSI-Divergenz — bereits passierte Evidenz für die Idee, nicht ein zukünftiges Ziel wie ein " +
        "Target) zu einer dealing_range ('GO für die Idee', level='range', id=dealing_range_id) oder " +
        "einer einzelnen trade_position ('GO für diesen Entry', level='position', id=trade_position_id) " +
        "hinzu. Bei level='range' OHNE id: instrument mitgeben — bootstrapped automatisch (bereits " +
        "offene Range fürs Instrument wiederverwenden, sonst neu anlegen), genau wie im Chart ein " +
        "einzelner Klick auf die erste Bestätigung selbst schon eine Range mit anlegt (Dashboard.vue: " +
        "tscBootstrapArmed) — Philip sieht dort auch keinen separaten 'Range anlegen'-Schritt, dieses " +
        "Tool muss also ebenfalls keinen brauchen (Bug-Report Philip 2026-08-30). Die Richtung der " +
        "NEU angelegten Range kommt dabei aus DIESER Bestätigung: bei kind='ob' aus obDirection, bei " +
        "kind='pivot' aus direction (Sweep eines Tiefs='low' → long, eines Hochs='high' → short) — " +
        "ein Bootstrap mit kind='fib'/'rsi_divergence' schlägt fehl (keine eindeutige Richtung), dafür " +
        "explizit create_dealing_range aufrufen. Mit id (bekannt aus get_tsc_range/create_dealing_range) " +
        "läuft es wie bisher direkt gegen diese bestehende Range/Position — id MUSS dann existieren, " +
        "sonst Fehler. Idempotent bei level='range' + kind='pivot'/'ob': zeigt dieselbe " +
        "ob_zone_id/liquidity_level_id bereits eine Bestätigung an dieser Range, wird KEINE zweite " +
        "Zeile angelegt (die bestehende kommt zurück) — der State-Machine-Übergang feuert trotzdem, " +
        "sicher erneut aufrufbar, wenn der Loop mit unveränderter Evidenz zu s45.tscLink zurückkehrt. " +
        "kind='pivot'/'ob'/'rsi_divergence' sind Confirmations (geben tatsächlich das GO), " +
        "kind='fib' ist eine Confluence (gibt nur zusätzliche Sicherheit, kein GO) — siehe " +
        "trading-Repo trade-from-poi.md#confirmation-confluence-und-anti-confluence--wie-eine-dealing-range-go-bekommt " +
        "für die Begriffsdefinition; category ergibt sich standardmäßig automatisch aus kind, NUR bei " +
        "Anti-Confluence (spricht gegen den Trade, z.B. ein gegenläufiges OB oder eine gegenläufige " +
        "Divergenz) explizit category='anti_confluence' mitgeben — sonst würde z.B. ein gegenläufiges " +
        "'ob' fälschlich als Confirmation gewertet und (bei level='range') sogar die Range-Richtung " +
        "umdrehen. " +
        "Bei einem setup-verlinkten " +
        "Trade (tradeSetupId auf create_trade/update_dealing_range) NICHT automatisch angelegt — " +
        "explizit nachziehen, sonst zeigt das Edit-Modal trotz Setup-Link keine Bestätigung (siehe " +
        "get_trade_setups fürs Ableiten von price/sourceTime: bei kind='ob' price = ob_bottom bei " +
        "Short-Setups bzw. ob_top bei Long-Setups, sourceTime = ob_start_time, rangeLow/rangeHigh = " +
        "ob_bottom/ob_top, timeframe='5M'; bei kind='pivot' price = ls_price, sourceTime = " +
        "ls_pivot_time, touchedTime = ls_touched_time). sourceTime ist PFLICHT (bei kind='ob' " +
        "zusätzlich rangeLow/rangeHigh) — ohne diese Felder speichert das Tool nichts, weil die " +
        "Bestätigung sonst im Journal existiert, aber für immer unsichtbar im Chart bliebe. Bei " +
        "kind='pivot' zusätzlich instrument/direction (und timeframe='1H'/'4H') mitgeben, wenn der " +
        "Pivot ein echter Struktur-/Liquiditäts-Pivot ist (nicht z.B. ein synthetischer Preis) — " +
        "löst ihn per find-or-create in liquidity_levels auf (dieselbe Zeile wie ein von poi-watcher " +
        "erkannter Pivot, falls der Preis/Zeitpunkt exakt übereinstimmt), statt nur einen rohen " +
        "Snapshot zu speichern. Fehlen sie, bleibt das alte Rohdaten-Verhalten (kein Fehler). Bei " +
        "kind='ob' zusätzlich instrument/timeframe/obDirection mitgeben, um die Zone per " +
        "find-or-create in ob_zones aufzulösen (analog zu instrument/direction bei kind='pivot', nur " +
        "eigenes Feld — obDirection ist die Long/Short-Richtung der OB selbst, eine andere Achse als " +
        "direction, das nur für einen Pivot 'high'/'low' bedeutet). Bei level='range' UND kind='ob' " +
        "mit obDirection zieht das Tool zusätzlich die dealing_range selbst nach: direction wird " +
        "IMMER auf obDirection gesetzt (eine OB ist das eindeutigere Signal als ein bloßer Sweep), " +
        "invalidation NUR, falls dort noch nichts gesetzt ist (eine bereits vorhandene, evtl. manuell " +
        "nachjustierte Invalidierung bleibt unangetastet) — TSC-Bootstrap-Fall, wenn Philip eine Idee " +
        "zuerst über einen Sweep anlegt und die OB-Bestätigung erst danach hinzukommt. Bei " +
        "kind='rsi_divergence': price/sourceTime/touchedTime tragen den geprüften (jüngeren) " +
        "Divergenz-Schwungpunkt (toPrice/toTime), fromPrice/fromRsi/toRsi/divergenceType den " +
        "Referenzpunkt und die RSI-Werte beider Beine (siehe get_forex_rsi) — ohne sie ist die " +
        "Divergenz später nicht mehr als Zwei-Bein-Konnektor nachzeichenbar, aber kein harter Fehler. " +
        "Statt kind/price/sourceTime/rangeLow/rangeHigh/timeframe/instrument/direction/obDirection/" +
        "divergenceType/fromPrice/fromRsi/toRsi manuell mitzugeben, kann pinId gesetzt werden (id aus " +
        "get_pin_context/add_pin_entry) — der Server leitet all das dann selbst aus der pin_context-" +
        "Zeile ab (kind='ob_zone'→'ob', 'liquidity_level'/'m5_liquidity_level'→'pivot', " +
        "'rsi_divergence'→'rsi_divergence'; 'trade_position'/'trade_setup'/'trade_confirmation' als " +
        "Pin-Quelle werden abgelehnt, keine sinnvolle neue Bestätigung daraus ableitbar). Jedes hier " +
        "trotzdem explizit gesetzte Feld überschreibt den abgeleiteten Wert (z.B. touchedTime " +
        "nachtragen, wenn der Pin selbst noch nicht 'touched' war). sec optional für einen Backtest/" +
        "Replay-Zeitpunkt (Default: jetzt) — ohne ihn treibt dieser Aufruf die State-Machine-Zeile " +
        "des HEUTIGEN Tages an, nicht die eines laufenden Backtests.",
      inputSchema: {
        level: z.enum(["range", "position"]),
        replayUntilSec: REPLAY_UNTIL_SEC,
        sec: deprecatedTimeParam("sec"),
        id: z
          .number()
          .int()
          .optional()
          .describe(
            "dealing_range_id bei level='range' (optional — ohne id UND mit instrument wird die " +
              "Range bootstrapped, siehe Tool-Beschreibung), trade_position_id bei level='position' " +
              "(hier weiterhin Pflicht, kein automatisches Anlegen einer Ausführung).",
          ),
        pinId: z.number().int().optional().describe("Statt kind/price/sourceTime/... manuell: id aus get_pin_context, siehe Tool-Beschreibung."),
        kind: z.enum(["pivot", "ob", "fib", "rsi_divergence"]).optional().describe("Pflicht, außer pinId ist gesetzt (dann daraus abgeleitet)."),
        category: z
          .enum(["confirmation", "confluence", "anti_confluence"])
          .optional()
          .describe(
            "Überschreibt die automatische kind->category-Ableitung — NUR für Anti-Confluence " +
              "gedacht (spricht gegen den Trade), sonst weglassen. Siehe Tool-Beschreibung.",
          ),
        price: z.number().optional().describe("Pflicht, außer pinId ist gesetzt."),
        sourceTime: z.string().optional().describe("ISO-Zeitstempel, z.B. Pivot-/OB-Startzeit — Pflicht, außer pinId ist gesetzt, sonst keine Chart-Position berechenbar."),
        touchedTime: z.string().nullable().optional().describe("ISO-Zeitstempel, falls bereits (an)getestet"),
        rangeLow: z.number().nullable().optional().describe("Bei kind='ob': PFLICHT (untere Zonen-Kante), bei kind='fib' optionale Ankerkante."),
        rangeHigh: z.number().nullable().optional().describe("Bei kind='ob': PFLICHT (obere Zonen-Kante), bei kind='fib' optionale Ankerkante."),
        timeframe: z.string().nullable().optional().describe("Bei kind='ob': Zeitebene der Zone, z.B. '5M'/'1H'/'4H'. Bei kind='pivot': '1H'/'4H', siehe oben."),
        instrument: INSTRUMENT.optional().describe(
          "Bei kind='pivot' oder kind='ob' für die liquidity_level_id/ob_zone_id-Auflösung. Bei " +
            "level='range' OHNE id zusätzlich PFLICHT fürs Bootstrap (siehe Tool-Beschreibung).",
        ),
        direction: z.enum(["high", "low"]).optional().describe("Nur bei kind='pivot': siehe Tool-Beschreibung."),
        obDirection: z.enum(["long", "short"]).optional().describe("Nur bei kind='ob': siehe Tool-Beschreibung."),
        divergenceType: z.enum(["bearish", "bullish"]).optional().describe("Nur bei kind='rsi_divergence'."),
        fromPrice: z.number().optional().describe("Nur bei kind='rsi_divergence': Preis des Referenz-Schwungpunkts."),
        fromRsi: z.number().optional().describe("Nur bei kind='rsi_divergence': RSI-Wert am Referenz-Schwungpunkt."),
        toRsi: z.number().optional().describe("Nur bei kind='rsi_divergence': RSI-Wert am geprüften Schwungpunkt (price)."),
        bonus: z.string().optional().describe("Nur bei kind='pivot': Session-Kontext wie 'Asia-Mid', falls bekannt (siehe get_near_relevant_liquidity_levels)."),
      },
    },
    // Validierung (kind/price/sourceTime Pflicht, rangeLow/rangeHigh bei kind='ob') sitzt jetzt in
    // addTradeConfirmation selbst, nicht mehr hier — sie muss auch nach einer pinId-Ableitung
    // greifen, die auf dieser Ebene noch nicht aufgelöst ist.
    async ({ level, id, replayUntilSec, sec: _sec, ...fields }) => json(await addTradeConfirmation({ level, id, ...fields, sec: replayUntilSec })),
  );

  server.registerTool(
    "add_trade_target",
    {
      title: "Target zu einer Dealing Range hinzufügen",
      description:
        "Fügt einer BEREITS BESTEHENDEN dealing_range ein weiteres Target (TP1/TP2/TP3/...) hinzu — " +
        "für eine initiale Anlage siehe stattdessen `targets` auf create_trade. dealingRangeId ist die " +
        "id der Idee (siehe get_journal, Feld dealing_ranges.id) — existiert noch keine offene TSC-" +
        "Idee (get_tsc_range liefert null), ZUERST create_dealing_range aufrufen und dessen id " +
        "verwenden, kein automatisches Anlegen hier. sourceTime ist PFLICHT (z.B. Pivot-/" +
        "OB-Zeitpunkt) — ohne sourceTime bleibt das Target im Chart unsichtbar, auch wenn die " +
        "DB-Zeile existiert, deshalb erzwingt das Tool das Feld. Für ein reines Pivot-Ziel (kein " +
        "rangeLow/rangeHigh) zusätzlich instrument/direction/timeframe mitgeben, wenn es ein echter " +
        "Struktur-/Liquiditäts-Pivot ist — löst ihn per find-or-create in liquidity_levels auf " +
        "(siehe add_trade_confirmation für dieselbe Logik), statt nur einen rohen Snapshot zu " +
        "speichern. Fehlen sie, bleibt das alte Rohdaten-Verhalten (kein Fehler). kind ('pivot' oder " +
        "'ob') sollte mitgegeben werden, sonst kann das Chart ein OB-Ziel (rangeLow/rangeHigh gesetzt) " +
        "nicht von einem Pivot-Ziel unterscheiden. touchedTime, falls das Ziel bereits erreicht wurde " +
        "(sonst offen). AUSWAHLPFLICHT statt Mitgliedschaftsprüfung: find_targets liefert seine " +
        "Kandidaten nach Abstand zum Kurs SORTIERT — Position 0 ist die Default-Antwort, der Rest ist " +
        "Sicht aufs Umfeld. Dieses Tool lehnt einen weiter entfernten Preis ab, solange nicht JEDER " +
        "näher liegende Kandidat in skippedCandidates mit Grund genannt ist (die Fehlermeldung listet " +
        "die fehlenden auf). Ein vorab gefasstes Ziel gegen die Liste zu halten und abzunicken reicht " +
        "also nicht mehr — erst die Liste durchgehen, dann wählen. sec optional für einen Backtest/" +
        "Replay-Zeitpunkt (Default: jetzt) — ohne ihn treibt dieser Aufruf die State-Machine-Zeile " +
        "des HEUTIGEN Tages an, nicht die eines laufenden Backtests.",
      inputSchema: {
        dealingRangeId: z.number().int(),
        replayUntilSec: REPLAY_UNTIL_SEC,
        sec: deprecatedTimeParam("sec"),
        price: z.number(),
        kind: z.enum(["pivot", "ob"]).nullable().optional(),
        rangeLow: z.number().nullable().optional().describe("Für OB-Ziele: Zonen-Unterkante"),
        rangeHigh: z.number().nullable().optional().describe("Für OB-Ziele: Zonen-Oberkante"),
        sourceTime: z.string().describe("ISO-Zeitstempel, z.B. Pivot-/OB-Zeitpunkt — PFLICHT, sonst keine Chart-Position berechenbar."),
        touchedTime: z.string().nullable().optional().describe("ISO-Zeitstempel, falls das Ziel bereits erreicht wurde"),
        instrument: INSTRUMENT.optional().describe("Nur bei einem reinen Pivot-Ziel: siehe Tool-Beschreibung."),
        timeframe: z.string().optional().describe("Nur bei einem reinen Pivot-Ziel: '1H' oder '4H'."),
        direction: z.enum(["high", "low"]).optional().describe("Nur bei einem reinen Pivot-Ziel."),
        skippedCandidates: z
          .array(z.string())
          .optional()
          .describe(
            "Je ein Eintrag mit Preis + Grund für JEDEN find_targets-Kandidaten, der näher am Kurs liegt als `price` " +
              '(z.B. "1.35528 = Hoch, kein Short-Ziel"). Weglassen/leer ist nur gültig, wenn du den nächstgelegenen ' +
              "Kandidaten gewählt hast — sonst lehnt das Tool den Call ab und nennt die fehlenden.",
          ),
      },
    },
    async ({ dealingRangeId, skippedCandidates, replayUntilSec, sec: _sec, ...rawFields }) => {
      const fields = { ...rawFields, sec: replayUntilSec };
      await assertTargetChoiceFromCandidates({ dealingRangeId, price: fields.price, sec: fields.sec, skippedCandidates });
      return json(await addTradeTarget(dealingRangeId, fields));
    },
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
        liquidityLevelId: z.number().int().nullable().optional().describe("Manuelle Verlinkung/Korrektur auf eine liquidity_levels-Zeile, siehe get_near_relevant_liquidity_levels."),
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
