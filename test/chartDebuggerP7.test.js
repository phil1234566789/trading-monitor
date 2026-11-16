import {expect,it} from 'vitest';
import {CHART_DEBUGGER_CASES,loadCaseFixture,caseSteps,evaluateCase,expectedText} from '../src/chartDebuggerCases.js';

it('opens the historical positive P7 (Pins 451/452) with its original native DOB and both OB roles',async()=>{
 const c=CHART_DEBUGGER_CASES.find(c=>c.id==='P7');
 expect(c).toBeDefined();
 expect(expectedText(c)).toBe('Positiv · DOB');
 const fixture=await loadCaseFixture(c),result=evaluateCase(c,fixture,caseSteps(c,fixture).through);
 expect(result.orderBlocks.map(x=>[x.role,x.orderBlock.startTime])).toEqual([['first',1793669400],['second',1793671200]]);
 expect(result.pair).toMatchObject({direction:'short',entries:{a:{status:'ready',entryTime:1793672220,entryPrice:3945.18,stopPrice:3953.26},b:{status:'invalid'}}});
});
