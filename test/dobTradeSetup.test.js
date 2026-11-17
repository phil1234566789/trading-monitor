import {readdirSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {checkDobTradeSetup,dobLiveWindowInput,dobLiveWindowStart} from '../src/dobTradeSetup.js';
import {poiMaxDistanceAtr} from '../src/dobHtfObPoi.js';
import {berlinOffsetMinutes} from '../src/berlinTime.js';
import {directory,load,poiContext,run,berlin} from './dobFixtures.js';

const all=result=>[...result.setups,...result.rejected];
const POI_MAX_DISTANCE_ATR=poiMaxDistanceAtr('XAUUSD');
const berlinMinute=sec=>((Math.floor(sec/60)+berlinOffsetMinutes(sec*1000))%1440+1440)%1440;

// Mustertrades Journal-Konto 8 (Berliner Zeit). Erwartet ist der nächste v0-Entry gleicher Richtung, kein Soll:
// Abweichungen sind Fachfragen an Philip, keine Regeländerung.
const SAMPLE_TRADES=[
 {trade:'#134',day:'2026-11-12',direction:'short',at:'14:11',price:3930,v0:{entryAt:'14:10',entryPrice:3929.65,route:'a',phase:'win'}},
 {trade:'#135',day:'2026-11-05',direction:'short',at:'16:14',price:4112.74,v0:{entryAt:'16:19',entryPrice:4116.3,route:'b',phase:'win'}},
 {trade:'#136',day:'2026-11-04',direction:'long',at:'04:13',price:3934.94,v0:{entryAt:'04:13',entryPrice:3934.94,route:'a',phase:'win'}},
 // #137 = Referenzpaar P8 (Pins 453/454); Philips Exit am TP1 3892,33 liegt hinter dem 2R-Ziel 3899,07.
 {trade:'#137',day:'2026-11-02',direction:'short',at:'09:05',price:3903.21,v0:{entryAt:'09:05',entryPrice:3903.21,route:'a',phase:'win'}},
 {trade:'#136 Re-Entry',day:'2026-11-04',direction:'long',at:'06:21',price:3956.08,v0:{entryAt:'06:19',entryPrice:3953.11,route:'a',phase:'win'}},
];
const nearestIn=(list,{day,direction,at})=>list.filter(s=>s.direction===direction&&s.entryTime!=null)
 .reduce((best,s)=>!best||Math.abs(s.entryTime-berlin(day,at))<Math.abs(best.entryTime-berlin(day,at))?s:best,null);
const nearest=sample=>nearestIn(all(run(load(sample.day))),sample);

describe('checkDobTradeSetup v0-Kern',()=>{
 it.each(SAMPLE_TRADES)('$trade: nächster v0-Entry bleibt eingefroren',sample=>{
  const setup=nearest(sample),{entryAt,...rest}=sample.v0;
  expect(setup).toMatchObject({...rest,entryTime:berlin(sample.day,entryAt)});
  // TP = Entry ± 2R mit dem SL des Indikators.
  expect(setup.targetPrice).toBeCloseTo(setup.entryPrice+2*(setup.entryPrice-setup.stopPrice),8);
  expect(setup.id).toBe(`${setup.pairId}:${setup.route}`);
  expect(setup.chart).toMatchObject({time:setup.entryTime,secondOrderBlockStart:Number(setup.pairId.split(':').at(-1))});
 });

 it('#135 meldet das Setup schon vor dem Entry mit derselben ID',()=>{
  const fixture=load('2026-11-05'),done=nearest(SAMPLE_TRADES[1]);
  const early=all(run(fixture,done.recognizedAt)).find(s=>s.id===done.id);
  expect(early).toMatchObject({phase:'ob2Recognized',entryTime:null,entryPrice:null,targetPrice:null});
  expect(early.phaseSince).toBeLessThanOrEqual(done.entryTime);
  expect(all(run(fixture,done.entryTime+60)).find(s=>s.id===done.id)).toMatchObject({phase:'entry',phaseSince:done.entryTime,entryTime:done.entryTime});
 });

 // Q2: einziger Guardrail; umgesetzt im Indikator (insideEntryWindow), hier nur abgesichert.
 it('liefert nie einen Entry zwischen 22:00 und 02:00 Berlin',()=>{
  const days=readdirSync(directory).filter(name=>/^\d{4}-\d{2}-\d{2}\.json$/.test(name)).map(name=>load(name.slice(0,-5)));
  let entries=0;
  for(const fixture of days)for(let at=fixture.provenance.query.from+3600;at<=fixture.provenance.query.to;at+=3600)
   for(const setup of all(run(fixture,at,false)))if(setup.entryTime!=null){
    entries++;
    expect(berlinMinute(setup.entryTime)).toBeGreaterThanOrEqual(120);
    expect(berlinMinute(setup.entryTime)).toBeLessThanOrEqual(22*60);
   }
  expect(entries).toBeGreaterThan(100);
 });

 it('rechnet im Live-Fenster seit dem letzten Marktschluss dieselben Setups wie mit Vortag',()=>{
  const [a,b]=['2026-11-04','2026-11-05'].map(load);
  const candles={m5:[...a.candles.m5,...b.candles.m5],m1:[...a.candles.m1,...b.candles.m1]};
  // Erste Minute nach der Tagespause am Abend des 04.11. (FXCM-Reopen 23:01 Berlin).
  const reopen=candles.m1.find((c,i)=>i&&c.time>berlin('2026-11-04','20:00')&&c.time-candles.m1[i-1].time>1800).time;
  for(let at=berlin('2026-11-05','02:00');at<=berlin('2026-11-05','22:00');at+=1800){
   const input={instrument:'XAUUSD',m5Candles:candles.m5,m1Candles:candles.m1,evaluatedAt:at,poiContext},live=dobLiveWindowInput(input);
   expect(dobLiveWindowStart(candles.m1,'XAUUSD',at)).toBe(reopen);
   expect([live.m5Candles.length<300,live.m1Candles.length<1500]).toEqual([true,true]);
   const wide=checkDobTradeSetup(input);
   expect(live.liveFrom).toBe(reopen);
   const result=checkDobTradeSetup(live);
   expect(result.setups).toEqual(wide.setups.filter(s=>s.recognizedAt>=reopen));
   expect(result.rejected).toEqual(wide.rejected.filter(s=>s.recognizedAt>=reopen));
  }
 });

 it('hat im geschlossenen Markt ein leeres Live-Fenster',()=>{
  const fixture=load('2026-11-05'),last=fixture.candles.m1.findLast(c=>c.time<berlin('2026-11-05','23:30'));
  const at=last.time+60+10*60;
  expect(dobLiveWindowStart(fixture.candles.m1,'XAUUSD',at)).toBe(Math.floor(at/60)*60);
  expect(all(checkDobTradeSetup(dobLiveWindowInput({instrument:'XAUUSD',m5Candles:fixture.candles.m5,m1Candles:fixture.candles.m1,evaluatedAt:at})))).toEqual([]);
 });
});

// OB-POI = alle Mustertrade-Positionen außer K05 (#137, LQ-Sweep-POI, gehört zur späteren LQ-Sweep-Version).
// v1 = nächste aktive H1/H4-OB ≤ 1,5 ATR; v2 = dasselbe, aber die Zone muss vor OB1 retestet sein (Philip, Q17).
// Philips eigene Zone treffen #134/#136/#140 exakt (jeweils vor OB1 berührt). #135 nimmt mit Retest die retestete H4-Zone
// statt der nie berührten H1-Zone. #139/#139b: die einzige nahe Zone wurde vor OB1 nie berührt (Philips POI dort: M5-OB + LQ-Sweep).
const OB_SAMPLES=[
 ['#134','2026-11-12','14:11','short',['H1',3954.74,3964.91]],['#135','2026-11-05','16:14','short',['H1',4158.6,4167.16],['H4',4166.18,4225.24]],
 ['#136','2026-11-04','04:13','long',['H1',3917.39,3922.72]],['#136b','2026-11-04','06:21','long',['H1',3917.39,3922.72]],
 ['#138','2026-10-26','14:34','short',['H4',4020.03,4034.21]],['#139','2026-10-22','10:52','short',['H1',4108.4,4116.2],null],
 ['#139b','2026-10-22','11:24','short',['H1',4108.4,4116.2],null],['#140','2026-10-22','05:03','short',['H1',4122.1,4126.19]],
 ['#140b','2026-10-22','05:22','short',['H1',4122.1,4126.19]],['#141','2026-10-12','15:34','short',['H4',4166.18,4225.24]],
].map(([trade,day,at,direction,v1,v2=v1])=>({trade,day,at,direction,v1,v2}));
const poiOf=([timeframe,bottom,top])=>({kind:'htfOb',timeframe,zone:{bottom,top}});

describe('checkDobTradeSetup: Phase ob2Retest',()=>{
 // Alarmzeitpunkt (Q3): OB2 berührt, OB1-Reaktion und -Hold stehen, POI passt; die OB2-Reaktion fehlt noch.
 it('#134 meldet ob2Retest ab dem OB2-Kontakt und gibt dann an das Paar ab',()=>{
  const fixture=load('2026-11-12'),done=nearestIn(run(fixture).setups,{day:'2026-11-12',at:'14:11',direction:'short'});
  const contactKnown=done.chart.secondRetestTime+60;
  expect(contactKnown).toBeLessThan(done.recognizedAt);
  const before=run(fixture,contactKnown-60);
  expect(all(before).some(s=>s.pairId===done.pairId)).toBe(false);
  const retest=run(fixture,contactKnown).setups.find(s=>s.pairId===done.pairId);
  expect(retest).toMatchObject({id:`${done.pairId}:retest`,phase:'ob2Retest',phaseSince:contactKnown,route:null,entryTime:null,
   poi:done.poi});
  const after=run(fixture,done.recognizedAt).setups.filter(s=>s.pairId===done.pairId);
  expect(after.map(s=>s.phase)).not.toContain('ob2Retest');
  expect(after.length).toBeGreaterThan(0);
 });
});

describe('checkDobTradeSetup: POI',()=>{
 // #140 Pos. 1 (05:03) hat keinen eigenen v0-Trade, sie fällt auf den Trade von #140b (05:24).
 it.each(OB_SAMPLES)('$trade: v1 (ohne Retest) findet einen POI',sample=>{
  const result=run(load(sample.day),undefined,true,{requireRetest:false}),setup=nearestIn(all(result),sample);
  expect(Math.abs(setup.entryTime-berlin(sample.day,sample.at))).toBeLessThanOrEqual(30*60);
  expect(result.setups).toContainEqual(setup);
  expect(setup.poi).toMatchObject(poiOf(sample.v1));
  expect(setup.poi.distanceAtr).toBeLessThanOrEqual(POI_MAX_DISTANCE_ATR);
 });
 it.each(OB_SAMPLES)('$trade: v2 verlangt den Retest der Zone vor OB1',sample=>{
  const result=run(load(sample.day)),setup=nearestIn(all(result),sample);
  if(sample.v2){
   expect(result.setups).toContainEqual(setup);
   expect(setup.poi).toMatchObject({...poiOf(sample.v2),retested:true});
   // Art und Alter des letzten Touchs vor OB1 für spätere Guardrails (Folge-Touch, frischer Retest).
   expect(['first','followUp']).toContain(setup.poi.retestKind);
   expect(setup.poi.retestAgeSeconds).toBeGreaterThan(0);
   // Messung (exakte M5-Episoden): #134 erster Touch, #141 zwölfter Touch.
   if(sample.trade==='#134')expect(setup.poi.retestKind).toBe('first');
   if(sample.trade==='#141')expect(setup.poi.retestKind).toBe('followUp');
   expect(setup.poi.distanceAtr).toBeLessThanOrEqual(POI_MAX_DISTANCE_ATR);
  }else{
   expect(result.rejected).toContainEqual(setup);
   expect(setup.reason).toBe('noPoi');
  }
 });
 it('#137 (LQ-Sweep-POI) wird mit Grund verworfen, nicht still weggelassen',()=>{
  const result=run(load('2026-11-02')),setup=nearest(SAMPLE_TRADES[3]);
  expect(result.rejected).toContainEqual(setup);
  // Nächste aktive Zone 38,99 USD = 2,54 ATR entfernt.
  expect(setup.poi.distanceAtr).toBeGreaterThan(POI_MAX_DISTANCE_ATR);
  expect(setup.reason).toBe('noPoi');
 });
 it('ohne H1/H4 bleibt der POI unbekannt und jedes Setup verworfen',()=>{
  const result=run(load('2026-11-02'),undefined,false);
  expect(result.setups).toEqual([]);
  expect(result.rejected.length).toBeGreaterThan(0);
  expect(new Set(result.rejected.map(s=>s.reason))).toEqual(new Set(['missingHtfCandles']));
 });
 it('ohne gemessenen ATR-Faktor gibt es kein POI (kein stiller Default)',()=>{
  const fixture=load('2026-11-02');
  expect(POI_MAX_DISTANCE_ATR).toBe(1.5);
  expect(poiMaxDistanceAtr('EURUSD')).toBeNull();
  const result=checkDobTradeSetup({instrument:'EURUSD',m5Candles:fixture.candles.m5,m1Candles:fixture.candles.m1,
   evaluatedAt:fixture.provenance.query.to,poiContext});
  expect(result.setups).toEqual([]);
  expect(result.rejected.length).toBeGreaterThan(0);
  expect(new Set(result.rejected.map(s=>s.reason))).toEqual(new Set(['noPoiConfig']));
 });
});
