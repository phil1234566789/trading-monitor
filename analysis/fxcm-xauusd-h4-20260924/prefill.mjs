import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { detectOrderBlocks } from '../../src/orderBlockDetection.js';
import { GOLD_H4_MIN_FVG_USD } from '../../src/goldH4ObConfig.js';

const base = new URL('./', import.meta.url);
const data = JSON.parse(readFileSync(new URL('candles.json', base), 'utf8'));
const summary = JSON.parse(readFileSync(new URL('summary.json', base), 'utf8'));
const check = summary.instruments['XAU/USD'];
assert(check.count > 100 && check.unique_timestamps && check.strictly_sorted);
assert.equal(check.invalid_ohlc.length + check.outside_range_or_open + check.off_precision_grid, 0);
assert.equal(summary.matched_h4_scale.gold_h4_fvg_candidate, GOLD_H4_MIN_FVG_USD);
const rows = data.instruments['XAU/USD'].candles;
assert(rows.every(r => r.instrument === 'XAUUSD' && r.bar === '4h'));
const candles = rows.map(c => ({ ...c, time: Date.parse(c.time) / 1000 }));
const zones = detectOrderBlocks(candles, '4H', false, GOLD_H4_MIN_FVG_USD);
const iso = t => t == null ? null : new Date(t * 1000).toISOString();
const obs = zones.map(z => ({instrument:'XAUUSD',timeframe:'4H',direction:z.dir===1?'long':'short',
  top:z.top,bottom:z.bottom,start_time:iso(z.startTime),end_time:iso(z.endTime),
  touched:z.touched,invalidated:z.invalidated,retested:z.retested,retested_at:iso(z.retestedAt),notified:true}));
writeFileSync(new URL('order-blocks.json',base),JSON.stringify({minFvgUsd:GOLD_H4_MIN_FVG_USD,asOf:data.end_exclusive_utc,rows:obs},null,2)+'\n');
// Einmaliger, idempotenter Testimport; keine Änderungen an Forex/H1 oder Benachrichtigungen.
writeFileSync(new URL('../../.debug/gold-h4-seed.sql',base), `begin;
insert into public.fxcm_candles(instrument,bar,time,open,high,low,close,volume,source)
select instrument,bar,time,open,high,low,close,volume,'fxcm'
from jsonb_to_recordset($gold$${JSON.stringify(rows)}$gold$::jsonb) as x(instrument text,bar text,time timestamptz,open numeric,high numeric,low numeric,close numeric,volume numeric)
on conflict (instrument,bar,time) do nothing;
insert into public.ob_zones(instrument,timeframe,direction,top,bottom,start_time,end_time,touched,invalidated,retested,retested_at,notified)
select instrument,timeframe,direction,top,bottom,start_time,end_time,touched,invalidated,retested,retested_at,notified
from jsonb_to_recordset($gold$${JSON.stringify(obs)}$gold$::jsonb) as x(instrument text,timeframe text,direction text,top numeric,bottom numeric,start_time timestamptz,end_time timestamptz,touched boolean,invalidated boolean,retested boolean,retested_at timestamptz,notified boolean)
on conflict (instrument,timeframe,start_time,direction) do nothing;
commit;
`);
console.log(JSON.stringify({candles:rows.length,septemberCandles:rows.filter(r=>r.time>='2026-08-31T22:00:00').length,obs:obs.length,septemberObs:obs.filter(r=>r.start_time>='2026-08-31T22:00:00').length,invalidated:obs.filter(r=>r.invalidated).length}));
