import {expect,it} from 'vitest';
import {CHART_DEBUGGER_CASES,loadCaseFixture,evaluateCase,caseSteps} from '../src/chartDebuggerCases.js';
import {obReactionGraph} from '../src/obReactionGraph.js';

const titleOf=async(id,role,at)=>{
 const c=CHART_DEBUGGER_CASES.find(x=>x.id===id),fixture=await loadCaseFixture(c),t=at??caseSteps(c,fixture).through,r=evaluateCase(c,fixture,t);
 const entry=r.orderBlocks.find(o=>o.role===role);
 return obReactionGraph({dir:c.dir,entry,context:r.context,evaluatedAt:t,pair:r.pair,partner:r.orderBlocks.find(o=>o!==entry)}).title;
};

it('Kopfzeile nennt Aufruf, Richtung und den gewählten M5-OB (Berliner Zeit, Preise unten–oben)',async()=>{
 // P16 OB2 startet 21.10. 03:15 UTC = 05:15 CEST, P14 OB1 16.10. 10:45 UTC = 12:45 CEST.
 expect(await titleOf('P16','second')).toBe('evaluateOrderBlockReaction() · Long · M5-OB 05:15 · 4.112,95–4.116,82');
 expect(await titleOf('P14','first')).toBe('evaluateOrderBlockReaction() · Short · M5-OB 12:45 · 4.181,03–4.183,9');
 // Vor Erkennung der OB: Zeit ja, Preise noch nicht.
 expect(await titleOf('P16','second',1792545900)).toBe('evaluateOrderBlockReaction() · Long · M5-OB 05:15');
});
