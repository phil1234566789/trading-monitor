import { supabase } from './supabaseClient.js';
import { fetchAllRows } from './dbReadPaging.js';
import { mapObZone } from './obZones.js';
import { firstCandleTouchRange } from './priceChartObZones.js';
import { goldPreviewConfig } from './goldPreviewConfig.js';

// Invalidierung überschreibt das DB-endTime. Historische Boxen enden trotzdem beim
// ersten Touch; dafür liegen hier alle nativen Kerzen derselben Zeitebene seit der Entstehung vor.
export function goldDisplayZone(zone, candles) {
  const touch = firstCandleTouchRange(candles, zone.startTime, zone.bottom, zone.top);
  return touch != null && touch <= zone.endTime
    ? { ...zone, touched: true, endTime: touch }
    : zone;
}

// Der Testchart liest nur das freigegebene Archivfenster, ohne Live-Fallback oder Forex-Erkennung.
export async function fetchGoldPreview(bar = '1h') {
  const config = goldPreviewConfig(bar);
  const { data, error } = await fetchAllRows((from, to) => supabase.from('fxcm_candles')
    .select('time,open,high,low,close').eq('instrument', 'XAUUSD').eq('bar', bar)
    .gte('time', config.start).lt('time', config.end)
    .order('time', { ascending: true }).range(from, to));
  if (error) throw error;
  return data.map(row => ({ ...row, time: Date.parse(row.time) / 1000 }));
}

export async function fetchGoldPreviewObs(bar = '1h') {
  const config = goldPreviewConfig(bar);
  const { data, error } = await fetchAllRows((from, to) => supabase.from('ob_zones')
    .select('instrument,timeframe,direction,top,bottom,touched,invalidated,start_time,end_time')
    .eq('instrument', 'XAUUSD').eq('timeframe', config.timeframe)
    .gte('start_time', config.start).lt('start_time', config.end)
    .order('start_time', { ascending: true }).order('id', { ascending: true }).range(from, to));
  if (error) throw error;
  return data.map(mapObZone);
}
