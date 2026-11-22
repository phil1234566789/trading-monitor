import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {createM5StructureContextResolver,currentM5StructureRange} from '../src/m5StructureContext.js';
import {findLiquiditySourceOwner} from '../src/liquiditySourceOwnership.js';
import {createCloseReactionCache} from '../src/m5CloseReactionHistory.js';
import {detectLiquidityLevels} from '../src/liquidityDetection.js';
import {explainLsReactionSource,lsReactionPoint} from '../src/lsReactionExplain.js';
import {isLsReactionPin,noteLsPrice,lsReactionCaseFromPin,locateLsReactionCase,diagnoseLsReactionCase,lsReactionCaseWindow,lsReactionLeadOf,LS_REACTION_LEADS,lsReactionChainAt,lsReactionChangeTimes} from '../src/lsReactionDebugger.js';

const load=path=>JSON.parse(readFileSync(new URL(path,import.meta.url),'utf8'));
const oct12=load('./fixtures/ls-reaction-native/context.json'),oct22=load('./fixtures/ls-reaction-ls-ob/xau-2026-10-22.json');
const sessions=oct12.sessionConfigs.filter(s=>s.instrument==='XAUUSD');
const run=(fixture,pin)=>{
 const kase=lsReactionCaseFromPin(pin),{m5,h1,d1}=fixture.candles,located=locateLsReactionCase(kase,m5,sessions);
 return {kase,located,result:diagnoseLsReactionCase(kase,m5,sessions,located,{m5,h1,d1})};
};

it('nimmt LS-Reaktion-Notizen und neue trade_setup-Pins, nicht die TS1.0-Pins von September',()=>{
 expect(isLsReactionPin({kind:'ob_zone',note:'mir fehlt hier ein Long TS 1.1 mit LS 4.445,98',createdAt:'2026-11-17T19:03:16Z'})).toBe(true);
 expect(isLsReactionPin({kind:'trade_setup',note:'long im trend',createdAt:'2026-11-14T11:44:16Z'})).toBe(true);
 expect(isLsReactionPin({kind:'trade_setup',note:'Beispiel Trendfortführung',createdAt:'2026-09-24T05:00:00Z'})).toBe(false);
 expect(isLsReactionPin({kind:'ob_zone',note:'TS1.0 Long',createdAt:'2026-11-17T00:00:00Z'})).toBe(false);
});

it('liest Philips LS-Preis deutsch und englisch',()=>{
 expect(noteLsPrice('mir fehlt hier ein Long TS 1.1 mit LS 4.445,98. kurzfristiger')).toBe(4445.98);
 expect(noteLsPrice('warum ist das zusammen mit LS 4.187,84 kein LS-Reaktion short?')).toBe(4187.84);
 expect(noteLsPrice('LS 4179.25')).toBe(4179.25);
 expect(noteLsPrice('kein Preis')).toBeNull();
});

it('Pin 509 (OB-Pin): TS1 findet den Short, LS-Reaktion besteht mit Ankerhistorie',()=>{
 const {kase,located,result}=run(oct12,{id:509,kind:'ob_zone',note:'das müsste doch ein LS-Reaktion short setup sein?',
  obZone:{instrument:'XAUUSD',direction:'short',timeframe:'5M',top:4180.14,bottom:4177.75,startTime:'2026-10-12T10:45:00+00:00'}});
 expect(kase).toMatchObject({code:'P509',dir:1,error:null});
 expect(located.evaluatedAt).toBe(Date.parse('2026-10-12T10:55:00Z')/1000);
 expect(result.setup.sweeps.map(s=>s.level.price)).toContain(4179.25);
 expect(result.verdict).toBe('LS-Reaktion ✓');
 expect(result.candidates.find(c=>c.level.price===4179.25)).toMatchObject({inSetup:true});
});

it('Pin 510 (M5-Level-Pin): findet den ersten Setup-OB nach dem Sweep',()=>{
 const {located,result}=run(oct12,{id:510,kind:'m5_liquidity_level',note:'LS-Reaktion short?',
  m5Liquidity:{instrument:'XAUUSD',direction:'high',price:4179.25,pivotTime:'2026-10-12T08:40:00+00:00'}});
 expect(located.level.touchedTime).toBe(Date.parse('2026-10-12T10:25:00Z')/1000);
 expect(located.ob).not.toBeNull();
 expect(result.steps.find(s=>s.label.startsWith('TS1 ')).ok).toBe(true);
});

