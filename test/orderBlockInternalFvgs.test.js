import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {createOrderBlockReactionContext,internalOrderBlockFvgs,internalFvgOpenAt} from '../src/orderBlockReaction.js';
import {detectOrderBlocks} from '../src/orderBlockDetection.js';
import {orderBlockRecognitionTimes} from '../src/orderBlockRecognitionTime.js';

const fixture=day=>JSON.parse(readFileSync(new URL(`./fixtures/dob-native/${day}.json`,import.meta.url),'utf8'));
const time=(day,hm)=>Date.parse(`${day}T${hm}:00+01:00`)/1000;
it('P7 OB2 has two filled formation FVGs at 04:10, not the new open FVGs from 03:58 and 03:59',()=>{
 const d=fixture('2026-11-03'),at=time('2026-11-03','04:10');
 const rows=d.candles.m1.filter(c=>c.time+60<=at),ctx=createOrderBlockReactionContext(rows,at,'XAUUSD');
 const ob={...detectOrderBlocks(d.candles.m5,'5m',true,0).find(z=>z.startTime===1793671200),recognizedAt:1793671800};
 const fvgs=internalOrderBlockFvgs(ctx,ob);
 expect(fvgs.map(f=>f.candleTime)).toEqual(['02:56','03:00'].map(hm=>time('2026-11-03',hm)));
 expect(fvgs.every(f=>internalFvgOpenAt(ctx,f,at)===false)).toBe(true);
});

it('keeps the 05:14 M1-FVG inside the actual formation of the 05:15 M5-OB (Pin 502)',()=>{
 const d=fixture('2026-10-21'),at=Date.parse('2026-10-21T06:32:00+02:00')/1000;
 const ctx=createOrderBlockReactionContext(d.candles.m1.filter(c=>c.time+60<=at),at,'XAUUSD');
 const zone=detectOrderBlocks(d.candles.m5,'5m',true,0).find(z=>z.startTime===1792552500&&z.dir===1);
 const ob={...zone,recognizedAt:orderBlockRecognitionTimes(d.candles.m5,'5m').get(zone.startTime)};
 expect(internalOrderBlockFvgs(ctx,ob).some(f=>f.candleTime===1792552440)).toBe(true);
});
