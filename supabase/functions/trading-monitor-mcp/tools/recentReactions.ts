import { z } from "npm:zod@3.24.1";
import type { McpServer } from "npm:@modelcontextprotocol/sdk@^1.12.0/server/mcp.js";
import { berlinDateTimeStrFor } from "../berlinTime.ts";
import { fetchForexCandles } from "../forexCandles.ts";
import { getLiquidityLevels, getObZones, getSessions } from "../db.ts";
import { buildNearRelevantLiquidityLevels } from "./nearRelevantLiquidityLevels.ts";
import { buildNearRelevantObZones } from "./nearRelevantObZones.ts";
import { computeM5LiquidityAndObZones, M5_DETECTION_LOOKBACK_HOURS, M5_DETECTION_CANDLE_BUFFER, M5_BAR_SECONDS } from "./dataExport.ts";

function json(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

// get_recent_reactions (Pflichtprüfung 00-trading-steps/05-dealing-range-bestaetigen.md, 2026-08-31)
// — Philip: "die letzten LQ-Sweeps (alle TFs) prüfen, die letzten OBs (alle TFs) prüfen, prüfen ob
// diese für den Analysezeitpunkt irgendeine Aussage haben (Fall 1/2/3/4)" soll bei JEDEM vollen
// Schritt-5-Durchlauf laufen, nicht nur bei Verdacht — dafür reicht get_data_snapshot nicht (kein
// M5) und get_data_export ist zu teuer (voller Tages-Export inkl. 1H-Struktur/Tageskerzen, nur um an
// m5LiquidityLevels/m5ObZones ranzukommen). "sweeps" allein wäre als Name schief gewesen (Philip,
// 2026-08-31) — das Tool liefert auch OB-Reaktionen (Test/Invalidierung), nicht nur Liquiditäts-
// Sweeps, daher "reactions" als Oberbegriff für beides. Dieses Tool bündelt NUR "was wurde kürzlich
// gesweept/getestet, alle Timeframes, beide Richtungen" — 1H/4H über die bereits vorhandenen
// buildNearRelevantLiquidityLevels/buildNearRelevantObZones (schon touched-zeitfenster-basiert,
// siehe dort), M5 über dieselbe Erkennung wie get_data_export (computeM5LiquidityAndObZones,
// dataExport.ts) — hier aber ohne Tageskerzen/1H-Struktur-Ballast. "Relevant" heißt hier bewusst nur
// zeitliche Rezenz (`lookbackHours`) — OB der Sweep noch HÄLT (Preis seither nicht zurückerobert),
// muss Lana selbst gegen den aktuellen Kurs prüfen, das gehört nicht in dieses schlanke Tool.
const DEFAULT_LOOKBACK_HOURS = 24;
const OB_RANGE_PIPS = 40;

export interface RecentReactionsArgs {
  instrument: string;
  replayUntilSec?: number;
  lookbackHours?: number;
}

export async function buildRecentReactions({ instrument, replayUntilSec, lookbackHours = DEFAULT_LOOKBACK_HOURS }: RecentReactionsArgs) {
  const currentTimeSec = replayUntilSec ?? Math.floor(Date.now() / 1000);
  const fromSec = currentTimeSec - lookbackHours * 3600;
  const m5DetectionCount = Math.ceil((M5_DETECTION_LOOKBACK_HOURS * 3600) / M5_BAR_SECONDS) + M5_DETECTION_CANDLE_BUFFER;

  const [liquidity1h4h, obZones1h4h, m5DetectionRaw, liquidityLevelsRaw, m5PersistedObZoneRows, sessionConfigs] = await Promise.all([
    buildNearRelevantLiquidityLevels({ instrument, fromSec, toSec: currentTimeSec }),
    buildNearRelevantObZones({ instrument, fromSec, toSec: currentTimeSec, rangePips: OB_RANGE_PIPS }),
    // Derselbe 7-Tage-M5-Kerzenbedarf wie get_data_export (siehe computeM5LiquidityAndObZones) —
    // nötig für die Fraktal-Erkennung selbst, unabhängig vom kürzeren lookbackHours-Filter unten.
    fetchForexCandles(instrument, "5m", { count: m5DetectionCount, toMs: currentTimeSec * 1000 }),
    getLiquidityLevels(instrument, undefined, false, currentTimeSec),
    getObZones(instrument, "5M", true, currentTimeSec),
    getSessions(instrument),
  ]);

  const htfLiquidityLevels = liquidityLevelsRaw.filter((l) => l.timeframe === "1H" || l.timeframe === "4H");
  const m5CandlesForDetection = m5DetectionRaw.filter((c) => c.time <= currentTimeSec);
  const { m5LiquidityLevels, m5ObZonesAll } = computeM5LiquidityAndObZones({
    currentTimeSec,
    m5CandlesForDetection,
    htfLiquidityLevels,
    m5PersistedObZoneRows,
    sessionConfigs,
  });

  // Nur SWEEPS (touched=true), alle Timeframes, beide Richtungen, sortiert nach Sweep-Zeitpunkt
  // (jüngster zuerst) — 1H/4H sind über buildNearRelevantLiquidityLevels' fromSec/toSec bereits auf
  // das Fenster begrenzt, M5 kommt ungefiltert (7-Tage-Fenster) zurück und wird hier zusätzlich auf
  // dasselbe lookbackHours-Fenster eingegrenzt.
  const liquiditySweeps = [
    ...liquidity1h4h.levels.filter((l) => l.touched),
    ...m5LiquidityLevels.filter((l) => l.touched && l.touchedTime != null && l.touchedTime >= fromSec).map((l) => ({ ...l, timeframe: "5M" as const })),
  ].sort((a, b) => (b.touchedTime ?? 0) - (a.touchedTime ?? 0));

  // Nur Reaktionen (touched ODER invalidated), analog zu liquiditySweeps.
  const obReactions = [
    ...obZones1h4h.zones.filter((z) => z.touched || z.invalidated),
    ...m5ObZonesAll.filter((z) => z.touched && z.endTime != null && z.endTime >= fromSec).map((z) => ({ ...z, timeframe: "5M" as const })),
  ].sort((a, b) => (b.endTime ?? 0) - (a.endTime ?? 0));

  return {
    instrument,
    asOf: { sec: currentTimeSec, at: berlinDateTimeStrFor(currentTimeSec), timezone: "Europe/Berlin" },
    replay: replayUntilSec == null ? { active: false } : { active: true, until: replayUntilSec },
    lookbackHours,
    referencePrice: liquidity1h4h.referencePrice,
    liquiditySweeps,
    obReactions,
  };
}

export function registerRecentReactionsTools(server: McpServer) {
  server.registerTool(
    "get_recent_reactions",
    {
      title: "Kürzliche LQ-Sweeps/OB-Reaktionen (alle Timeframes)",
      description:
        "Pflichtprüfung für Schritt 5 (Dealing Range bestätigen, siehe 00-trading-steps/05-dealing-range-" +
        "bestaetigen.md) — liefert ALLE kürzlich gesweepten Liquiditäts-Level UND ALLE kürzlich " +
        "getesteten/invalidierten OB-Zonen, über 1H/4H/M5 hinweg, BEIDE Richtungen (bullisch UND " +
        "bärisch), sortiert nach Zeitpunkt (jüngster zuerst). Bei JEDEM vollen Schritt-5-Durchlauf " +
        "aufrufen, nicht nur bei Verdacht — auch bei einem direkten Replay-Einstieg mitten am Tag " +
        "(z.B. 16:30), damit ein Sweep von vor 30 Minuten nicht übersehen wird, nur weil man die " +
        "auslösende Kerze nicht live gesehen hat. Schlanker als get_data_export (kein Tages-" +
        "Kerzenverlauf, keine 1H-Struktur) — genau auf 'was ist kürzlich passiert' zugeschnitten. " +
        "`touched`/`invalidated` zeigen NUR, dass der Sweep/die Reaktion passiert ist — ob er/sie " +
        "noch HÄLT (Preis seither nicht zurückerobert/erneut durchbrochen) musst du selbst gegen den " +
        "aktuellen Kurs prüfen, das liefert dieses Tool bewusst nicht vorberechnet. `lookbackHours` " +
        "(Default 24) gilt für 1H/4H/M5 gleichermaßen.",
      inputSchema: {
        instrument: z.enum(["GBPUSD", "EURUSD"]).describe("Forex-Instrument"),
        replayUntilSec: z.number().optional().describe("Unix-Sekunden — Backtest/Replay-Zeitpunkt statt live 'jetzt'"),
        lookbackHours: z.number().positive().optional().describe("Wie weit zurück nach Sweeps/Reaktionen gesucht wird (Default 24h)"),
      },
    },
    async ({ instrument, replayUntilSec, lookbackHours }) => json(await buildRecentReactions({ instrument, replayUntilSec, lookbackHours })),
  );
}