it('DR 140: LS-Reaktion besteht, aber die verbotene Asia-Session blendet aus',()=>{
 const {result}=run(oct22,{id:-140,kind:'ob_zone',note:'LS-Reaktion',
  obZone:{instrument:'XAUUSD',direction:'short',timeframe:'5M',top:4123.87,bottom:4117.9,startTime:'2026-10-22T02:40:00+00:00'}});
 expect(result.assessment.status).toBe('passed');
 expect(result.verdict).toBe('ausgeblendet (verbotene Session)');
});

it('DR 139: Philips M1-LS hat kein M5-Fraktal, LS-Reaktion bleibt unbekannt',()=>{
 const {result}=run(oct22,{id:-139,kind:'ob_zone',note:'OB 4.102,73 + LS 4.100,44 kein LS-Reaktion',
  obZone:{instrument:'XAUUSD',direction:'short',timeframe:'5M',top:4102.73,bottom:4096.77,startTime:'2026-10-22T06:25:00+00:00'}});
 expect(result.steps.find(s=>s.label.startsWith('M5-Fraktal bei LS 4100.44')).ok).toBe(false);
 expect(result.verdict).toBe('LS-Reaktion unknown');
});

it('Pin 557 (#55028): Wurzel trägt die LS, weil die Gegen-Range ein jüngerer Close-CHoCH ist',()=>{
 const {result}=run(load('./fixtures/ls-reaction-ls-ob/xau-2026-11-18.json'),{id:557,kind:'ob_zone',note:'astreiner Short',
  obZone:{instrument:'XAUUSD',direction:'short',timeframe:'5M',top:3786.62,bottom:3779.74,startTime:'2026-11-18T09:55:00+00:00'}});
 expect(result.setup.sweeps.map(s=>s.level.price)).toContain(3783.64);
 expect(result.assessment).toMatchObject({status:'passed',reason:'sourceRangeDirection'});
 expect(result.verdict).toBe('LS-Reaktion ✓');
});

it.each([['07:45 vor dem Range-Low 09:20','2026-11-18T06:45:00Z','2026-11-18T09:35:00Z','ready'],
 ['10:40 nach dem Range-Low 09:20 (Gegenbewegung)','2026-11-18T09:40:00Z','2026-11-18T11:55:00Z','unmet']])
('Pin 557: LS-Pivot %s',(_,pivot,touch,status)=>{
 const f=load('./fixtures/ls-reaction-ls-ob/xau-2026-11-18.json'),{m5,h1,d1}=f.candles,at=Date.parse(touch)/1000;
 const resolve=createM5StructureContextResolver({m5Candles:m5,h1Candles:h1,d1Candles:d1,settings:f.settings,
  sessionConfigs:f.sessionConfigs.filter(s=>s.instrument==='XAUUSD'),instrument:'XAUUSD'}),context=resolve(at+600);
 const level={...detectLiquidityLevels(context.candles,5).highs.find(p=>p.pivotTime===Date.parse(pivot)/1000),touchedTime:at};
 const current=currentM5StructureRange(context,createCloseReactionCache());
 expect(current).toMatchObject({trend:'uptrend',basis:'existingCloseReactionChoch'});
 expect(findLiquiditySourceOwner({setup:{ls:level,dir:-1},context,resolveContext:resolve,expectedTrend:'downtrend',current}).status)
  .toBe(status);
});

it('Zeitbalken Pin 557: vor dem OB kein Urteil, Kette wechselt um 10:25 Berlin auf die Close-CHoCH-Range',()=>{
 const f=load('./fixtures/ls-reaction-ls-ob/xau-2026-11-18.json'),{m5,h1,d1}=f.candles;
 const kase=lsReactionCaseFromPin({id:557,kind:'ob_zone',note:'',obZone:{instrument:'XAUUSD',direction:'short',timeframe:'5M',top:3786.62,bottom:3779.74,startTime:'2026-11-18T09:55:00+00:00'}});
 const located=locateLsReactionCase(kase,m5,sessions),diagnose=at=>diagnoseLsReactionCase(kase,m5,sessions,{...located,evaluatedAt:at},{m5,h1,d1});
 expect(located.obKnownAt).toBe(Date.parse('2026-11-18T10:05:00Z')/1000);
 expect(diagnose(located.obKnownAt-300).verdict).toBe('OB noch nicht bekannt');
 expect(diagnose(located.obKnownAt).verdict).toBe('LS-Reaktion ✓');
 const resolve=createM5StructureContextResolver({m5Candles:m5,h1Candles:h1,d1Candles:d1,settings:{},sessionConfigs:sessions,instrument:'XAUUSD'});
 const cache=createCloseReactionCache(),chainAt=iso=>lsReactionChainAt(resolve,cache,Date.parse(iso)/1000);
 // Vorher nur die Wurzel: die ist kein Richtungsbeleg, also keine aktuelle Range.
 expect(chainAt('2026-11-18T09:20:00Z')).toMatchObject({links:[{depth:0,trend:'downtrend'}],current:null});
 expect(chainAt('2026-11-18T09:30:00Z').current).toMatchObject({trend:'uptrend',basis:'existingCloseReactionChoch'});
 const samples=[];
 for(let at=Date.parse('2026-11-18T09:00:00Z')/1000;at<=Date.parse('2026-11-18T09:40:00Z')/1000;at+=300)samples.push({at,key:chainAt(new Date(at*1000).toISOString()).key});
 expect(lsReactionChangeTimes(samples)).toContain(Date.parse('2026-11-18T09:25:00Z')/1000);
});

