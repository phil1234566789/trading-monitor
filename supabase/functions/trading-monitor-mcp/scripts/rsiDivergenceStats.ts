// RSI-Divergenz-Statistik-Script (Chat 2026-08-11, fünfte Runde: "wie schwer ist es einen
// Zeitraum ... damit wir wissen, wie wir den Indikator einstellen" + "wir müssen die Divergenzen
// zusammen mit den Sessions vergleichen ... MMM Session ... hohe Fehlalarm-Quote") — bewusste
// Alternative zur Live-Modal-Lösung (RsiDivergenceStatsPanel.vue, die Philip explizit behalten
// wollte): fürs reine Tuning/Analysieren ist ein einmaliges Script über das KOMPLETTE
// archivierte Jahr simpler als Browser+IndexedDB-Cache+Datums-Range-UI — kein Lücken-Risiko im
// Cache, kein 10-20s-UI-Delay bei jedem Öffnen, beliebig oft mit anderen Parametern wiederholbar
// (siehe LOOKFORWARD-Kommaliste unten). Gleiches Muster wie backfillObZones.ts: eigenständiges
// Script, liest nur (forex_candles + sessions), schreibt nichts in die DB.
//
// Ordnet jede gefundene Divergenz zusätzlich der Session zu, in der ihr toTime (der Divergenz-
// Pivot-Zeitpunkt) liegt (dieselbe sessionOccurrences-Logik wie der Live-Chart, Berlin-Zeitzonen-
// bewusst via berlinTime.ts, DST-korrekt) — Philip: "ob auf lange Sicht (100 Divergenzen z.B.) die
// MMM Session eine hohe Fehlalarm-Quote hat". Keine Session deckt jeden Zeitpunkt ab (Lücken
// zwischen Asia/MMM/NY/Spread Hour) — solche Divergenzen landen in der "–"-Gruppe, das ist
// erwartet, keine fehlende Zuordnung.
//
//   SUPABASE_URL=... SUPABASE_ANON_KEY=... \
//     [STATS_INSTRUMENTS=GBPUSD,EURUSD] [STATS_BAR=5m] [STATS_LOOKBACK=100] \
//     [STATS_LOOKFORWARD=60] \
//     deno run --allow-net --allow-env --allow-write --allow-read \
//     supabase/functions/trading-monitor-mcp/scripts/rsiDivergenceStats.ts
//
// STATS_LOOKFORWARD akzeptiert eine Kommaliste (z.B. "15,30,60") für einen direkten
// Parameter-Vergleich in einem Lauf — genau der Wert, den Philip schon als "vermutlich zu hoch"
// vermutet hatte (siehe rsiDivergenceOutcome.js).
//
// 2026-08-27 von der Node-Autoren-Kopie (mcp-server/, gelöscht) nach Deno portiert, einzige
// verbleibende Kopie — process.env → Deno.env.get, node:fs/path → Deno.mkdirSync/writeTextFileSync,
// process.stderr.write → Deno.stderr.writeSync, Cross-Directory-Imports aus ../../../src/ ersetzt
// durch die lokalen, bereits vorhandenen Kopien (../rsi.js, ../rsiDivergenceOutcome.js,
// ../sessionOccurrences.js), sonst unverändert.
import { supabase } from "../supabaseClient.ts";
import { berlinOffsetMinutes, berlinDateStrFor, berlinDateTimeStrFor } from "../berlinTime.ts";
import { detectRsiDivergenceHistory, DEFAULT_DIVERGENCE_LOOKBACK_BARS } from "../rsi.js";
import { classifyDivergenceOutcome, DEFAULT_DIVERGENCE_OUTCOME_LOOKFORWARD_BARS } from "../rsiDivergenceOutcome.js";
import { sessionOccurrences } from "../sessionOccurrences.js";

interface CandleRow {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}
interface SessionRow {
  label: string;
  from_minutes: number;
  to_minutes: number;
  days: number[] | null;
}
interface SessionOcc {
  label: string;
  occurrences: { startSec: number; endSec: number }[];
}
interface ClassifiedDivergence {
  type: "bearish" | "bullish";
  fromTime: number;
  toTime: number;
  fromPrice: number;
  toPrice: number;
  fromRsi: number;
  toRsi: number;
  outcome: string;
  structureLevel?: number;
  structureTime?: number;
  breakTime?: number;
  barsToBreak?: number;
  windowEndTime?: number;
  session: string;
}

