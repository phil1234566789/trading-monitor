import {readFileSync} from 'node:fs';
import {detectOrderBlocks} from '../src/orderBlockDetection.js';
import {orderBlockRecognitionTimes} from '../src/orderBlockRecognitionTime.js';
import {obReactionGraph,graphChangeTimes} from '../src/obReactionGraph.js';
import {describe,it,expect} from 'vitest';
import {chartDebuggerFvgZones,chartDebuggerReactionZones} from '../src/chartDebuggerFvgs.js';
import {createOrderBlockReactionContext,evaluateOrderBlockReaction,internalOrderBlockFvgs} from '../src/orderBlockReaction.js';

describe('interne FVG-Zonen im Chart-Debugger',()=>{
 const fvg={direction:'long',bottom:100,top:102,candleTime:480,recognizedAt:600};
 const entry={role:'second',orderBlock:{dir:1,bottom:99,top:105,startTime:0,recognizedAt:300},internalFvgs:[fvg],reaction:{fvg:null}};
 const rows=Array.from({length:10},(_,i)=>({time:600+i*60,open:104,close:104,high:105,low:i>=5?99:i>=1?101:103}));
 const zones=(at,candles=rows,e=entry)=>chartDebuggerFvgZones(e,createOrderBlockReactionContext(candles.filter(c=>c.time+60<=at),at,'XAUUSD'),at);
 it('erste Berührung schneidet eine noch offene Zone nicht ab',()=>{
  const [z]=zones(840);
  expect(z.fvg).toBe(fvg);
  expect(z.zone).toMatchObject({bottom:100,top:102,startTime:480,endTime:840,touched:true});
  expect(z.zone.touchedTime).toBeUndefined();
  expect(z.label).toBe('Int. M1-FVG 01:08 · offen');
  expect(z.label).toContain('offen');
 });
 it('endet erst am Schluss der vollständig füllenden M1-Kerze',()=>{
  const [z]=zones(1200);
  expect(z.zone.endTime).toBe(960);
  expect(z.label).toContain('gefüllt');
  expect(z.label).toBe('Int. M1-FVG 01:08 · gefüllt');
  expect(z.label).not.toContain('\n');
 });
 it('Lücke vor Füllung bleibt unbekannt und wird nicht als sichere Vollfüllung gezeichnet',()=>{
  const [z]=zones(1200,rows.filter(c=>c.time!==780));
  expect(z.zone.endTime).toBe(1200);
  expect(z.label).toContain('unbekannt');
 });
 it('zeichnet jedes interne Element des ausgewählten OB und keine zusätzliche Reaktionsquelle',()=>{
  const other={...fvg,candleTime:540,recognizedAt:660};
  const selected={...entry,role:'first',internalFvgs:[fvg,other],reaction:{fvg:other}};
  const result=zones(1200,rows,selected);
  expect(result.map(z=>z.fvg)).toEqual([fvg]);
  expect(result[0].label).toBe('Int. M1-FVG 01:08 · gefüllt');
 });
 it('zeichnet neue Entry-b-FVG getrennt von der ursprünglichen Struktur-FVG',()=>{
  const next={...fvg,candleTime:720,recognizedAt:840};
  const selected={...entry,reaction:{fvg,routes:{b:{entryFvg:next}}}};
  const result=chartDebuggerReactionZones(selected,createOrderBlockReactionContext(rows,1200,'XAUUSD'),1200);
  expect(result.map(z=>z.fvg)).toEqual([fvg,next]);
  expect(result[0].label).toContain('Reaktions-FVG');
  expect(result[1].label).toContain('Entry-b-FVG');
 });
 it('partielle Überlappung bleibt sichtbar und wird separat beschriftet',()=>{
  const partial={...fvg,bottom:98};
  const selected={...entry,internalFvgs:[partial]};
  const result=zones(840,rows,selected);
  expect(result).toHaveLength(1);
  expect(result[0].label).toBe('Überl. M1-FVG 01:08 · offen');
  const g=obReactionGraph({entry:selected,context:createOrderBlockReactionContext(rows,840,'XAUUSD'),evaluatedAt:840,dir:1});
  expect(g.nodes.fvgList.sub).toBe('0 intern · 1 teilweise überlappend');
 });
 it('Rückspulen stellt die offene Box wieder bis zum Sliderstand dar',()=>{
  expect(zones(1200)[0].zone.endTime).toBe(960);
  expect(zones(840)[0].zone.endTime).toBe(840);
 });
});