it('Pin 557 erklärt Box und Quellen im Klartext',()=>{
 const {result}=run(load('./fixtures/ls-reaction-ls-ob/xau-2026-11-18.json'),{id:557,kind:'ob_zone',note:'',
  obZone:{instrument:'XAUUSD',direction:'short',timeframe:'5M',top:3786.62,bottom:3779.74,startTime:'2026-11-18T09:55:00+00:00'}});
 const step=prefix=>result.steps.find(s=>s.label.trim().startsWith(prefix));
 expect(step('Setup-Box').detail).toBe('OB-Kerze 3.779,74–3.784,14 · Box/Invalidierung bis Sweep-Hoch 3.786,62');
 expect(step('Quelle LS 3.783,64')).toMatchObject({ok:true,code:'passed · sourceRangeDirection',
  detail:'LS-Pivot 07:45 gehört zur Abwärts-Wurzel und ist älter als das Range-Low 09:20, an dem die Gegen-Range (Close-CHoCH) beginnt → zählt'});
 expect(step('Quelle OB 3.779,88')).toMatchObject({ok:false,code:'unmet · orderBlockSourceRangeNotAssociated'});
});

it('Klartext: LS-Pivot nach dem Range-Low gehört zur Gegenbewegung',()=>{
 const at=Date.parse('2026-11-18T11:00:00Z')/1000,berlin=iso=>Date.parse(iso)/1000;
 expect(explainLsReactionSource({dir:1,evaluatedAt:at,source:{level:{pivotTime:berlin('2026-11-18T09:40:00Z'),price:3786.62}},
  assessment:{status:'unmet',reason:'sourceRangeNotAssociated',trendEvidence:{currentRange:{trend:'uptrend',basis:'existingCloseReactionChoch',
   confirmation:{originTime:berlin('2026-11-18T08:20:00Z')}},sourceOwner:{status:'unmet'}}}}))
  .toBe('LS-Pivot 10:40 liegt nach dem Range-Low 09:20 und gehört damit zur Gegenbewegung → zählt nicht');
});

it('Kettenpreise mit Instrument-Präzision statt rohem Float (P556)',()=>{
 const t=Date.parse('2026-11-18T09:05:00Z')/1000;
 expect(lsReactionPoint({price:1.3147499999999999,pivotTime:t},t,'GBPUSD')).toBe('1,31475 (10:05)');
 expect(lsReactionPoint({price:3757.31,pivotTime:t},t,'XAUUSD')).toBe('3.757,31 (10:05)');
});

it('Änderungszeiten: nur Wechsel gegenüber dem vorigen Schritt',()=>{
 expect(lsReactionChangeTimes([{at:1,key:'a'},{at:2,key:'a'},{at:3,key:'b'},{at:4,key:'b'},{at:5,key:'a'}])).toEqual([3,5]);
});

it('meldet einen H1-OB-Pin als nicht auswertbar statt zu raten',()=>{
 expect(lsReactionCaseFromPin({id:1,kind:'ob_zone',note:'LS-Reaktion',obZone:{instrument:'XAUUSD',direction:'short',timeframe:'1H',startTime:'2026-10-22T00:00:00Z'}}).error)
  .toMatch(/H1/);
});

it('zeigt mindestens einen Tag M5-Vorlauf, auch bei altem oder fremdem Query-Wert',()=>{
 expect(lsReactionLeadOf('6h')).toBe('24h');
 expect(Math.min(...LS_REACTION_LEADS.map(([,,s])=>s))).toBeGreaterThanOrEqual(86400);
 const kase={anchorTime:Date.parse('2026-10-12T10:45:00Z')/1000,lsPivotTime:null};
 expect(kase.anchorTime-lsReactionCaseWindow(kase,'6h','3h').view.from).toBeGreaterThanOrEqual(86400);
});
