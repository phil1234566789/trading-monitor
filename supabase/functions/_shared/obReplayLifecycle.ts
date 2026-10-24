import { barSecondsFor } from "../trading-monitor-mcp/timeframes.ts";

// end_time enthält bei Altzeilen nur das letzte Ereignis. Touch und Invalidierung
// deshalb aus dem gemeinsamen FXCM-Archiv getrennt rekonstruieren, nie auseinander erraten.
type Candle = { time: number; high: number; low: number };
type Row = { timeframe: string; direction: string; top: number; bottom: number;
  start_time: string; end_time: string | null; touched: boolean; invalidated: boolean };
export async function reconstructObLifecycle<T extends Row>(rows: T[], asOf: number,
  read: (bar: string, from: number, until: number) => Promise<Candle[]>): Promise<T[]> {
  const states = new Map<T, T>();
  await Promise.all(["1H", "4H"].map(async tf => {
    const duration = barSecondsFor(tf);
    const group = rows.filter(r => r.timeframe === tf);
    if (!group.length) return;
    const from = Math.min(...group.map(r => Date.parse(r.start_time) / 1000));
    const native = (await read(tf.toLowerCase(), from, asOf - duration))
      .filter(c => c.time + duration <= asOf);
    if (!native.length) throw new Error(`Keine ${tf}-Archivabdeckung für OB-Replay`);
    // Native H4-Grenzen kommen vom Feed; die laufende Kerze nur durch geschlossene M5 ergänzen.
    const partialFrom = native.at(-1)!.time + duration;
    const partial = partialFrom + 300 <= asOf ? await read("5m", partialFrom, asOf - 300) : [];
    const candles = [...native, ...partial.filter(c => c.time + 300 <= asOf)];
    for (const row of group) {
      const knownAt = Date.parse(row.start_time) / 1000 + 2 * duration;
      if (native[0].time > knownAt) throw new Error(`Unvollständige ${tf}-Archivabdeckung für OB-Replay`);
      let touch: number | null = null, invalidation: number | null = null;
      for (const c of candles) {
        if (c.time < knownAt) continue;
        if (touch == null && c.low <= row.top && c.high >= row.bottom) touch = c.time;
        if (row.direction === "long" ? c.low < row.bottom : c.high > row.top) {
          invalidation = c.time;
          break;
        }
      }
      const end = touch ?? invalidation;
      states.set(row, { ...row, touched: touch != null, invalidated: invalidation != null,
        end_time: end == null ? null : new Date(end * 1000).toISOString() });
    }
  }));
  return rows.map(row => states.get(row) ?? row);
}
