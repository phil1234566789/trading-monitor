import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {isTs11Pin,noteLsPrice,ts11CaseFromPin,locateTs11Case,diagnoseTs11Case,ts11CaseWindow,ts11LeadOf,TS11_LEADS} from '../src/tradeSetup11Debugger.js';

const load=path=>JSON.parse(readFileSync(new URL(path,import.meta.url),'utf8'));
const oct12=load('./fixtures/ts11-native/context.json'),oct22=load('./fixtures/ts11-ls-ob/xau-2026-10-22.json');
const sessions=oct12.sessionConfigs.filter(s=>s.instrument==='XAUUSD');
const run=(fixture,pin)=>{
 const kase=ts11CaseFromPin(pin),{m5,h1,d1}=fixture.candles,located=locateTs11Case(kase,m5,sessions);
 return {kase,located,result:diagnoseTs11Case(kase,m5,sessions,located,{m5,h1,d1})};
};

it('nimmt TS1.1-Notizen und neue trade_setup-Pins, nicht die TS1.0-Pins von September',()=>{
 expect(isTs11Pin({kind:'ob_zone',note:'mir fehlt hier ein Long TS 1.1 mit LS 4.445,98',createdAt:'2026-11-17T19:03:16Z'})).toBe(true);
 expect(isTs11Pin({kind:'trade_setup',note:'long im trend',createdAt:'2026-11-14T11:44:16Z'})).toBe(true);
 expect(isTs11Pin({kind:'trade_setup',note:'Beispiel Trendfortführung',createdAt:'2026-09-24T05:00:00Z'})).toBe(false);
 expect(isTs11Pin({kind:'ob_zone',note:'TS1.0 Long',createdAt:'2026-11-17T00:00:00Z'})).toBe(false);
});

it('liest Philips LS-Preis deutsch und englisch',()=>{
 expect(noteLsPrice('mir fehlt hier ein Long TS 1.1 mit LS 4.445,98. kurzfristiger')).toBe(4445.98);
 expect(noteLsPrice('warum ist das zusammen mit LS 4.187,84 kein TS1.1 short?')).toBe(4187.84);
 expect(noteLsPrice('LS 4179.25')).toBe(4179.25);
 expect(noteLsPrice('kein Preis')).toBeNull();
});

it('Pin 509 (OB-Pin): TS1 findet den Short, TS1.1 besteht mit Ankerhistorie',()=>{
 const {kase,located,result}=run(oct12,{id:509,kind:'ob_zone',note:'das müsste doch ein TS1.1 short setup sein?',
  obZone:{instrument:'XAUUSD',direction:'short',timeframe:'5M',top:4180.14,bottom:4177.75,startTime:'2026-10-12T10:45:00+00:00'}});
 expect(kase).toMatchObject({code:'P509',dir:1,error:null});
 expect(located.evaluatedAt).toBe(Date.parse('2026-10-12T10:55:00Z')/1000);
 expect(result.setup.sweeps.map(s=>s.level.price)).toContain(4179.25);
 expect(result.verdict).toBe('TS1.1 ✓');
 expect(result.candidates.find(c=>c.level.price===4179.25)).toMatchObject({inSetup:true});
});

it('Pin 510 (M5-Level-Pin): findet den ersten Setup-OB nach dem Sweep',()=>{
 const {located,result}=run(oct12,{id:510,kind:'m5_liquidity_level',note:'TS1.1 short?',
  m5Liquidity:{instrument:'XAUUSD',direction:'high',price:4179.25,pivotTime:'2026-10-12T08:40:00+00:00'}});
 expect(located.level.touchedTime).toBe(Date.parse('2026-10-12T10:25:00Z')/1000);
 expect(located.ob).not.toBeNull();
 expect(result.steps.find(s=>s.label.startsWith('TS1 ')).ok).toBe(true);
});

it('DR 140: TS1.1 besteht, aber die verbotene Asia-Session blendet aus',()=>{
 const {result}=run(oct22,{id:-140,kind:'ob_zone',note:'TS1.1',
  obZone:{instrument:'XAUUSD',direction:'short',timeframe:'5M',top:4123.87,bottom:4117.9,startTime:'2026-10-22T02:40:00+00:00'}});
 expect(result.assessment.status).toBe('passed');
 expect(result.verdict).toBe('ausgeblendet (verbotene Session)');
});

it('DR 139: Philips M1-LS hat kein M5-Fraktal, TS1.1 bleibt unbekannt',()=>{
 const {result}=run(oct22,{id:-139,kind:'ob_zone',note:'OB 4.102,73 + LS 4.100,44 kein TS1.1',
  obZone:{instrument:'XAUUSD',direction:'short',timeframe:'5M',top:4102.73,bottom:4096.77,startTime:'2026-10-22T06:25:00+00:00'}});
 expect(result.steps.find(s=>s.label.startsWith('M5-Fraktal bei LS 4100.44')).ok).toBe(false);
 expect(result.verdict).toBe('TS1.1 unknown');
});

it('meldet einen H1-OB-Pin als nicht auswertbar statt zu raten',()=>{
 expect(ts11CaseFromPin({id:1,kind:'ob_zone',note:'TS1.1',obZone:{instrument:'XAUUSD',direction:'short',timeframe:'1H',startTime:'2026-10-22T00:00:00Z'}}).error)
  .toMatch(/H1/);
});

it('zeigt mindestens einen Tag M5-Vorlauf, auch bei altem oder fremdem Query-Wert',()=>{
 expect(ts11LeadOf('6h')).toBe('24h');
 expect(Math.min(...TS11_LEADS.map(([,,s])=>s))).toBeGreaterThanOrEqual(86400);
 const kase={anchorTime:Date.parse('2026-10-12T10:45:00Z')/1000,lsPivotTime:null};
 expect(kase.anchorTime-ts11CaseWindow(kase,'6h','3h').view.from).toBeGreaterThanOrEqual(86400);
});
