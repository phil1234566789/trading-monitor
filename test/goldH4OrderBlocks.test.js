import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { detectOrderBlocks } from '../src/orderBlockDetection.js';
import { detectOrderBlocks as mcp } from '../supabase/functions/trading-monitor-mcp/orderBlockDetection.js';
import { detectOrderBlocks as backend } from '../supabase/functions/_shared/orderBlocks.ts';
import { GOLD_H4_MIN_FVG_USD } from '../src/goldH4ObConfig.js';
const candle = (time,low,high) => ({time,low,high,open:low,close:high});

it('accepts exact H4 Gold threshold, rejects one cent below, in all runtimes', () => {
  const rows = [candle(0,4390,4400),candle(14400,4390,4400),candle(28800,4399,4405),candle(43200,4406.19,4410)];
  for (const detect of [detectOrderBlocks,mcp,backend]) {
    expect(detect(rows,'4H',false,GOLD_H4_MIN_FVG_USD)).toHaveLength(1);
    expect(detect(rows.map((r,i)=>i===3?{...r,low:4406.18,open:4406.18}:r),'4H',false,GOLD_H4_MIN_FVG_USD)).toHaveLength(0);
  }
});

it('keeps the native September H4 probe closed, ordered, and consistent across detectors', () => {
  const data = JSON.parse(readFileSync(new URL('../analysis/fxcm-xauusd-h4-20260924/candles.json',import.meta.url),'utf8'));
  const candles = data.instruments['XAU/USD'].candles.map(c=>({...c,time:Date.parse(c.time)/1000}));
  expect(candles).toHaveLength(143);
  expect(new Set(candles.map(c=>c.time)).size).toBe(candles.length);
  for (const [i,c] of candles.entries()) {
    expect(c.time+14400).toBeLessThanOrEqual(Date.parse(data.end_exclusive_utc)/1000);
    expect(c.time % 14400).toBe(3600);
    expect(c.low).toBeLessThanOrEqual(Math.min(c.open,c.close));
    expect(c.high).toBeGreaterThanOrEqual(Math.max(c.open,c.close));
    if(i) expect(c.time).toBeGreaterThan(candles[i-1].time);
  }
  const zones=detectOrderBlocks(candles,'4H',false,GOLD_H4_MIN_FVG_USD);
  expect(zones).toHaveLength(16);
  expect(mcp(candles,'4H',false,GOLD_H4_MIN_FVG_USD)).toEqual(zones);
  expect(backend(candles,'4H',false,GOLD_H4_MIN_FVG_USD)).toEqual(zones);
});
