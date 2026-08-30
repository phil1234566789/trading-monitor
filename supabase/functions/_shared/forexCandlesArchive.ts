// Forex-Kerzen-Archiv-Schreibzugriff (forex_candles) — extrahiert aus forex-candles/index.ts
// (Task "Market-Structure-Startpunkt: 1D-Periode-4-Pivots", CLAUDE.md "DRY within a single
// runtime"), damit die neue daily-structure-pivots-Funktion dieselbe Upsert-Logik nutzt statt
// einer dritten Kopie. Nur `period`-Werte im `bar`-CHECK-Constraint werden persistiert — seit
// dieser Migration zusätzlich '1D' (siehe 20260830090000_forex_candles_allow_1d.sql), vorher nur
// '5m'/'1h'/'4h'.
import type { createClient } from "npm:@supabase/supabase-js@2";

export interface ArchivableCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const UPSERT_CHUNK_SIZE = 1000;

export async function persistClosedCandles(
  supabase: ReturnType<typeof createClient>,
  instrument: string,
  bar: string,
  candles: ArchivableCandle[],
  logPrefix: string,
) {
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
  for (let i = 0; i < rows.length; i += UPSERT_CHUNK_SIZE) {
    const chunk = rows.slice(i, i + UPSERT_CHUNK_SIZE);
    const { error } = await supabase
      .from("forex_candles")
      .upsert(chunk, { onConflict: "instrument,bar,time", ignoreDuplicates: true });
    if (error) console.error(`${logPrefix}: Archiv-Upsert fehlgeschlagen (${instrument} ${bar}):`, error);
  }
}

// Paginierter Archiv-Read, aufsteigend ab `fromIso` (inklusive) — für die neue
// daily-structure-pivots-Funktion (genug 1D-Historie für die Periode-4-Fraktal-Erkennung, siehe
// CLAUDE.md-Gotcha: nach data.length vorrücken, nie nach der Page-Size, nur eine wirklich leere
// Seite bedeutet "fertig"). Anders als db.ts' getForexCandlesArchiveUpTo (rückwärts ab einem
// Cutoff, "neueste N bis zu einem Punkt") hier bewusst vorwärts ohne Zeilen-Obergrenze, weil der
// Aufrufer die GESAMTE Historie ab einem Startpunkt braucht, nicht "die letzten N".
const DB_READ_PAGE_SIZE = 1000;

export async function readForexCandlesArchiveFrom(
  supabase: ReturnType<typeof createClient>,
  instrument: string,
  bar: string,
  fromIso: string,
  toIso?: string, // exklusive Obergrenze — ohne Angabe bis ans Archiv-Ende
): Promise<ArchivableCandle[]> {
  const rows: { time: string; open: number; high: number; low: number; close: number; volume: number }[] = [];
  let boundary = fromIso;
  let inclusive = true;
  while (true) {
    let query = supabase
      .from("forex_candles")
      .select("time, open, high, low, close, volume")
      .eq("instrument", instrument)
      .eq("bar", bar)
      .order("time", { ascending: true })
      .limit(DB_READ_PAGE_SIZE);
    query = inclusive ? query.gte("time", boundary) : query.gt("time", boundary);
    if (toIso) query = query.lt("time", toIso);
    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < DB_READ_PAGE_SIZE) break;
    boundary = data[data.length - 1].time;
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
