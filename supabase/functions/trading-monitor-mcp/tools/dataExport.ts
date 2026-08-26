import { fetchForexCandles, type Candle } from "../forexCandles.ts";
import { berlinDayRangeUtcMs, berlinDateStrFor, berlinDateTimeStrFor, berlinOffsetMinutes } from "../berlinTime.ts";
import { getObZones, getLiquidityLevels, getSessions } from "../db.ts";
// Reine Trend-Mathematik (siehe CLAUDE.md "MCP-Server") — seit dem Split von marketStructureAnalysis.ts
// (Chat 2026-07-31, Rendering lebt jetzt separat in marketStructureRendering.ts) frei von Browser-
// Abhängigkeiten und direkt aus dem Frontend-Quellbaum importierbar, kein dritter Algorithmus-Port.
import { computeRangesPivots, buildMarketStructureState, summarizeMarketStructureState } from "../marketStructureAnalysis.ts";
// M5-Liquidity/M5-OB werden von KEINEM Backend persistiert (poi-watcher speichert liquidity_levels
// nur 1H, ob_zones nur 1H/4H, siehe CLAUDE.md poi-watcher-Throttling) — Lana bekam sie bisher gar
// nicht (Bug-Report Philip 2026-08-02: "Lana braucht mehr Daten ... M5 LQ-Levels/M5 OBs genau die
// ich auch habe im Chart"). Statt einer eigenen Backend-Persistierung (widerspräche der bewussten
// "M5 ist nur für Trade-Setups"-Architektur) live neu erkannt — identischer Algorithmus UND
// identisches 7-Tage-Lookback-Fenster wie der "Daten-Export"-Button (src/dataExport.js,
// EXPORT_LOOKBACK_HOURS), siehe CLAUDE.md "MCP-Server" zum selben Cross-Directory-Import-Muster
// (marketStructureAnalysis.js oben). detectLiquidityLevels lebt schon dependency-frei in
// liquidityDetection.js; detectOrderBlocks wurde für diesen Zweck neu nach orderBlockDetection.js
// extrahiert (aus orderBlocks.js, das über chartColors.js/chartZoom.js Browser-Only-Imports zieht).
import { detectLiquidityLevels, filterRelevantLevels, LIQUIDITY_FRACTAL_PERIOD, LIQUIDITY_MAX_RELEVANT } from "../liquidityDetection.js";
import { detectOrderBlocks } from "../orderBlockDetection.js";
import { PIP_SIZE } from "../pipConfig.js";
// Session-Kontext ("asia high" etc., siehe src/dataExport.js) — sessionOccurrences.js ist seit
// Chat 2026-08-02 dependency-frei (aus sessions.js extrahiert, dessen `sessions`-Singleton
// localStorage anfasst), deshalb direkt cross-directory importierbar wie oben.
import { buildSessionContextLookup, contextForPivot, bonusLabelForPivot } from "../sessionOccurrences.js";

// Asia-Session laut Philip: 00:00-07:00 Europe/Berlin, separat ausgewertet — siehe
// src/dataExport.js ASIA_SESSION_END_HOUR (dieselbe Konvention, hier dupliziert statt importiert,
// siehe CLAUDE.md "MCP-Server" für die Begründung).
const ASIA_SESSION_END_HOUR = 7;
const M5_FETCH_COUNT = 300;
const DAY_SEC = 24 * 3600;

// Exakt dieselben Werte wie src/dataExport.js (EXPORT_LOOKBACK_HOURS/EXPORT_CANDLE_BUFFER) — Philip
// 2026-08-02: "lieber konsistent halten wo es geht" statt des ursprünglich kürzeren (~25h) Fensters,
// das nur an der ohnehin schon geladenen Tages-Kerzenreihe (`raw` unten) mitgeschnitten hatte.
const M5_DETECTION_LOOKBACK_HOURS = 7 * 24;
const M5_DETECTION_CANDLE_BUFFER = 20;
const M5_BAR_SECONDS = 300;

