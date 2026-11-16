import {describe,expect,it} from 'vitest';
import {CHART_DEBUGGER_CASES,loadCaseFixture,evaluateCase,caseSteps,expectationOf,expectedText,productMatches} from '../src/chartDebuggerCases.js';
import {measureReactionContact} from '../src/orderBlockReaction.js';

const NEAR={nearTouch:'second'};
const byId=id=>CHART_DEBUGGER_CASES.find(c=>c.id===id);
const at=async(id,evaluatedAt,options)=>{const c=byId(id),fixture=await loadCaseFixture(c);return evaluateCase(c,fixture,evaluatedAt??caseSteps(c,fixture).through,options);};
const ob2=r=>r.orderBlocks.at(-1).reaction;

describe('Chart-Debugger: OB-Reaktions-Fälle unter dem Produkt-Default W1 (nur exakter Touch)',()=>{
 it('every case finds all its OBs and settles their structure, independently of pending public entries',async()=>{
  for(const c of CHART_DEBUGGER_CASES){
   const r=await at(c.id);
   for(const ob of r.orderBlocks){expect(ob.orderBlock,`${c.id} ${ob.startTime}`).not.toBeNull();expect(['true','false']).toContain(ob.reaction.structuralState);}
  }
 });
 it('every case has Philips expectation, and the product deviates exactly where it is known to',async()=>{
  const deviations=[];
  for(const c of CHART_DEBUGGER_CASES){
   expect(expectationOf(c),c.id).not.toBeNull();
   if(!productMatches(c,await at(c.id)))deviations.push(c.id);
  }
  // 501 und 504 erfüllen ihr Soll seit der 2-%-Berührungstoleranz (v9).
  expect(deviations).toEqual([]);
  expect(expectedText(byId('501'))).toBe('Negativ · Reaktion false, kein Entry');
  expect(expectedText(byId('504'))).toBe('Negativ · Reaktion false, kein Entry');
  expect(expectedText(byId('P14'))).toBe('Positiv · DOB');
 });
 it('shows the same reference outcomes as the product tests',async()=>{
  expect(ob2(await at('503'))).toMatchObject({state:'false',reason:'m5OrderBlockBroken',knownAt:1792556940});
  // P14/Pin 500: ohne offene interne FVG ist der SL das Retest-Hoch (M1 16.10. 14:35 Berlin).
  const p14=await at('P14');
  expect(p14.pair.entries).toMatchObject({a:{status:'ready',entryTime:1792154280,entryPrice:4177.28,stopPrice:4181.45,stopAnchor:'retestExtreme'},
   b:{status:'skipped',reason:'entryAlreadyFound',knownAt:1792154280}});
  // 504: Kontakt 07:43 liegt 1,4 % vor der Kante, also Touch; Entry b scheitert am M1-OB-Einstich um 07:54.
  expect(ob2(await at('504'))).toMatchObject({state:'false',structuralState:'true',contact:{status:'touch',knownAt:1792561440},knownAt:1792561620,
   routes:{a:{status:'rejected',reason:'opposingFvgOpen',knownAt:1792561620},
    b:{status:'rejected',reason:'entryBOrderBlockTooDeep',knownAt:1792562040}}});
  // 501: das High 05:37 liegt 1,15 % unter der Gegenkante, Reaktion false ab 05:38.
  expect(ob2(await at('501'))).toMatchObject({state:'false',reason:'m5OrderBlockBroken',knownAt:1794199080});
  expect((await at('P16')).pair.entries).toMatchObject({a:{status:'invalid',reason:'opposingFvgOpen',knownAt:1792557120},
   b:{status:'ready',entryTime:1792557540,entryPrice:4117.62,stopPrice:4112.95}});
  expect((await at('P17')).pair.entries).toMatchObject({a:{status:'invalid',reason:'opposingFvgOpen',knownAt:1792481460},b:{status:'pending'}});
  expect(ob2(await at('P17'))).toMatchObject({state:'unknown',structuralState:'true',verdict:{state:'pending'}});
 });
 it('Pins 497/498: both OBs react, but the M1 08:00 high breaks the OB1 hold before the OB2 reaction',async()=>{
  const {orderBlocks:[first,second],m1,pair,hold}=await at('497');
  expect(pair).toBeNull();
  expect(hold).toMatchObject({status:'failed',reason:'retestExtremeSwept',final:true,checkedFrom:1791784680,checkedThrough:1791789300,
   firstSweepTime:1791784800,firstSweepKnownAt:1791784860,anchor:{kind:'exact',price:4192.19,fromTime:1791784680},breakCandle:{high:4192.69}});
  expect(expectedText(byId('498'))).toBe('Negativ · Hold gebrochen 08:00');
  expect(first.reaction).toMatchObject({state:'true',contact:{candleTime:1791784380},penetration:{extremePrice:4192.19},knownAt:1791784680});
  expect(second.reaction).toMatchObject({state:'true',contact:{candleTime:1791788640},knownAt:1791789300});
  const holdBreak=m1.find(c=>c.time>first.reaction.knownAt&&c.high>first.reaction.penetration.extremePrice);
  expect(holdBreak).toMatchObject({time:1791784800,high:4192.69});
  expect(holdBreak.time).toBeLessThan(second.reaction.knownAt);
 });
 it('the near-touch switch restores the near-touch reactions of OB2',async()=>{
  expect((await at('P14',undefined,NEAR)).pair.entries).toMatchObject({a:{status:'ready',entryTime:1792151400,entryPrice:4176.29,stopPrice:4181.98},
   b:{status:'skipped',reason:'entryAlreadyFound',knownAt:1792151400}});
  expect(ob2(await at('504',undefined,NEAR))).toMatchObject({contact:{status:'touch',knownAt:1792561440},knownAt:1792561620,
   routes:{b:{status:'rejected',reason:'entryBOrderBlockTooDeep',knownAt:1792562040}}});
  expect((await at('P16',undefined,NEAR)).pair.entries).toMatchObject({a:{status:'ready',entryPrice:4123.01},
   b:{status:'skipped',reason:'entryAlreadyFound',knownAt:1792556100}});
  // Der Near-A-Entry 06:15 beendet die Auswertung, daher weder erster B-Versuch noch Retry 06:39.
  expect(ob2(await at('P16',undefined,NEAR)).routes.b).toEqual({status:'skipped',reason:'entryAlreadyFound',knownAt:1792556100});
 });
 // Portiert aus dem Prototyp: Wissen kommt erst mit der schließenden Kerze, Rückspulen nimmt es wieder weg.
 it('reveals OB, reaction, Entry-b rejection and DOB only once known',async()=>{
  const full=ob2(await at('504',undefined,NEAR));
  expect(ob2(await at('504',full.knownAt-60,NEAR)).state).not.toBe('true');
  expect(ob2(await at('504',full.routes.b.knownAt-60,NEAR)).routes.b.status).toBe('pending');
  expect((await at('504',byId('504').orderBlocks[0]+60)).orderBlocks[0].orderBlock).toBeNull();
  const pair=(await at('P16')).pair;
  expect((await at('P16',pair.recognizedAt-60)).pair).toBeNull();
 });
 it('keeps the 10 % near-touch boundary inclusive on decimal prices without a buffer',()=>{
  const zone={dir:1,bottom:4100.1,top:4101.1};
  expect(measureReactionContact(zone,{time:0,low:4101.2,high:4102})).toBe('nearTouch');
  expect(measureReactionContact(zone,{time:0,low:4101.21,high:4102})).toBe('none');
  expect(measureReactionContact({...zone,dir:-1},{time:0,low:4099,high:4100})).toBe('nearTouch');
 });
});
