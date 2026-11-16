import {expect,it} from 'vitest';
import {CHART_DEBUGGER_CASES,loadCaseFixture,caseSteps,evaluateCase,expectedText} from '../src/chartDebuggerCases.js';

it('opens positive P7 (Pins 451/452): opponent blocks A, the new B attempt enters at 03:35',async()=>{
 const c=CHART_DEBUGGER_CASES.find(c=>c.id==='P7');
 expect(c).toBeDefined();
 expect(expectedText(c)).toBe('Positiv · DOB');
 const fixture=await loadCaseFixture(c),result=evaluateCase(c,fixture,caseSteps(c,fixture).through);
 expect(result.orderBlocks.map(x=>[x.role,x.orderBlock.startTime])).toEqual([['first',1793669400],['second',1793671200]]);
 // Philip 16.11.: die frühere A-Freigabe und endgültige B-Sperre waren beide falsch.
 expect(result.pair).toMatchObject({direction:'short',entries:{a:{status:'invalid',reason:'opposingFvgOpen'},
  b:{status:'ready',entryTime:1793673300,entryPrice:3943.16,stopPrice:3953.26}}});
});