// periodOuter/periodInner sind weiterhin exakt wie im "Daten-Export"-Button (src/dataExport.js).
// lookbackHours dagegen ist seit Chat 2026-08-09 auf Philips Wunsch bewusst LÄNGER als der Button
// (dessen STRUCTURE_LOOKBACK_HOURS bleibt bei 7 Tagen) — ein zu kurzes Fenster ließ mehrstufig
// verschachtelte Trends (siehe marketStructureAnalysis.rules.md, "beliebige Verschachtelungstiefe")
// beim Laniakea-Backtest gar nicht erst entstehen, weil der Ursprung der äußersten Ebene oft schon
// außerhalb von 7 Tagen liegt. Philips TATSÄCHLICH im Dashboard eingestellte Werte (falls
// abweichend, z.B. "fixer Start") leben nur in seinem Browser-localStorage (siehe CLAUDE.md-Notiz)
// — dafür nimmt get_data_export optionale structureConfig-Parameter entgegen, die L bei Bedarf von
// Philip erfragen kann, statt sie zu erraten.
const STRUCTURE_PERIOD_OUTER = 5;
const STRUCTURE_PERIOD_INNER = 2;
const STRUCTURE_LOOKBACK_HOURS = 21 * 24;
const STRUCTURE_CANDLE_BUFFER_HOURS = 40;

// Chat 2026-08-26, Philip: ein live erkanntes M5-Level auf demselben Preis wie ein 1H/4H-Level
// ist für Lana redundant — das HTF-Level ist bedeutsamer (Frontend-Pendant: siehe
// mergeDbLiquidityLevels in src/priceChartLiquidity.js, dieselbe Begründung/Epsilon dort).
const SAME_PRICE_EPSILON = 0.05 * PIP_SIZE;
function coincidesWithHtf(level: { price: number; direction: "high" | "low" }, htfLevels: { price: number; direction: string }[]): boolean {
  return htfLevels.some((h) => h.direction === level.direction && Math.abs(h.price - level.price) <= SAME_PRICE_EPSILON);
}

// Chat 2026-08-26, Philip: "kontext"-Feld an jedem LQ-Level für Lana — dieselbe Label-Formel wie am
// Chart (src/liquidity.js: formatLiquidityLevelLabel), hier dupliziert wie der Rest dieses Moduls
// (siehe CLAUDE.md "MCP-Server"; businessSecondsBetween/formatAgeShort sind Ports von
// src/chartTimeUtils.js, die Tier-Grenzen von src/ageTier.ts — nicht cross-importiert, da Deno beim
// Deploy nur den eigenen Ordner bündelt, ein Import über supabase/functions/trading-monitor-mcp/
// hinaus würde fehlschlagen, siehe computeRangesPivots oben für den etablierten "lokale Kopie"-Weg).
const KONTEXT_DAY_SECONDS = 24 * 3600;
const KONTEXT_WEEK_SECONDS = 7 * KONTEXT_DAY_SECONDS;
function classifyAgeTier(businessSeconds: number): "minor" | "medium" | "major" {
  if (businessSeconds < KONTEXT_DAY_SECONDS) return "minor";
  if (businessSeconds <= KONTEXT_WEEK_SECONDS) return "medium";
  return "major";
}
function businessSecondsBetween(startSec: number, endSec: number): number {
  if (endSec == null || startSec == null || endSec <= startSec) return 0;
  const DAY = 86400;
  let total = 0;
  let cursor = startSec;
  while (cursor < endSec) {
    const dayStart = Math.floor(cursor / DAY) * DAY;
    const segmentEnd = Math.min(dayStart + DAY, endSec);
    const isWeekend = [0, 6].includes(new Date(dayStart * 1000).getUTCDay());
    if (!isWeekend) total += segmentEnd - cursor;
    cursor = segmentEnd;
  }
  return total;
}
function formatAgeShort(seconds: number): string | null {
  if (seconds < 0) return null;
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  return `${minutes}m`;
}
// Sweep/High/Low-Typtext ist wieder raus (Chat 2026-08-26, zweite Runde: "dann kann das label
// 'sweep|high|low' ja weg" — dasselbe Pendant zu src/liquidity.js: formatLiquidityLevelLabel, siehe
// dortige Begründung). dirNum/touched deshalb keine Parameter mehr hier.
export function formatKontext(bonus: string | null, pivotTimeSec: number, nowSec: number): string {
  const businessSec = businessSecondsBetween(pivotTimeSec, nowSec);
  const tier = classifyAgeTier(businessSec);
  const tierLabel = tier !== "minor" ? `${tier[0].toUpperCase()}${tier.slice(1)}` : null;
  const age = formatAgeShort(businessSec);
  const ageLabel = age ? `(${age} alt)` : null;
  return [bonus, tierLabel, ageLabel].filter((p): p is string => p != null && p !== "").join(" ");
}

function rangeStats(rawCandles: Candle[]) {
  if (rawCandles.length === 0) return { rangeHigh: null, rangeLow: null };
  const rangeHigh = Math.max(...rawCandles.map((c) => c.high));
  const rangeLow = Math.min(...rawCandles.map((c) => c.low));
  return { rangeHigh, rangeLow };
}

