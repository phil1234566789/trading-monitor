import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {measureReactionContact,createOrderBlockReactionContext,evaluateOrderBlockReaction,evaluateReactionStop} from '../src/orderBlockReaction.js';
import {detectOrderBlocks} from '../src/orderBlockDetection.js';
import {orderBlockRecognitionTimes} from '../src/orderBlockRecognitionTime.js';

const days=new Map();
const fixture=day=>{if(!days.has(day))days.set(day,JSON.parse(readFileSync(new URL(`./fixtures/dob-native/${day}.json`,import.meta.url),'utf8')));return days.get(day);};
const nativeOrderBlock=(day,startTime,dir)=>{
 const m5=fixture(day).candles.m5,zone=detectOrderBlocks(m5,'5m',true,0).find(z=>z.startTime===startTime&&z.dir===dir);
 return {...zone,recognizedAt:orderBlockRecognitionTimes(m5,'5m').get(startTime),timeframe:'5M'};
};
const react=(day,startTime,dir,{evaluatedAt,m1}={})=>{
 const rows=m1??fixture(day).candles.m1;
 return evaluateOrderBlockReaction(createOrderBlockReactionContext(rows,evaluatedAt??fixture(day).candles.m1.at(-1).time+60),nativeOrderBlock(day,startTime,dir));
};

describe('reaction contact',()=>{
 const long={dir:1,bottom:100,top:110},short={dir:-1,bottom:100,top:110};
 it.each([[long,{low:109,high:112},'touch'],[long,{low:111,high:113},'nearTouch'],[long,{low:111.01,high:113},'none'],
  [short,{low:98,high:100},'touch'],[short,{low:97,high:99},'nearTouch'],[short,{low:97,high:98.99},'none']])('classifies %o with %o as %s',(zone,candle,expected)=>{
  expect(measureReactionContact(zone,{time:0,...candle})).toBe(expected);
 });
 it('keeps an approach from the wrong side as no contact and invalid geometry unknown',()=>{
  expect(measureReactionContact(long,{time:0,low:95,high:99.5})).toBe('none');
  expect(measureReactionContact(short,{time:0,low:110.5,high:111})).toBe('none');
  expect(measureReactionContact({dir:0,bottom:100,top:110},{time:0,low:99,high:101})).toBe('unknown');
 });
});

describe('internal FVG stop at entry',()=>{
 const rows=[...Array(20)].map((_,i)=>({time:600+i*60,low:105,high:108}));
 const context=fvgs=>({rows,candidates:fvgs,fills:new Map()});
 const ob={dir:1,bottom:100,top:110},contact={candleTime:900},inside={direction:'long',recognizedAt:660,bottom:102,top:104};
 it('uses the far M5 edge while a pre-existing internal FVG is open',()=>{
  expect(evaluateReactionStop(context([inside]),ob,contact,1200)).toMatchObject({status:'ready',anchor:'m5-edge',price:100});
  const below=rows.map(c=>({...c,low:101,high:103}));
  expect(evaluateReactionStop({rows:below,candidates:[{...inside,direction:'short',bottom:106,top:108}],fills:new Map()},{...ob,dir:-1},contact,1200).price).toBe(110);
 });
 it('never invents a tighter stop: filled, only-overlapping or later FVGs leave it unknown',()=>{
  const filled=rows.map(c=>c.time===720?{...c,low:101}:c);
  expect(evaluateReactionStop({rows:filled,candidates:[inside],fills:new Map()},ob,contact,1200))
   .toMatchObject({status:'unknown',reason:'retestEpisodeUnresolved'});
  expect(evaluateReactionStop(context([{...inside,bottom:99,top:103}]),ob,contact,1200)).toMatchObject({status:'unknown',reason:'partialOverlapOpen'});
  expect(evaluateReactionStop(context([{...inside,recognizedAt:960}]),ob,contact,1200).status).toBe('unknown');
 });
 it('judges the stop at entry time; a later fill does not change it, a gap before entry does',()=>{
  const laterFill=rows.map(c=>c.time===1500?{...c,low:101}:c);
  expect(evaluateReactionStop({rows:laterFill,candidates:[inside],fills:new Map()},ob,contact,1200).price).toBe(100);
  expect(evaluateReactionStop({rows:rows.filter(c=>c.time!==780),candidates:[inside],fills:new Map()},ob,contact,1200))
   .toMatchObject({status:'unknown',reason:'internalFvgHistoryMissing'});
 });
});

describe('native reaction references',()=>{
 it('Pin 503: the M5 lower edge breaks before any reaction FVG, so both routes are rejected from 06:29 Berlin',()=>{
  const r=react('2026-10-21',1792555800,1);
  expect(r).toMatchObject({state:'false',reason:'m5OrderBlockBroken',knownAt:1792556940});
  expect(r.routes.a).toMatchObject({status:'rejected',knownAt:1792556940});expect(r.routes.b.status).toBe('rejected');
 });
 it('Pin 504: near-touch reaction 07:44/07:47, but Entry b is rejected for its M1 OB depth',()=>{
  const r=react('2026-10-21',1792558800,1);
  expect(r).toMatchObject({state:'true',contact:{status:'nearTouch',knownAt:1792561440},knownAt:1792561620});
  expect(r.routes.b).toMatchObject({status:'rejected',reason:'entryBOrderBlockTooDeep'});
 });
 it('Pin 502: Entry a stops at the bullish M5 lower edge while the old internal FVG is still open',()=>{
  expect(react('2026-10-21',1792552500,1).routes.a).toMatchObject({status:'entry',entryTime:1792556100,entryPrice:4123.01,stopLoss:4112.95,stopAnchor:'m5-edge'});
 });
 it('Pin 500: both routes stop at the bearish M5 upper edge, independent of what happens after the entry',()=>{
  const full=react('2026-10-16',1792150200,-1);
  expect(full.routes.a).toMatchObject({status:'entry',entryTime:1792151400,entryPrice:4176.29,stopLoss:4181.98});
  expect(full.routes.b).toMatchObject({status:'entry',entryTime:1792151580,entryPrice:4175.75,stopLoss:4181.98});
  expect(react('2026-10-16',1792150200,-1,{evaluatedAt:1792151580}).routes).toEqual(full.routes);
 });
 it('Pin 501: reaction true at 05:40 Berlin without inventing an entry SL',()=>{
  const r=react('2026-11-09',1794192300,-1,{evaluatedAt:1794199200+3600});
  expect(r).toMatchObject({state:'true',knownAt:1794199200});
  expect(r.routes.a).toMatchObject({status:'pending',reason:'retestEpisodeUnresolved',entryCandidate:{entryTime:1794199200,entryPrice:4128.84}});
 });
 it('stays unknown before contact, before the FVG and across a missing minute',()=>{
  expect(react('2026-10-21',1792552500,1,{evaluatedAt:1792555200}).reason).toBe('noContact');
  expect(react('2026-10-21',1792552500,1,{evaluatedAt:1792556040})).toMatchObject({state:'unknown',reason:'awaitingFvg'});
  const m1=fixture('2026-10-21').candles.m1.filter(c=>c.time!==1792555500);
  expect(react('2026-10-21',1792552500,1,{m1})).toMatchObject({state:'unknown',reason:'missingHistory'});
 });
});
