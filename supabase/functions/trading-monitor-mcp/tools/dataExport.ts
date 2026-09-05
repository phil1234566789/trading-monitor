import { fetchForexCandles, type Candle } from "../forexCandles.ts";
import { berlinDayRangeUtcMs, berlinDateStrFor, berlinDateTimeStrFor, berlinOffsetMinutes } from "../berlinTime.ts";
import { getObZones, getLiquidityLevels, getSessions, getLatestDailyStructureStartTime } from "../db.ts";
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
import { detectLiquidityLevels, filterRelevantLevels, LIQUIDITY_FRACTAL_PERIOD, LIQUIDITY_MAX_RELEVANT } from "../../_shared/liquidityDetection.ts";
import { detectOrderBlocks } from "../orderBlockDetection.js";
import { PIP_SIZE } from "../pipConfig.js";
// Dieselbe Preis-/Zeit-Relevanzlogik wie get_near_relevant_liquidity_levels/get_near_relevant_ob_zones
// (siehe filterRelevantObZoneRows dort) — Bug-Report Philip 2026-08-30: get_data_export gab obZones
// bisher als ROHEN, ungefilterten getObZones-Rückgabewert weiter (216 Zonen über den gesamten
// historischen Bestand statt preisnaher/relevanter), während der neuere near-relevant-Weg fürs
// exakt selbe Problem schon eine geprüfte Lösung hatte — DRY-Fix statt einer zweiten Definition von
// "relevant".
import { filterRelevantObZoneRows } from "./nearRelevantObZones.ts";
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
// export: von recentReactions.ts wiederverwendet (derselbe M5-Kerzenbedarf für dieselbe Erkennung).
export const M5_DETECTION_LOOKBACK_HOURS = 7 * 24;
export const M5_DETECTION_CANDLE_BUFFER = 20;
export const M5_BAR_SECONDS = 300;

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
// Philip 2026-08-30 ("was würdest du sagen auf was reduzieren?"): 4 volle Swings (4x Hoch + 4x
// Tief) reichen für beide tatsächlichen Verwendungen in Schritt 3 — Target-Suche (der jüngste
// untouched Pivot in Trendrichtung steht i.d.R. schon in currRange, die Liste wird nur für den
// Fall gebraucht, dass DER schon touched ist) und die Trend-Kraft-HH/HL- bzw. LH/LL-Sequenz (dafür
// reicht ein paar Swings Kontext). Wird NUR am get_data_export-Rand gekappt (siehe
// capStructurePivots unten), NICHT in summarizeMarketStructureState selbst — das speist auch das
// Debug-Metadata-Panel, wo Philip die volle Historie zum Nachvollziehen braucht.
const STRUCTURE_PIVOTS_MAX_EXPOSED = 8;
// Preis-Radius für die M5-Variante der obZones/liquidityLevels-Relevanzfilterung — enger als die
// 40 Pips für 1H/4H (Philip 2026-08-30: "M5 dann 20 Pips nach oben und unten"), weil M5-Zonen viel
// kleinteiliger/dichter beieinander liegen als HTF-Zonen.
export const M5_OB_RANGE_PIPS = 20;

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
// Bug-Report Philip 2026-08-26, dritte Runde: "Alter bedeutet von Entstehungspunkt bis touched.
// Falls noch nie touched, dann halt eben bis jetzt. Das gilt überall so." — Port von
// ageReferenceTime (src/chartTimeUtils.js), hier dupliziert wie der Rest dieses Moduls.
function ageReferenceTime(touchedTimeSec: number | null, nowSec: number): number {
  return touchedTimeSec ?? nowSec;
}
// Sweep/High/Low-Typtext ist wieder raus (Chat 2026-08-26, zweite Runde: "dann kann das label
// 'sweep|high|low' ja weg" — dasselbe Pendant zu src/liquidity.js: formatLiquidityLevelLabel, siehe
// dortige Begründung). Alter als reines "(3h)" statt "(3h alt)" (dritte Runde desselben Chats).
// touchedTimeSec (vierte Runde) hat Vorrang vor nowSec für Tier UND Alter — ein vor Tagen
// gesweeptes Level soll nicht scheinbar unbegrenzt "älter" werden, nur weil seither Zeit vergeht.
export function formatKontext(bonus: string | null, pivotTimeSec: number, touchedTimeSec: number | null, nowSec: number): string {
  const reference = ageReferenceTime(touchedTimeSec, nowSec);
  const businessSec = businessSecondsBetween(pivotTimeSec, reference);
  const tier = classifyAgeTier(businessSec);
  const tierLabel = tier !== "minor" ? `${tier[0].toUpperCase()}${tier.slice(1)}` : null;
  const age = formatAgeShort(businessSec);
  const ageLabel = age ? `(${age})` : null;
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
// MCP-Server-eigenen forexCandles.ts-Client statt src/forexCandles.js geholt. Gibt zusätzlich zum
// Trend-State das TATSÄCHLICH verwendete Zeitfenster zurück (window) — Philip: "L soll immer den
// Startpunkt des Trend-Algos mit einzeichnen, damit ich abchecken kann, ob das passt, denn was L
// sieht ist ja nicht zwingend dasselbe, was ich im Chart sehe" (2026-07-31). Ohne das hätte L keine
// Möglichkeit, Philip zu zeigen, ab welchem Zeitpunkt sie tatsächlich gerechnet hat.
//
// Default-Startpunkt (Task "Market-Structure-Startpunkt: 1D-Periode-4-Pivots", 2026-08-30):
// destrukturiert `fixedStartActive` bewusst OHNE Default-Wert, um "explizit false" (Philip/Claude
// wollen aktiv das rollierende Lookback-Fenster) von "gar nicht angegeben" (kein Override -> neuer
// 1D-Pivot-Default greift) unterscheiden zu können — ein `= false` an dieser Stelle hätte diese
// Unterscheidung sofort wieder verschluckt.
// Bug-Report Philip 2026-08-30: "unknown" heißt nicht Konsolidierung, sondern nur, dass der
// Algorithmus noch mehr Strukturpunkte braucht, um sich einzupegeln — reine Interna, keine
// brauchbare Info für Lana ("kann damit nichts anfangen, soll auch nicht damit doktern"). Rekursiv,
// weil ein bestätigter Außentrend durchaus einen noch unbestätigten (unknown) Nested-CHoCH-
// Kandidaten tragen kann — der fliegt dann ebenfalls raus, alles darunter ist laut
// advanceNestedTrend (marketStructureAnalysis.ts) ohnehin garantiert null. Bewusst NICHT in
// summarizeMarketStructureState selbst (das speist auch den Debug-Export/das Frontend-Pendant
// unverändert) — nur hier am get_data_export-Rand gefiltert.
function dropUnknownStructureLevels(summarized: ReturnType<typeof summarizeMarketStructureState>): ReturnType<typeof summarizeMarketStructureState> {
  if (!summarized || summarized.trend === "unknown") return null;
  return { ...summarized, nestedTrend: dropUnknownStructureLevels(summarized.nestedTrend) };
}

// Kappt structurePivots je Ebene auf die letzten STRUCTURE_PIVOTS_MAX_EXPOSED (siehe Konstante
// oben) — rekursiv über dieselbe nestedTrend-Kette wie dropUnknownStructureLevels, läuft danach
// (nach dem unknown-Filter), damit eine bereits rausgefilterte Ebene nicht unnötig verarbeitet
// wird. Pivots liegen chronologisch aufsteigend vor (älteste zuerst), .slice(-N) behält also die
// jüngsten.
function capStructurePivots(summarized: ReturnType<typeof summarizeMarketStructureState>): ReturnType<typeof summarizeMarketStructureState> {
  if (!summarized) return null;
  return {
    ...summarized,
    structurePivots: summarized.structurePivots.slice(-STRUCTURE_PIVOTS_MAX_EXPOSED),
    nestedTrend: capStructurePivots(summarized.nestedTrend),
  };
}

// Bug-Report Philip 2026-08-30 (Live-Test mit Lana): Lana ermittelte "seit Fr, 21.08. -> 7 Tage
// Downtrend", die TSC-Anzeige (usePriceChartMarketStructure.js/tradeSetupCockpit.ts:
// computeTrendChain) zeigte für denselben Trend korrekt "4 Tage" — Lana bekam bisher nur den
// rohen Pivot-Zeitstempel (currRange.high/low.pivotAt, ein reiner Unix-Sekunden-STRING ohne
// Wochentag/Alter, siehe pivotForDisplay) und musste sich das Alter selbst ausrechnen, offenbar per
// naiver Kalendertag-Subtraktion statt der im Chart verwendeten wochenend-bereinigten
// businessSecondsBetween. Genau die Art Kopfrechnen, die serverseitig vorberechnet gehört statt
// Lana überlassen zu werden (Vorbild: calc_rr-Tool, siehe CLAUDE.md "Mechanical Subcomputations").
// Port von computeTrendChain/trendOriginPivotTime/formatTrendAge (src/tradeSetupCockpit.ts), hier
// auf der ROHEN (noch nicht pivotForDisplay-bereinigten) state-Kette berechnet, weil dort
// pivotTime noch als Zahl vorliegt — dieselbe Kette wie structure1h/nestedTrend (äußerste bis
// innerste bestätigte Ebene, 'unknown' bereits ausgeschlossen), nur mit fertigem Alter pro Ebene.
const TREND_AGE_DATE_FORMATTER = new Intl.DateTimeFormat("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "Europe/Berlin" });
function trendOriginPivotTime(state: { currRange: { high: { pivotTime?: number | null }; low: { pivotTime?: number | null } } }): number | null {
  const highTime = state.currRange.high.pivotTime ?? null;
  const lowTime = state.currRange.low.pivotTime ?? null;
  if (highTime == null) return lowTime;
  if (lowTime == null) return highTime;
  return Math.min(highTime, lowTime);
}
// "1 Tag"/"4 Tage" wie im TSC (nur ganze Tage, keine Stunden — Philip 2026-08-29: "Die Stunden
// Info interessiert mich nicht"), unter 1 Tag dasselbe "(seit Do, 27.08.)"-Kalenderdatum-Fallback.
function formatTrendAge(seconds: number, originTimeSec: number): string {
  const days = Math.floor(seconds / 86400);
  if (days >= 1) return days === 1 ? "1 Tag" : `${days} Tage`;
  return `(seit ${TREND_AGE_DATE_FORMATTER.format(new Date(originTimeSec * 1000)).replace(".", "")})`;
}
function computeTrendChainAges(
  state: ReturnType<typeof buildMarketStructureState>,
  nowSec: number,
): { trend: "uptrend" | "downtrend"; ageDays: number; ageText: string; originAt: string }[] {
  const chain: { trend: "uptrend" | "downtrend"; ageDays: number; ageText: string; originAt: string }[] = [];
  let s = state;
  while (s && s.trend !== "unknown") {
    const originTime = trendOriginPivotTime(s);
    if (originTime != null) {
      const ageSeconds = businessSecondsBetween(originTime, nowSec);
      chain.push({
        trend: s.trend as "uptrend" | "downtrend",
        ageDays: Math.floor(ageSeconds / 86400),
        ageText: formatTrendAge(ageSeconds, originTime),
        originAt: berlinDateTimeStrFor(originTime),
      });
    }
    s = s.nestedTrend;
  }
  return chain;
}

// Exportiert (statt modul-privat) seit run_bias_check (Schritt 3, siehe tools/biasCheck.ts) —
// wiederverwendet denselben 1H-Structure-Trend statt ihn ein zweites Mal zu berechnen (DRY, siehe
// CLAUDE.md).
export async function compute1hStructureState(instrument: string, currentTimeSec: number, structureConfig: StructureConfig = {}) {
  const {
    periodOuter = STRUCTURE_PERIOD_OUTER,
    periodInner = STRUCTURE_PERIOD_INNER,
    lookbackHoursOuter = STRUCTURE_LOOKBACK_HOURS,
    lookbackHoursInner = STRUCTURE_LOOKBACK_HOURS,
    fixedStartActive,
    fixedStartTime = null,
  } = structureConfig;

  let useFixedStart: boolean;
  let effectiveFixedStartTime: number | null;
  if (fixedStartActive === undefined) {
    // Kein explizites Override -> letzter 1D-Periode-4-Pivot dieses Instruments als Default
    // (siehe daily-structure-pivots/index.ts), Fallback aufs bisherige rollierende Lookback-
    // Fenster, solange für dieses Instrument noch kein aufgelöster Pivot vorliegt.
    effectiveFixedStartTime = await getLatestDailyStructureStartTime(instrument);
    useFixedStart = effectiveFixedStartTime != null;
  } else {
    useFixedStart = fixedStartActive && fixedStartTime != null;
    effectiveFixedStartTime = fixedStartTime;
  }
  const cutoffOuter = useFixedStart ? effectiveFixedStartTime! : currentTimeSec - lookbackHoursOuter * 3600;
  const cutoffInner = useFixedStart ? effectiveFixedStartTime! : currentTimeSec - lookbackHoursInner * 3600;
  const earliestCutoff = Math.min(cutoffOuter, cutoffInner);
  const fetchHours = Math.ceil((currentTimeSec - earliestCutoff) / 3600) + STRUCTURE_CANDLE_BUFFER_HOURS;

  const raw = await fetchForexCandles(instrument, "1h", { count: fetchHours, toMs: currentTimeSec * 1000 });
  const candles = raw.filter((c) => c.time <= currentTimeSec);
  // berlinDateTimeStrFor als formatTime (Bug-Report Philip 2026-08-30, GBPUSD-Backtest bis 08:45):
  // computeRangesPivots hat einen formatTime-Parameter genau für diesen Zweck, der bisher NICHT
  // übergeben wurde — fiel auf den Default (t) => String(t) zurück, ein roher Unix-Sekunden-STRING
  // ohne Wochentag/Uhrzeit. Lana musste sich daraus Alter/Datum selbst herleiten (derselbe
  // Fehlerquell wie beim structureTrendAge-Fix vom selben Tag, siehe Kommentar dort) — pivotAt/
  // touchedAt sind laut pivotForDisplay (marketStructureAnalysis.ts) ohnehin als "die
  // menschenlesbaren" Felder gedacht (pivotTime/touchedTime, die rohen Unix-Werte, werden dort
  // schon bewusst entfernt), nur die MCP-Seite hatte bisher keinen Formatter übergeben.
  const pivotsOuter = computeRangesPivots(candles, periodOuter, cutoffOuter, berlinDateTimeStrFor);
  const pivotsInner = computeRangesPivots(candles, periodInner, cutoffInner, berlinDateTimeStrFor);
  const state = buildMarketStructureState(pivotsOuter, pivotsInner, periodOuter, periodInner, candles);
  return {
    trend: capStructurePivots(dropUnknownStructureLevels(summarizeMarketStructureState(state, { includeAppliedPivots: false }))),
    trendAge: computeTrendChainAges(state, currentTimeSec),
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
// deshalb `nowSec`/`touchedTimeSec` jetzt mit im Spiel (touchedTimeSec hat seit der dritten
// Nachbesserung Vorrang vor nowSec für Tier/Alter, siehe formatKontext).
// candles (optional, oldest-first {time,high,low}): Basis für den echten Session-High/Low je
// Session-Occurrence (siehe sessionOccurrences.js: buildSessionContextLookup/sessionExtremeSuffix)
// — Bug-Report Philip 2026-08-29: ohne Preisvergleich vergab bonusLabelForPivot "Asia-High" allein
// über die Zeitfenster-Zugehörigkeit, auch wenn der Pivot-Preis gar nicht dem tatsächlichen
// Session-Extremwert entsprach. Best-effort: deckt m5CandlesForDetection (7-Tage-M5-Lookback, siehe
// buildDataExport unten) die Occurrence nicht ab (z.B. ein Monate alter, weiterhin unberührter
// 1H-Pivot), bleibt sessionExtremeSuffix beim alten rein zeitfenster-basierten Fallback.
function attachSessionContext<T extends { pivotTimeSec: number; dirNum: 1 | -1; touchedTimeSec: number | null; price: number }>(
  levels: T[],
  sessionConfigs: Awaited<ReturnType<typeof getSessions>>,
  nowSec: number,
  candles: Candle[] = [],
): (T & { context: string | null; kontext: string })[] {
  if (levels.length === 0) return [];
  const rangeStartSec = Math.min(...levels.map((l) => l.pivotTimeSec)) - DAY_SEC;
  const rangeEndSec = Math.max(...levels.map((l) => l.pivotTimeSec)) + DAY_SEC;
  const lookup = buildSessionContextLookup(
    sessionConfigs,
    rangeStartSec,
    rangeEndSec,
    (utcSec: number) => berlinOffsetMinutes(utcSec * 1000),
    candles,
  );
  return levels.map((l) => {
    const bonus = bonusLabelForPivot(l.pivotTimeSec, l.dirNum, l.price, lookup);
    return {
      ...l,
      context: contextForPivot(l.pivotTimeSec, l.dirNum, l.price, lookup),
      kontext: formatKontext(bonus, l.pivotTimeSec, l.touchedTimeSec, nowSec),
    };
  });
}

export interface M5DetectionInputs {
  currentTimeSec: number;
  m5CandlesForDetection: Candle[];
  // 1H/4H liquidity_levels-Zeilen (für coincidesWithHtf-Dedup — ein M5-Level auf demselben Preis
  // wie ein HTF-Level ist redundant, siehe coincidesWithHtf oben).
  htfLiquidityLevels: { price: number; direction: string }[];
  // Bereits persistierte 5M-ob_zones-Zeilen (für m5ObZoneIdByKey — falls eine live erkannte M5-Box
  // schon eine echte id hat, siehe Kommentar unten).
  m5PersistedObZoneRows: { direction: string; start_time: string; id: number }[];
  sessionConfigs: Awaited<ReturnType<typeof getSessions>>;
}

// M5-Sweep/OB-Live-Erkennung, ausgelagert aus buildDataExport (Task "get_recent_reactions", 2026-08-31)
// — dieselbe Erkennung wird jetzt von ZWEI Tools gebraucht (get_data_export UND das neue,
// schlankere get_recent_reactions, siehe recentReactions.ts), DRY statt einer zweiten Kopie. Gibt
// `m5ObZonesAll` bewusst OHNE den abschließenden Preis-Band-Filter zurück (siehe buildDataExport
// unten) — get_recent_reactions filtert stattdessen nach Touch-Rezenz, nicht nach Preisnähe.
export function computeM5LiquidityAndObZones({
  currentTimeSec,
  m5CandlesForDetection,
  htfLiquidityLevels,
  m5PersistedObZoneRows,
  sessionConfigs,
}: M5DetectionInputs) {
  const { highs: m5LiquidityHighs, lows: m5LiquidityLows } = detectLiquidityLevels(m5CandlesForDetection, LIQUIDITY_FRACTAL_PERIOD);
  const m5LiquidityLevelsRaw = [
    ...filterRelevantLevels(m5LiquidityHighs, LIQUIDITY_MAX_RELEVANT, true).map((l) => ({
      direction: "high" as const,
      dirNum: 1 as const,
      price: l.price,
      pivotTimeSec: l.pivotTime,
      touched: l.touched,
      touchedTimeSec: l.touchedTime,
      endTime: l.endTime,
    })),
    ...filterRelevantLevels(m5LiquidityLows, LIQUIDITY_MAX_RELEVANT, true).map((l) => ({
      direction: "low" as const,
      dirNum: -1 as const,
      price: l.price,
      pivotTimeSec: l.pivotTime,
      touched: l.touched,
      touchedTimeSec: l.touchedTime,
      endTime: l.endTime,
    })),
  ];
  // HTF-Level (1H+4H) sind bedeutsamer als ein M5-Level auf demselben Preis — siehe coincidesWithHtf
  // oben. Filter läuft vor attachSessionContext (dort würden ausgefilterte Level unnötig einen
  // Session-Context berechnen).
  const m5LiquidityLevelsDeduped = m5LiquidityLevelsRaw.filter((l) => !coincidesWithHtf(l, htfLiquidityLevels));
  const m5LiquidityLevels = attachSessionContext(m5LiquidityLevelsDeduped, sessionConfigs, currentTimeSec, m5CandlesForDetection).map(
    ({ pivotTimeSec, dirNum: _dirNum, touchedTimeSec, ...rest }) => ({
      ...rest,
      pivotTime: pivotTimeSec,
      touchedTime: touchedTimeSec,
    }),
  );

  // Task "Chart-Objekte: OBs auf kanonische ob_zones-ID konsolidieren", Punkt 8 — m5ObZones bleibt
  // Live-Recompute, aber falls eine der live erkannten M5-Boxen bereits als referenzierte Teilmenge
  // in ob_zones persistiert wurde (Trade-Setup/Pin/Confirmation), bekommt sie hier ihre echte id mit
  // — damit Lana per ID matchen kann (z.B. gegen trade_setups.ob_zone_id oder pin_context), statt
  // über Preisnähe zu raten.
  const m5ObZoneIdByKey = new Map(
    m5PersistedObZoneRows.map((z) => [`${z.direction}_${Math.floor(new Date(z.start_time).getTime() / 1000)}`, z.id]),
  );
  const obZonesReferencePrice = m5CandlesForDetection[m5CandlesForDetection.length - 1]?.close ?? null;
  const m5ObZonesAll = detectOrderBlocks(m5CandlesForDetection, "5m", true)
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
        // Bewusst KEIN Alters-Label (kontext) mehr bei OBs — anders als bei Liquidity-Leveln
        // (Philip 05.09.2026: "bei OBs spielt das Alter eigentlich keine Rolle... sowas wie minor/
        // medium/major gibt's bei OBs nicht"). Stattdessen `retested`: eine getouchte, nicht
        // invalidierte OB zählt erst als Confluence, sobald der Retest nachweislich abgeschlossen
        // ist (siehe orderblöcke.md#retest-status) — unabhängig davon, wie lange das her ist.
        retested: z.retested,
        startTime: z.startTime,
        endTime: z.endTime,
      };
    });

  return { m5LiquidityLevels, m5ObZonesAll, obZonesReferencePrice };
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
  const [raw, m5DetectionRaw, liquidityLevelsRaw, obZonesRaw, structureResult, sessionConfigs] = await Promise.all([
    fetchForexCandles(instrument, "5m", { count: M5_FETCH_COUNT, toMs: endUtcMs }),
    // Eigener, größerer Kerzensatz statt `raw` — 7-Tage-Lookback wie der "Daten-Export"-Button
    // (siehe EXPORT_LOOKBACK_HOURS oben), endet an currentTimeSec statt am Tagesende, damit ein
    // Replay-Zeitpunkt MITTEN im Tag nicht versehentlich schon spätere Kerzen des Tages sieht.
    fetchForexCandles(instrument, "5m", { count: m5DetectionCount, toMs: currentTimeSec * 1000 }),
    getLiquidityLevels(instrument, undefined, false, currentTimeSec),
    // includeAll:true statt false (Bug-Report Philip 2026-08-30, siehe filterRelevantObZoneRows-
    // Import oben) — der volle, Replay-konsistent zurückgerechnete Zeilensatz (auch touched/
    // invalidated), weil filterRelevantObZoneRows unten selbst entscheidet, welche davon relevant
    // sind (u.a. kürzlich getouchte/invalidierte). Der SQL-seitige !includeAll-Filter würde bei
    // aktivem asOfSec ohnehin übersprungen (siehe getObZones/db.ts). Bleibt ungefiltert nach
    // Timeframe (enthält also weiterhin auch etwaige persistierte 5M-Zeilen), siehe
    // m5ObZoneIdByKey unten.
    getObZones(instrument, undefined, true, currentTimeSec),
    compute1hStructureState(instrument, currentTimeSec, structureConfig),
    getSessions(instrument),
  ]);
  // getLiquidityLevels(instrument, undefined, ...) fragt ALLE Timeframes ab, nicht nur 1H/4H — kann
  // dadurch auch vereinzelte persistierte 5M-Zeilen zurückgeben (z.B. von add_trade_confirmation/
  // add_trade_target's find-or-create, siehe findOrCreateLiquidityLevelId in db.ts). coincidesWithHtf
  // unten geht aber explizit von "liquidityLevels = 1H+4H" aus (siehe Kommentar dort) — ohne diesen
  // Filter würde eine SOLCHE 5M-Zeile mit sich selbst "kollidieren" und ihr eigenes live erkanntes
  // M5-Gegenstück aus m5LiquidityLevels rausfiltern, obwohl es gar kein HTF-Level ist. Bug-Beispiel
  // 28.08.2026 (GBPUSD, Backtest bis 08:45): Sweep-Level 1,35946 fehlte dadurch in m5LiquidityLevels,
  // Philip musste es manuell anpinnen, siehe milk-city Task
  // "m5LiquidityLevels liefert bekannten M5-Pivot nicht".
  const liquidityLevels = liquidityLevelsRaw.filter((l) => l.timeframe === "1H" || l.timeframe === "4H");

  const dayCandles = raw.filter((c) => c.time >= startSec && c.time < endSec && (replayUntilSec == null || c.time <= replayUntilSec));
  const asiaCandles = dayCandles.filter((c) => c.time < asiaEndSec);
  const mainCandles = dayCandles.filter((c) => c.time >= asiaEndSec);

  // Nach currentTimeSec gekappt (nicht nur nach Tagesende) — sonst würde Live-Replay Zonen/Level aus
  // der "Zukunft" relativ zum Replay-Punkt sehen, derselbe Bug wie bei liquidityLevels/obZones oben.
  const m5CandlesForDetection = m5DetectionRaw.filter((c) => c.time <= currentTimeSec);
  // M5-Sweep/OB-Rohdaten ausgelagert (computeM5LiquidityAndObZones oben) — wiederverwendet von
  // get_recent_reactions (recentReactions.ts), das dieselbe Erkennung braucht, aber ohne den restlichen
  // Tages-Export (Tageskerzen/1H-Struktur) — DRY statt einer zweiten M5-Erkennungslogik.
  const { m5LiquidityLevels, m5ObZonesAll, obZonesReferencePrice } = computeM5LiquidityAndObZones({
    currentTimeSec,
    m5CandlesForDetection,
    htfLiquidityLevels: liquidityLevels,
    m5PersistedObZoneRows: obZonesRaw.filter((z) => z.timeframe === "5M"),
    sessionConfigs,
  });

  // Preis-/Zeit-gefilterte 1H/4H-Teilmenge (siehe filterRelevantObZoneRows-Import oben) —
  // referencePrice aus derselben m5CandlesForDetection-Reihe wie oben (letzte Kerze <=
  // currentTimeSec), fromSec = dieselbe 7-Tage-Konvention wie der Rest dieses Moduls
  // (M5_DETECTION_LOOKBACK_HOURS). Kombiniert gefiltert (dropLowerTfDuplicateZones in
  // filterRelevantObZoneRows braucht 1H UND 4H zusammen, um 4H-vor-1H-Duplikate zu erkennen), erst
  // danach für die Antwort in zwei saubere Felder gesplittet (Philip 2026-08-30: "Orderblöcke
  // sollen sauber aufgeteilt werden in M5, 1h und 4h").
  const obZonesRelevant = filterRelevantObZoneRows(
    obZonesRaw.filter((z) => z.timeframe === "1H" || z.timeframe === "4H"),
    { referencePrice: obZonesReferencePrice, fromSec: currentTimeSec - M5_DETECTION_LOOKBACK_HOURS * 3600, toSec: currentTimeSec },
  );
  // Kuratierte Form statt roher DB-Zeile (dieselbe Auswahl wie buildNearRelevantObZones' zones —
  // Philip 2026-08-30: poi-watcher-interne Buchhaltung notified/notified_at/created_at/updated_at/
  // alert_price ist für Lanas Analyse irrelevant, siehe get_near_relevant_liquidity_levels für
  // dieselbe Begründung) + start_time/end_time als Unix-Sekunden statt ISO-UTC-String (einheitlich
  // mit m5ObZones/m5LiquidityLevels statt einer zweiten Zeit-Repräsentation im selben Response).
  // Bewusst KEIN Alters-Label (kontext) mehr bei OBs (Philip 05.09.2026: "bei OBs spielt das Alter
  // eigentlich keine Rolle... sowas wie minor/medium/major gibt's bei OBs nicht") — das 2026-08-30
  // eingeführte kontext-Feld ist damit wieder raus, ersetzt durch `retested`: eine getouchte, nicht
  // invalidierte OB zählt erst als Confluence, sobald der Retest nachweislich abgeschlossen ist
  // (späterer Kerzenschluss außerhalb der Zone auf 1H/4H, siehe orderblöcke.md#retest-status) —
  // unabhängig davon, wie lange das her ist.
  function curateObZoneRow(z: (typeof obZonesRelevant)[number]) {
    const startTime = Math.floor(new Date(z.start_time).getTime() / 1000);
    const endTime = z.end_time != null ? Math.floor(new Date(z.end_time).getTime() / 1000) : null;
    return {
      id: z.id,
      timeframe: z.timeframe,
      direction: z.direction,
      top: z.top,
      bottom: z.bottom,
      touched: z.touched,
      invalidated: z.invalidated,
      retested: z.retested,
      startTime,
      endTime,
    };
  }
  const obZones1h = obZonesRelevant.filter((z) => z.timeframe === "1H").map(curateObZoneRow);
  const obZones4h = obZonesRelevant.filter((z) => z.timeframe === "4H").map(curateObZoneRow);

  // M5-Relevanzfilter (Philip 2026-08-30: "Orderblöcke sollen sauber aufgeteilt werden in M5, 1h
  // und 4h. Und davon auch nur relevante") — NUR Preis-Band (M5_OB_RANGE_PIPS), unabhängig vom
  // touched-Status, bewusst OHNE den Zeit-Ausnahme-Zweig, den filterRelevantObZoneRows für 1H/4H
  // nutzt ("getoucht = zeitlich relevant, Preis egal"). Lana-Review 2026-08-30 am Testoutput: mit
  // dem 1H/4H-Zeit-Zweig blieben bei M5 33 von 42 Zonen übrig (nur ~21% Reduktion, u.a. Zonen 70+
  // Pips vom Kurs entfernt, weil sie irgendwann in den letzten 7 Tagen getoucht wurden) — bei M5
  // ist "vor Tagen getoucht" der Normalfall statt eines bedeutsamen Sweeps (jede Zone wird
  // innerhalb weniger Stunden getoucht), anders als bei den wenigen, bedeutsamen 1H/4H-Zonen, für
  // die der Zeit-Zweig gedacht ist. m5ObZonesAll (aus computeM5LiquidityAndObZones oben) ist bereits
  // um invalidierte Zonen bereinigt — get_recent_reactions (recentReactions.ts) nutzt denselben
  // m5ObZonesAll-Rohsatz, filtert aber nach Touch-Rezenz statt Preis-Band.
  const M5_OB_RANGE_PRICE = M5_OB_RANGE_PIPS * PIP_SIZE;
  const m5ObZones = m5ObZonesAll.filter((z) => {
    if (obZonesReferencePrice == null) return false;
    const withinBand = Math.min(Math.abs(z.top - obZonesReferencePrice), Math.abs(z.bottom - obZonesReferencePrice)) <= M5_OB_RANGE_PRICE;
    const priceInsideZone = z.bottom <= obZonesReferencePrice && z.top >= obZonesReferencePrice;
    return withinBand || priceInsideZone;
  });

  // Session-Kontext auch für die persistierten 1H/4H-Level (Philip 2026-08-02: "konsistent halten wo
  // es geht" — der Button gibt ihn für 1h UND 5m, nicht nur 5m). pivot_time kommt als ISO-String aus
  // der DB, direction schon als "high"/"low"-String (anders als bei den live erkannten M5-Leveln).
  // Kuratierte Form + Split in 1h/4h (Philip 2026-08-30, dieselbe Begründung wie obZones oben) —
  // pivotTime/touchedTime als Unix-Sekunden statt der eingangs entfernten ISO-Strings, dieselbe
  // Feldauswahl wie get_near_relevant_liquidity_levels' levels (id/timeframe/direction/price/
  // touched/pivotTime/touchedTime/context/kontext), poi-watcher-interne Buchhaltung raus.
  const liquidityLevelsWithContext = attachSessionContext(
    liquidityLevels
      .map((l) => ({
        ...l,
        pivotTimeSec: Math.floor(new Date(l.pivot_time).getTime() / 1000),
        dirNum: l.direction === "high" ? (1 as const) : (-1 as const),
        touchedTimeSec: l.touched && l.end_time != null ? Math.floor(new Date(l.end_time).getTime() / 1000) : null,
      })),
    sessionConfigs,
    currentTimeSec,
    m5CandlesForDetection,
  ).map(({ pivotTimeSec, dirNum: _dirNum, touchedTimeSec, ...l }) => ({
    id: l.id,
    timeframe: l.timeframe,
    direction: l.direction,
    price: l.price,
    touched: l.touched,
    pivotTime: pivotTimeSec,
    touchedTime: touchedTimeSec,
    context: l.context,
    kontext: l.kontext,
  }));
  const liquidityLevels1h = liquidityLevelsWithContext.filter((l) => l.timeframe === "1H");
  const liquidityLevels4h = liquidityLevelsWithContext.filter((l) => l.timeframe === "4H");

  return {
    instrument,
    date: effectiveDateStr,
    timezone: "Europe/Berlin",
    replay: replayUntilSec == null ? { active: false } : { active: true, until: replayUntilSec },
    structure1h: structureResult.trend,
    // Fertiges, wochenend-bereinigtes Alter je Ebene der structure1h-Kette (äußerste bis innerste
    // bestätigte Ebene) — siehe computeTrendChainAges oben. IMMER diese Werte für "seit wann läuft
    // der Trend"/"wie alt" nutzen, NIE selbst aus currRange.*.pivotAt zurückrechnen (seit dem
    // formatTime-Fix oben ein Berlin-formatierter String, aber weiterhin ohne Wochenend-Bereinigung
    // — eine naive Kalendertag-Subtraktion daraus liefert dasselbe falsche Alter wie zuvor).
    structureTrendAge: structureResult.trendAge,
    // Siehe compute1hStructureState oben: der tatsächlich verwendete Cutoff (Outer/Inner-Fenster).
    structureWindow: structureResult.window,
    liquidityLevels1h,
    liquidityLevels4h,
    obZones1h,
    obZones4h,
    // Live erkannt, 7-Tage-Lookback (siehe m5CandlesForDetection oben) — nicht aus der DB, es gibt
    // dafür keine Backend-Persistierung.
    m5LiquidityLevels,
    m5ObZones,
    // Nur Range (rangeHigh/rangeLow), keine rohen Kerzen mehr (Philip 2026-08-30: "asiasession.candles
    // kann raus") — 03-htf-bias.md prüft ohnehin nur rangeHigh/rangeLow gegen, die 84 rohen M5-Kerzen
    // waren größter Einzelposten ohne dokumentierten Verwendungszweck über die Range hinaus.
    asiaSession: rangeStats(asiaCandles),
    candles: mainCandles,
  };
}
