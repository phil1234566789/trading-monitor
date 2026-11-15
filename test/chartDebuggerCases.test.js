import {describe,expect,it} from 'vitest';
import {CHART_DEBUGGER_CASES,loadCaseFixture,evaluateCase,caseSteps} from '../src/chartDebuggerCases.js';
import {measureReactionContact} from '../src/orderBlockReaction.js';

const NEAR={nearTouch:'second'};
const byId=id=>CHART_DEBUGGER_CASES.find(c=>c.id===id);
const at=async(id,evaluatedAt,options)=>{const c=byId(id),fixture=await loadCaseFixture(c);return evaluateCase(c,fixture,evaluatedAt??caseSteps(c,fixture).through,options);};
const ob2=r=>r.orderBlocks.at(-1).reaction;

describe('Chart-Debugger: OB-Reaktions-Fälle unter dem Produkt-Default W1 (nur exakter Touch)',()=>{
 it('every case finds all its OBs and evaluates a reaction by the end of its window',async()=>{
  for(const c of CHART_DEBUGGER_CASES){
   const r=await at(c.id);
   for(const ob of r.orderBlocks){expect(ob.orderBlock,`${c.id} ${ob.startTime}`).not.toBeNull();expect(ob.reaction.state).not.toBe('unknown');}
  }
 });
 it('shows the same reference outcomes as the product tests',async()=>{
  expect(ob2(await at('503'))).toMatchObject({state:'false',reason:'m5OrderBlockBroken',knownAt:1792556940});
  // P14/Pin 500: der exakte Retest hat keinen belegten SL (Retest-Extrem unspezifiziert), also kein Paar.
  const p14=await at('P14');
  expect(p14.pair).toBeNull();
  expect(ob2(p14)).toMatchObject({state:'true',contact:{status:'touch'},knownAt:1792154280,
   routes:{a:{status:'unknown',reason:'retestEpisodeUnresolved',entryCandidate:{entryTime:1792154280,entryPrice:4177.28}},
    b:{status:'unknown',reason:'retestEpisodeUnresolved',entryCandidate:{entryTime:1792158360,entryPrice:4175.33}}}});
  expect(ob2(await at('504'))).toMatchObject({state:'true',contact:{status:'touch'},knownAt:1792563300,
   routes:{a:{status:'unknown',reason:'retestEpisodeUnresolved'},b:{status:'unknown',reason:'retestEpisodeUnresolved'}}});
  expect((await at('P16')).pair.entries).toMatchObject({a:{status:'ready',entryTime:1792557120,entryPrice:4120.27,stopPrice:4112.95},
   b:{status:'ready',entryTime:1792557540,entryPrice:4117.62,stopPrice:4112.95}});
  expect((await at('P17')).pair.entries).toMatchObject({a:{status:'ready',entryTime:1792481460,entryPrice:4130.55,stopPrice:4136.58},b:{status:'pending'}});
 });
 it('the near-touch switch restores the near-touch reactions of OB2',async()=>{
  expect((await at('P14',undefined,NEAR)).pair.entries).toMatchObject({a:{status:'ready',entryTime:1792151400,entryPrice:4176.29,stopPrice:4181.98},
   b:{status:'ready',entryTime:1792151580,entryPrice:4175.75,stopPrice:4181.98}});
  expect(ob2(await at('504',undefined,NEAR))).toMatchObject({contact:{status:'nearTouch',knownAt:1792561440},knownAt:1792561620,
   routes:{b:{status:'rejected',reason:'entryBOrderBlockTooDeep',knownAt:1792562040}}});
  expect((await at('P16',undefined,NEAR)).pair.entries).toMatchObject({a:{status:'ready',entryPrice:4123.01},b:{status:'invalid',reason:'entryBOrderBlockBroken'}});
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
