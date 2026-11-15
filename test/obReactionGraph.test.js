import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {CHART_DEBUGGER_CASES,loadCaseFixture,evaluateCase,caseSteps} from '../src/chartDebuggerCases.js';
import {obReactionGraph,graphChangeTimes} from '../src/obReactionGraph.js';
import {createOrderBlockReactionContext,evaluateOrderBlockReaction,internalFvgOpenAt} from '../src/orderBlockReaction.js';
import {reactionOptionsFor} from '../src/doubleOrderBlocks.js';
import {detectOrderBlocks} from '../src/orderBlockDetection.js';
import {orderBlockRecognitionTimes} from '../src/orderBlockRecognitionTime.js';

// Gleicher Aufruf wie ChartDebugger.vue: Rolle wählen, Partner und Paar mitgeben.
const caseOf=id=>CHART_DEBUGGER_CASES.find(x=>x.id===id);
const graphOf=(c,r,at,role='second')=>{const entry=r.orderBlocks.find(o=>o.role===role);
 return obReactionGraph({dir:c.dir,entry,context:r.context,evaluatedAt:at,pair:r.pair,partner:r.orderBlocks.find(o=>o!==entry)??null});};
const graphAt=async(id,evaluatedAt,role='second')=>{
 const c=caseOf(id),fixture=await loadCaseFixture(c),at=evaluatedAt??caseSteps(c,fixture).through;
 return graphOf(c,evaluateCase(c,fixture,at),at,role);
};
const status=g=>Object.fromEntries(Object.entries(g.nodes).map(([k,n])=>[k,n.status]));

