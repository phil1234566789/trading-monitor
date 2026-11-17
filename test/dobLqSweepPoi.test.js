import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {load,run,berlin,directory} from './dobFixtures.js';
import {dobTs11FromRow,dobLqSweepMatch} from '../src/dobLqSweepPoi.js';

// POI-Art LQ-Sweep (Philip): POI = TS1.1-Setup, GO wenn OB1 oder OB2 des DOB mindestens eine Kante mit dem TS1.1-OB teilt.
// Positivfälle = Philips Mustertrades (Konto 8); Erwartung je Fall: welches TS1.1 trägt, an welchem OB, mit welcher Stufe.
// #139 (nur Überlappung) und #138/#142 (TS1.1-OB knapp neben dem DOB-OB) sind gemeldete Lücken der Regel, hier eingefroren,
// damit eine Regeländerung sichtbar wird statt still durchzurutschen.
const tradeSetups=JSON.parse(readFileSync(new URL('lq-sweep-ts11.json',directory),'utf8')).rows.map(dobTs11FromRow);
const SAMPLES=[
 {trade:'#137',day:'2026-11-02',at:'09:05',direction:'short',ts:47184,match:'edge',ob:'ob1',edge:'both'},
 {trade:'#140 (K10)',day:'2026-10-22',at:'05:24',direction:'short',ts:50160,match:'edge',ob:'ob1',edge:'both'},
 {trade:'#141',day:'2026-10-12',at:'15:34',direction:'short',ts:17262,match:'edge',ob:'ob1',edge:'top'},
 // #135: Philips Level 4142,14 (TS 37679) trifft OB1 über die rohe OB-Oberkante 4142,29; TS 38280 teilt zusätzlich beide Kanten mit OB2.
 {trade:'#135',day:'2026-11-05',at:'16:19',direction:'short',ts:37679,match:'edge',ob:'ob1',edge:'top'},
 {trade:'#143',day:'2026-06-04',at:'05:52',direction:'long',ts:49404,match:'edge',ob:'ob1',edge:'bottom'},
 {trade:'#139',day:'2026-10-22',at:'10:52',direction:'short',ts:24767,match:'overlap',ob:'ob1',edge:null},
 {trade:'#138',day:'2026-10-26',at:'14:34',direction:'short',ts:27646,match:'adjacent',ob:'ob1',edge:null,gapUsd:0.84},
 {trade:'#142',day:'2026-11-17',at:'14:32',direction:'short',ts:48056,match:'adjacent',ob:'ob1',edge:null,gapUsd:0.18},
];
const lq=(day,match)=>run(load(day),undefined,false,{match},{poiType:'lq_sweep',tradeSetups});
const entryNear=(result,{day,at,direction})=>[...result.setups,...result.rejected]
 .filter(s=>s.direction===direction&&s.entryTime!=null&&Math.abs(s.entryTime-berlin(day,at))<=10*60)
 .sort((a,b)=>Math.abs(a.entryTime-berlin(day,at))-Math.abs(b.entryTime-berlin(day,at)))[0];

describe('DOB-POI LQ-Sweep: Mustertrades',()=>{
 it.each(SAMPLES)('$trade: DOB-Entry vorhanden, TS1.1 $ts verbindet sich per $match',s=>{
  const setup=entryNear(lq(s.day,'adjacent'),s);
  expect(setup,`kein DOB-Entry bei ${s.trade}`).toBeDefined();
  expect(setup.poi).toMatchObject({kind:'ts11',tradeSetupId:s.ts,match:s.match,matchedOb:s.ob,matchedEdge:s.edge});
  if(s.gapUsd!=null)expect(setup.poi.gapUsd).toBeCloseTo(s.gapUsd,2);
 });
 it.each(SAMPLES)('$trade: Regel „gleiche Kante“ gibt GO nur bei Stufe edge',s=>{
  const setup=entryNear(lq(s.day,'edge'),s);
  expect(setup.reason==null).toBe(s.match==='edge');
  if(s.match!=='edge')expect(setup.reason).toBe('noPoi');
 });
 it('#140 (K10) ist zugleich HTF-OB-POI: beide POI-Arten erkennen ihn',()=>{
  const s=SAMPLES[1];
  const htf=entryNear(run(load(s.day)),s);
  expect(htf.poi.timeframe).toBe('H1');
  expect(htf.reason).toBeUndefined();
  expect(entryNear(lq(s.day,'edge'),s)).toMatchObject({poi:{tradeSetupId:50160}});
  expect(entryNear(lq(s.day,'edge'),s).reason).toBeUndefined();
 });
 it('ohne TS1.1-Daten bleibt jedes Setup verworfen und der Grund ist erkennbar',()=>{
  const result=run(load('2026-11-02'),undefined,false,undefined,{poiType:'lq_sweep',tradeSetups:[]});
  expect(result.setups).toEqual([]);
  expect(new Set(result.rejected.map(s=>s.reason))).toEqual(new Set(['missingTradeSetups']));
 });
});

describe('dobLqSweepMatch',()=>{
 const pair={firstOrderBlock:{top:10,bottom:8},secondOrderBlock:{top:7,bottom:5}};
 const ts=(top,bottom,raw={})=>({top,bottom,rawTop:raw.top??null,rawBottom:raw.bottom??null});
 it('gleiche Kante bis 1 Tick, auch über das rohe OB hinter der aufgeweiteten Box',()=>{
  expect(dobLqSweepMatch(pair,ts(12,8.01),0.01)).toMatchObject({match:'edge',matchedOb:'ob1',matchedEdge:'bottom'});
  expect(dobLqSweepMatch(pair,ts(12,8.02),0.01)).toMatchObject({match:'overlap'});
  expect(dobLqSweepMatch(pair,ts(14,9,{top:10}),0.01)).toMatchObject({match:'edge',matchedEdge:'top'});
 });
 it('Überlappung vor Abstand, Abstand bis 1 USD, sonst keine Verbindung',()=>{
  expect(dobLqSweepMatch(pair,ts(11.5,10.5),0.01)).toMatchObject({match:'adjacent',gapUsd:0.5});
  expect(dobLqSweepMatch(pair,ts(12.5,11.01),0.01)).toBeNull();
  expect(dobLqSweepMatch(pair,ts(6.5,6),0.01)).toMatchObject({match:'overlap',matchedOb:'ob2'});
 });
});