export interface StructureConfig {
  periodOuter?: number;
  periodInner?: number;
  lookbackHoursOuter?: number;
  lookbackHoursInner?: number;
  fixedStartActive?: boolean;
  fixedStartTime?: number | null;
}

// Port von compute1hStructureState (src/dataExport.js) — identische Logik, nur candles über den
// mcp-server-eigenen forexCandles.ts-Client statt src/forexCandles.js geholt. Gibt zusätzlich zum
// Trend-State das TATSÄCHLICH verwendete Zeitfenster zurück (window) — Philip: "L soll immer den
// Startpunkt des Trend-Algos mit einzeichnen, damit ich abchecken kann, ob das passt, denn was L
// sieht ist ja nicht zwingend dasselbe, was ich im Chart sehe" (2026-07-31). Ohne das hätte L keine
// Möglichkeit, Philip zu zeigen, ab welchem Zeitpunkt sie tatsächlich gerechnet hat.
async function compute1hStructureState(instrument: string, currentTimeSec: number, structureConfig: StructureConfig = {}) {
  const {
    periodOuter = STRUCTURE_PERIOD_OUTER,
    periodInner = STRUCTURE_PERIOD_INNER,
    lookbackHoursOuter = STRUCTURE_LOOKBACK_HOURS,
    lookbackHoursInner = STRUCTURE_LOOKBACK_HOURS,
    fixedStartActive = false,
    fixedStartTime = null,
  } = structureConfig;

  const useFixedStart = fixedStartActive && fixedStartTime != null;
  const cutoffOuter = useFixedStart ? fixedStartTime : currentTimeSec - lookbackHoursOuter * 3600;
  const cutoffInner = useFixedStart ? fixedStartTime : currentTimeSec - lookbackHoursInner * 3600;
  const earliestCutoff = Math.min(cutoffOuter, cutoffInner);
  const fetchHours = Math.ceil((currentTimeSec - earliestCutoff) / 3600) + STRUCTURE_CANDLE_BUFFER_HOURS;

  const raw = await fetchForexCandles(instrument, "1h", { count: fetchHours, toMs: currentTimeSec * 1000 });
  const candles = raw.filter((c) => c.time <= currentTimeSec);
  const pivotsOuter = computeRangesPivots(candles, periodOuter, cutoffOuter);
  const pivotsInner = computeRangesPivots(candles, periodInner, cutoffInner);
  const state = buildMarketStructureState(pivotsOuter, pivotsInner, periodOuter, periodInner, candles);
  return {
    trend: summarizeMarketStructureState(state, { includeAppliedPivots: false }),
    window: {
      periodOuter,
      periodInner,
      fixedStartActive: useFixedStart,
      cutoffOuter,
      cutoffOuterAt: berlinDateTimeStrFor(cutoffOuter),
      cutoffInner,
      cutoffInnerAt: berlinDateTimeStrFor(cutoffInner),
    },
  };
}

export interface DataExportArgs {
  instrument: string;
  dateStr?: string;
  replayUntilSec?: number;
  structureConfig?: StructureConfig;
}

// Haupt-Einstiegspunkt für Claude (siehe CLAUDE.md "MCP-Server") — bündelt M5-Kerzen des Tages +
// Asia-Session-Range, relevante Liquidity-Level, relevante OB-Zonen UND den 1H-Structure-Trend in
// einem Call, damit Claude sich nicht erst durch mehrere Einzel-Tools hangeln muss.
// Hängt an jedes Level ein `context`-Feld ("asia high" o.ä., siehe sessionOccurrences.js) —
// Zeitfenster wird aus den Pivot-Zeitpunkten der Level SELBST abgeleitet (±1 Tag Puffer), nicht aus
// einem extern mitgegebenen Kerzenfenster, damit auch ein Monate alter, weiterhin unberührter Pivot
// (siehe [[project_liquidity_levels_history_gap]]) noch einen korrekten Kontext bekommt.
// Chat 2026-08-26, Philip: zusätzlich ein `kontext`-Feld (siehe formatKontext oben) — dieselbe
// Session-Lookup-Berechnung wird für beide Felder wiederverwendet statt sie zweimal aufzubauen,
// deshalb `nowSec` jetzt mit im Spiel.
function attachSessionContext<T extends { pivotTimeSec: number; dirNum: 1 | -1 }>(
  levels: T[],
  sessionConfigs: Awaited<ReturnType<typeof getSessions>>,
  nowSec: number,
): (T & { context: string | null; kontext: string })[] {
  if (levels.length === 0) return [];
  const rangeStartSec = Math.min(...levels.map((l) => l.pivotTimeSec)) - DAY_SEC;
  const rangeEndSec = Math.max(...levels.map((l) => l.pivotTimeSec)) + DAY_SEC;
  const lookup = buildSessionContextLookup(sessionConfigs, rangeStartSec, rangeEndSec, (utcSec: number) => berlinOffsetMinutes(utcSec * 1000));
  return levels.map((l) => {
    const bonus = bonusLabelForPivot(l.pivotTimeSec, l.dirNum, lookup);
    return {
      ...l,
      context: contextForPivot(l.pivotTimeSec, l.dirNum, lookup),
      kontext: formatKontext(bonus, l.pivotTimeSec, nowSec),
    };
  });
}

