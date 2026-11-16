import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {createOrderBlockReactionContext,evaluateOrderBlockReaction,evaluateReactionStop,internalOrderBlockFvgs,internalFvgOpenAt} from '../src/orderBlockReaction.js';
import {detectOrderBlocks} from '../src/orderBlockDetection.js';
import {orderBlockRecognitionTimes} from '../src/orderBlockRecognitionTime.js';
import {closedChecklistCandles} from '../src/tradeSetupChecklistTimeBasis.js';
import {detectDoubleOrderBlocks,DOUBLE_ORDER_BLOCK_VERSION} from '../src/doubleOrderBlocks.js';
import {m1FvgFullyFilled} from '../src/m1FvgEntrySequence.js';

// Philip, 16.11.2026: ein vollständiger A-Entry beendet die Reaktion; B ist danach kein weiterer Versuch.
const cases=[
 {id:'P14',day:'2026-10-16',first:1792147500,second:1792150200,dir:-1,entryTime:1792154280,entryPrice:4177.28,stopLoss:4181.45},
 {id:'P8',day:'2026-11-02',first:1793600400,second:1793604600,dir:-1,entryTime:1793606700,entryPrice:3903.21,stopLoss:3905.28},
];
const read=day=>JSON.parse(readFileSync(new URL(`./fixtures/dob-native/${day}.json`,import.meta.url),'utf8'));
const reflect=rows=>rows.map(c=>({...c,open:10000-c.open,high:10000-c.low,low:10000-c.high,close:10000-c.close}));

