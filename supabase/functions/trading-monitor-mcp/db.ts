import { supabase } from "./supabaseClient.ts";
import { PIP_SIZE } from "./pipConfig.js";

// Dünne Supabase-Query-Helfer, von den Tools in ./tools/*.ts genutzt. Tabellenformen siehe
// supabase/migrations/*.sql (ob_zones, liquidity_levels, trade_setups, dealing_ranges,
// trade_positions, trade_targets, trade_partial_exits, news_events, trading_schedules,
// claude_annotations) — alle mit anon-select-RLS, siehe CLAUDE.md "MCP-Server".

// Analog zu applyAsOf unten für liquidity_levels, aber für ob_zones: end_time ist hier der
// deterministische Zeitpunkt, an dem die Zone entweder touched ODER invalidated wurde (siehe
// detectOrderBlocks in _shared/orderBlocks.ts — waechst mit jeder Kerze, friert bei einem der
// beiden Ereignisse ein). Ein Pivot/eine Zone, deren start_time NACH asOfSec liegt, existierte zu
// diesem Zeitpunkt noch nicht; touched/invalidated werden zurückgesetzt, wenn end_time NACH
// asOfSec liegt (das Ereignis war aus Sicht des Replay-Zeitpunkts noch nicht passiert). Bug-Report
// Lana 2026-08-02: get_data_export zeigte Zonen mit start_time NACH dem Replay-Cutoff (z.B.
// 2026-07-31T17:00 bei einem 08:00-Cutoff) — derselbe Live-statt-as-of-Bug wie zuvor bei
// liquidityLevels.
function applyAsOfZones<T extends { start_time: string; touched: boolean; invalidated: boolean; end_time: string | null }>(
  rows: T[],
  asOfSec: number | undefined,
): T[] {
  if (asOfSec == null) return rows;
  return rows
    .filter((r) => new Date(r.start_time).getTime() / 1000 <= asOfSec)
    .map((r) => {
      if ((r.touched || r.invalidated) && r.end_time != null && new Date(r.end_time).getTime() / 1000 > asOfSec) {
        return { ...r, touched: false, invalidated: false, end_time: null };
      }
      return r;
    });
}

export async function getObZones(instrument: string, timeframe?: string, includeAll = false, asOfSec?: number) {
  let query = supabase.from("ob_zones").select("*").eq("instrument", instrument).order("start_time", { ascending: true });
  if (timeframe) query = query.eq("timeframe", timeframe);
  // Der SQL-seitige !includeAll-Filter arbeitet auf dem LIVE-Stand von touched/invalidated — bei
  // aktivem asOfSec brauchen wir stattdessen den vollen Zeilensatz, rechnen erst in JS auf den
  // Replay-Zeitpunkt zurück und filtern danach (sonst würden Zonen, die erst NACH dem Replay-Punkt
  // touched/invalidated wurden, hier schon in Postgres fälschlich rausfallen).
  if (!includeAll && asOfSec == null) query = query.eq("invalidated", false).eq("touched", false);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  let rows = applyAsOfZones(data ?? [], asOfSec);
  if (!includeAll && asOfSec != null) rows = rows.filter((r) => !r.invalidated && !r.touched);
  return rows;
}

const LIQUIDITY_MAX_RELEVANT = 10; // siehe src/liquidity.js LIQUIDITY_MAX_RELEVANT
const RECENT_SWEEP_COUNT = 2; // siehe src/liquidity.js RECENT_SWEEP_COUNT

// Port von filterRelevantLevels (src/liquidityDetection.js) auf DB-Zeilen statt In-Memory-
// Detektionsobjekten — gleiche Auswahl-Logik (neuestes Level, unberührte Level, RECENT_SWEEP_COUNT
// zuletzt gesweepte, insgesamt max. maxRelevant), damit "relevant" hier dasselbe bedeutet wie im
// Live-Chart. rows müssen chronologisch aufsteigend (älteste zuerst) sortiert sein, wie levels in
// liquidityDetection.js.
//
// Task "Chart-Objekte: OBs auf kanonische ob_zones-ID konsolidieren", Punkt 13 — currentPrice/
// priceThreshold (optional, Default null = unverändertes Verhalten) für dasselbe dritte
// Relevanz-Kriterium wie im Frontend (filterRelevantLevels): ein berührtes Level bleibt auch
// relevant, wenn es aktuell in Preis-Reichweite liegt, unabhängig davon wie lange der Sweep her
// ist. Bewusst noch nicht in getLiquidityLevels/get_data_export verdrahtet — "aktueller Preis"
// bräuchte dort eine eigene, Replay-konsistente Herleitung, die dieser Task nicht abdeckt; die
// Signatur ist aber schon bereit dafür.
function filterRelevantRows<T extends { touched: boolean; end_time: string | null; price: number }>(
  rows: T[],
  maxRelevant: number,
  currentPrice: number | null = null,
  priceThreshold: number | null = null,
): T[] {
  const n = rows.length;
  if (n === 0) return [];
  const newestActive = !rows[n - 1].touched;

  const recentSweepIdx = new Set<number>();
  rows
    .map((r, i) => ({ i, t: r.touched ? r.end_time : null }))
    .filter((x): x is { i: number; t: string } => x.t != null)
    .sort((a, b) => (a.t < b.t ? 1 : -1))
    .slice(0, RECENT_SWEEP_COUNT)
    .forEach((x) => recentSweepIdx.add(x.i));

  const result: T[] = [];
  let relevantCount = 0;
  for (let i = n - 1; i >= 0; i--) {
    const row = rows[i];
    const isNewest = newestActive && i === n - 1;
    const isRecentSweep = recentSweepIdx.has(i);
    const isPriceRelevant = currentPrice != null && priceThreshold != null && Math.abs(row.price - currentPrice) <= priceThreshold;
    if (isNewest || !row.touched || isRecentSweep || isPriceRelevant) {
      if (relevantCount < maxRelevant) result.push(row);
      relevantCount += 1;
    }
  }
  return result;
}

// Rekonstruiert den Stand "as of asOfSec" statt des Live-Stands von jetzt: ein Pivot, der erst NACH
// asOfSec entstanden ist, existierte zu diesem Zeitpunkt noch nicht (raus); ein Level, das laut DB
// zwar "touched" ist, dessen end_time aber NACH asOfSec liegt, war zu diesem Zeitpunkt noch
// unberührt (touched/end_time zurück auf false/null) — sonst sieht ein Replay-Snapshot Sweeps, die
// aus Sicht der simulierten Zeit noch gar nicht passiert sind. Bug-Report Philip 2026-08-02: beim
// Backtesten von historischen Setups zeigte get_data_export den AKTUELLEN Live-Sweep-Stand
// (inkl. Sweeps von nach dem Replay-Zeitpunkt) statt des Stands zum Replay-Zeitpunkt — dadurch
// fielen für den Analysezeitpunkt relevante, damals noch unberührte Level durch den
// RECENT_SWEEP_COUNT-Filter, weil sie inzwischen (nach dem Replay-Punkt) längst gesweept wurden.
function applyAsOf<T extends { pivot_time: string; touched: boolean; end_time: string | null }>(
  rows: T[],
  asOfSec: number | undefined,
): T[] {
  if (asOfSec == null) return rows;
  return rows
    .filter((r) => new Date(r.pivot_time).getTime() / 1000 <= asOfSec)
    .map((r) => {
      if (r.touched && r.end_time != null && new Date(r.end_time).getTime() / 1000 > asOfSec) {
        return { ...r, touched: false, end_time: null };
      }
      return r;
    });
}

