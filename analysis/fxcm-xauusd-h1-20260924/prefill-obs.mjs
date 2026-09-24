import { readFileSync, writeFileSync } from 'node:fs';
import { detectOrderBlocks } from '../../src/orderBlockDetection.js';
import { GOLD_H1_MIN_FVG_USD } from '../../src/goldH1ObConfig.js';

const base = new URL('./', import.meta.url);
const data = JSON.parse(readFileSync(new URL('candles.json', base), 'utf8'));
const candles = data.instruments['XAU/USD'].candles.map(c => ({...c,time:Date.parse(c.time)/1000}));
const zones = detectOrderBlocks(candles, '1H', false, GOLD_H1_MIN_FVG_USD);
const iso = t => t == null ? null : new Date(t*1000).toISOString();
const rows = zones.map(z => ({instrument:'XAUUSD',timeframe:'1H',direction:z.dir===1?'long':'short',
  top:z.top,bottom:z.bottom,start_time:iso(z.startTime),end_time:iso(z.endTime),
  touched:z.touched,invalidated:z.invalidated,retested:z.retested,retested_at:iso(z.retestedAt),notified:true}));
writeFileSync(new URL('order-blocks.json',base),JSON.stringify({minFvgUsd:GOLD_H1_MIN_FVG_USD,asOf:data.end_exclusive_utc,rows},null,2)+'\n');
// Typisierte JSON-Eingabe; nur Gold-H1-Schlüssel, keine Löschung oder nachträgliche Benachrichtigung.
writeFileSync(new URL('../../.debug/gold-h1-obs.sql',base), `
insert into public.ob_zones(instrument,timeframe,direction,top,bottom,start_time,end_time,touched,invalidated,retested,retested_at,notified)
select instrument,timeframe,direction,top,bottom,start_time,end_time,touched,invalidated,retested,retested_at,notified
from jsonb_to_recordset($gold$${JSON.stringify(rows)}$gold$::jsonb) as x(instrument text,timeframe text,direction text,top numeric,bottom numeric,start_time timestamptz,end_time timestamptz,touched boolean,invalidated boolean,retested boolean,retested_at timestamptz,notified boolean)
on conflict (instrument,timeframe,start_time,direction) do nothing;
`);
console.log(JSON.stringify({count:rows.length,invalidated:rows.filter(r=>r.invalidated).length,minFvgUsd:GOLD_H1_MIN_FVG_USD}));
