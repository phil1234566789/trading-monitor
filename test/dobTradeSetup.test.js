import {readFileSync,readdirSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {checkDobTradeSetup,dobLiveWindowInput,dobLiveWindowStart} from '../src/dobTradeSetup.js';
import {berlinOffsetMinutes} from '../src/berlinTime.js';

const directory=new URL('./fixtures/dob-native/',import.meta.url);
const load=day=>JSON.parse(readFileSync(new URL(`${day}.json`,directory),'utf8'));
const run=(fixture,evaluatedAt=fixture.provenance.query.to)=>checkDobTradeSetup({instrument:'XAUUSD',
 m5Candles:fixture.candles.m5,m1Candles:fixture.candles.m1,evaluatedAt});
const berlin=(day,hhmm)=>{const utc=Date.parse(`${day}T${hhmm}:00Z`)/1000;return utc-berlinOffsetMinutes(utc*1000)*60;};
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
const nearest=({day,direction,at})=>run(load(day)).setups.filter(s=>s.direction===direction&&s.entryTime!=null)
 .reduce((best,s)=>!best||Math.abs(s.entryTime-berlin(day,at))<Math.abs(best.entryTime-berlin(day,at))?s:best,null);

describe('checkDobTradeSetup v0',()=>{
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
  const early=run(fixture,done.recognizedAt).setups.find(s=>s.id===done.id);
  expect(early).toMatchObject({phase:'ob2Recognized',entryTime:null,entryPrice:null,targetPrice:null});
  expect(early.phaseSince).toBeLessThanOrEqual(done.entryTime);
  expect(run(fixture,done.entryTime+60).setups.find(s=>s.id===done.id)).toMatchObject({phase:'entry',phaseSince:done.entryTime,entryTime:done.entryTime});
 });

 // Q2: einziger Guardrail; umgesetzt im Indikator (insideEntryWindow), hier nur abgesichert.
 it('liefert nie einen Entry zwischen 22:00 und 02:00 Berlin',()=>{
  const days=readdirSync(directory).filter(name=>/^\d{4}-\d{2}-\d{2}\.json$/.test(name)).map(name=>load(name.slice(0,-5)));
  let entries=0;
  for(const fixture of days)for(let at=fixture.provenance.query.from+3600;at<=fixture.provenance.query.to;at+=3600)
   for(const setup of run(fixture,at).setups)if(setup.entryTime!=null){
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
   const input={instrument:'XAUUSD',m5Candles:candles.m5,m1Candles:candles.m1,evaluatedAt:at},live=dobLiveWindowInput(input);
   expect(dobLiveWindowStart(candles.m1,'XAUUSD',at)).toBe(reopen);
   expect([live.m5Candles.length<300,live.m1Candles.length<1500]).toEqual([true,true]);
   const wide=checkDobTradeSetup(input).setups.filter(s=>s.recognizedAt>=reopen);
   expect(live.liveFrom).toBe(reopen);
   expect(checkDobTradeSetup(live).setups).toEqual(wide);
  }
 });

 it('hat im geschlossenen Markt ein leeres Live-Fenster',()=>{
  const fixture=load('2026-11-05'),last=fixture.candles.m1.findLast(c=>c.time<berlin('2026-11-05','23:30'));
  const at=last.time+60+10*60;
  expect(dobLiveWindowStart(fixture.candles.m1,'XAUUSD',at)).toBe(Math.floor(at/60)*60);
  expect(checkDobTradeSetup(dobLiveWindowInput({instrument:'XAUUSD',m5Candles:fixture.candles.m5,m1Candles:fixture.candles.m1,evaluatedAt:at})).setups).toEqual([]);
 });
});