// Chat 2026-08-26, Philip: "liegt ein 4H LQ-Level auf demselben Preis wie ein 1H-Level, gewinnt das
// 4H-Level, das 1H-Level kann raus" — analog zur selben Rangfolge im Frontend
// (src/priceChartLiquidity.js: computeHtfLiquidityLevels/HTF_TIMEFRAME_PRIORITY), gleiches Epsilon
// gegen Float-Differenzen. rows sind hier bereits nach EINER Richtung gefiltert (highs bzw. lows).
const SAME_PRICE_EPSILON = 0.05 * PIP_SIZE;
function dropLowerTfDuplicates<T extends { price: number; timeframe: string }>(rows: T[]): T[] {
  const htfRows = rows.filter((r) => r.timeframe === "4H");
  return rows.filter((r) => r.timeframe !== "1H" || !htfRows.some((h) => Math.abs(h.price - r.price) <= SAME_PRICE_EPSILON));
}

export async function getLiquidityLevels(instrument: string, timeframe?: string, includeAll = false, asOfSec?: number) {
  let query = supabase
    .from("liquidity_levels")
    .select("*")
    .eq("instrument", instrument)
    .order("pivot_time", { ascending: true });
  if (timeframe) query = query.eq("timeframe", timeframe);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = applyAsOf(data ?? [], asOfSec);
  if (includeAll) return rows;
  const highs = dropLowerTfDuplicates(filterRelevantRows(rows.filter((r) => r.direction === "high"), LIQUIDITY_MAX_RELEVANT));
  const lows = dropLowerTfDuplicates(filterRelevantRows(rows.filter((r) => r.direction === "low"), LIQUIDITY_MAX_RELEVANT));
  return [...highs, ...lows];
}

