import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {stopBehindSwing,SL_ALGO_V1,SL_ALGO_DEFAULT,slAlgoApplies,slAlgoFromJson} from '../src/slAlgo.js';
import {dobIntradayEnd,dobIntradayWinrate} from '../src/dobIntraday.js';
import {untouchedSwingsAsOf} from '../src/marketStructureSwings.js';
import {counterZoneHits} from '../src/antiConfluenceCounterZones.js';
import {createDobSwingStopGate} from '../src/dobSwingStop.js';
import {dobSwingStopVariant} from '../src/dobMaxR.js';
import {dobStopText,dobAlarmEvents} from '../src/dobAlarm.js';
import {dobRowStopPrice} from '../src/dobTradeStatistics.js';
import {dobRowConfigScore} from '../src/dobPartialProfit.js';
import {dobChartPosition} from '../src/dobChartPositions.js';
import {DOB_GUARDRAILS_DEFAULT,dobGuardrailsFromRow,dobGuardrailsToRow} from '../src/dobGuardrails.js';
import {load,run,berlin} from './dobFixtures.js';

// M5-Reihe aus M15-Hochs/Tiefs: jede M15 = 3 gleiche M5 (Open/Close in der Mitte).
const m15=(start,bars)=>bars.flatMap(([high,low],i)=>[0,1,2].map(k=>({time:start+i*900+k*300,open:(high+low)/2,high,low,close:(high+low)/2})));

describe('Struktur-Baustein: untouchedSwingsAsOf (M15, Periode 2)',()=>{
 // 6 Bars Vorlauf, Tief 90 bei Bar 8, danach steigt der Kurs; Bar 13 fällt auf 89 und berührt das Tief.
 const bars=[...Array(6).fill([106,101]),[105,100],[104,98],[100,90],[103,95],[106,97],[108,99],[110,101],[109,89]];
 const T=6*900,candles=m15(0,bars);
 it('liefert das Tief erst, wenn die 2 Kerzen rechts geschlossen sind',()=>{
  expect(untouchedSwingsAsOf(candles,{asOf:T+4*900,since:T}).filter(p=>p.type==='low')).toEqual([]);
  expect(untouchedSwingsAsOf(candles,{asOf:T+5*900,since:T}).filter(p=>p.type==='low').map(p=>p.price)).toEqual([90]);
 });
 it('sieht keine Kerzen ab asOf (kein Blick in die Zukunft) und lässt berührte weg',()=>{
  expect(untouchedSwingsAsOf(candles,{asOf:T+7*900,since:T}).some(p=>p.price===90)).toBe(true);
  expect(untouchedSwingsAsOf(candles,{asOf:T+8*900,since:T}).some(p=>p.price===90)).toBe(false);
 });
});

describe('SL-Baustein: stopBehindSwing',()=>{
 const swings=[{type:'low',price:1.3010,pivotTime:100},{type:'low',price:1.3005,pivotTime:200},{type:'low',price:1.3030,pivotTime:300},{type:'high',price:1.31,pivotTime:400}];
 it('Long: jüngstes Tief unter dem SL, 5 Ticks darunter',()=>{
  expect(stopBehindSwing(swings,{direction:'long',stopPrice:1.3020,instrument:'GBPUSD'})).toEqual({stopPrice:1.30045,swingPrice:1.3005,swingTime:200});
 });
 it('ohne Swing jenseits des SL: null',()=>{
  expect(stopBehindSwing(swings,{direction:'long',stopPrice:1.3000,instrument:'GBPUSD'})).toBeNull();
  expect(stopBehindSwing(swings,{direction:'short',stopPrice:1.3050,instrument:'XAUUSD'})).toMatchObject({stopPrice:1.31+0.05});
 });
});

describe('Anti-Confluence-Baustein: counterZoneHits (breit)',()=>{
 // Short-Entry 100, Ziel 96: bullische M5-FVG 98,5–99,5 darunter (offen) ist ein Treffer, ATR 2 → Kante bis 1 unter dem Entry.
 const t0=1_800_000_000-1_800_000_000%86400,base=Array.from({length:40},(_,i)=>({time:t0+i*300,open:100,high:100.2,low:99.8,close:100}));
 base[20]={...base[20],high:98.5,low:97,close:98};base[21]={...base[21],high:101,low:98,open:98,close:100.5};base[22]={...base[22],low:99.5,high:101};
 for(let i=23;i<40;i++)base[i]={...base[i],low:99.6};
 const at=t0+39*300,args={instrument:'XAUUSD',entryTime:at,entryPrice:100,targetPrice:96,direction:'short',atr:2};
 it('findet die offene Gegen-FVG zwischen Ziel und Entry',()=>{
  expect(counterZoneHits(base,args).some(z=>z.kind==='FVG'&&z.tf==='5m'&&z.bottom===98.5&&z.top===99.5)).toBe(true);
 });
 it('kein Treffer ohne ATR, für die Gegenrichtung oder wenn das Ziel davor liegt',()=>{
  expect(counterZoneHits(base,{...args,atr:null})).toEqual([]);
  expect(counterZoneHits(base,{...args,targetPrice:99.6}).some(z=>z.bottom===98.5)).toBe(false);
 });
});