for(const mirrored of [false,true])describe(`A-Entry beendet die Reaktion (${mirrored?'gespiegelt':'nativ'})`,()=>{
 for(const c of cases)it(`${c.id}: B bleibt ab A-Entry skipped, auch mit späteren Kerzen`,()=>{
  const fixture=read(c.day),dir=mirrored?-c.dir:c.dir;
  const m1=mirrored?reflect(fixture.candles.m1):fixture.candles.m1,m5=mirrored?reflect(fixture.candles.m5):fixture.candles.m5;
  const evaluate=at=>{
   const closedM5=closedChecklistCandles(m5,'5m',at);
   const zone=detectOrderBlocks(closedM5,'5m',true,0).find(z=>z.startTime===c.second&&z.dir===dir);
   expect(zone).toBeDefined();
   return evaluateOrderBlockReaction(createOrderBlockReactionContext(closedChecklistCandles(m1,'1m',at),at,'XAUUSD'),
    {...zone,recognizedAt:orderBlockRecognitionTimes(closedM5,'5m').get(c.second),timeframe:'5M'});
  };
  const prefix=evaluate(c.entryTime);
  for(const at of [c.entryTime,c.entryTime+60,m1.at(-1).time+60]){
   const r=evaluate(at);
   expect(r).toMatchObject({state:'true',verdict:{state:'true',knownAt:c.entryTime}});
   expect(r.routes.a).toMatchObject({status:'entry',entryTime:c.entryTime});
   expect(r.routes.a.entryPrice).toBeCloseTo(mirrored?10000-c.entryPrice:c.entryPrice,8);
   expect(r.routes.a.stopLoss).toBeCloseTo(mirrored?10000-c.stopLoss:c.stopLoss,8);
   expect(r.routes.b).toEqual({status:'skipped',reason:'entryAlreadyFound',knownAt:c.entryTime});
   expect(r.routes).toEqual(prefix.routes);
  }
 });

 it('A unknown wegen belegter Teilüberlappung beendet B nicht: dritter nativer Versuch liefert den Entry',()=>{
  const fixture=read('2026-10-16'),m1=mirrored?reflect(fixture.candles.m1):fixture.candles.m1;
  const m5=mirrored?reflect(fixture.candles.m5):fixture.candles.m5;
  const zone=detectOrderBlocks(m5,'5m',true,0).find(z=>z.startTime===1792157400&&z.dir===(mirrored?-1:1));
  expect(zone).toBeDefined();
  const ob={...zone,recognizedAt:orderBlockRecognitionTimes(m5,'5m').get(zone.startTime),timeframe:'5M'};
  const evaluate=at=>{
   const context=createOrderBlockReactionContext(closedChecklistCandles(m1,'1m',at),at,'XAUUSD');
   return {context,result:evaluateOrderBlockReaction(context,ob)};
  };
  const initial=evaluate(1792167240),r=initial.result;
  // Quelle 15:33, bekannt 15:35: offen und nur teilweise innerhalb der M5-Formation, kein erfundener A-Stop.
  const partial=internalOrderBlockFvgs(initial.context,ob,r.contact.candleTime).find(f=>f.candleTime===1792157580);
  expect(partial).toMatchObject({recognizedAt:1792157700});
  expect(partial.bottom).toBeCloseTo(mirrored?10000-4161.16:4159.79,8);
  expect(partial.top).toBeCloseTo(mirrored?10000-4159.79:4161.16,8);
  expect(internalFvgOpenAt(initial.context,partial,1792167240)).toBe(true);
  expect(partial.bottom<ob.bottom||partial.top>ob.top).toBe(true);
  expect(r.routes.a).toMatchObject({status:'unknown',reason:'partialOverlapOpen',knownAt:1792167240});
  expect(r.routes.b.status).toBe('pending');
  const final=evaluate(1792172940).result;
  expect(final.routes.a).toEqual(r.routes.a);
  expect(final).toMatchObject({state:'true',verdict:{state:'true',knownAt:1792172940}});
  expect(final.routes.b).toMatchObject({status:'entry',entryTime:1792172940,
   entryFvg:{candleTime:1792172460,recognizedAt:1792172580}});
  expect(final.routes.b.entryPrice).toBeCloseTo(mirrored?10000-4162.5:4162.5,8);
  expect(final.routes.b.stopLoss).toBeCloseTo(mirrored?10000-4156.61:4156.61,8);
  expect(final.routes.b.attempts).toHaveLength(3);
  expect(final.routes.b.attempts).toMatchObject([
   {status:'rejected',reason:'entryBOrderBlockBroken',knownAt:1792167540,fvg:{candleTime:1792167120,recognizedAt:1792167240}},
   {status:'rejected',reason:'entryBOrderBlockBroken',knownAt:1792169340,fvg:{candleTime:1792168920,recognizedAt:1792169040}},
   {status:'entry',entryTime:1792172940,fvg:{candleTime:1792172460,recognizedAt:1792172580}},
  ]);
 });

 it('B bewertet interne FVGs am Entry: bei erster Reaktion offen, vor Entry gefüllt, daher Retest-Extrem-SL',()=>{
  const fixture=read('2026-11-11'),m1=mirrored?reflect(fixture.candles.m1):fixture.candles.m1;
  const m5=mirrored?reflect(fixture.candles.m5):fixture.candles.m5,dir=mirrored?1:-1;
  const zone=detectOrderBlocks(m5,'5m',true,0).find(z=>z.startTime===1794411900&&z.dir===dir);
  expect(zone).toBeDefined();
  const ob={...zone,recognizedAt:orderBlockRecognitionTimes(m5,'5m').get(zone.startTime),timeframe:'5M'};
  const evaluate=at=>{
   const context=createOrderBlockReactionContext(closedChecklistCandles(m1,'1m',at),at,'XAUUSD');
   return {context,result:evaluateOrderBlockReaction(context,ob)};
  };
  const reactionAt=1794412920,fillAt=1794413820,entryAt=1794414240,initial=evaluate(reactionAt);
  // Native Quelle 16:40, bekannt 16:42, vollständig intern. Erst Kerze 17:16 füllt sie, bekannt 17:17.
  const source=internalOrderBlockFvgs(initial.context,ob,initial.result.contact.candleTime).find(f=>f.candleTime===1794411600);
  expect(source).toMatchObject({recognizedAt:1794411720});
  expect(source.bottom).toBeCloseTo(mirrored?10000-4007.44:4004.68,8);
  expect(source.top).toBeCloseTo(mirrored?10000-4004.68:4007.44,8);
  expect(source.bottom).toBeGreaterThanOrEqual(ob.bottom);
  expect(source.top).toBeLessThanOrEqual(ob.top);
  const firstFill=m1.find(c=>c.time>=source.recognizedAt&&m1FvgFullyFilled(c,source));
  expect(firstFill.time+60).toBe(fillAt);
  expect(internalFvgOpenAt(initial.context,source,reactionAt)).toBe(true);
  const initialStop=evaluateReactionStop(initial.context,ob,initial.result.contact,reactionAt);
  expect(initialStop).toMatchObject({status:'ready',anchor:'m5-edge'});
  expect(initialStop.price).toBeCloseTo(mirrored?10000-4009.85:4009.85,8);

  for(const at of [reactionAt,fillAt-1,fillAt,1794414120,entryAt-1]){
   const {context,result:r}=evaluate(at);
   const same=context.byDirection[dir===1?'long':'short'].find(f=>f.candleTime===source.candleTime);
   expect(internalFvgOpenAt(context,same,at)).toBe(at<fillAt);
   expect(r.routes.a).toMatchObject({status:'rejected',reason:'opposingFvgOpen',knownAt:reactionAt});
   expect(r.routes.b.status).not.toBe('entry');
   expect(r.routes.b).not.toHaveProperty('stopLoss');
   expect(r.routes.b.attempts.every(attempt=>!Object.hasOwn(attempt,'stopLoss'))).toBe(true);
  }
  const ready=evaluate(entryAt).result;
  expect(ready).toMatchObject({state:'true',knownAt:reactionAt,verdict:{state:'true',knownAt:entryAt}});
  expect(ready.routes.b).toMatchObject({status:'entry',entryTime:entryAt,stopAnchor:'retestExtreme',
   entryFvg:{candleTime:1794414000,recognizedAt:1794414120}});
  expect(ready.routes.b.entryPrice).toBeCloseTo(mirrored?10000-4004.84:4004.84,8);
  expect(ready.routes.b.stopLoss).toBeCloseTo(mirrored?10000-4007.70:4007.70,8);
  expect(ready.routes.b.stopLoss).not.toBe(initialStop.price);
  // Präfix-SL bleibt auch nach späteren Kerzen identisch, statt auf den ursprünglichen Kantenstop zurückzuspringen.
  expect(evaluate(m1.at(-1).time+60).result.routes.b).toEqual(ready.routes.b);
 });

 it('DOB-Projektion erhält skipped ohne Entry, Outcome oder unbekannten Folgezustand',()=>{
  const c=cases[0],fixture=read(c.day);
  const m1=mirrored?reflect(fixture.candles.m1):fixture.candles.m1,m5=mirrored?reflect(fixture.candles.m5):fixture.candles.m5;
  const result=detectDoubleOrderBlocks({instrument:'XAUUSD',m1Candles:m1,m5Candles:m5,evaluatedAt:m1.at(-1).time+60});
  const pair=result.pairs.find(p=>p.firstOrderBlock.startTime===c.first&&p.secondOrderBlock.startTime===c.second);
  expect(pair).toBeDefined();
  expect(pair.entries.a).toMatchObject({status:'ready',entryTime:c.entryTime});
  expect(pair.entries.b).toEqual({variant:'b',status:'skipped',reason:'entryAlreadyFound',knownAt:c.entryTime});
  expect(DOUBLE_ORDER_BLOCK_VERSION).toMatch(/terminal-entry-v11$/);
 });
});
