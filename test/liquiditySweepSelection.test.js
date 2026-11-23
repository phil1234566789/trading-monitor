import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {createLiquiditySweepSelector} from '../src/liquiditySweepSelection.js';
import {lqSweepPoi,slimLiquiditySweepSelection} from '../src/dobLqSweepPoi.js';

// Spec aus Philips Pseudochart „LS-Zuordnung kausal“ (Pins 634/639/640 Winner mit richtigem LS, 641 Loss eines gültigen Setups):
// jüngster gültiger Sweep vor OB1, Sweep-Extrem = erster M5-Pivot ab Touch, IN = Umkehr-OB. Kerzen aus dem Lauf-Cache, Zeiten Berlin.
const fixture=JSON.parse(readFileSync(new URL('fixtures/ls-sweep-selection/xau-pins-634-641.json',import.meta.url),'utf8'));
const candles=rows=>rows.map(([time,open,high,low,close])=>({time,open,high,low,close}));
const berlin=t=>new Date(t*1000).toLocaleString('de-DE',{timeZone:'Europe/Berlin',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
const selectFor=(c,m5=candles(c.m5))=>createLiquiditySweepSelector({instrument:'XAUUSD',m5Candles:m5,h1Candles:candles(c.h1),
 d1Candles:candles(c.d1),sessionConfigs:fixture.sessions});
const pin=id=>fixture.cases.find(c=>c.pin===id);

describe('kausale LS-Auswahl an den Pin-Fällen',()=>{
 it.each([
  [634,'16.10., 11:05',[4190.77],'16.10., 11:15',4192.21,'16.10., 11:20'],
  // 4.315,90 um 04:40 ist ungültig (Range), deshalb der ältere Sweep 04:35; Pivot und OB-Kante 4.313,20 sind ein LS.
  [639,'15.09., 04:35',[4313.2],'15.09., 04:45',4317.33,'15.09., 05:35'],
  // OB-Kante 4.399,23 zählt als eigener LS derselben Sweep-Kerze.
  [640,'11.09., 15:35',[4400.19,4399.23],'11.09., 15:55',4402.45,'11.09., 16:10'],
  // Fall 4 (Loss bleibt): 3.852,40 ist ein gültiger, 4 Tage alter LS; 3.859,81 liegt nach dem Range-High und zählt nicht.
  [641,'16.11., 06:45',[3852.4],'16.11., 06:55',3832.18,'16.11., 07:00'],
 ])('Pin %i: Touch %s, LS %j, Extrem %s %f, IN %s',(id,touch,ls,extremeAt,extreme,inAt)=>{
  const c=pin(id),s=selectFor(c)({dir:c.dir,before:c.before});
  expect(berlin(s.touchTime)).toBe(touch);
  expect(s.levels.map(l=>l.price)).toEqual(ls);
  expect(s.lsCount).toBe(ls.length);
  expect([berlin(s.reaction.extreme.time),s.reaction.extreme.price]).toEqual([extremeAt,extreme]);
  expect(berlin(s.reaction.reactionOb.startTime)).toBe(inAt);
 });

 // Zwischenlösung (Philip): ob ein POI trägt, entscheidet die Kanten-Geometrie wie v1; welcher LS, die kausale Auswahl.
 const c634=pin(634),pair={direction:'short',firstOrderBlock:{startTime:c634.before,top:10,bottom:9},secondOrderBlock:{top:9.6,bottom:9.2},
  recognizedAt:c634.before+3600};
 // Geometrisch gekoppelte LS-Reaktion mit der heute angezeigten Primär-LS 4.177,39 (#50327).
 const ts={id:50327,direction:'short',top:10,bottom:9.4,rawTop:null,rawBottom:null,startTime:c634.before-1800,knownAt:c634.before-1200,
  lsPrice:4177.39,lsPivotTime:c634.before-9000,lsTouchedTime:c634.before-2400,lsTimeframe:'5M',lsSourceKind:'liquidity'};
 const poiOf=selector=>lqSweepPoi({instrument:'XAUUSD',poiOptions:{match:'adjacent'},tradeSetups:[ts],liquiditySweepSelector:selector});
 it('Pin 634: geometrisch gekoppelter POI trägt den kausalen LS 4.190,77 statt der Primär-LS',()=>{
  const {poi,reason}=poiOf(selectFor(c634))(pair);
  expect(reason).toBeNull();
  expect(poi).toMatchObject({kind:'ts11',tradeSetupId:50327,match:'edge',lsSource:'causal',lsPrice:4190.77,lsCount:1});
  expect(berlin(poi.lsTouchedTime)).toBe('16.10., 11:05');
 });
 it('ohne kausalen Sweep bleibt der POI, aber ohne LS und ohne Rückfall auf die Primär-LS',()=>{
  const {poi}=poiOf(()=>null)(pair);
  expect(poi).toMatchObject({tradeSetupId:50327,lsSource:'none',lsPrice:null,lsCount:0});
 });
 it('ohne geometrische Kopplung kein POI, auch wenn ein kausaler Sweep existiert',()=>{
  const far={...pair,firstOrderBlock:{...pair.firstOrderBlock,top:20,bottom:19},secondOrderBlock:{top:19.6,bottom:19.2}};
  expect(poiOf(selectFor(c634))(far).poi).toBeNull();
 });
});

// dob-watcher speichert die Auswahl je (Richtung, OB1-Start) schlank in dob_ls_selections und rechnet sie nicht jede Minute neu (Edge-CPU).
describe('gespeicherte LS-Auswahl',()=>{
 const slimJson=s=>JSON.parse(JSON.stringify(slimLiquiditySweepSelection(s)));
 it.each([634,639,640,641])('Pin %i: 30 min nach OB1-Start steht die Auswahl schon fest',id=>{
  const c=pin(id),cut=c.before+1800,closed=(rows,sec)=>candles(rows).filter(x=>x.time+sec<=cut);
  const early=createLiquiditySweepSelector({instrument:'XAUUSD',m5Candles:closed(c.m5,300),h1Candles:closed(c.h1,3600),
   d1Candles:closed(c.d1,86400),sessionConfigs:fixture.sessions});
  expect(slimJson(early({dir:c.dir,before:c.before}))).toEqual(slimJson(selectFor(c)({dir:c.dir,before:c.before})));
 });
 it('Pin 634: POI aus der gespeicherten Auswahl gleicht dem aus der frischen',()=>{
  const c=pin(634),fresh=selectFor(c),stored=slimJson(fresh({dir:c.dir,before:c.before}));
  const pair={direction:'short',firstOrderBlock:{startTime:c.before,top:10,bottom:9},secondOrderBlock:{top:9.6,bottom:9.2},recognizedAt:c.before+3600};
  const ts={id:50327,direction:'short',top:10,bottom:9.4,rawTop:null,rawBottom:null,startTime:c.before-1800,knownAt:c.before-1200,
   lsPrice:4177.39,lsPivotTime:c.before-9000,lsTouchedTime:c.before-2400,lsTimeframe:'5M',lsSourceKind:'liquidity'};
  const poiOf=selector=>lqSweepPoi({instrument:'XAUUSD',poiOptions:{match:'adjacent'},tradeSetups:[ts],liquiditySweepSelector:selector})(pair);
  expect(poiOf(()=>stored)).toEqual(poiOf(fresh));
  expect(poiOf(()=>null).poi.lsSource).toBe('none');
 });
});