describe('Knotenplan = v7-Entscheidungsbaum aus dem Produktergebnis',()=>{
 it('P16 OB2: Route a liefert den Entry mit fernem M5-Kanten-SL',async()=>{
  const g=await graphAt('P16');
  expect(g.head).toMatch(/^Intern: true · Routen: a entry, b /);
  expect(status(g)).toMatchObject({detect:'visited',touch:'visited',broken:'visited',reaction:'visited',stop:'visited',routeA:'visited',
   result:'visited',closed:'not-visited',false:'not-visited',hold:'not-visited'});
  expect(g.nodes.stop.sub).toContain('ferne M5-Kante');
  expect(g.edges).toMatchObject({reactionOb2:'visited',aResult:'visited',falseResult:'not-visited'});
 });
 it('P16 OB1: Hold-Gate hält, weil der DOB erkannt ist',async()=>{
  const g=await graphAt('P16',undefined,'first');
  expect(status(g)).toMatchObject({reaction:'visited',hold:'visited',noDob:'not-visited',stop:'not-visited'});
  expect(g.head).toBe('Intern: true · Routen: – (OB1)');
 });
 it('503: Gegenkante vor der FVG gebrochen → Reaktion false',async()=>{
  const g=await graphAt('503');
  expect(g.head).toBe('Intern: false (M5-Gegenkante gebrochen) · Routen: a rejected, b rejected');
  expect(status(g)).toMatchObject({broken:'rejected',false:'rejected',reaction:'not-visited',routeA:'not-visited',stop:'not-visited',result:'rejected'});
  expect(g.edges.falseResult).toBe('rejected');
  expect(g.history.at(-1).text).toBe('Reaktion false · M5-Gegenkante gebrochen');
 });
 it('504 und P14: Reaktion true, SL ohne offene interne FVG → Retest-Extrem',async()=>{
  for(const [id,sl] of [['504','4.114,07'],['P14','4.181,45']]){
   const g=await graphAt(id);
   expect(g.head,id).toBe('Intern: true · Routen: a entry, b entry');
   expect(status(g),id).toMatchObject({reaction:'visited',stop:'visited',routeA:'visited',bCheck:'visited',entryB:'visited',result:'visited'});
   expect(g.nodes.stop.sub,id).toBe(`${sl}\nkeine offen → Retest-Extrem`);
  }
 });
 it('folgt dem Slider: vor der OB unbekannt, vor der FVG offen',async()=>{
  const c=CHART_DEBUGGER_CASES.find(x=>x.id==='503');
  expect((await graphAt('503',c.orderBlocks[0]+60)).text).toBe('M5-OB noch nicht bekannt.');
  const knownAt=(await graphAt('P16')).history.find(h=>h.text.startsWith('Reaktion true')).at,before=await graphAt('P16',knownAt-60);
  expect(status(before)).toMatchObject({reaction:'not-visited',broken:'unknown'});
  expect(before.head).toBe('Intern: unknown (Retest da, noch keine neue FVG) · Routen: –');
 });
 it('marketClosed: OB1 vom 05.11. verfällt über die Tagespause',()=>{
  const load=n=>JSON.parse(readFileSync(new URL(`./fixtures/dob-native/${n}.json`,import.meta.url),'utf8'));
  const [d1,d2]=['2026-11-05','2026-11-06'].map(load),m5=[...d1.candles.m5,...d2.candles.m5],at=1793916060+1800;
  const m1=[...d1.candles.m1,...d2.candles.m1].filter(c=>c.time+60<=at);
  const zone=detectOrderBlocks(m5,'5m',true,0).find(z=>z.startTime===1793838000);
  const orderBlock={...zone,recognizedAt:orderBlockRecognitionTimes(m5,'5m').get(1793838000),timeframe:'5M'};
  const reaction=evaluateOrderBlockReaction(createOrderBlockReactionContext(m1,at,'XAUUSD'),orderBlock,reactionOptionsFor('first'));
  const g=obReactionGraph({dir:1,entry:{role:'second',orderBlock,reaction,internalFvgs:[]},context:{rows:m1,evaluatedAt:at},evaluatedAt:at});
  // Produktstatus unknown mit Grund, kein selbst erfundenes rejected.
  expect(g.head).toBe('Intern: unknown (Markt geschlossen, OB verfallen) · Routen: –');
  expect(status(g)).toMatchObject({touch:'unknown',closed:'unknown',broken:'not-visited',result:'unknown'});
  expect(g.nodes.result.sub).toBe('Reaktion unknown\nMarkt geschlossen, OB verfallen');
 });

 it('Seitenspur übernimmt unknown aus der Produkt-Füllhistorie bei verdeckter Kerze und Lücke (Drift-Wächter)',async()=>{
  const c=caseOf('P16'),fixture=await loadCaseFixture(c),at=caseSteps(c,fixture).through;
  const base=evaluateCase(c,fixture,at),fvg=base.orderBlocks[1].internalFvgs[0];
  // Vorbedingung: ohne Eingriff ist der Füllstand bekannt, sonst prüft der Test nichts.
  expect(fvg).not.toBe(base.orderBlocks[1].reaction.fvg);
  expect(internalFvgOpenAt(base.context,fvg,at)).not.toBeNull();
  for(const edit of [m1=>m1.map(x=>x.time===fvg.recognizedAt?{...x,ignored:true}:x),m1=>m1.filter(x=>x.time!==fvg.recognizedAt)]){
   const r=evaluateCase(c,{...fixture,candles:{...fixture.candles,m1:edit(fixture.candles.m1)}},at),same=r.orderBlocks[1].internalFvgs.find(f=>f.candleTime===fvg.candleTime);
   expect(internalFvgOpenAt(r.context,same,at)).toBeNull();
   const g=graphOf(c,r,at),index=r.orderBlocks[1].internalFvgs.filter(f=>f!==r.orderBlocks[1].reaction.fvg).indexOf(same);
   expect(g.nodes.fvgList.meters[index]).toMatchObject({value:null,label:'Füllstand unbekannt'});
  }
 });
 it('Route b: missingHistory und entryBUnknown bleiben unknown statt „nein“',()=>{
  const orderBlock={dir:1,top:2,bottom:1,startTime:0,recognizedAt:300},fvg={top:2.5,bottom:2.2,recognizedAt:900,candleTime:780};
  for(const reason of ['missingHistory','entryBUnknown']){
   const reaction={state:'true',reason:null,contact:{status:'touch',candleTime:600,knownAt:660},fvg,knownAt:900,penetration:null,
    routes:{a:{status:'unknown',reason:'partialOverlapOpen',knownAt:900},b:{status:'unknown',reason,knownAt:1200}}};
   const g=obReactionGraph({dir:1,entry:{role:'second',orderBlock,reaction,internalFvgs:[]},context:{rows:[],evaluatedAt:1800},evaluatedAt:1800});
   expect(g.nodes.bCheck.status,reason).toBe('unknown');
   expect(g.nodes.bCheck.sub,reason).toContain(reason==='missingHistory'?'M1-Historie lückenhaft':'Entry b unbekannt');
   expect(g.nodes.entryB.status,reason).toBe('not-visited');
  }
 });
 it('P16: „nächste Änderung“ springt nacheinander zu Kontakt, Reaktion, Entry a, Entry b und verpasst keine Änderung',async()=>{
  const c=caseOf('P16'),fixture=await loadCaseFixture(c),{from,through}=caseSteps(c,fixture),end=evaluateCase(c,fixture,through);
  const entry=end.orderBlocks[1],times=graphChangeTimes({entry,context:end.context,pair:end.pair,partner:end.orderBlocks[0]});
  const r=entry.reaction,key=[r.contact.knownAt,r.knownAt,r.routes.a.entryTime,r.routes.b.entryTime];
  const jumps=[];for(let at=from,next;(next=times.find(t=>t>at))!=null&&next<=through;at=next)jumps.push(next);
  expect(jumps.filter(t=>key.includes(t))).toEqual([...new Set(key)]);
  // Wächter: jede Minute, in der sich Zustände/Texte ändern, ist ein Sprungziel (Prozentzahlen ausgenommen).
  const sign=at=>{const g=graphOf(c,evaluateCase(c,fixture,at),at);
   return JSON.stringify([g.head,Object.values(g.nodes).map(n=>[n.status,n.sub,(n.meters??[]).map(m=>m.value==null?m.label:m.label.replace(/[\d,.]+ %/g,''))])]);};
  let previous=sign(from);
  for(let at=from+60;at<=through;at+=60){const now=sign(at);if(now!==previous)expect(times,`Änderung um ${at}`).toContain(at);previous=now;}
 },60000);
});
