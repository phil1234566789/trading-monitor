// Einmaliges Backfill-Script für die forex_candles-Tabelle (siehe Migration
// 20260809120000_forex_candles.sql) — holt abgeschlossene Kerzen über dieselbe forex-candles Edge
// Function, die auch Chart/MCP-Live-Reads nutzen (`fetchForexCandles`, kein direkter cTrader-
// Zugriff hier, die Edge Function kümmert sich um OAuth-Token/Refresh). Kein Tool im laufenden
// MCP-Server (siehe index.ts) — manueller Lauf, per Env-Vars parametrisierbar statt die Konstanten
// unten für jede Ausweitung von Hand zu ändern (Chat 2026-08-09, zweite Runde: erst GBP 5m/1h/4h
// Juli+August, dann GBP 4h fürs ganze Jahr — beides derselbe Lauf, andere Env-Vars):
//
//   SUPABASE_URL=... SUPABASE_ANON_KEY=... [BACKFILL_INSTRUMENTS=GBPUSD] [BACKFILL_BARS=5m,1h,4h] \
//     [BACKFILL_START_DATE=2026-07-01] npx tsx mcp-server/src/scripts/backfillForexCandles.ts
//
// (SUPABASE_*-Werte wie in .mcp.json, siehe dort — anon-Key ist ein "publishable" Key, kein
// Secret). Idempotent (ON CONFLICT DO NOTHING beim Upsert unten), ein erneuter Lauf mit
// überlappendem/größerem Zeitraum überspringt bereits Vorhandenes einfach statt es zu duplizieren.
import { supabase } from "../supabaseClient.js";
import { fetchForexCandles, type Candle } from "../forexCandles.js";
import { berlinDayRangeUtcMs } from "../berlinTime.js";

type Bar = "5m" | "1h" | "4h";
const ALL_BARS: Bar[] = ["5m", "1h", "4h"];

function parseBars(raw: string | undefined): Bar[] {
  if (!raw) return ALL_BARS;
  const bars = raw.split(",").map((b) => b.trim());
  const invalid = bars.filter((b) => !ALL_BARS.includes(b as Bar));
  if (invalid.length > 0) throw new Error(`Unbekannte(r) Timeframe(s) in BACKFILL_BARS: ${invalid.join(", ")} (erlaubt: ${ALL_BARS.join(", ")})`);
  return bars as Bar[];
}

// Defaults entsprechen dem ursprünglichen Piloten (GBPUSD, 5m/1h/4h, ab Juli 2026) — ohne Env-Vars
// verhält sich ein erneuter Lauf also unverändert.
const INSTRUMENTS = (process.env.BACKFILL_INSTRUMENTS ?? "GBPUSD").split(",").map((s) => s.trim());
const BARS = parseBars(process.env.BACKFILL_BARS);
const START_DATE = process.env.BACKFILL_START_DATE ?? "2026-07-01"; // Europe/Berlin, inklusive — Ende ist implizit "jetzt"

// MAX_COUNT der forex-candles Edge Function (siehe supabase/functions/forex-candles/index.ts) —
// mehr pro Request ist serverseitig eh gekappt, cTraders eigenes 14.000-Bars-Limit spielt hier
// noch keine Rolle.
const PAGE_SIZE = 1000;
const UPSERT_BATCH_SIZE = 1000;

// cTrader-Connects sind laut CLAUDE.md bekannt timeout-anfällig (siehe auch der ganze Anlass
// dieses Scripts) — bei ~16 sequenziellen Requests für den Piloten würde ein einzelner
// Hänger sonst den kompletten Lauf abbrechen. Simpler Retry statt komplexerer Backoff-Logik,
// reicht für ein manuelles Einmal-Script.
async function withRetries<T>(fn: () => Promise<T>, attempts = 4): Promise<T> {
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === attempts) throw err;
      console.warn(`Versuch ${i}/${attempts} fehlgeschlagen (${err instanceof Error ? err.message : err}), warte kurz...`);
      // Direkt hintereinander reconnecten scheint das Problem eher zu verschlimmern (mehrere
      // Fails in Serie im ersten Testlauf) — kurze Pause statt sofortigem Retry.
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
  throw new Error("unreachable");
}

async function upsertBatch(instrument: string, bar: string, candles: Candle[]) {
  if (candles.length === 0) return;
  const rows = candles.map((c) => ({
    instrument,
    bar,
    time: new Date(c.time * 1000).toISOString(),
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    volume: c.volume,
  }));
  // ignoreDuplicates statt echtem Update — geschlossene Kerzen ändern sich nie, ein erneuter Lauf
  // (z.B. nach einem Abbruch) soll bereits gesicherte Zeilen einfach überspringen (siehe Migration).
  const { error } = await supabase
    .from("forex_candles")
    .upsert(rows, { onConflict: "instrument,bar,time", ignoreDuplicates: true });
  if (error) throw new Error(`Upsert fehlgeschlagen (${instrument} ${bar}): ${error.message}`);
}

// Paginiert rückwärts von "jetzt" (toMs zunächst undefined) bis vor die Startgrenze, exakt wie
// PriceChart.vue's Scroll-Back-Fetch (fetchOlderForexCandles) — jede Seite endet exklusiv genau
// dort, wo die vorherige begann, siehe forex-candles Edge Function ("to: ... exclusive upper
// bound — for load older").
async function backfillOne(instrument: string, bar: Bar) {
  const startMs = berlinDayRangeUtcMs(START_DATE).startUtcMs;
  let cursorToMs: number | undefined;
  let pendingBatch: Candle[] = [];
  let totalRows = 0;
  let pages = 0;

  for (;;) {
    const page = await withRetries(() => fetchForexCandles(instrument, bar, { count: PAGE_SIZE, toMs: cursorToMs }));
    pages++;
    if (page.length === 0) break;

    const withinRange = page.filter((c) => c.time * 1000 >= startMs);
    pendingBatch.push(...withinRange);
    totalRows += withinRange.length;
    if (pendingBatch.length >= UPSERT_BATCH_SIZE) {
      await upsertBatch(instrument, bar, pendingBatch);
      pendingBatch = [];
    }

    const oldestInPage = page[0].time * 1000;
    if (oldestInPage <= startMs) break; // Startgrenze erreicht/unterschritten, fertig
    cursorToMs = oldestInPage;
  }

  await upsertBatch(instrument, bar, pendingBatch);
  console.log(`${instrument} ${bar}: ${totalRows} Kerzen über ${pages} Seite(n) gesichert.`);
}

for (const instrument of INSTRUMENTS) {
  for (const bar of BARS) {
    await backfillOne(instrument, bar);
  }
}