export async function getTradeSetups(instrument: string) {
  const { data, error } = await supabase
    .from("trade_setups")
    .select("*")
    .eq("instrument", instrument)
    .order("fractal_pivot_time", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

// Trade-Journal: seit 2026-07-31 aufgeteilt in dealing_ranges (die Idee: instrument/direction/
// invalidation/trade_setup_id, gilt für 1-n Ausführungen) und trade_positions (die einzelne
// Ausführung: entry/exit/outcome/reasoning) — siehe CLAUDE.md-Abschnitt zum Trade-Journal.
// instrument/direction sitzen jetzt auf dealing_ranges, deshalb !inner (sonst kann PostgREST auf
// dem eingebetteten Feld nicht filtern) plus trade_targets gleich mit eingebettet, weil die
// ebenfalls an dealing_ranges statt an der Ausführung hängen.
export async function getJournal(instrument?: string, source?: string, limit = 50) {
  let query = supabase
    .from("trade_positions")
    .select("*, dealing_ranges!inner(instrument, direction, invalidation, trade_setup_id, lesson_dealing_range_id, setup_type, trade_targets(id, price)), trade_partial_exits(price, exit_time, portion_pct)")
    .order("triggered_at", { ascending: false })
    .limit(limit);
  if (instrument) query = query.eq("dealing_ranges.instrument", instrument);
  if (source) query = query.eq("source", source);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

// Pin-Kontext (Chat 2026-08-01, siehe supabase/migrations/20260801120000_laniakea_context.sql,
// 20260801130000_laniakea_context_ob_zones.sql, 20260801140000_laniakea_context_trade_setups.sql,
// 20260801150000_laniakea_context_trade_confirmations.sql — Migrationsdateien behalten ihren
// historischen Namen, siehe 20260817120000_rename_laniakea_context_to_pin_context.sql für den Rename
// auf DB-Ebene; src/pinContext.js):
// trade_positions, ob_zones, trade_setups ODER trade_evidence, die Philip per Rechtsklick "an
// Lana übergeben" hat (kind unterscheidet, welches der vier embeds befüllt ist — bei z.B. einer
// trade_position-Zeile sind die übrigen drei null und umgekehrt, kein zusätzlicher Filter nötig,
// PostgREST liefert einfach null fürs nicht zutreffende Embed). Kein Snapshot in der Tabelle
// selbst — derselbe Embed-Shape wie getJournal (trade_positions.* + dealing_ranges + trade_targets/
// trade_partial_exits) für trade_position, volle Zeile für die übrigen drei — damit Lana beim
// Fetch immer die aktuellen Werte sieht statt eines möglicherweise veralteten Stands.
export async function getPinContext() {
  const { data, error } = await supabase
    .from("pin_context")
    .select(
      "id, kind, note, created_at, " +
        "trade_positions(*, dealing_ranges!inner(instrument, direction, invalidation, trade_setup_id, lesson_dealing_range_id, setup_type, trade_targets(id, price)), trade_partial_exits(price, exit_time, portion_pct)), " +
        "ob_zones(*), " +
        "trade_setups(*), " +
        "trade_evidence(*), " +
        "liquidity_levels(*), " +
        // m5_liquidity_*/rsi_divergence_* sitzen direkt auf pin_context selbst (kein Embed, siehe
        // 20260802130000_laniakea_context_m5_liquidity.sql / 20260811170000_laniakea_context_rsi_divergence.sql
        // — beide nie persistiert, deshalb Rohdaten-Snapshot statt FK), müssen deshalb hier
        // explizit mit ausgewählt werden. kind='m5_ob' nutzt seit Punkt 6 (Migration
        // 20260823120000) dieselbe ob_zones(*)-Embed wie 1H/4H, kein Snapshot mehr.
        "m5_liquidity_instrument, m5_liquidity_timeframe, m5_liquidity_direction, m5_liquidity_price, m5_liquidity_pivot_time, " +
        "rsi_divergence_instrument, rsi_divergence_type, rsi_divergence_from_time, rsi_divergence_to_time, " +
        "rsi_divergence_from_price, rsi_divergence_to_price, rsi_divergence_from_rsi, rsi_divergence_to_rsi",
    )
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

// Schreib-Pendant zu getPinContext (Chat 2026-08-17: Lana darf Chart-POIs jetzt selbst pinnen,
// vorher read-only) — spiegelt addPinEntry/addPinM5ObEntry/addPinM5LiquidityEntry/
// addPinRsiDivergenceEntry/removePinEntry aus src/pinContext.js 1:1 (Upsert-Keys/onConflict
// identisch, siehe dort), nur mit throw statt console.error+null (Konvention dieser Datei, siehe
// createTrade/postChartAnnotations oben) und dem hiesigen supabaseClient.ts statt dem
// Browser-Client. `.select()` bewusst schmal (nur Bestätigungs-Felder) statt getPinContext's
// vollem Embed-Shape — der Rückgabewert dient nur der Rückmeldung an Lana, kein Re-Fetch-Ersatz.
// Bewusst NUR die Chart-POI-Kinds (ob_zone/liquidity_level/trade_setup/m5_ob/m5_liquidity_level/
// rsi_divergence) — trade_position/trade_confirmation bleiben Philip-only (Journal-Einträge, kein
// Chart-Highlight), siehe Task "Pin-Kontext: MCP-Write, fehlende Chart-Highlights, Touch-Alarm".
const PIN_CONFIRM_COLUMNS = "id, kind, note, created_at";
const PIN_REF_COLUMN: Record<string, string> = {
  ob_zone: "ob_zone_id",
  trade_setup: "trade_setup_id",
  liquidity_level: "liquidity_level_id",
};

export async function addPinEntry(kind: "ob_zone" | "trade_setup" | "liquidity_level", refId: number, note?: string) {
  const column = PIN_REF_COLUMN[kind];
  const { data, error } = await supabase
    .from("pin_context")
    .upsert(
      {
        kind,
        trade_position_id: null,
        ob_zone_id: null,
        trade_setup_id: null,
        trade_confirmation_id: null,
        liquidity_level_id: null,
        [column]: refId,
        note: note || null,
      },
      { onConflict: column },
    )
    .select(PIN_CONFIRM_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export interface PinM5Ob {
  instrument: string;
  direction: "long" | "short";
  top: number;
  bottom: number;
  startTimeUnixSec: number;
}

// Task "Chart-Objekte: OBs auf kanonische ob_zones-ID konsolidieren", Punkt 6 — Deno-seitiges
// Pendant zu src/tradeIntake.js: findOrCreateObZoneId (Browser). M5-OBs werden von poi-watcher nie
// live erkannt/persistiert (siehe PLAN-chart-objekte-forex.md Abschnitt 5), deshalb hier ein
// normaler Upsert (kein ignoreDuplicates, damit .select() bei bereits vorhandenem Konflikt
// trotzdem die id liefert) statt eines reinen Lookups.
async function findOrCreateObZoneId(instrument: string, timeframe: string, direction: string, top: number, bottom: number, startTimeSec: number) {
  const { data, error } = await supabase
    .from("ob_zones")
    .upsert(
      { instrument, timeframe, direction, top, bottom, start_time: new Date(startTimeSec * 1000).toISOString() },
      { onConflict: "instrument,timeframe,start_time,direction" },
    )
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as number;
}

// Analoges Gegenstück zu findOrCreateObZoneId, für kind='pivot'-Targets/Bestätigungen (Task
// "1H-Struktur-Pivots auf kanonische liquidity_levels-ID konsolidieren", 2026-08-24/25). Ein
// structure1h-Pivot (marketStructureAnalysis.ts) hat oft keine eigene liquidity_levels-Zeile —
// poi-watchers Fraktal-Erkennung läuft unabhängig davon und findet nicht zwangsläufig denselben
// Preispunkt. Nutzt denselben unique(instrument,timeframe,direction,pivot_time)-Constraint wie
// poi-watcher selbst (Migration 20260715120000) — trifft der Upsert auf einen bereits von
// poi-watcher erkannten Pivot, wird dessen Zeile wiederverwendet (keine Dopplung), sonst neu
// angelegt. timeframe ist '1H'/'4H' oder seit Migration 20260827120000 auch '5M' (M5-Sweep-
// Bestätigung/-Target, siehe src/tradeIntake.js: findOrCreateLiquidityLevelId, dieselbe Formel) —
// Guard hier nachgezogen (fehlte bisher nur in dieser Deno-Kopie), sonst würde ein Fremd-Timeframe
// den liquidity_levels-Check-Constraint verletzen statt sauber null zurückzugeben.
async function findOrCreateLiquidityLevelId(instrument: string, timeframe: string, direction: string, price: number, pivotTimeSec: number) {
  if (timeframe !== "1H" && timeframe !== "4H" && timeframe !== "5M") return null;
  const { data, error } = await supabase
    .from("liquidity_levels")
    .upsert(
      { instrument, timeframe, direction, price, pivot_time: new Date(pivotTimeSec * 1000).toISOString() },
      { onConflict: "instrument,timeframe,direction,pivot_time" },
    )
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as number;
}

// Landet seit Punkt 6 als ganz normaler kind='ob_zone'-Pin (find-or-create in ob_zones, dann
// addPinEntry) statt eines eigenen m5_ob-Rohdaten-Snapshots — Signatur bleibt unverändert, damit
// pins.ts (add_pin_entry-Tool, Lanas stabiles Interface) nicht angepasst werden muss.
export async function addPinM5ObEntry(zone: PinM5Ob, note?: string) {
  const obZoneId = await findOrCreateObZoneId(zone.instrument, "5M", zone.direction, zone.top, zone.bottom, zone.startTimeUnixSec);
  return addPinEntry("ob_zone", obZoneId, note);
}

export interface PinM5Liquidity {
  instrument: string;
  timeframe: string;
  direction: "high" | "low";
  price: number;
  pivotTimeUnixSec: number;
}

export async function addPinM5LiquidityEntry(level: PinM5Liquidity, note?: string) {
  const { data, error } = await supabase
    .from("pin_context")
    .upsert(
      {
        kind: "m5_liquidity_level",
        trade_position_id: null,
        ob_zone_id: null,
        trade_setup_id: null,
        trade_confirmation_id: null,
        liquidity_level_id: null,
        m5_liquidity_instrument: level.instrument,
        m5_liquidity_timeframe: level.timeframe,
        m5_liquidity_direction: level.direction,
        m5_liquidity_price: level.price,
        m5_liquidity_pivot_time: new Date(level.pivotTimeUnixSec * 1000).toISOString(),
        note: note || null,
      },
      { onConflict: "m5_liquidity_instrument,m5_liquidity_timeframe,m5_liquidity_direction,m5_liquidity_pivot_time" },
    )
    .select(PIN_CONFIRM_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export interface PinRsiDivergence {
  type: "bearish" | "bullish";
  fromTimeUnixSec: number;
  toTimeUnixSec: number;
  fromPrice: number;
  toPrice: number;
  fromRsi: number;
  toRsi: number;
}

export async function addPinRsiDivergenceEntry(instrument: string, divergence: PinRsiDivergence, note?: string) {
  const { data, error } = await supabase
    .from("pin_context")
    .upsert(
      {
        kind: "rsi_divergence",
        trade_position_id: null,
        ob_zone_id: null,
        trade_setup_id: null,
        trade_confirmation_id: null,
        liquidity_level_id: null,
        rsi_divergence_instrument: instrument,
        rsi_divergence_type: divergence.type,
        rsi_divergence_from_time: new Date(divergence.fromTimeUnixSec * 1000).toISOString(),
        rsi_divergence_to_time: new Date(divergence.toTimeUnixSec * 1000).toISOString(),
        rsi_divergence_from_price: divergence.fromPrice,
        rsi_divergence_to_price: divergence.toPrice,
        rsi_divergence_from_rsi: divergence.fromRsi,
        rsi_divergence_to_rsi: divergence.toRsi,
        note: note || null,
      },
      { onConflict: "rsi_divergence_instrument,rsi_divergence_type,rsi_divergence_from_time,rsi_divergence_to_time" },
    )
    .select(PIN_CONFIRM_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function removePinEntry(id: number) {
  const { error } = await supabase.from("pin_context").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// Supabase/PostgREST deckelt eine einzelne Response serverseitig bei diesem Wert (empirisch
// bestätigt beim Bau von backfillObZones.ts UND src/forexCandles.js) — unabhängig davon, wie groß
// .limit() angefragt wird. Ein `limit` über 1000 hier würde sonst still nur die ersten 1000 Zeilen
// liefern statt eines Fehlers.
const DB_READ_PAGE_SIZE = 1000;

// Liest aus der forex_candles-Tabelle (Backfill 2026-08-09, siehe Migration
// 20260809120000_forex_candles.sql + scripts/backfillForexCandles.ts) statt einem
// Live-cTrader-Request — kein Timeout-Risiko, aber nur für den tatsächlich befüllten Bereich
// nutzbar (aktuell: GBPUSD, 5m/1h/4h, ab 2026-01-01). Rückgabeform exakt wie
// fetchForexCandles/get_forex_candles ({time,open,high,low,close,volume}, time in Unix-Sekunden,
// oldest-first) — time kommt aus Postgres als timestamptz-String zurück, hier zurückgerechnet,
// damit ein Aufrufer nicht zwischen "Live" und "Archiv" unterscheiden muss. Paginiert in
// DB_READ_PAGE_SIZE-Schritten (siehe oben) statt eines einzelnen großen .limit(limit).
export async function getForexCandlesArchive(instrument: string, bar: string, fromTime?: string, toTime?: string, limit = 5000) {
  const rows: { time: string; open: number; high: number; low: number; close: number; volume: number }[] = [];
  let cursor = fromTime;
  let inclusive = true;
  while (rows.length < limit) {
    const pageLimit = Math.min(DB_READ_PAGE_SIZE, limit - rows.length);
    let query = supabase
      .from("forex_candles")
      .select("time, open, high, low, close, volume")
      .eq("instrument", instrument)
      .eq("bar", bar)
      .order("time", { ascending: true })
      .limit(pageLimit);
    if (cursor) query = inclusive ? query.gte("time", cursor) : query.gt("time", cursor);
    if (toTime) query = query.lte("time", toTime);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < pageLimit) break; // ehrlich weniger Kerzen im Zeitraum als angefragt, fertig
    cursor = data[data.length - 1].time; // jüngstes in dieser Seite (data ist asc sortiert)
    inclusive = false;
  }
  return rows.map((r) => ({
    time: Math.floor(new Date(r.time).getTime() / 1000),
    open: r.open,
    high: r.high,
    low: r.low,
    close: r.close,
    volume: r.volume,
  }));
}

// Pendant zu getForexCandlesArchive oben, aber "neueste `count` Kerzen bis (inklusive) toIso"
// statt "ab fromTime aufsteigend" — das ist die Form, die forexCandles.ts's fetchForexCandles
// braucht (siehe dort), um transparent archive-first zu werden: absteigend paginiert, dann
// umgedreht. Bug-Report Philip 2026-08-10: get_data_export versuchte für ein GBPUSD-Datum
// mitten im archivierten Bereich (03.06.2026) trotzdem live cTrader (3× Timeout) und musste sich
// selbst mit get_forex_candles_archive behelfen — dataExport.ts/indicatorWindow.ts riefen bisher
// ausschließlich das rohe, live-only fetchForexCandles auf, das neue get_forex_candles_archive-
// Tool war nur eine ZUSÄTZLICHE Option, kein automatischer Ersatz. Null nur, wenn wirklich nichts
// im Archiv gefunden wurde (Signal: live fetchen).
export async function getForexCandlesArchiveUpTo(instrument: string, bar: string, count: number, toIso: string) {
  const rows: { time: string; open: number; high: number; low: number; close: number; volume: number }[] = [];
  let boundary = toIso;
  let inclusive = true;
  while (rows.length < count) {
    const pageLimit = Math.min(DB_READ_PAGE_SIZE, count - rows.length);
    let query = supabase
      .from("forex_candles")
      .select("time, open, high, low, close, volume")
      .eq("instrument", instrument)
      .eq("bar", bar)
      .order("time", { ascending: false })
      .limit(pageLimit);
    query = inclusive ? query.lte("time", boundary) : query.lt("time", boundary);
    const { data, error } = await query;
    if (error) {
      console.error("Kerzen-Archiv lesen fehlgeschlagen, falle auf Live-cTrader zurück:", error.message);
      break;
    }
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < pageLimit) break;
    boundary = data[data.length - 1].time;
    inclusive = false;
  }
  if (rows.length === 0) return null;
  return rows.reverse().map((r) => ({
    time: Math.floor(new Date(r.time).getTime() / 1000),
    open: r.open,
    high: r.high,
    low: r.low,
    close: r.close,
    volume: r.volume,
  }));
}

export async function getNewsEvents(fromTime?: string, toTime?: string) {
  let query = supabase.from("news_events").select("*").order("event_time", { ascending: true });
  if (fromTime) query = query.gte("event_time", fromTime);
  if (toTime) query = query.lte("event_time", toTime);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

// Nur für den Session-Kontext an LQ-Leveln in get_data_export (siehe tools/dataExport.ts,
// sessionOccurrences.js's buildSessionContextLookup) — Node-sicherer Direkt-Read statt src/
// sessions.js (dessen `sessions`-Singleton beim Modul-Laden localStorage anfasst, siehe CLAUDE.md
// "MCP-Server"). Nur highLowRelevant-Sessions sind für den Kontext überhaupt relevant (siehe
// buildSessionContextLookup selbst), aber hier ungefiltert zurückgegeben (dieselbe Spaltenauswahl
// wie sessions.js' eigener syncFromRemote) — der Filter passiert im Aufrufer, näher an der
// eigentlichen Verwendung.
export async function getSessions(instrument: string) {
  const { data, error } = await supabase
    .from("sessions")
    .select("label, from_minutes, to_minutes, high_low_relevant, days")
    .eq("instrument", instrument);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    label: r.label as string | null,
    fromMinutes: r.from_minutes as number,
    toMinutes: r.to_minutes as number,
    highLowRelevant: r.high_low_relevant as boolean,
    days: r.days as number[] | null,
  }));
}

export async function getTradingSchedule(instrument: string) {
  const { data, error } = await supabase.from("trading_schedules").select("*").eq("instrument", instrument).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

// Insert-Form exakt wie src/claudeAnnotationsStore.js:23-34 (addClaudeAnnotationDrawing) —
// dieselbe Tabelle/Spalten, damit eine per MCP geschriebene Zeichnung sich für den Rest der App
// (Chart, ClaudeAnnotationsModal) nicht von einer manuell gepasteten unterscheidet.
export async function postChartAnnotations(instrument: string, date: string, annotations: unknown[], title?: string) {
  const { data, error } = await supabase
    .from("claude_annotations")
    .insert({ instrument, date, annotations, title })
    .select("id, instrument, date, title, annotations, visible, created_at")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

// Nur zum Auflösen "welches Konto" beim Trade-Anlegen (Philip nennt einen Namen, kein rohes ID) —
// siehe trading_accounts (20260730130000_trading_accounts.sql), volles anon-CRUD dort.
export async function getTradingAccounts() {
  const { data, error } = await supabase.from("trading_accounts").select("id, name, notes").order("name");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export interface TradePositionInput {
  source: "backtest" | "paper" | "live";
  entryPrice?: number | null;
  stopLoss?: number | null;
  triggeredAt?: string | null;
  reasoning?: string | null;
  outcome?: "win" | "loss" | "open" | null;
  rMultiple?: number | null;
  exitPrice?: number | null;
  exitTime?: string | null;
  tradingAccountId?: number | null;
  zoneId?: number | null;
  // Broker-Ausführungsdetails (Chat 2026-07-31, siehe Migration
  // 20260731210000_trade_positions_size_pl_commission.sql) — vorher zweckentfremdet im
  // reasoning-Freitext eingetragen ("Menge 0,5, Netto P/L $27.00").
  size?: number | null;
  netPl?: number | null;
  commission?: number | null;
}

// Gemeinsamer Insert-Kern für create_trade (neue Idee + erste Ausführung) UND add_trade_position
// (eine WEITERE Ausführung auf eine bereits bestehende Idee, z.B. Re-Entry/nachgezogener Einstieg) —
// Philip 2026-07-31: "es gibt ja auch dealing ranges, wo ich keinen entry finde oder meine Limit
// Order nicht abgeholt wird" — kommt also oft genug vor, um ein eigenes Tool zu rechtfertigen, statt
// nur über create_trade (das würde fälschlich eine zweite, unabhängige Idee anlegen) zu gehen.
async function insertTradePosition(dealingRangeId: number, fields: TradePositionInput) {
  const { data, error } = await supabase
    .from("trade_positions")
    .insert({
      dealing_range_id: dealingRangeId,
      source: fields.source,
      entry_price: fields.entryPrice ?? null,
      stop_loss: fields.stopLoss ?? null,
      ...(fields.triggeredAt ? { triggered_at: fields.triggeredAt } : {}),
      reasoning: fields.reasoning ?? null,
      outcome: fields.outcome ?? null,
      r_multiple: fields.rMultiple ?? null,
      exit_price: fields.exitPrice ?? null,
      exit_time: fields.exitTime ?? null,
      trading_account_id: fields.tradingAccountId ?? null,
      zone_id: fields.zoneId ?? null,
      size: fields.size ?? null,
      net_pl: fields.netPl ?? null,
      commission: fields.commission ?? null,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

// Fügt eine weitere Ausführung zu einer BEREITS BESTEHENDEN dealing_range hinzu (Re-Entry, oder
// erster tatsächlicher Fill nach einer zunächst nicht abgeholten Limit-Order) — dealingRangeId
// referenziert die Idee, die im Chart/Journal z.B. als "Long#18" durchnummeriert auftaucht.
export async function addTradePosition(dealingRangeId: number, fields: TradePositionInput) {
  return insertTradePosition(dealingRangeId, fields);
}

export interface CreateTradeArgs extends TradePositionInput {
  instrument: string;
  direction: "long" | "short";
  invalidation?: number | null;
  tradeSetupId?: number | null;
  targets?: {
    price: number;
    rangeLow?: number | null;
    rangeHigh?: number | null;
    instrument?: string;
    timeframe?: string;
    direction?: "high" | "low";
  }[];
}

// Legt die "Trade Entity" an, die Philip meint: EINE dealing_range (die Idee) + EINE trade_position
// (die erste Ausführung), optional + trade_targets — siehe supabase/migrations/
// 20260731120000_dealing_ranges_trade_positions.sql für die Aufteilungs-Begründung. Für eine
// WEITERE Ausführung auf dieselbe Idee siehe addTradePosition oben, nicht dieses Tool nochmal
// aufrufen (das würde eine zweite, unabhängige Idee anlegen). Kein echtes DB-Transaktions-RPC
// (Supabase-JS-Client kann das ohne eigene Postgres-Function nicht) — bei einem Fehler nach dem
// dealing_ranges-Insert wird die Zeile wieder gelöscht, damit keine verwaiste Idee ohne Ausführung
// übrig bleibt.
export async function createTrade(args: CreateTradeArgs) {
  const { data: dealingRange, error: drError } = await supabase
    .from("dealing_ranges")
    .insert({
      instrument: args.instrument,
      direction: args.direction,
      invalidation: args.invalidation ?? null,
      trade_setup_id: args.tradeSetupId ?? null,
    })
    .select("*")
    .single();
  if (drError) throw new Error(drError.message);

  let position;
  try {
    position = await insertTradePosition(dealingRange.id, args);
  } catch (err) {
    await supabase.from("dealing_ranges").delete().eq("id", dealingRange.id);
    throw err;
  }

  let targets: unknown[] = [];
  if (args.targets && args.targets.length > 0) {
    // source_time NICHT weglassen (Bug-Report Philip 2026-08-07, dealing_range #32: "3 targets
    // drin, aber man sieht sie nicht im Chart") — refreshTradeTargetLinksInternal in PriceChart.vue
    // überspringt jedes Target mit sourceTime==null komplett (siehe Migration
    // 20260728140000_trade_targets_kind_and_source.sql: ohne bekannte source_time ist aus dem
    // reinen Preis keine Linie rekonstruierbar). position.triggered_at ist der beste verfügbare
    // Anker, den dieses Tool kennt — der tatsächliche DB-Wert (auch wenn triggeredAt im Aufruf
    // fehlte und die Spalte selbst einen Default zog), nicht args.triggeredAt.
    const liquidityLevelIds = await Promise.all(
      args.targets.map((t) => resolvePivotLiquidityLevelId({ ...t, sourceTime: position.triggered_at })),
    );
    const { data: targetRows, error: targetError } = await supabase
      .from("trade_targets")
      .insert(
        args.targets.map((t, i) => ({
          dealing_range_id: dealingRange.id,
          price: t.price,
          range_low: t.rangeLow ?? null,
          range_high: t.rangeHigh ?? null,
          source_time: position.triggered_at,
          liquidity_level_id: liquidityLevelIds[i],
        })),
      )
      .select("*");
    if (targetError) throw new Error(targetError.message);
    targets = targetRows ?? [];
  }

  return { dealingRange, tradePosition: position, targets };
}

export interface UpdateTradePositionArgs {
  entryPrice?: number | null;
  stopLoss?: number | null;
  triggeredAt?: string;
  reasoning?: string | null;
  outcome?: "win" | "loss" | "open" | null;
  rMultiple?: number | null;
  exitPrice?: number | null;
  exitTime?: string | null;
  tradingAccountId?: number | null;
  zoneId?: number | null;
  size?: number | null;
  netPl?: number | null;
  commission?: number | null;
}

const TRADE_POSITION_FIELD_MAP: Record<keyof UpdateTradePositionArgs, string> = {
  entryPrice: "entry_price",
  stopLoss: "stop_loss",
  triggeredAt: "triggered_at",
  reasoning: "reasoning",
  outcome: "outcome",
  rMultiple: "r_multiple",
  exitPrice: "exit_price",
  exitTime: "exit_time",
  tradingAccountId: "trading_account_id",
  zoneId: "zone_id",
  size: "size",
  netPl: "net_pl",
  commission: "commission",
};

// Nur die tatsächlich übergebenen Felder patchen (nicht übergeben != explizit auf null setzen) —
// deshalb Object.keys(fields) statt eines festen Feld-Sets.
export async function updateTradePosition(id: number, fields: UpdateTradePositionArgs) {
  const patch: Record<string, unknown> = {};
  for (const key of Object.keys(fields) as (keyof UpdateTradePositionArgs)[]) {
    patch[TRADE_POSITION_FIELD_MAP[key]] = fields[key];
  }
  const { data, error } = await supabase.from("trade_positions").update(patch).eq("id", id).select("*").single();
  if (error) throw new Error(error.message);
  return data;
}

export interface UpdateDealingRangeArgs {
  instrument?: string;
  direction?: "long" | "short";
  invalidation?: number | null;
  tradeSetupId?: number | null;
  // "Lesson"-Verknüpfung (Chat 2026-07-31, vierte Runde, siehe Migration
  // 20260731230000_dealing_ranges_lesson_link.sql) — self-referencing FK auf eine ANDERE
  // dealing_range, die "das wäre der richtige Trade gewesen" markiert.
  lessonDealingRangeId?: number | null;
  // "Favorit"-Markierung (Chat 2026-08-13, siehe Migration
  // 20260813120000_dealing_ranges_setup_type.sql) — aktuell nur ein Enum-Wert ('10/10-Trade'),
  // null entfernt die Markierung wieder.
  setupType?: "10/10-Trade" | null;
}

const DEALING_RANGE_FIELD_MAP: Record<keyof UpdateDealingRangeArgs, string> = {
  instrument: "instrument",
  direction: "direction",
  invalidation: "invalidation",
  tradeSetupId: "trade_setup_id",
  lessonDealingRangeId: "lesson_dealing_range_id",
  setupType: "setup_type",
};

export async function updateDealingRange(id: number, fields: UpdateDealingRangeArgs) {
  const patch: Record<string, unknown> = {};
  for (const key of Object.keys(fields) as (keyof UpdateDealingRangeArgs)[]) {
    patch[DEALING_RANGE_FIELD_MAP[key]] = fields[key];
  }
  const { data, error } = await supabase.from("dealing_ranges").update(patch).eq("id", id).select("*").single();
  if (error) throw new Error(error.message);
  return data;
}

// Nur die Idee, OHNE gleichzeitig eine trade_positions-Ausführung (anders als createTrade oben) —
// Port von src/tradeIntake.js: createDealingRange, fürs TSC-über-MCP-Bedienen (Philip: "jetzt
// bereite bitte alles so vor, dass Lana ... den TSC bedienen kann"). direction kommt NICHT von
// einem erkannten Setup, sondern von der ersten OB-Bestätigung, siehe addTradeConfirmation unten
// (obDirection-Zweig) — analog zum Frontend-Flow (Dashboard.vue: onSelectTarget,
// tscBootstrapArmed-Zweig).
export async function createDealingRange(instrument: string, direction: "long" | "short") {
  const { data, error } = await supabase.from("dealing_ranges").insert({ instrument, direction }).select("*").single();
  if (error) throw new Error(error.message);
  return data;
}

// TSC-Reset — Port von src/tradeIntake.js: deleteDealingRange. trade_evidence/trade_targets
// hängen mit `on delete cascade` an dealing_ranges (Migration 20260731120000), ein einziges DELETE
// hier reicht also. Nur sinnvoll, solange die Range noch keine trade_positions-Zeile hat (siehe
// fetchActiveTscRangeId) — kein serverseitiger Schutz davor, dieselbe Vorsicht wie im Frontend.
export async function deleteDealingRange(id: number) {
  const { error } = await supabase.from("dealing_ranges").delete().eq("id", id);
  if (error) throw new Error(error.message);
  return { deleted: true, id };
}

// Port von src/trades.js: fetchActiveTscRangeId — welche dealing_ranges-Zeile ist gerade "die
// aktive TSC-Range" für ein Instrument? Eine über die TSC angelegte Range hat (noch) keine
// trade_positions-Zeile — genau das unterscheidet "wird gerade analysiert" von "schon ausgeführt".
// Bei mehreren offenen Ranges für dasselbe Instrument gewinnt die zuletzt angelegte. `.limit(20)`
// reicht für eine persönliche Journal-Größenordnung locker, kein echtes NOT-EXISTS nötig
// (PostgREST kann das nicht direkt).
export async function fetchActiveTscRangeId(instrument: string) {
  const { data, error } = await supabase
    .from("dealing_ranges")
    .select("id, trade_positions(id)")
    .eq("instrument", instrument)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw new Error(error.message);
  return (data ?? []).find((r) => (r.trade_positions ?? []).length === 0)?.id ?? null;
}

function toLiquidityLevel(row: { liquidity_levels?: { price: number; direction: string; timeframe: string; pivot_time: string; touched: boolean; end_time: string | null } | null } | null) {
  if (!row?.liquidity_levels) return null;
  const lvl = row.liquidity_levels;
  return {
    price: lvl.price,
    dir: lvl.direction === "high" ? 1 : -1,
    pivotTime: Math.floor(new Date(lvl.pivot_time).getTime() / 1000),
    // Bug-Report Philip 2026-08-27: eine per TSC-Klick verknüpfte LQ-Linie zeichnete sich durch
    // bis "jetzt", statt am Touch zu enden — touched=false/end_time=null aus der DB kann entweder
    // "poi-watcher hat live bestätigt: noch unberührt" ODER "diese Zeile kam gerade erst per
    // findOrCreateLiquidityLevelId rein, poi-watcher hat sie nie gesehen/aktualisiert" bedeuten,
    // beides sieht in der DB identisch aus. null (statt false) triggert denselben
    // Self-Heal-gegen-geladene-Kerzen-Pfad wie bei einem reinen m5_liquidity_level-Snapshot (siehe
    // src/priceChartLiquidity.js: mergePinnedLevels).
    touched: lvl.touched === true ? true : lvl.end_time != null ? false : null,
    endTime: lvl.end_time ? Math.floor(new Date(lvl.end_time).getTime() / 1000) : null,
    timeframe: lvl.timeframe,
  };
}

// Schlanker Fetch NUR für die TSC — Port von src/trades.js: fetchDealingRangeCockpit. Anders als
// getJournal geht das hier NICHT über trade_positions (eine frisch aus der TSC angelegte Range hat
// zu Beginn noch gar keine Ausführung), sondern lädt eine einzelne dealing_ranges-Zeile direkt +
// ihre range-level Bestätigungen/Targets. liquidity_levels wird eingebettet, damit eine
// Sweep-Bestätigung/-Target das bestehende LQ-Chartobjekt highlighten kann statt eine zweite,
// dickere Linie zu zeichnen (dieselbe toLiquidityLevel-Formel wie getJournal).
export async function fetchDealingRangeCockpit(dealingRangeId: number) {
  const { data: range, error: rangeError } = await supabase
    .from("dealing_ranges")
    .select("id, instrument, direction, invalidation")
    .eq("id", dealingRangeId)
    .maybeSingle();
  if (rangeError) throw new Error(rangeError.message);
  if (!range) return null;

  const LIQUIDITY_LEVEL_EMBED = "liquidity_level_id, liquidity_levels(price, direction, timeframe, pivot_time, touched, end_time)";
  const [
    { data: confirmations, error: confirmationsError },
    { data: targets, error: targetsError },
  ] = await Promise.all([
    supabase
      .from("trade_evidence")
      .select(`id, price, kind, category, source_time, touched_time, range_low, range_high, timeframe, divergence_type, from_price, from_rsi, to_rsi, bonus, ${LIQUIDITY_LEVEL_EMBED}`)
      .eq("dealing_range_id", dealingRangeId)
      .order("created_at"),
    supabase
      .from("trade_targets")
      .select(`id, price, kind, source_time, touched_time, range_low, range_high, timeframe, ${LIQUIDITY_LEVEL_EMBED}`)
      .eq("dealing_range_id", dealingRangeId)
      .order("created_at"),
  ]);
  if (confirmationsError) throw new Error(confirmationsError.message);
  if (targetsError) throw new Error(targetsError.message);

  return {
    id: range.id,
    instrument: range.instrument,
    direction: range.direction,
    invalidation: range.invalidation ?? null,
    confirmations: (confirmations ?? []).map((c: any) => ({
      id: c.id,
      level: "range",
      price: c.price,
      kind: c.kind,
      category: c.category,
      sourceTime: c.source_time ? Math.floor(new Date(c.source_time).getTime() / 1000) : null,
      touchedTime: c.touched_time ? Math.floor(new Date(c.touched_time).getTime() / 1000) : null,
      liquidityLevel: toLiquidityLevel(c),
      rangeLow: c.range_low ?? null,
      rangeHigh: c.range_high ?? null,
      timeframe: c.timeframe ?? null,
      fromPrice: c.from_price ?? null,
      fromRsi: c.from_rsi ?? null,
      toRsi: c.to_rsi ?? null,
      divergenceType: c.divergence_type ?? null,
      bonus: c.bonus ?? null,
    })),
    targets: (targets ?? []).map((t: any) => ({
      id: t.id,
      price: t.price,
      kind: t.kind,
      sourceTime: t.source_time ? Math.floor(new Date(t.source_time).getTime() / 1000) : null,
      touchedTime: t.touched_time ? Math.floor(new Date(t.touched_time).getTime() / 1000) : null,
      rangeLow: t.range_low ?? null,
      rangeHigh: t.range_high ?? null,
      timeframe: t.timeframe ?? null,
      liquidityLevel: toLiquidityLevel(t),
    })),
  };
}

export interface AddTradeConfirmationArgs {
  level: "range" | "position";
  id: number;
  kind: "pivot" | "ob" | "fib" | "rsi_divergence";
  price: number;
  // Pflicht seit Bug-Report Philip 2026-08-18 (siehe Task "Lana soll confirmations/targets sauber
  // in der dealing range verknüpfen") — ohne sourceTime kann PriceChart.vue die Box/Linie nicht
  // positionieren (snapToBarTime braucht einen Zeitpunkt), die Bestätigung landete im Journal, blieb
  // im Chart aber für immer unsichtbar. Vorher optional, per Tool-Beschreibung "sollte" statt
  // erzwungen — reichte nicht zuverlässig.
  sourceTime: string;
  touchedTime?: string | null;
  rangeLow?: number | null;
  rangeHigh?: number | null;
  timeframe?: string | null;
  // Nur bei kind='pivot' sinnvoll (Task "liquidity_level_id-Konsolidierung", 2026-08-24/25) — wenn
  // alle drei zusammen mit price/sourceTime gegeben sind, wird der Pivot per find-or-create in
  // liquidity_levels aufgelöst statt nur als roher Snapshot gespeichert (siehe
  // findOrCreateLiquidityLevelId). Fehlen sie, bleibt liquidity_level_id null (Alt-Verhalten,
  // weiterhin unterstützt).
  instrument?: string;
  direction?: "high" | "low";
  // Nur bei kind='ob' sinnvoll — die Long/Short-Richtung der OB selbst (NICHT dieselbe Achse wie
  // direction oben, das ist 'high'/'low' für einen Pivot). Bewusst ein eigenes Feld statt direction
  // zu überladen (Philip: "das entscheidet eine Bestätigung, welche einen OB enthält" — die OB ist
  // bärisch oder bullisch, ein Sweep-Pivot ist high oder low, zwei verschiedene Achsen). Löst analog
  // zu direction/liquidity_level_id die ob_zones-Zeile per find-or-create auf (siehe
  // findOrCreateObZoneId) UND schreibt — nur bei level='range' — die direction/invalidation der
  // dealing_range fort (Port von src/tradeIntake.js: insertConfirmation, dortiger Kommentar für die
  // "direction immer überschreiben, invalidation nur wenn leer"-Regel).
  obDirection?: "long" | "short";
  // Nur bei kind='rsi_divergence' sinnvoll (Task "Lana-MCP: Confirmations/Confluences/
  // Anti-Confluences/Targets vollständig für eine Dealing Range anlegbar") — price/sourceTime/
  // touchedTime tragen bereits toPrice/fromTime/toTime (wie bei 'ob' der nahe Zonen-Rand als price
  // dient), diese drei zusätzlichen Felder machen die Divergenz später als vollständigen
  // Zwei-Bein-Konnektor nachzeichenbar (siehe src/tradeEvidence.ts, gleiches Feld-Set wie beim
  // Frontend-Chart-Klick-Weg).
  divergenceType?: "bearish" | "bullish";
  fromPrice?: number;
  fromRsi?: number;
  toRsi?: number;
  // Nur bei kind='pivot' sinnvoll — Session-Kontext wie "Asia-Mid" (siehe
  // src/sessionOccurrences.js: bonusLabelForPivot, src/tradeEvidence.ts). Lana müsste das aus
  // get_data_export/get_near_relevant_liquidity_levels ableiten, wenn sie es mitgeben will.
  bonus?: string;
}

// Fehlte bisher komplett auf MCP-Seite (Bug-Report Philip 2026-08-07, siehe Migration
// 20260807120000_backfill_range_confirmations_27_28.sql): create_trade/add_trade_position setzen
// zwar tradeSetupId auf die dealing_range, legen aber anders als der Frontend-Chart-Klick-Weg
// (src/views/Dashboard.vue: onSelectSetupConfirmations/tradeIntake.js: insertConfirmation) nie
// die zugehörige trade_evidence-Zeile an — ein per MCP eingepflegter, setup-verlinkter Trade
// zeigte darum nie eine Bestätigung im Edit-Modal. Gleiche Zweigleisigkeit wie im Frontend: level
// entscheidet, ob dealing_range_id (GO für die Idee) oder trade_position_id (GO für diesen Entry)
// gesetzt wird, nie beide.
//
// category (Migration 20260828130000) ist seit der Anti-Confluence-Einführung keine generierte
// Spalte mehr, muss also explizit gesetzt werden. Das Tool hat (noch) keinen eigenen
// Anti-Confluence-Weg (siehe milk-city Task "Lana-MCP: Confirmations/Confluences/Anti-Confluences/
// Targets vollständig für eine Dealing Range anlegbar") — bildet darum 1:1 die frühere generierte
// Ableitung nach, bis dieser Task das erweitert.
const KIND_TO_CATEGORY: Record<AddTradeConfirmationArgs["kind"], "confirmation" | "confluence"> = {
  pivot: "confirmation",
  ob: "confirmation",
  fib: "confluence",
  rsi_divergence: "confluence",
};

export async function addTradeConfirmation(args: AddTradeConfirmationArgs) {
  let liquidityLevelId: number | null = null;
  if (args.kind === "pivot" && args.instrument && args.timeframe && args.direction) {
    liquidityLevelId = await findOrCreateLiquidityLevelId(
      args.instrument,
      args.timeframe,
      args.direction,
      args.price,
      Math.floor(new Date(args.sourceTime).getTime() / 1000),
    );
  }
  // Analog zu liquidityLevelId oben, für kind='ob' — Port der find-or-create-Auflösung aus
  // src/tradeIntake.js: insertConfirmation (fehlte hier bisher komplett, siehe
  // AddTradeConfirmationArgs.obDirection-Kommentar).
  let obZoneId: number | null = null;
  if (args.kind === "ob" && args.instrument && args.timeframe && args.obDirection && args.rangeLow != null && args.rangeHigh != null) {
    obZoneId = await findOrCreateObZoneId(
      args.instrument,
      args.timeframe,
      args.obDirection,
      args.rangeHigh,
      args.rangeLow,
      Math.floor(new Date(args.sourceTime).getTime() / 1000),
    );
  }
  const { data, error } = await supabase
    .from("trade_evidence")
    .insert({
      dealing_range_id: args.level === "range" ? args.id : null,
      trade_position_id: args.level === "position" ? args.id : null,
      kind: args.kind,
      category: KIND_TO_CATEGORY[args.kind],
      price: args.price,
      source_time: args.sourceTime,
      touched_time: args.touchedTime ?? null,
      range_low: args.rangeLow ?? null,
      range_high: args.rangeHigh ?? null,
      timeframe: args.timeframe ?? null,
      liquidity_level_id: liquidityLevelId,
      ob_zone_id: obZoneId,
      divergence_type: args.divergenceType ?? null,
      from_price: args.fromPrice ?? null,
      from_rsi: args.fromRsi ?? null,
      to_rsi: args.toRsi ?? null,
      bonus: args.bonus ?? null,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  // Port von src/tradeIntake.js: insertConfirmation (dortiger Kommentar für die Herleitung) — nur
  // bei level='range': direction wird IMMER überschrieben (die OB ist das eindeutigere Signal als
  // ein bloßer Sweep), invalidation NUR wenn noch leer (eine bereits gesetzte, evtl. manuell
  // nachjustierte Invalidierung wird nicht überschrieben).
  if (args.level === "range" && args.kind === "ob" && args.rangeLow != null && args.rangeHigh != null && args.obDirection != null) {
    const { data: range, error: rangeError } = await supabase.from("dealing_ranges").select("invalidation, direction").eq("id", args.id).maybeSingle();
    if (rangeError) throw new Error(rangeError.message);
    if (range) {
      const updates: Record<string, unknown> = {};
      if (range.direction !== args.obDirection) updates.direction = args.obDirection;
      if (range.invalidation == null) updates.invalidation = args.obDirection === "long" ? args.rangeLow : args.rangeHigh;
      if (Object.keys(updates).length > 0) {
        const { error: updateError } = await supabase.from("dealing_ranges").update(updates).eq("id", args.id);
        if (updateError) throw new Error(updateError.message);
      }
    }
  }

  return data;
}

export interface AddTradeTargetArgs {
  price: number;
  // 'pivot'|'ob' — fehlte hier bisher komplett (nur DB-Default), Port von src/tradeIntake.js:
  // addTargetToTrade. Ohne kind kann PriceChart.vue: refreshTradeTargetLinksInternal ein OB-Target
  // (rangeLow/rangeHigh gesetzt) nicht von einem Pivot-Target unterscheiden.
  kind?: "pivot" | "ob" | null;
  rangeLow?: number | null;
  rangeHigh?: number | null;
  // Pflicht seit Bug-Report Philip 2026-08-18 (siehe AddTradeConfirmationArgs.sourceTime oben,
  // dieselbe Begründung) — ohne sourceTime bleibt das Target im Chart unsichtbar, auch wenn die
  // DB-Zeile existiert.
  sourceTime: string;
  // Tatsächlicher Erreichungs-Zeitpunkt (TP schon getroffen) — fehlte hier bisher komplett, Port
  // von src/tradeIntake.js: addTargetToTrade. null solange das Target noch offen ist.
  touchedTime?: string | null;
  // Nur sinnvoll für ein reines Pivot-Target (kein rangeLow/rangeHigh) — siehe
  // AddTradeConfirmationArgs.instrument/direction, gleiche find-or-create-Logik.
  instrument?: string;
  timeframe?: string;
  direction?: "high" | "low";
}

async function resolvePivotLiquidityLevelId(args: { rangeLow?: number | null; rangeHigh?: number | null; instrument?: string; timeframe?: string; direction?: "high" | "low"; price: number; sourceTime: string }) {
  if (args.rangeLow != null || args.rangeHigh != null) return null; // OB-Ziel, kein Pivot
  if (!args.instrument || !args.timeframe || !args.direction) return null;
  return findOrCreateLiquidityLevelId(args.instrument, args.timeframe, args.direction, args.price, Math.floor(new Date(args.sourceTime).getTime() / 1000));
}

// Fügt einer BEREITS BESTEHENDEN dealing_range ein weiteres Target hinzu (createTrade oben legt
// Targets nur bei der initialen Anlage an) — fehlte bisher komplett, ebenso wie update/delete
// (Bug-Report Philip 2026-08-09: TP1/TP2 nachträglich korrigieren war über MCP nicht möglich,
// nur über create_trade neu anlegen). sourceTime ist seit 2026-08-18 Pflicht (Zod-Schema in
// tools/trades.ts erzwingt es) statt nur optional beim Aufrufer zu liegen — ohne sourceTime bleibt
// das Target laut refreshTradeTargetLinksInternal (PriceChart.vue, siehe Migration
// 20260728140000_trade_targets_kind_and_source.sql) unsichtbar im Chart, auch wenn die DB-Zeile
// existiert, und das reine Doku-"sollte" reichte nicht zuverlässig (Bug-Report Philip 2026-08-18).
export async function addTradeTarget(dealingRangeId: number, args: AddTradeTargetArgs) {
  const liquidityLevelId = await resolvePivotLiquidityLevelId(args);
  const { data, error } = await supabase
    .from("trade_targets")
    .insert({
      dealing_range_id: dealingRangeId,
      price: args.price,
      kind: args.kind ?? null,
      range_low: args.rangeLow ?? null,
      range_high: args.rangeHigh ?? null,
      source_time: args.sourceTime,
      touched_time: args.touchedTime ?? null,
      timeframe: args.timeframe ?? null,
      liquidity_level_id: liquidityLevelId,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export interface UpdateTradeTargetArgs {
  price?: number;
  rangeLow?: number | null;
  rangeHigh?: number | null;
  sourceTime?: string | null;
  liquidityLevelId?: number | null;
}

const TRADE_TARGET_FIELD_MAP: Record<keyof UpdateTradeTargetArgs, string> = {
  price: "price",
  rangeLow: "range_low",
  rangeHigh: "range_high",
  sourceTime: "source_time",
  liquidityLevelId: "liquidity_level_id",
};

// Nur die tatsächlich übergebenen Felder patchen, wie updateTradePosition/updateDealingRange oben.
export async function updateTradeTarget(id: number, fields: UpdateTradeTargetArgs) {
  const patch: Record<string, unknown> = {};
  for (const key of Object.keys(fields) as (keyof UpdateTradeTargetArgs)[]) {
    patch[TRADE_TARGET_FIELD_MAP[key]] = fields[key];
  }
  const { data, error } = await supabase.from("trade_targets").update(patch).eq("id", id).select("*").single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteTradeTarget(id: number) {
  const { error } = await supabase.from("trade_targets").delete().eq("id", id);
  if (error) throw new Error(error.message);
  return { deleted: true, id };
}
