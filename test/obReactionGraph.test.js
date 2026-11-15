import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {OB_REACTION_CASES,loadCaseFixture,evaluateCase,caseSteps} from '../src/obReactionDebuggerCases.js';
import {obReactionGraph} from '../src/obReactionGraph.js';
import {createOrderBlockReactionContext,evaluateOrderBlockReaction} from '../src/orderBlockReaction.js';
import {reactionOptionsFor} from '../src/doubleOrderBlocks.js';
import {detectOrderBlocks} from '../src/orderBlockDetection.js';
import {orderBlockRecognitionTimes} from '../src/orderBlockRecognitionTime.js';

// Gleicher Aufruf wie ObReactionDebugger.vue: Rolle wählen, Partner und Paar mitgeben.
const graphAt=async(id,evaluatedAt,role='second')=>{
 const c=OB_REACTION_CASES.find(x=>x.id===id),fixture=await loadCaseFixture(c),at=evaluatedAt??caseSteps(c,fixture).through;
 const r=evaluateCase(c,fixture,at),entry=r.orderBlocks.find(o=>o.role===role);
 return obReactionGraph({dir:c.dir,entry,m1:r.m1,evaluatedAt:at,pair:r.pair,partner:r.orderBlocks.find(o=>o!==entry)??null});
};
const status=g=>Object.fromEntries(Object.entries(g.nodes).map(([k,n])=>[k,n.status]));

describe('Knotenplan = v7-Entscheidungsbaum aus dem Produktergebnis',()=>{
 it('P16 OB2: Route a liefert den Entry mit fernem M5-Kanten-SL',async()=>{
  const g=await graphAt('P16');
  expect(g.head).toBe('Intern: true · Ausgabe: entry (Route a)');
  expect(status(g)).toMatchObject({detect:'visited',touch:'visited',broken:'visited',reaction:'visited',stop:'visited',routeA:'visited',
   result:'visited',closed:'not-visited',false:'not-visited',hold:'not-visited'});
  expect(g.nodes.stop.sub).toContain('ferne M5-Kante');
  expect(g.edges).toMatchObject({reactionOb2:'visited',aResult:'visited',falseResult:'not-visited'});
 });
 it('P16 OB1: Hold-Gate hält, weil der DOB erkannt ist',async()=>{
  const g=await graphAt('P16',undefined,'first');
  expect(status(g)).toMatchObject({reaction:'visited',hold:'visited',noDob:'not-visited',stop:'not-visited'});
  expect(g.head).toBe('Intern: true · Ausgabe: kein Entry');
 });
 it('503: Gegenkante vor der FVG gebrochen → Reaktion false',async()=>{
  const g=await graphAt('503');
  expect(g.head).toBe('Intern: false · Ausgabe: rejected');
  expect(status(g)).toMatchObject({broken:'rejected',false:'rejected',reaction:'not-visited',routeA:'not-visited',stop:'not-visited',result:'rejected'});
  expect(g.edges.falseResult).toBe('rejected');
  expect(g.history.at(-1).text).toBe('Reaktion false · M5-Gegenkante gebrochen');
 });
 it('504 und P14: Reaktion true, SL ohne offene interne FVG → Retest-Extrem (T6) → unknown',async()=>{
  for(const id of ['504','P14']){
   const g=await graphAt(id);
   expect(g.head,id).toBe('Intern: true · Ausgabe: unknown (Route a)');
   expect(status(g),id).toMatchObject({reaction:'visited',stop:'unknown',routeA:'unknown',bCheck:'visited',entryB:'unknown',result:'unknown'});
   expect(g.nodes.stop.sub,id).toBe('SL unknown\nkeine offen → Retest-Extrem (T6) → unknown');
  }
 });
 it('folgt dem Slider: vor der OB unbekannt, vor der FVG offen',async()=>{
  const c=OB_REACTION_CASES.find(x=>x.id==='503');
  expect((await graphAt('503',c.orderBlocks[0]+60)).text).toBe('M5-OB noch nicht bekannt.');
  const knownAt=(await graphAt('P16')).history.find(h=>h.text.startsWith('Reaktion true')).at,before=await graphAt('P16',knownAt-60);
  expect(status(before)).toMatchObject({reaction:'not-visited',broken:'unknown'});
  expect(before.head).toBe('Intern: unknown · Ausgabe: pending');
 });
 it('marketClosed: OB1 vom 05.11. verfällt über die Tagespause',()=>{
  const load=n=>JSON.parse(readFileSync(new URL(`./fixtures/dob-native/${n}.json`,import.meta.url),'utf8'));
  const [d1,d2]=['2026-11-05','2026-11-06'].map(load),m5=[...d1.candles.m5,...d2.candles.m5],at=1793916060+1800;
  const m1=[...d1.candles.m1,...d2.candles.m1].filter(c=>c.time+60<=at);
  const zone=detectOrderBlocks(m5,'5m',true,0).find(z=>z.startTime===1793838000);
  const orderBlock={...zone,recognizedAt:orderBlockRecognitionTimes(m5,'5m').get(1793838000),timeframe:'5M'};
  const reaction=evaluateOrderBlockReaction(createOrderBlockReactionContext(m1,at,'XAUUSD'),orderBlock,reactionOptionsFor('first'));
  const g=obReactionGraph({dir:1,entry:{role:'second',orderBlock,reaction,internalFvgs:[]},m1,evaluatedAt:at});
  expect(g.head).toBe('Intern: unknown · Ausgabe: rejected');
  expect(status(g)).toMatchObject({touch:'rejected',closed:'rejected',broken:'not-visited',result:'rejected'});
  expect(g.nodes.result.sub).toBe('OB verfallen');
 });
});