export async function buildDataExport({ instrument, dateStr, replayUntilSec, structureConfig }: DataExportArgs) {
  const effectiveDateStr = dateStr ?? berlinDateStrFor(replayUntilSec ?? Math.floor(Date.now() / 1000));
  const { startUtcMs, endUtcMs } = berlinDayRangeUtcMs(effectiveDateStr);
  const startSec = startUtcMs / 1000;
  const endSec = endUtcMs / 1000;
  const asiaEndSec = startSec + ASIA_SESSION_END_HOUR * 3600;
  // "Aktuelle Zeit" aus Sicht dieses Snapshots — bei aktivem Replay der simulierte Zeitpunkt, sonst
  // die echte Wanduhrzeit (analog src/dataExport.js currentTimeSec).
  const currentTimeSec = replayUntilSec ?? Math.floor(Date.now() / 1000);
  const m5DetectionCount = Math.ceil((M5_DETECTION_LOOKBACK_HOURS * 3600) / M5_BAR_SECONDS) + M5_DETECTION_CANDLE_BUFFER;

  // getLiquidityLevels/getObZones bekommen currentTimeSec als asOfSec, damit im Replay der
  // Sweep-Stand "as of Replay-Zeitpunkt" rauskommt statt des aktuellen Live-Stands (siehe db.ts
  // applyAsOf/applyAsOfZones) — sonst sind spätere Sweeps (nach dem Replay-Punkt) schon "verbraucht"
  // und verdrängen per RECENT_SWEEP_COUNT genau die Level/Zonen, die zum Analysezeitpunkt noch
  // relevant/unberührt waren (Bug-Report Lana 2026-08-02 für obZones).
  const [raw, m5DetectionRaw, liquidityLevels, obZones, structureResult, sessionConfigs] = await Promise.all([
    fetchForexCandles(instrument, "5m", { count: M5_FETCH_COUNT, toMs: endUtcMs }),
    // Eigener, größerer Kerzensatz statt `raw` — 7-Tage-Lookback wie der "Daten-Export"-Button
    // (siehe EXPORT_LOOKBACK_HOURS oben), endet an currentTimeSec statt am Tagesende, damit ein
    // Replay-Zeitpunkt MITTEN im Tag nicht versehentlich schon spätere Kerzen des Tages sieht.
    fetchForexCandles(instrument, "5m", { count: m5DetectionCount, toMs: currentTimeSec * 1000 }),
    getLiquidityLevels(instrument, undefined, false, currentTimeSec),
    getObZones(instrument, undefined, false, currentTimeSec),
    compute1hStructureState(instrument, currentTimeSec, structureConfig),
    getSessions(instrument),
  ]);

  const dayCandles = raw.filter((c) => c.time >= startSec && c.time < endSec && (replayUntilSec == null || c.time <= replayUntilSec));
  const asiaCandles = dayCandles.filter((c) => c.time < asiaEndSec);
  const mainCandles = dayCandles.filter((c) => c.time >= asiaEndSec);

  // Nach currentTimeSec gekappt (nicht nur nach Tagesende) — sonst würde Live-Replay Zonen/Level aus
  // der "Zukunft" relativ zum Replay-Punkt sehen, derselbe Bug wie bei liquidityLevels/obZones oben.
  const m5CandlesForDetection = m5DetectionRaw.filter((c) => c.time <= currentTimeSec);
  const { highs: m5LiquidityHighs, lows: m5LiquidityLows } = detectLiquidityLevels(m5CandlesForDetection, LIQUIDITY_FRACTAL_PERIOD);
  const m5LiquidityLevelsRaw = [
    ...filterRelevantLevels(m5LiquidityHighs, LIQUIDITY_MAX_RELEVANT, true).map((l) => ({
      direction: "high" as const,
      dirNum: 1 as const,
      price: l.price,
      pivotTimeSec: l.pivotTime,
      touched: l.touched,
      touchedTime: l.touchedTime,
      endTime: l.endTime,
    })),
    ...filterRelevantLevels(m5LiquidityLows, LIQUIDITY_MAX_RELEVANT, true).map((l) => ({
      direction: "low" as const,
      dirNum: -1 as const,
      price: l.price,
      pivotTimeSec: l.pivotTime,
      touched: l.touched,
      touchedTime: l.touchedTime,
      endTime: l.endTime,
    })),
  ];
  // HTF-Level (liquidityLevels, 1H+4H) sind bedeutsamer als ein M5-Level auf demselben Preis —
  // siehe coincidesWithHtf oben. Filter läuft vor attachSessionContext (dort würden ausgefilterte
  // Level unnötig einen Session-Context berechnen).
  const m5LiquidityLevelsDeduped = m5LiquidityLevelsRaw.filter((l) => !coincidesWithHtf(l, liquidityLevels));
  const m5LiquidityLevels = attachSessionContext(m5LiquidityLevelsDeduped, sessionConfigs, currentTimeSec).map(
    ({ pivotTimeSec, dirNum: _dirNum, ...rest }) => ({
      ...rest,
      pivotTime: pivotTimeSec,
    }),
  );

  // Task "Chart-Objekte: OBs auf kanonische ob_zones-ID konsolidieren", Punkt 8 — m5ObZones bleibt
  // Live-Recompute (siehe Kommentar unten), aber falls eine der live erkannten M5-Boxen bereits als
  // referenzierte Teilmenge in ob_zones persistiert wurde (Trade-Setup/Pin/Confirmation, siehe
  // PLAN-chart-objekte-forex.md Abschnitt 5), bekommt sie hier ihre echte id mit — damit Lana per
  // ID matchen kann (z.B. gegen trade_setups.ob_zone_id oder pin_context), statt über Preisnähe zu
  // raten. obZones oben ist bereits ungefiltert nach Timeframe geholt (getObZones ohne timeframe-
  // Arg), enthält also auch etwaige persistierte 5M-Zeilen mit — kein zweiter DB-Call nötig.
  const m5ObZoneIdByKey = new Map(
    obZones.filter((z) => z.timeframe === "5M").map((z) => [`${z.direction}_${Math.floor(new Date(z.start_time).getTime() / 1000)}`, z.id]),
  );
  // .filter(!invalidated) analog zu collectObsZones (PriceChart.vue) — invalidierte Zonen werden
  // im Chart standardmäßig auch nicht mehr angezeigt.
  const m5ObZones = detectOrderBlocks(m5CandlesForDetection, "5m", true)
    .filter((z) => !z.invalidated)
    .map((z) => {
      const direction = z.dir === 1 ? ("long" as const) : ("short" as const);
      return {
        id: m5ObZoneIdByKey.get(`${direction}_${z.startTime}`) ?? null,
        direction,
        top: z.top,
        bottom: z.bottom,
        weak: z.weak,
        touched: z.touched,
        startTime: z.startTime,
        endTime: z.endTime,
      };
    });

  // Session-Kontext auch für die persistierten 1H-Level (Philip 2026-08-02: "konsistent halten wo
  // es geht" — der Button gibt ihn für 1h UND 5m, nicht nur 5m). pivot_time kommt als ISO-String aus
  // der DB, direction schon als "high"/"low"-String (anders als bei den live erkannten M5-Leveln).
  const liquidityLevelsWithContext = attachSessionContext(
    liquidityLevels.map((l) => ({ ...l, pivotTimeSec: Math.floor(new Date(l.pivot_time).getTime() / 1000), dirNum: l.direction === "high" ? (1 as const) : (-1 as const) })),
    sessionConfigs,
    currentTimeSec,
  ).map(({ pivotTimeSec: _pivotTimeSec, dirNum: _dirNum, ...rest }) => rest);

  return {
    instrument,
    date: effectiveDateStr,
    timezone: "Europe/Berlin",
    replay: replayUntilSec == null ? { active: false } : { active: true, until: replayUntilSec },
    structure1h: structureResult.trend,
    // Siehe compute1hStructureState oben: der tatsächlich verwendete Cutoff, damit L ihn immer als
    // Marker/Linie einzeichnen kann (post_chart_annotations) — Philips Sichtkontrolle gegen den
    // eigenen Chart.
    structureWindow: structureResult.window,
    liquidityLevels: liquidityLevelsWithContext,
    obZones,
    // Live erkannt, 7-Tage-Lookback (siehe m5CandlesForDetection oben) — nicht aus der DB, es gibt
    // dafür keine Backend-Persistierung.
    m5LiquidityLevels,
    m5ObZones,
    asiaSession: { ...rangeStats(asiaCandles), candles: asiaCandles },
    candles: mainCandles,
  };
}