const INSTRUMENTS = (Deno.env.get("STATS_INSTRUMENTS") ?? "GBPUSD,EURUSD").split(",").map((s) => s.trim());
const BAR = Deno.env.get("STATS_BAR") ?? "5m";
const LOOKBACK = Number(Deno.env.get("STATS_LOOKBACK") ?? DEFAULT_DIVERGENCE_LOOKBACK_BARS);
const LOOKFORWARD_VALUES = (Deno.env.get("STATS_LOOKFORWARD") ?? String(DEFAULT_DIVERGENCE_OUTCOME_LOOKFORWARD_BARS))
  .split(",")
  .map((s) => Number(s.trim()));

// sessionOccurrences erwartet eine Sekunden->Minuten-Offset-Funktion, berlinOffsetMinutes nimmt
// aber Millisekunden (siehe berlinTime.ts) — dieselbe Umrechnung wie dataExport.js's Aufruf
// ((utcSec) => berlinOffsetMinutes(utcSec * 1000)), sonst rechnet jede Session-Grenze um Faktor
// 1000 daneben.
const berlinOffsetFromSec = (utcSec: number) => berlinOffsetMinutes(utcSec * 1000);

const READ_PAGE_SIZE = 5000; // siehe backfillObZones.ts — großzügig angefragt, PostgREST kappt serverseitig ohnehin auf ~1000

const stderrEncoder = new TextEncoder();
function writeStderr(text: string) {
  Deno.stderr.writeSync(stderrEncoder.encode(text));
}

// Aufsteigend sortierte, komplette archivierte Kerzenserie — via .range()-Pagination, weiterzählen
// um die TATSÄCHLICH zurückgegebene Zeilenzahl statt READ_PAGE_SIZE (siehe backfillObZones.ts-
// Kommentar: der PostgREST-Cap ist kein verlässliches "letzte Seite"-Signal).
async function fetchAllCandles(instrument: string, bar: string): Promise<CandleRow[]> {
  const all: CandleRow[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("forex_candles")
      .select("time, open, high, low, close, volume")
      .eq("instrument", instrument)
      .eq("bar", bar)
      .order("time", { ascending: true })
      .range(from, from + READ_PAGE_SIZE - 1);
    if (error) throw new Error(`Kerzen lesen fehlgeschlagen (${instrument} ${bar}): ${error.message}`);
    if (!data || data.length === 0) break;
    all.push(...(data as any[]).map((r) => ({ ...r, time: Math.floor(new Date(r.time).getTime() / 1000) })));
    from += data.length;
    // Fortschritts-Log (2026-08-24, Philip: "dauert echt so lang" bei stillem Paginierungs-Warten
    // über ein volles Jahr) — \r statt \n, überschreibt sich in einem echten Terminal selbst.
    writeStderr(`\r${instrument} ${bar}: ${all.length} Kerzen geladen...`);
  }
  writeStderr("\n");
  return all;
}

async function fetchSessions(instrument: string): Promise<SessionRow[]> {
  const { data, error } = await supabase.from("sessions").select("label, from_minutes, to_minutes, days").eq("instrument", instrument);
  if (error) throw new Error(`Sessions lesen fehlgeschlagen (${instrument}): ${error.message}`);
  return (data as SessionRow[]) ?? [];
}

// Erste passende Session gewinnt (analog contextForPivot in sessionOccurrences.js) — "–" wenn
// keine Session dieses Instruments den Zeitpunkt abdeckt.
function sessionLabelFor(atSec: number, sessionOccs: SessionOcc[]): string {
  for (const { label, occurrences } of sessionOccs) {
    if (occurrences.some((o) => atSec >= o.startSec && atSec < o.endSec)) return label;
  }
  return "–";
}

function formatPct(n: number | null): string {
  return n == null ? "–" : `${Math.round(n * 100)}%`;
}

