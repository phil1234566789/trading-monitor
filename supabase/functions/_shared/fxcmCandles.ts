import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.110.0';

export interface FxcmCandle { time: number; open: number; high: number; low: number; close: number; volume: number }
const PERIODS: Record<string, string> = { M1: '1m', M3: '3m', M5: '5m', M15: '15m', H1: '1h', H4: '4h', D1: '1D' };

export async function readFxcmCandles(db: SupabaseClient, symbol: string, period: string, count: number, to?: number): Promise<FxcmCandle[]> {
  const bar = PERIODS[period] ?? period;
  if (!['GBPUSD', 'EURUSD'].includes(symbol) || !Object.values(PERIODS).includes(bar) ||
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
    rows.push(...data.map((r) => ({ ...r, time: Date.parse(r.time) / 1000 })));
    boundary = data[data.length - 1].time;
  }
  return rows.reverse();
}
