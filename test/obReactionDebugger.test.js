import {describe,expect,it} from 'vitest';
import {OB_REACTION_CASES,loadCaseFixture,evaluateCase,caseSteps} from '../src/obReactionDebuggerCases.js';
import {measureReactionContact} from '../src/orderBlockReaction.js';

const byId=id=>OB_REACTION_CASES.find(c=>c.id===id);
const at=async(id,evaluatedAt)=>{const c=byId(id),fixture=await loadCaseFixture(c);return evaluateCase(c,fixture,evaluatedAt??caseSteps(c,fixture).through);};

describe('OB-Reaktions-Debugger: Fälle',()=>{
 it('every case finds all its OBs and evaluates a reaction by the end of its window',async()=>{
  for(const c of OB_REACTION_CASES){
   const r=await at(c.id);
   for(const ob of r.orderBlocks){expect(ob.orderBlock,`${c.id} ${ob.startTime}`).not.toBeNull();expect(ob.reaction.state).not.toBe('unknown');}
  }
 });
 it('shows the same reference outcomes as the product tests',async()=>{
  expect((await at('503')).orderBlocks[0].reaction).toMatchObject({state:'false',reason:'m5OrderBlockBroken'});
  expect((await at('504')).orderBlocks[0].reaction.routes.b).toMatchObject({status:'rejected',reason:'entryBOrderBlockTooDeep'});
  expect((await at('500')).orderBlocks[0].reaction.routes.a).toMatchObject({status:'entry',entryPrice:4176.29,stopLoss:4181.98});
  expect((await at('P14')).pair.entries.b).toMatchObject({status:'ready',entryTime:1792151580,entryPrice:4175.75});
  expect((await at('P16')).pair.entries).toMatchObject({a:{status:'ready',entryPrice:4123.01},b:{status:'invalid'}});
  expect((await at('P17')).pair.entries.a).toMatchObject({status:'ready',entryPrice:4130.55,stopPrice:4136.58});
 });
 // Portiert aus dem Prototyp: Wissen kommt erst mit der schließenden Kerze, Rückspulen nimmt es wieder weg.
 it('reveals OB, reaction, Entry-b rejection and DOB only once known',async()=>{
  const c=byId('504'),full=(await at('504')).orderBlocks[0].reaction;
  expect((await at('504',full.knownAt-60)).orderBlocks[0].reaction.state).not.toBe('true');
  expect((await at('504',full.routes.b.knownAt-60)).orderBlocks[0].reaction.routes.b.status).toBe('pending');
  expect((await at('504',c.orderBlocks[0]+60)).orderBlocks[0].orderBlock).toBeNull();
  const pair=(await at('P14')).pair;
  expect((await at('P14',pair.recognizedAt-60)).pair).toBeNull();
 });
 it('keeps the 10 % near-touch boundary inclusive on decimal prices without a buffer',()=>{
  const zone={dir:1,bottom:4100.1,top:4101.1};
  expect(measureReactionContact(zone,{time:0,low:4101.2,high:4102})).toBe('nearTouch');
  expect(measureReactionContact(zone,{time:0,low:4101.21,high:4102})).toBe('none');
  expect(measureReactionContact({...zone,dir:-1},{time:0,low:4099,high:4100})).toBe('nearTouch');
 });
});