// Baustein-Grenze: der SL-Baustein und die DOB-Variante rechnen keine Struktur selbst, nur marketStructureSwings.js fragt den Struktur-Algo.
describe('Grenze SL-Baustein ↔ Struktur-Algo',()=>{
 const src=f=>readFileSync(new URL(`../src/${f}`,import.meta.url),'utf8');
 it.each(['slAlgo.js','dobSwingStop.js','antiConfluenceCounterZones.js','dobMaxR.js'])('%s importiert keine Pivot-/Fraktal-Erkennung',f=>{
  expect(src(f)).not.toMatch(/marketStructureAnalysis|liquidityDetection|detectLiquidityLevels|computeRangesPivots/);
 });
 it('dobSwingStop.js holt die Swings aus marketStructureSwings.js',()=>{
  expect(src('dobSwingStop.js')).toMatch(/from '\.\/marketStructureSwings\.js'/);
  expect(src('marketStructureSwings.js')).toMatch(/computeRangesPivots/);
 });
});

describe('DOB-SL-Variante (c): Chart = Alarm',()=>{
 const fixture=load('2026-11-12');
 const done=run(fixture).setups.find(s=>s.entryTime===berlin('2026-11-12','14:10'));
 const swingStop={hits:[{kind:'FVG',tf:'15M'}],stop:{stopPrice:done.stopPrice+5,swingPrice:done.stopPrice+4.95,swingTime:done.entryTime-3600}};
 const gate=(s,algo,poiType)=>slAlgoApplies(algo,poiType)?swingStop:null,on={...DOB_GUARDRAILS_DEFAULT,slAlgo:SL_ALGO_V1};
 it('Alarm nennt den SL hinter dem M15-P2 nur mit Schalter, TP bleibt beim DOB-Risiko',()=>{
  const at=done.entryTime+60,entry=cfg=>dobAlarmEvents(run(fixture,at,true,undefined,{swingStopGate:gate,guardrails:cfg}),at,{guardrails:cfg}).find(e=>e.phase==='entry');
  const off=entry(DOB_GUARDRAILS_DEFAULT),withSwing=entry(on);
  expect(off.text).not.toContain('M15-Swing');
  expect(withSwing.text).toContain(dobStopText({...done,swingStop,instrument:'XAUUSD'},on));
  expect(withSwing.text).toContain('hinter M15-Swing');
  // Gleicher Dedup-Schlüssel: die Variante ändert den Alarm, nicht seine Identität.
  expect(withSwing.id).toBe(off.id);
  expect(withSwing.text.split('\n').find(l=>l.startsWith('TP'))).toBe(off.text.split('\n').find(l=>l.startsWith('TP')));
 });
 it('SL-Algo 1.0 greift nur bei HTF-OB, Default ist der DOB-SL',()=>{
  expect(slAlgoApplies(SL_ALGO_V1,'htf_ob')).toBe(true);
  expect(slAlgoApplies(SL_ALGO_V1,'lq_sweep')).toBe(false);
  expect(slAlgoApplies(SL_ALGO_DEFAULT,'htf_ob')).toBe(false);
  expect(createDobSwingStopGate({m5Candles:fixture.candles.m5,instrument:'XAUUSD',atr:[{time:0,value:1e9}]})(done,SL_ALGO_V1,'lq_sweep')).toBeNull();
  expect(slAlgoFromJson({method:'unbekannt'})).toEqual(SL_ALGO_DEFAULT);
  expect(slAlgoFromJson({method:'structure_p2'})).toEqual(SL_ALGO_V1);
 });
 it('Chart-Position aus der Lauf-Zeile zeigt denselben SL wie der Alarm',()=>{
  const variant=dobSwingStopVariant({...done,swingStop},{candles:fixture.candles.m1,dataEnd:fixture.provenance.query.to,instrument:'XAUUSD'});
  const row={id:'x',instrument:'XAUUSD',direction:done.direction,entry_time:done.entryTime,entry_price:done.entryPrice,stop_price:done.stopPrice,
   outcome:'success',exit_time:null,max_r:2,sl_hit:false,ambiguous_r:null,swing_max_r:variant.maxR,swing_sl_hit:variant.slHit,swing_ambiguous_r:variant.ambiguousR,
   swing_risk_usd:variant.riskUsd,swing_stop_price:variant.stopPrice};
  expect(variant.stopPrice).toBe(swingStop.stop.stopPrice);
  expect(dobRowStopPrice(on,row)).toBe(swingStop.stop.stopPrice);
  expect(dobRowStopPrice(DOB_GUARDRAILS_DEFAULT,row)).toBe(done.stopPrice);
  const p=dobChartPosition(row,on,fixture.candles.m5);
  expect(p.stopPrice).toBe(swingStop.stop.stopPrice);
  // Ziel fest: 2R des DOB-Risikos, nicht des neuen Risikos.
  expect(p.targetPrice).toBeCloseTo(done.entryPrice-2*Math.abs(done.entryPrice-done.stopPrice),6);
 });
});

