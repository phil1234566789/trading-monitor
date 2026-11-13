import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {detectSetupObs,detectTradeSetups,hasUninterruptedSweepReaction} from '../src/tradeSetup.js';
import {detectTradeSetup,hasUninterruptedSweepReaction as denoValid} from '../supabase/functions/_shared/tradeSetup.ts';

const at=t=>Date.parse(`2026-11-10T${t}:00+01:00`)/1000;
const m5=JSON.parse(readFileSync(new URL('./fixtures/xau-ts1-sweep-20261110.json',import.meta.url)));
const params={nowTime:at('01:50'),graceSec:300,lsMaxLeadSecH1:7200,lsMaxLeadSecM5:2700,maxDistanceM5:20,maxSweepDistance:30,maxLookbackSec:21600,obMaxDelaySec:3600,closeCheckMaxAgeSec:0};
const ls={dir:-1,price:4133.54,pivotTime:at('00:00'),touched:true,touchedTime:at('01:10')};
const setup={dir:-1,ls,obStartTime:at('01:40')};

describe('TS1 Sweep-Reaktion ohne bestätigte Gegen-FVG',()=>{
 it('verwirft Original40972 nach den beiden gepinnten bärischen FVGs in beiden Laufzeiten',()=>{
  const candles=m5.filter(c=>c.time+300<=at('01:50'));
  const obs=detectSetupObs(candles,0);
  expect(obs.filter(o=>o.dir===-1&&o.startTime>=at('01:15')&&o.startTime<=at('01:30')).map(o=>o.startTime)).toEqual([at('01:15'),at('01:30')]);
  expect(hasUninterruptedSweepReaction(setup,obs)).toBe(false);
  expect(denoValid(setup,obs)).toBe(false);
  expect(detectTradeSetups(-1,[],[],[ls],obs,params,candles)).toEqual([]);
  expect(detectTradeSetup(-1,[],[],[ls],obs,params,candles)).toBeNull();
 });
 it('erkennt die zweite native Gegen-FVG03:30 erst nach tatsächlicher Bestätigung03:40',()=>{
  const candidate={dir:-1,ls:{...ls,touchedTime:at('03:00')},obStartTime:at('04:00')};
  const before=detectSetupObs(m5.filter(c=>c.time+300<=at('03:35')),0);
  const after=detectSetupObs(m5.filter(c=>c.time+300<=at('03:40')),0);
  expect(hasUninterruptedSweepReaction(candidate,before)).toBe(true);
  expect(hasUninterruptedSweepReaction(candidate,after)).toBe(false);
 });
 for(const dir of [-1,1]) it(`behält gültige ${dir===-1?'Long':'Short'}-Reaktionen und ignoriert spätere Gegen-FVGs`,()=>{
  const candidate={dir,ls:{...ls,dir,touchedTime:1000},obStartTime:2000};
  const own={dir:-dir,top:10,bottom:9,startTime:2000};
  const obs=[{...own,dir,startTime:900},own,{...own,dir,startTime:2300}];
  expect(hasUninterruptedSweepReaction(candidate,obs)).toBe(true);
  expect(denoValid(candidate,obs)).toBe(true);
  expect(hasUninterruptedSweepReaction(candidate,[...obs,{...own,dir,startTime:1500}])).toBe(false);
 });
});