function printGroup(label: string, list: { outcome: string }[]) {
  const hits = list.filter((d) => d.outcome === "hit").length;
  const misses = list.filter((d) => d.outcome === "miss").length;
  const pending = list.filter((d) => d.outcome === "pending").length;
  const decided = hits + misses;
  const hitRate = decided > 0 ? hits / decided : null;
  console.log(
    `  ${label.padEnd(14)} n=${String(list.length).padEnd(4)} Hit=${String(hits).padEnd(4)} Miss=${String(misses).padEnd(4)} Pending=${String(pending).padEnd(4)} Hit-Rate=${formatPct(hitRate)}`,
  );
}

// Lineare Interpolation zwischen den beiden umgebenden Werten (Standard-"linear"-Methode, wie z.B.
// numpy.percentile/Excel PERCENTILE.INC) — sortedValues MUSS bereits aufsteigend sortiert sein.
function percentile(sortedValues: number[], p: number): number {
  const idx = p * (sortedValues.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sortedValues[lower];
  return sortedValues[lower] + (sortedValues[upper] - sortedValues[lower]) * (idx - lower);
}

// Bars-bis-Bruch-Verteilung (nur Hits) + IQR-Ausreißer (Chat 2026-08-11: "hit in x-candles
// durchschnitt -> aber gibts ausreißer, die eig nicht als hit gelten") — IQR statt fixem
// Schwellenwert, weil die Verteilung rechtsschief ist (viele schnelle Breaks, wenige extrem
// langsame) und ein fixer Bars-Wert je nach Lookforward unterschiedlich viel bedeuten würde. Nur
// OBERE Ausreißer (ungewöhnlich LANGSAME Breaks) werden gelistet — ein ungewöhnlich schneller Break
// ist kein fragwürdiger Hit, ein extrem langsamer schon (Bruch evtl. eher Zufall als echte
// Divergenz-Bestätigung). Datum statt nur Index, damit Philip die Stelle direkt im Chart nachschauen kann.
function printBarsToBreakStats(list: ClassifiedDivergence[]) {
  const hits = list.filter((d) => d.outcome === "hit" && d.barsToBreak != null);
  if (hits.length === 0) {
    console.log("  Bars bis Bruch: keine Hits vorhanden.");
    return;
  }
  const values = hits.map((d) => d.barsToBreak as number).sort((a, b) => a - b);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const median = percentile(values, 0.5);
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  const stddev = Math.sqrt(variance);
  console.log(`  Bars bis Bruch (nur Hits, n=${values.length}): Ø ${mean.toFixed(1)}, Median ${median.toFixed(1)}, StdAbw ${stddev.toFixed(1)}`);

  const q1 = percentile(values, 0.25);
  const q3 = percentile(values, 0.75);
  const upperBound = q3 + 1.5 * (q3 - q1);
  const outliers = hits.filter((d) => (d.barsToBreak as number) > upperBound).sort((a, b) => (b.barsToBreak as number) - (a.barsToBreak as number));
  if (outliers.length === 0) {
    console.log(`  Keine Ausreißer nach IQR-Methode (Q1=${q1.toFixed(1)}, Q3=${q3.toFixed(1)}, Grenze=${upperBound.toFixed(1)} Bars).`);
  } else {
    console.log(`  ${outliers.length} Ausreißer (>${upperBound.toFixed(1)} Bars, IQR-Methode) — zum Nachschauen im Chart:`);
    for (const d of outliers) {
      console.log(`    ${berlinDateTimeStrFor(d.toTime)}  ${d.type.padEnd(8)} ${d.barsToBreak} Bars  Session=${d.session}`);
    }
  }
}

// Hit-Rate je Kalendermonat (Berlin, Chat 2026-08-11: "ist die hitrate je saison unterschiedlich")
// — Monatsschlüssel aus dem toTime-Zeitpunkt (derselbe Zeitpunkt, der auch die Session-Zuordnung
// bestimmt), nicht fromTime, damit ein Monatswechsel innerhalb der Referenzsuche dieselbe Divergenz
// nicht doppelt zählt.
function printMonthlyBreakdown(list: ClassifiedDivergence[]) {
  const byMonth = new Map<string, ClassifiedDivergence[]>();
  for (const d of list) {
    const month = berlinDateStrFor(d.toTime).slice(0, 7);
    if (!byMonth.has(month)) byMonth.set(month, []);
    byMonth.get(month)!.push(d);
  }
  console.log("  Monatlich:");
  for (const [month, monthList] of [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    printGroup(month, monthList);
  }
}

// Roh-Export je Divergenz (Chat 2026-08-11: "geb die daten aus, damit wir weitere zahlen heraus
// extrahieren können") — nach .debug/ (siehe CLAUDE.md "Debug metadata panel", gitignored,
// maschinen-lokal, gleicher Ordner wie metadata.json), damit Philip die Rohdaten in Excel/Sheets
// selbst weiterverarbeiten kann, ohne dass sich das Script um jede denkbare Auswertung kümmern muss.
function exportCsv(instrument: string, bar: string, lookforward: number, list: ClassifiedDivergence[]) {
  const dir = `${Deno.cwd()}/.debug`;
  Deno.mkdirSync(dir, { recursive: true });
  const path = `${dir}/rsi-divergence-stats-${instrument}-${bar}-lf${lookforward}.csv`;
  const headers = [
    "type",
    "from_time_berlin",
    "to_time_berlin",
    "from_price",
    "to_price",
    "from_rsi",
    "to_rsi",
    "session",
    "outcome",
    "bars_to_break",
    "structure_level",
    "month",
  ];
  const rows = list.map((d) =>
    [
      d.type,
      berlinDateTimeStrFor(d.fromTime),
      berlinDateTimeStrFor(d.toTime),
      d.fromPrice,
      d.toPrice,
      d.fromRsi?.toFixed(2) ?? "",
      d.toRsi?.toFixed(2) ?? "",
      d.session,
      d.outcome,
      d.barsToBreak ?? "",
      d.structureLevel ?? "",
      berlinDateStrFor(d.toTime).slice(0, 7),
    ].join(","),
  );
  Deno.writeTextFileSync(path, [headers.join(","), ...rows].join("\n"));
  console.log(`  CSV exportiert: ${path} (${list.length} Zeilen)`);
}

async function runFor(instrument: string) {
  const candles = await fetchAllCandles(instrument, BAR);
  if (candles.length === 0) {
    console.warn(`${instrument} ${BAR}: keine archivierten Kerzen gefunden, übersprungen.`);
    return;
  }
  const sessionRows = await fetchSessions(instrument);
  const rangeStart = candles[0].time;
  const rangeEnd = candles[candles.length - 1].time;
  const sessionOccs: SessionOcc[] = sessionRows.map((s) => ({
    label: s.label,
    occurrences: sessionOccurrences(s.from_minutes, s.to_minutes, rangeStart, rangeEnd, berlinOffsetFromSec, s.days ?? undefined),
  }));

  // maxCount=Infinity -> .slice(-Infinity) im Divergenz-Code ergibt die komplette Historie (siehe
  // RsiDivergenceStatsPanel.vue-Fix: dieselbe "alle, nicht nur ein Anzeige-Limit"-Logik).
  const divergences = detectRsiDivergenceHistory(candles, undefined, LOOKBACK, Infinity);
  const fromDate = new Date(rangeStart * 1000).toISOString().slice(0, 10);
  const toDate = new Date(rangeEnd * 1000).toISOString().slice(0, 10);
  console.log(`\n=== ${instrument} (${BAR}, Lookback ${LOOKBACK}, ${candles.length} Kerzen, ${fromDate}–${toDate}) ===`);
  console.log(`${divergences.length} Divergenzen gefunden.`);

  for (const lookforward of LOOKFORWARD_VALUES) {
    const classified: ClassifiedDivergence[] = divergences.map((d) => ({
      ...d,
      ...classifyDivergenceOutcome(candles, d, undefined, lookforward),
      session: sessionLabelFor(d.toTime, sessionOccs),
    }));

    console.log(`\n--- Lookforward ${lookforward} Bars ---`);
    printGroup("GESAMT", classified);

    const bySession = new Map<string, ClassifiedDivergence[]>();
    for (const d of classified) {
      if (!bySession.has(d.session)) bySession.set(d.session, []);
      bySession.get(d.session)!.push(d);
    }
    for (const [session, list] of [...bySession.entries()].sort((a, b) => b[1].length - a[1].length)) {
      printGroup(session, list);
    }

    console.log("");
    printBarsToBreakStats(classified);
    console.log("");
    printMonthlyBreakdown(classified);
    console.log("");
    exportCsv(instrument, BAR, lookforward, classified);
  }
}

for (const instrument of INSTRUMENTS) {
  await runFor(instrument);
}