describe('native P7: ausgewählte OB2-Quellen und Entry-b-Wiederholung',()=>{
 const fixture=JSON.parse(readFileSync(new URL('./fixtures/dob-native/2026-11-03.json',import.meta.url),'utf8'));
 const at=hm=>Date.parse(`2026-11-03T${hm}:00+01:00`)/1000;
 function snapshot(hm){
  const evaluatedAt=at(hm),m1=fixture.candles.m1.filter(c=>c.time+60<=evaluatedAt),m5=fixture.candles.m5.filter(c=>c.time+300<=evaluatedAt);
  const orderBlock={...detectOrderBlocks(m5,'5m',true).find(z=>z.startTime===1793671200&&z.dir===-1),recognizedAt:orderBlockRecognitionTimes(m5,'5m').get(1793671200)};
  const context=createOrderBlockReactionContext(m1,evaluatedAt,'XAUUSD');
  const entry={role:'second',orderBlock,internalFvgs:internalOrderBlockFvgs(context,orderBlock),reaction:evaluateOrderBlockReaction(context,orderBlock)};
  return {entry,context,evaluatedAt,dir:-1};
 }
 it('04:10: Liste und Boxen haben genau die zwei gefüllten OB2-Formationsquellen',()=>{
  const x=snapshot('04:10'),zones=chartDebuggerFvgZones(x.entry,x.context,x.evaluatedAt),g=obReactionGraph(x);
  expect(g.nodes.fvgList.meters).toHaveLength(2);
  expect(zones.map(z=>[z.fvg.bottom,z.fvg.top])).toEqual([[3948.76,3950.76],[3947.81,3949.06]]);
  expect(zones.map(z=>z.zone.endTime)).toEqual([at('03:00'),at('03:51')]);
  expect(zones.map(z=>z.label)).toEqual(['Int. M1-FVG 02:56 · gefüllt','Int. M1-FVG 03:00 · gefüllt']);
 });
 it('Verlauf behält Ablehnung03:26, neue Quelle03:32 und Entry03:35; Box markiert FVG03:30',()=>{
  const x=snapshot('04:10'),g=obReactionGraph(x),times=graphChangeTimes(x);
  for(const hm of ['03:26','03:32','03:35'])expect(times).toContain(at(hm));
  expect(g.history).toEqual(expect.arrayContaining([
   expect.objectContaining({at:at('03:26'),text:expect.stringContaining('Versuch 1 rejected')}),
   expect.objectContaining({at:at('03:32'),text:expect.stringContaining('Versuch 2 FVG bekannt')}),
   expect.objectContaining({at:at('03:35'),text:expect.stringContaining('Versuch 2 entry')})]));
  const sources=chartDebuggerReactionZones(x.entry,x.context,x.evaluatedAt);
  expect(sources).toHaveLength(2);
  expect(sources[1].fvg.candleTime).toBe(at('03:30'));
  expect(sources[1].label).toContain('Entry-b-FVG');
  expect(obReactionGraph(snapshot('03:26')).nodes.result.headline).toBe('Reaktion: false');
  expect(obReactionGraph(snapshot('03:32')).nodes.result.headline).toBe('Reaktion: pending');
  expect(obReactionGraph(snapshot('03:35')).nodes.result.headline).toBe('Reaktion: true');
 });
});

describe('markierte Gegen-FVG (U4)',()=>{
 it('zeichnet die bullische FVG 10:20 vor der Nase, obwohl das Produkt sie nicht listet; Entry a kommt zustande',async()=>{
  const {CHART_DEBUGGER_CASES,loadCaseFixture,evaluateCase,caseSteps,productMatches}=await import('../src/chartDebuggerCases.js');
  const {chartDebuggerMarkedFvgZones}=await import('../src/chartDebuggerFvgs.js');
  const c=CHART_DEBUGGER_CASES.find(x=>x.id==='U4'),f=await loadCaseFixture(c),at=caseSteps(c,f).through,r=evaluateCase(c,f,at);
  const reaction=r.orderBlocks[0].reaction;
  expect(reaction.opponentFvgs.some(x=>x.fvg.candleTime===1792138800)).toBe(false);
  expect(reaction.routes.a.status).toBe('entry');
  expect(productMatches(c,r)).toBe(true);
  const [z]=chartDebuggerMarkedFvgZones(c,r.context,at);
  expect(z.zone).toMatchObject({bottom:4179.64,top:4181.41,startTime:1792138800});
  expect(z.label).toMatch(/^Gegen-FVG \(nicht im Preisweg\) 10:20 · /);
 });
});
