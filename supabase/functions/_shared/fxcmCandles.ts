import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.110.0';
import { isGoldWeekendPlaceholder } from './fxcmGoldCalendar.js';

export interface FxcmCandle { time: number; open: number; high: number; low: number; close: number; volume: number }
const PERIODS: Record<string, string> = { M1: '1m', M3: '3m', M5: '5m', M15: '15m', H1: '1h', H4: '4h', D1: '1D' };

export async function readFxcmCandles(db: SupabaseClient, symbol: string, period: string, count: number, to?: number): Promise<FxcmCandle[]> {
  const bar = PERIODS[period] ?? period;
  if (!['GBPUSD', 'EURUSD', 'XAUUSD'].includes(symbol) || !Object.values(PERIODS).includes(bar) ||
      !Number.isInteger(count) || count < 1 || count > 5000 || (to != null && !Number.isFinite(to))) {
    throw new Error('Invalid candle request');
  }
  const rows: FxcmCandle[] = [];
  let boundary = new Date(to ?? Date.now()).toISOString();
  while (rows.length < count) {
    const { data, error } = await db.from('fxcm_candles').select('time,open,high,low,close,volume')
      .eq('instrument', symbol).eq('bar', bar).lt('time', boundary)
      .order('time', { ascending: false }).limit(Math.min(1000, count - rows.length));
    if (error) throw error;
    if (!data?.length) break;
    rows.push(...data.filter(r => !isGoldWeekendPlaceholder(symbol, r)).map((r) => ({ ...r, time: Date.parse(r.time) / 1000 })));
    boundary = data[data.length - 1].time;
  }
  return rows.reverse();
}

const CLOSED_BAR_SECONDS: Record<string, number> = { '1m': 60, '5m': 300, '1h': 3600, '4h': 14400, '1D': 86400 };

// Die letzten `count` vor evaluatedAt geschlossenen Kerzen, ohne Obergrenze (Cursor-Paginierung über das zuletzt
// gelieferte Zeitfeld, PostgREST kappt Seiten still bei ~1000). dob-watcher und das TS1.1-Urteil im MCP lesen
// so; kein Live-Nachladen wie fetchForexCandles, das am Wochenende cTrader anwirft.
export async function readClosedFxcmCandles(db: SupabaseClient, instrument: string, bar: string, evaluatedAt: number, count: number): Promise<FxcmCandle[]> {
  const rows: Record<string, unknown>[] = [];
  let cursor = new Date(evaluatedAt * 1000).toISOString();
  while (rows.length < count) {
    const { data, error } = await db.from('fxcm_candles').select('time,open,high,low,close,volume').eq('instrument', instrument).eq('bar', bar)
      .lt('time', cursor).order('time', { ascending: false }).limit(Math.min(1000, count - rows.length));
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    rows.push(...data);
    cursor = data[data.length - 1].time as string;
  }
  return rows.reverse().map((r) => ({ time: Date.parse(r.time as string) / 1000, open: Number(r.open), high: Number(r.high), low: Number(r.low),
    close: Number(r.close), volume: Number(r.volume) })).filter((c) => c.time + CLOSED_BAR_SECONDS[bar] <= evaluatedAt);
}
