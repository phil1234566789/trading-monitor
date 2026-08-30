import { z } from "npm:zod@3.24.1";
import type { McpServer } from "npm:@modelcontextprotocol/sdk@^1.12.0/server/mcp.js";
import {
  getObZones,
  getTradeSetups,
  getJournal,
  getNewsEvents,
  getTradingSchedule,
  getTradingAccounts,
  getForexCandlesArchive,
} from "../db.ts";
import { fetchForexCandles } from "../forexCandles.ts";
import { buildDataExport } from "./dataExport.ts";
import { buildNearRelevantLiquidityLevels, NEAR_RANGE_PIPS } from "./nearRelevantLiquidityLevels.ts";
// Derselbe computeRsi/computeEma wie der Live-Chart (PriceChart.vue) — kein zweiter Port nötig,
// da beide Funktionen bereits dependency-frei sind (kein localStorage/import.meta.env), siehe
// CLAUDE.md "MCP-Server" zum selben Muster bei marketStructureAnalysis.ts. rsi.ts lebte bis
// 2026-08-11 nur hier im MCP-Server, wurde beim Bau des Chart-RSI-Panels nach src/rsi.js
// verschoben, damit es nicht ein zweites Mal implementiert werden musste.
import { computeRsi, rsiZone, DEFAULT_RSI_PERIOD } from "../rsi.js";
import { computeEma } from "../ema.js";
import { resolveDayWindow, fetchM5WithWarmup, isWithinDayWindow } from "../indicatorWindow.ts";

