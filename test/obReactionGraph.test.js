import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {OB_REACTION_CASES,loadCaseFixture,evaluateCase,caseSteps} from '../src/obReactionDebuggerCases.js';
import {obReactionGraph} from '../src/obReactionGraph.js';
import {createOrderBlockReactionContext,evaluateOrderBlockReaction} from '../src/orderBlockReaction.js';
import {reactionOptionsFor} from '../src/doubleOrderBlocks.js';
import {detectOrderBlocks} from '../src/orderBlockDetection.js';
import {orderBlockRecognitionTimes} from '../src/orderBlockRecognitionTime.js';

const graphAt=async(id,evaluatedAt)=>{
 const c=OB_REACTION_CASES.find(x=>x.id===id),fixture=await loadCaseFixture(c),at=evaluatedAt??caseSteps(c,fixture).through;
 const r=evaluateCase(c,fixture,at);
 return obReactionGraph({dir:c.dir,entry:r.orderBlocks.at(-1),m1:r.m1,evaluatedAt:at});
};
const status=g=>Object.fromEntries(Object.entries(g.nodes).map(([k,n])=>[k,n.status]));

describe('Knotenplan aus dem v7-Ergebnis',()=>{
 it('P16: Route a liefert den Entry mit M5-Kanten-SL',async()=>{
  const g=await graphAt('P16');
  expect(g.head).toBe('Intern: true · Ausgabe: entry (Route a)');
  expect(status(g)).toMatchObject({touch:'visited',fvg:'visited',wait:'alternative',reaction:'visited',entryA:'visited',stop:'visited',result:'visited',closed:'not-visited',counter:'info'});
  expect(g.edges).toMatchObject({aStop:'visited',stopResult:'visited',touchReject:'not-visited'});
  expect(g.nodes.stop.sub).toContain('M5-Kante');
 });
 it('503: Gegenkante gebrochen → false, Entry-Routen nicht besucht',async()=>{
  const g=await graphAt('503');
  expect(g.head).toBe('Intern: false · Ausgabe: rejected');
  expect(status(g)).toMatchObject({result:'rejected',entryA:'not-visited',entryB:'not-visited',stop:'not-visited'});
  expect(g.edges.touchReject).toBe('rejected');
  expect(g.history.at(-1).text).toBe('Reaktion false · M5-Gegenkante gebrochen');
 });
 it('504 und P14: Reaktion true, aber SL unknown → kein Entry',async()=>{
  for(const id of ['504','P14']){
   const g=await graphAt(id);
   expect(g.head,id).toBe('Intern: true · Ausgabe: unknown (Route a)');
   expect(status(g),id).toMatchObject({reaction:'visited',entryA:'unknown',entryB:'unknown',stop:'unknown',result:'unknown'});
   expect(g.nodes.stop.sub,id).toBe('SL unknown\nRetest-Extrem-SL nicht spezifiziert');
  }
 });
 it('folgt dem Slider: vor dem OB unbekannt, vor der FVG wartend',async()=>{
  const c=OB_REACTION_CASES.find(x=>x.id==='503');
  expect((await graphAt('503',c.orderBlocks[0]+60)).text).toBe('M5-OB noch nicht bekannt.');
  const p16=await graphAt('P16'),knownAt=p16.history.find(h=>h.text.startsWith('Reaktion true')).at;
  const before=await graphAt('P16',knownAt-60);
  expect(before.nodes.reaction.status).toBe('not-visited');
  expect(before.head).toMatch(/^Intern: unknown · Ausgabe: pending/);
 });
 it('marketClosed: OB1 vom 05.11. verfällt über die Tagespause',()=>{
  const load=n=>JSON.parse(readFileSync(new URL(`./fixtures/dob-native/${n}.json`,import.meta.url),'utf8'));
  const [d1,d2]=['2026-11-05','2026-11-06'].map(load),m5=[...d1.candles.m5,...d2.candles.m5],at=1793916060+1800;
  const m1=[...d1.candles.m1,...d2.candles.m1].filter(c=>c.time+60<=at);
  const zone=detectOrderBlocks(m5,'5m',true,0).find(z=>z.startTime===1793838000);
  const orderBlock={...zone,recognizedAt:orderBlockRecognitionTimes(m5,'5m').get(1793838000),timeframe:'5M'};
  const reaction=evaluateOrderBlockReaction(createOrderBlockReactionContext(m1,at,'XAUUSD'),orderBlock,reactionOptionsFor('first'));
  const g=obReactionGraph({dir:1,entry:{orderBlock,reaction,internalFvgs:[]},m1,evaluatedAt:at});
  expect(g.head).toBe('Intern: unknown · Ausgabe: unknown');
  expect(status(g)).toMatchObject({closed:'rejected',result:'unknown',fvg:'not-visited'});
  expect(g.edges.closedResult).toBe('rejected');
  expect(g.nodes.result.sub).toBe('OB verfallen');
 });
});