describe('Statistik-Umschaltung (c)',()=>{
 // Long, Entry 100, DOB-SL 99, neuer SL 98: festes Ziel 2R = 102 bringt mit doppeltem Risiko 1R.
 const row={entry_time:0,entry_price:100,stop_price:99,outcome:'loss',max_r:0.5,sl_hit:true,ambiguous_r:null,
  swing_max_r:2.5,swing_sl_hit:false,swing_ambiguous_r:null,swing_risk_usd:2,swing_stop_price:98};
 it('Schalter aus: DOB-Ergebnis, an: Ziel fest gegen den neuen SL',()=>{
  expect(dobRowConfigScore(DOB_GUARDRAILS_DEFAULT,row)).toMatchObject({outcome:'loss',r:-1});
  expect(dobRowConfigScore({...DOB_GUARDRAILS_DEFAULT,slAlgo:SL_ALGO_V1},row)).toMatchObject({outcome:'success',r:1});
 });
 it('Trades ohne Variante bleiben unverändert',()=>{
  const plain={...row,swing_max_r:null};
  expect(dobRowConfigScore({...DOB_GUARDRAILS_DEFAULT,slAlgo:SL_ALGO_V1},plain)).toEqual(dobRowConfigScore(DOB_GUARDRAILS_DEFAULT,plain));
 });
 it('SL-Algo-Konfig übersteht die DB-Form, Default DOB-SL',()=>{
  expect(dobGuardrailsFromRow({}).slAlgo).toEqual(SL_ALGO_DEFAULT);
  expect(dobGuardrailsFromRow(dobGuardrailsToRow('GBPUSD',{...DOB_GUARDRAILS_DEFAULT,slAlgo:SL_ALGO_V1},'htf_ob')).slAlgo).toEqual(SL_ALGO_V1);
 });
});

describe('createDobSwingStopGate auf echten Kerzen',()=>{
 it('läuft ohne ATR durch und liefert dann keine Variante',()=>{
  const fixture=load('2026-11-12'),done=run(fixture).setups.find(s=>s.entryTime===berlin('2026-11-12','14:10'));
  expect(createDobSwingStopGate({m5Candles:fixture.candles.m5,instrument:'XAUUSD',atr:[]})(done)).toBeNull();
 });
});

describe('Intraday-Messgröße: Ziel bis NY-Close',()=>{
 it('Tagesende 22:00 Berlin im Sommer, 23:00 im Winter, nach dem Tagesende der nächste Tag',()=>{
  expect(dobIntradayEnd(berlin('2026-07-15','10:00'))).toBe(berlin('2026-07-15','22:00'));
  expect(dobIntradayEnd(berlin('2026-01-15','10:00'))).toBe(berlin('2026-01-15','23:00'));
  expect(dobIntradayEnd(berlin('2026-07-15','22:30'))).toBe(berlin('2026-07-16','22:00'));
  // Umstellungstag (29.03.2026, Sommerzeit ab 03:00): Tagesende 22:00 Sommerzeit.
  expect(dobIntradayEnd(berlin('2026-03-29','10:00'))).toBe(berlin('2026-03-29','22:00'));
 });
 it('zählt nur Ziele bis zum Tagesende als Win, mit SL-Algo die swing-Werte',()=>{
  const rows=[{intraday_max_r:2,swing_max_r:null},{intraday_max_r:1,swing_max_r:2,swing_intraday_max_r:2.5},{intraday_max_r:null}];
  expect(dobIntradayWinrate(rows,DOB_GUARDRAILS_DEFAULT,()=>2)).toEqual({n:2,winrate:0.5});
  expect(dobIntradayWinrate(rows,{slAlgo:SL_ALGO_V1},()=>2)).toEqual({n:2,winrate:1});
 });
});
