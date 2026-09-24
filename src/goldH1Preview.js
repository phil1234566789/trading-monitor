import { supabase } from './supabaseClient.js';
import { fetchAllRows } from './dbReadPaging.js';
import { mapObZone } from './obZones.js';

export const GOLD_H1_PREVIEW = {
  start: '2026-09-06T22:00:00Z', end: '2026-09-20T22:00:00Z',
  priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
};

// Der Testchart liest nur das freigegebene Archivfenster, ohne Live-Fallback oder Forex-Erkennung.
export async function fetchGoldH1Preview() {
  const { data, error } = await fetchAllRows((from, to) => supabase.from('fxcm_candles')
    .select('time,open,high,low,close').eq('instrument', 'XAUUSD').eq('bar', '1h')
    .gte('time', GOLD_H1_PREVIEW.start).lt('time', GOLD_H1_PREVIEW.end)
    .order('time', { ascending: true }).range(from, to));
  if (error) throw error;
  return data.map(row => ({ ...row, time: Date.parse(row.time) / 1000 }));
}

export async function fetchGoldH1PreviewObs() {
  const { data, error } = await fetchAllRows((from, to) => supabase.from('ob_zones')
    .select('instrument,timeframe,direction,top,bottom,touched,invalidated,start_time,end_time')
    .eq('instrument', 'XAUUSD').eq('timeframe', '1H')
    .gte('start_time', GOLD_H1_PREVIEW.start).lt('start_time', GOLD_H1_PREVIEW.end)
    .order('start_time', { ascending: true }).order('id', { ascending: true }).range(from, to));
  if (error) throw error;
  return data.map(mapObZone);
}