function json(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

const INSTRUMENT = z.enum(["GBPUSD", "EURUSD"]).describe("Forex-Instrument");

// Wie TREND_ANALYSIS_CANDLE_COUNT/EMA_PERIOD_FAST/EMA_PERIOD_SLOW in PriceChart.vue.
const EMA_WARMUP_CANDLES = 1000;
const EMA_PERIOD_FAST = 50;
const EMA_PERIOD_SLOW = 200;

// "mehrere Vielfache der Periode" (siehe src/ema.js-Kommentar) — für RSI reicht das genauso als
// Vorlauf, bis die Wilder-Glättung eingependelt ist, bevor der erste Tagespunkt zurückgegeben wird.
const RSI_WARMUP_MULTIPLIER = 5;

// Registriert alle Read-Tools am Server. get_data_export zuerst und mit Beschreibung, die Claude
// aktiv dazu anhält, es zuerst aufzurufen (Philips Punkt: nicht zig einzelne GETs am Gesprächs-
// anfang) — die granularen Tools danach für alles, was das Bündel nicht abdeckt.
export function registerReadTools(server: McpServer) {
  server.registerTool(
    "get_data_export",
    {
      title: "Daten-Export (Gesamtbild)",
      description:
        "RUFE DIESES TOOL ZUERST AUF, bevor du andere trading-monitor-Tools nutzt. Liefert in einem " +
        "Call: M5-Kerzen des Tages + Asia-Session-Range, den 1H-Structure-Trend, relevante " +
        "persistierte Liquidity-Level (1H+4H, inkl. context wie 'asia high' und kontext wie " +
        "'Asia-High Major (26d)' falls eine passende Session existiert) und OB-Zonen " +
        "(1H+4H) für ein Instrument — dasselbe Bündel wie der 'Daten-Export'-" +
        "Button in der App. ZUSÄTZLICH m5LiquidityLevels/m5ObZones: live über ein 7-Tage-Fenster neu " +
        "erkannt (exakt derselbe Algorithmus UND Lookback wie der Button UND Philips 'Liquidität'/" +
        "'OB M5'-Chart-Toggles, ebenfalls mit context/kontext) — anders als liquidityLevels/obZones KEINE " +
        "DB-Zeilen (M5 wird von poi-watcher nie persistiert), deshalb auch kein späteres Update: " +
        "touched/invalidated gelten nur zum Zeitpunkt dieses Calls. Nutze die granularen get_*-Tools " +
        "nur, wenn du darüber hinaus mehr brauchst (andere Zeitspanne, Journal, News, Handelszeiten). " +
        "Der Structure-Trend (Periode 5/2) nutzt standardmäßig den letzten persistierten " +
        "1D-Periode-4-Struktur-Pivot dieses Instruments als Startpunkt (daily_structure_pivots, " +
        "täglicher Cron) — nur solange dafür noch kein Pivot vorliegt, fällt er auf einen " +
        "rollierenden 21-Tage-Lookback zurück. Falls Philip im Dashboard EXPLIZIT einen anderen " +
        "'fixen Start' eingestellt hat (nur in seinem Browser-localStorage sichtbar, nicht von " +
        "hier aus abfragbar), frag ihn danach und gib es über structureConfig mit. structure1h (und " +
        "dessen nestedTrend-Kette) enthält NIE eine Ebene mit trend='unknown' — die wird samt allem " +
        "darunter rausgefiltert (bedeutet nur 'Algo braucht noch mehr Strukturpunkte', keine " +
        "brauchbare Info). structure1h kann dadurch komplett null sein, auch wenn currRange/Pivots " +
        "technisch schon existieren — das ist kein Fehler. Antwort enthält " +
        "zusätzlich structureWindow (cutoffOuter/" +
        "cutoffInner als Unix-Sekunden UND als cutoffOuterAt/cutoffInnerAt in 'YYYY-MM-DD HH:mm' " +
        "Europe/Berlin, direkt nutzbar als time-Feld für post_chart_annotations) — zeichne diesen " +
        "Startpunkt IMMER als Marker/Linie ein, wenn du eine Structure-Trend-Analyse zeigst, damit " +
        "Philip visuell prüfen kann, ob er mit seinem eigenen Chart übereinstimmt.",
      inputSchema: {
        instrument: INSTRUMENT,
        dateStr: z.string().optional().describe("YYYY-MM-DD (Europe/Berlin), Default: heute"),
        replayUntilSec: z.number().optional().describe("Unix-Sekunden — deckt nur bis zu diesem Zeitpunkt auf (Replay-Simulation)"),
        structureConfig: z
          .object({
            periodOuter: z.number().int().positive().optional().describe("Default 5"),
            periodInner: z.number().int().positive().optional().describe("Default 2"),
            lookbackHoursOuter: z.number().positive().optional().describe("Default 504 (21 Tage)"),
            lookbackHoursInner: z.number().positive().optional().describe("Default 504 (21 Tage)"),
            fixedStartActive: z.boolean().optional().describe("true = fixedStartTime statt rollierendem Lookback nutzen"),
            fixedStartTime: z.number().optional().describe("Unix-Sekunden, nur relevant wenn fixedStartActive"),
          })
          .optional()
          .describe("Nur setzen, wenn Philip explizit von den Dashboard-Defaults abweichende Structure-Settings nennt"),
      },
    },
    async ({ instrument, dateStr, replayUntilSec, structureConfig }) =>
      json(await buildDataExport({ instrument, dateStr, replayUntilSec, structureConfig })),
  );

  server.registerTool(
    "get_ob_zones",
    {
      title: "OB-Zonen",
      description: "Order-Block-Zonen aus der ob_zones-Tabelle (von poi-watcher alle 5min aktualisiert). Default: nur nicht-invalidierte, nicht-angetestete Zonen (wie der Live-Chart).",
      inputSchema: {
        instrument: INSTRUMENT,
        timeframe: z.enum(["1H", "4H"]).optional(),
        includeAll: z.boolean().optional().describe("Auch invalidierte/angetestete Zonen mitliefern"),
        asOfSec: z.number().optional().describe("Unix-Sekunden für Backtest/Replay: Touched/Invalidated-Stand wird auf diesen Zeitpunkt zurückgerechnet statt des aktuellen Live-Stands geliefert"),
      },
    },
    async ({ instrument, timeframe, includeAll, asOfSec }) => json(await getObZones(instrument, timeframe, includeAll, asOfSec)),
  );

  // Chat 2026-08-26, Philip: ersetzt das alte get_liquidity_levels (reine, ungefilterte DB-Abfrage)
  // — "früher war die Idee, dass Lana alles selbst herausfindet, solange sie ALLE Daten zur
  // Verfügung hat. Die Realität zeigt, dass sie damit nicht klarkommt, wir müssen die Daten besser
  // vorbereiten." Siehe nearRelevantLiquidityLevels.ts für die Zeit-/Preis-Auswahlregel.
  server.registerTool(
    "get_near_relevant_liquidity_levels",
    {
      title: "Relevante Liquidity-Level in der Nähe",
      description:
        `Liquiditäts-Level (1H/4H) aus der liquidity_levels-Tabelle, bereits kuratiert statt roh: ` +
        `bereits GETOUCHTE Level nur, wenn ihr Sweep-Zeitpunkt im Fenster [fromSec, toSec] liegt; ` +
        `noch UNGETOUCHTE Level nur, wenn ihr Preis innerhalb von ${NEAR_RANGE_PIPS} Pips um den ` +
        `Referenzpreis (Kurs "as of" toSec) liegt — Preis-Nähe zählt bei ungetouchten Leveln mehr ` +
        `als Alter, ein Monate alter aber preisnaher Pivot bleibt also drin. Jedes Level trägt ein ` +
        `kontext-Feld wie in get_data_export (z.B. "Asia-High Major (26d)") — Sweep/High/Low ` +
        `steht NICHT im Text (siehe direction/touched-Felder), das ist der Farbe/Position am Chart ` +
        `vorbehalten.`,
      inputSchema: {
        instrument: INSTRUMENT,
        fromSec: z.number().optional().describe("Unix-Sekunden, Fenster-Start für die Touch-Zeit-Filterung. Default: toSec minus 7 Tage."),
        toSec: z
          .number()
          .optional()
          .describe(
            "Unix-Sekunden, Fenster-Ende UND Referenzzeitpunkt für Preis/Sweep-Stand (Backtest/Replay: der simulierte Zeitpunkt). Default: jetzt.",
          ),
      },
    },
    async ({ instrument, fromSec, toSec }) => json(await buildNearRelevantLiquidityLevels({ instrument, fromSec, toSec })),
  );

  server.registerTool(
    "get_trade_setups",
    {
      title: "Trade-Setups",
      description: "Erkannte Trade-Setups (M5 Sweep + Fraktal + OB) aus der trade_setups-Tabelle.",
      inputSchema: { instrument: INSTRUMENT },
    },
    async ({ instrument }) => json(await getTradeSetups(instrument)),
  );

  server.registerTool(
    "get_journal",
    {
      title: "Trade-Journal",
      description: "Einträge aus dem Trade-Journal (trade_positions je Ausführung, inkl. verknüpfter dealing_ranges-Idee mit Zielen, plus Teilausstiege).",
      inputSchema: {
        instrument: INSTRUMENT.optional(),
        source: z.enum(["backtest", "paper", "live"]).optional(),
        limit: z.number().int().positive().max(200).optional(),
      },
    },
    async ({ instrument, source, limit }) => json(await getJournal(instrument, source, limit)),
  );

  server.registerTool(
    "get_news_events",
    {
      title: "News-Events",
      description: "High-Impact News-Events (ForexFactory, manuell erfasst) aus news_events, optional in einem Zeitfenster.",
      inputSchema: {
        fromTime: z.string().optional().describe("ISO-Zeitstempel, untere Grenze (inklusiv)"),
        toTime: z.string().optional().describe("ISO-Zeitstempel, obere Grenze (inklusiv)"),
      },
    },
    async ({ fromTime, toTime }) => json(await getNewsEvents(fromTime, toTime)),
  );

  server.registerTool(
    "get_trading_schedule",
    {
      title: "Handelszeiten",
      description: "Konfigurierte Handels-/Alarmfenster für ein Instrument aus trading_schedules.",
      inputSchema: { instrument: INSTRUMENT },
    },
    async ({ instrument }) => json(await getTradingSchedule(instrument)),
  );

  server.registerTool(
    "get_trading_accounts",
    {
      title: "Trading-Konten",
      description: "Liste der Konten (Demo/Live-Trennung) aus trading_accounts — zum Auflösen von Name -> id für create_trade/update_trade_position.",
      inputSchema: {},
    },
    async () => json(await getTradingAccounts()),
  );

  server.registerTool(
    "get_forex_candles",
    {
      title: "Forex-Kerzen",
      description:
        "Rohkerzen für GBPUSD/EURUSD, automatisch archive-first: liegt der angefragte Bereich im " +
        "persistierten Kerzen-Archiv (aktuell: GBPUSD, 5m/1h/4h, ab 2026-01-01), kommt die Antwort " +
        "von dort — kein cTrader-Call, kein Timeout-Risiko. Nur außerhalb davon (EURUSD, andere " +
        "Timeframes wie z.B. 1m — die liegen NIE im Archiv, siehe get_forex_candles_archive, das nur " +
        "5m/1h/4h führt —, oder der kleine Rest seit dem letzten Backfill-Lauf bis 'jetzt') geht es " +
        "live über die forex-candles Edge Function gegen cTrader (eigener OAuth-Handshake pro Call, " +
        "daher dort gelegentlich träge/timeout-anfällig, ggf. selbst 1-2x wiederholen) — schlägt " +
        "dieser Live-Rest fehl, kommt trotzdem der archivierte Teil zurück statt eines Fehlers. " +
        "Optional `toSec`: liefert die neuesten `count` Kerzen bis zu diesem Zeitpunkt statt bis " +
        "jetzt — damit auch ein historischer Ausschnitt auf NICHT archivierten Timeframes (v.a. M1) " +
        "möglich, ohne extra Skript. get_forex_candles_archive direkt nutzen, wenn ein expliziter " +
        "fromTime/toTime-Bereich gebraucht wird statt 'neueste N bis zu einem Zeitpunkt'.",
      inputSchema: {
        instrument: INSTRUMENT,
        timeframe: z.enum(["1m", "3m", "5m", "15m", "1h", "4h", "1D"]),
        count: z.number().int().positive().max(5000).default(300),
        toSec: z.number().optional().describe("Unix-Sekunden — liefert die neuesten `count` Kerzen bis zu diesem Zeitpunkt statt bis jetzt (für einen historischen Ausschnitt, z.B. auf M1)"),
      },
    },
    async ({ instrument, timeframe, count, toSec }) =>
      json(await fetchForexCandles(instrument, timeframe, { count, toMs: toSec != null ? toSec * 1000 : undefined })),
  );

  server.registerTool(
    "get_forex_candles_archive",
    {
      title: "Forex-Kerzen-Archiv (persistiert)",
      description:
        "Kerzen aus der forex_candles-Tabelle, per Backfill-Script befüllt (siehe " +
        "scripts/backfillForexCandles.ts) — kein OAuth-Handshake, kein Timeout-" +
        "Risiko, beliebig oft wiederholbar. get_forex_candles nutzt intern automatisch dasselbe " +
        "Archiv (archive-first mit Live-Fallback) — DIESES Tool hier nur direkt aufrufen, wenn ein " +
        "EXPLIZITER fromTime/toTime-Bereich gebraucht wird (get_forex_candles kennt nur 'neueste N " +
        "Kerzen bis zu einem Zeitpunkt', keinen Start+Ende-Bereich). Aktuell befüllt: Instrument " +
        "GBPUSD, Timeframes 5m/1h/4h, ab 2026-01-01 (Europe/Berlin) bis zum letzten Backfill-Lauf. " +
        "Für EURUSD, andere Timeframes oder Zeiträume davor liefert dieses Tool ein leeres Array — " +
        "get_forex_candles fängt das für den 'neueste N'-Fall selbst per Live-Fallback ab, hier " +
        "musst du das selbst tun. fromTime/toTime als ISO-Zeitstempel (inklusive Grenzen); ohne " +
        "Angabe die ältesten verfügbaren Kerzen bis zum limit. Praktisch v.a. für historische " +
        "Analysen über mehrere Tage/Wochen (z.B. 'zeig mir alle Order-Blocks der letzten 3 " +
        "Wochen') statt vieler einzelner get_forex_candles-Calls.",
      inputSchema: {
        instrument: INSTRUMENT,
        timeframe: z.enum(["5m", "1h", "4h"]).describe("Nur diese drei sind aktuell befüllt"),
        fromTime: z.string().optional().describe("ISO-Zeitstempel, untere Grenze (inklusiv)"),
        toTime: z.string().optional().describe("ISO-Zeitstempel, obere Grenze (inklusiv)"),
        limit: z.number().int().positive().max(20000).default(5000),
      },
    },
    async ({ instrument, timeframe, fromTime, toTime, limit }) =>
      json(await getForexCandlesArchive(instrument, timeframe, fromTime, toTime, limit)),
  );

  server.registerTool(
    "get_forex_rsi",
    {
      title: "RSI (M5, Forex)",
      description:
        "M5-RSI(14) für GBPUSD/EURUSD (Wilder-Glättung, siehe trading/rsi.md), berechnet aus den " +
        "gleichen Kerzen wie get_forex_candles — kein zusätzlicher Twelve-Data-Request. Gleiche " +
        "dateStr/replayUntilSec-Semantik wie get_data_export: ohne Angabe der aktuelle Tag live, " +
        "mit dateStr ein bestimmter Europe/Berlin-Kalendertag, mit replayUntilSec innerhalb dieses " +
        "Tages nur bis zu diesem Zeitpunkt (Replay-Simulation) — für Vorlauf vor Tagesbeginn holt " +
        "das Tool automatisch zusätzliche Kerzen, damit die RSI-Werte am ersten Punkt des Tages " +
        "schon eingependelt sind. Nur für M5 gedacht, nur um Divergenzen (Kurs vs. RSI) und " +
        "Überkauft/Überverkauft-Zonen zu prüfen — Philip selbst achtet kaum aktiv auf RSI, " +
        "kommentiere ihn nur, wenn er auffällig ist oder stark gegen ein Setup spricht (siehe " +
        "rsi.md 'Philips RSI-Nutzung'). Divergenzen NICHT vorberechnet — vergleiche die " +
        "zurückgegebene series (Kurs+RSI) selbst auf HH/LH bzw. LL/HL an den jeweiligen Swing-" +
        "Punkten.",
      inputSchema: {
        instrument: INSTRUMENT,
        dateStr: z.string().optional().describe("YYYY-MM-DD (Europe/Berlin), Default: heute"),
        replayUntilSec: z.number().optional().describe("Unix-Sekunden — deckt nur bis zu diesem Zeitpunkt auf (Replay-Simulation)"),
        period: z.number().int().positive().default(DEFAULT_RSI_PERIOD).describe("RSI-Periode, Standard 14"),
      },
    },
    async ({ instrument, dateStr, replayUntilSec, period }) => {
      const window = resolveDayWindow(dateStr, replayUntilSec);
      const candles = await fetchM5WithWarmup(instrument, period * RSI_WARMUP_MULTIPLIER, window);
      const points = computeRsi(candles, period).filter((p) => isWithinDayWindow(p.time, window));
      const current = points[points.length - 1];
      return json({
        instrument,
        date: window.effectiveDateStr,
        timezone: "Europe/Berlin",
        replay: replayUntilSec == null ? { active: false } : { active: true, until: replayUntilSec },
        period,
        current: current?.rsi != null ? { time: current.time, close: current.close, rsi: current.rsi, zone: rsiZone(current.rsi) } : null,
        series: points,
      });
    },
  );

  server.registerTool(
    "get_forex_ema",
    {
      title: "EMA 50/200 (M5, Forex)",
      description:
        "M5-EMA(50)/EMA(200) für GBPUSD/EURUSD (siehe trading/ema.md) — nutzt computeEma aus " +
        `src/ema.js, denselben Code wie der Live-Chart-Overlay, mit ${EMA_WARMUP_CANDLES} Kerzen ` +
        "Vorlauf vor Tagesbeginn, bis sich EMA200 eingependelt hat (wie TREND_ANALYSIS_CANDLE_COUNT " +
        "im Frontend). Gleiche dateStr/replayUntilSec-Semantik wie get_data_export/get_forex_rsi: " +
        "ohne Angabe der aktuelle Tag live, mit dateStr ein bestimmter Europe/Berlin-Kalendertag, " +
        "mit replayUntilSec innerhalb dieses Tages nur bis zu diesem Zeitpunkt (Replay-Simulation). " +
        "Laut ema.md NUR grober Trendfilter (Kurs über/unter EMA200 → Bias) und Konsolidierungs-" +
        "warnung (EMA50/EMA200 konvergieren oder kreuzen → Setup meiden) — kein Einstiegssignal, " +
        "nur auf M5 relevant (Konvergenz auf 4H/1H ist KEIN Grund, ein M5-Setup abzulehnen). " +
        "Konvergenz nicht vorberechnet — Abstand ema50 minus ema200 über die series selbst " +
        "beobachten (schrumpfend = Konsolidierungsgefahr).",
      inputSchema: {
        instrument: INSTRUMENT,
        dateStr: z.string().optional().describe("YYYY-MM-DD (Europe/Berlin), Default: heute"),
        replayUntilSec: z.number().optional().describe("Unix-Sekunden — deckt nur bis zu diesem Zeitpunkt auf (Replay-Simulation)"),
      },
    },
    async ({ instrument, dateStr, replayUntilSec }) => {
      const window = resolveDayWindow(dateStr, replayUntilSec);
      const candles = await fetchM5WithWarmup(instrument, EMA_WARMUP_CANDLES, window);
      const ema50 = computeEma(candles, EMA_PERIOD_FAST);
      const ema200 = computeEma(candles, EMA_PERIOD_SLOW);
      const points = candles
        .map((c, i) => ({ time: c.time, close: c.close, ema50: ema50[i].value, ema200: ema200[i].value }))
        .filter((p) => isWithinDayWindow(p.time, window));
      const current = points[points.length - 1];
      return json({
        instrument,
        date: window.effectiveDateStr,
        timezone: "Europe/Berlin",
        replay: replayUntilSec == null ? { active: false } : { active: true, until: replayUntilSec },
        current: current ? { ...current, trendBias: current.close > current.ema200 ? "bullish" : "bearish" } : null,
        series: points,
      });
    },
  );
}
