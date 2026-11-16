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


describe('native P7: ausgewählte OB2-Quellen und Entry a',()=>{
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
 // Philip 16.11.: die nächste Gegen-FVG vor der Entry-Nase (03:13) ist bei der Reaktion gefüllt, A beendet die Reaktion um 03:17;
 // die Entry-b-Wiederholung deckt orderBlockReactionRetry.test.js ab.
 it('Entry a 03:17 beendet die Reaktion; nur die Reaktions-FVG wird gezeichnet',()=>{
  const x=snapshot('04:10');
  expect(x.entry.reaction.routes.a).toMatchObject({status:'entry',entryTime:at('03:17'),entryPrice:3945.18});
  expect(x.entry.reaction.routes.b.status).toBe('skipped');
  const sources=chartDebuggerReactionZones(x.entry,x.context,x.evaluatedAt);
  expect(sources.map(z=>z.label.split(' ')[0])).toEqual(['Reaktions-FVG']);
  expect(obReactionGraph(snapshot('03:17')).nodes.result.headline).toBe('Reaktion: true');
 });
});

describe('maßgebliche Gegen-FVG vor der Entry-Nase',()=>{
 // Tupel: Fall, Gegen-FVG (Mittelkerze, Unter-/Oberkante), offen bei Reaktion, Entry a.
 it.each([['U4',[1792138800,4179.64,4181.41],true,'rejected'],['P11',[1792691040,4045.12,4046.44],false,'entry'],['P13',[1792577580,4115.5,4115.68],false,'entry']])(
  '%s: zeichnet die nächste Gegen-FVG vor der Nase; nur offen bei Reaktion lehnt sie Entry a ab',async(id,[time,bottom,top],open,a)=>{
  const {CHART_DEBUGGER_CASES,loadCaseFixture,evaluateCase,caseSteps}=await import('../src/chartDebuggerCases.js');
  const {chartDebuggerOpponentZones}=await import('../src/chartDebuggerFvgs.js');
  const c=CHART_DEBUGGER_CASES.find(x=>x.id===id),f=await loadCaseFixture(c),at=caseSteps(c,f).through,r=evaluateCase(c,f,at),entry=r.orderBlocks.at(-1);
  expect(entry.reaction.opponentFvgs.find(x=>x.nearest)).toMatchObject({openAtReaction:open,blocksEntryA:open});
  expect(entry.reaction.routes.a.status).toBe(a);
  const [z]=chartDebuggerOpponentZones(entry,r.context,at);
  expect(z.zone).toMatchObject({bottom,top,startTime:time});
  expect(z.label).toMatch(/^Gegen-FVG vor Nase /);
 });
});
