// Philips drei XAU-Short-Fälle LS + OB, die TS1.1 im Chart nicht zeigte (Bug-Pins 509/510, DR 139, DR 140).
// Das Chartfenster (TRADE_SETUP_M5_CANDLE_COUNT) wird nachgestellt, weil Fall 1 nur daran scheiterte.
import {readFileSync} from 'node:fs';
import {beforeEach,expect,it,vi} from 'vitest';
const fetch=vi.hoisted(()=>vi.fn());
vi.mock('../src/candleCache.js',async original=>({...await original(),fetchCandlesCached:fetch}));
import {mergeCandles} from '../src/candleCache.js';
import {loadTradeSetup11Context} from '../src/tradeSetup11ContextLoader.js';
import {filterTradeSetup11Candidates} from '../src/tradeSetup11.js';
import {prepareTradeSetup11Context} from '../src/tradeSetup11Context.js';
import {detectTradeSetups,detectSetupObs,TRADE_SETUP_OB_SWEEP_PROFILE} from '../src/tradeSetup.js';
import {detectLiquidityLevels} from '../src/liquidityDetection.js';
import {tradeSetupParameters} from '../src/tradeSetupParameters.js';
import {markIgnoredCandles} from '../src/sessionOccurrences.js';
import {berlinOffsetMinutes} from '../src/berlinTime.js';
import {closedChecklistCandles} from '../src/tradeSetupChecklistTimeBasis.js';
import {obMinimum} from '../src/instrumentConfig.js';
import {isForbiddenAt} from '../src/sessions.js';
import {TRADE_SETUP_M5_CANDLE_COUNT} from '../src/priceChartConstants.js';

const load=path=>JSON.parse(readFileSync(new URL(path,import.meta.url),'utf8'));
const oct12=load('./fixtures/ts11-native/context.json'),oct22=load('./fixtures/ts11-ls-ob/xau-2026-10-22.json');
const sec=iso=>Date.parse(iso)/1000;
let source;
beforeEach(()=>{fetch.mockReset();fetch.mockImplementation(async(_fn,_symbol,bar,count,toMs)=>{
 const rows={'5m':source.m5,'1h':source.h1,'1D':source.d1}[bar].filter(c=>c.time*1000<toMs);
 return rows.slice(-count);
});});

function chartCase(fixture,evaluatedAt){
 source=fixture.candles;
 const sessions=fixture.sessionConfigs.filter(s=>s.instrument==='XAUUSD');
 const window=closedChecklistCandles(fixture.candles.m5,'5m',evaluatedAt).slice(-TRADE_SETUP_M5_CANDLE_COUNT);
 const rows=markIgnoredCandles(window,sessions,s=>berlinOffsetMinutes(s*1000)),levels=detectLiquidityLevels(rows,5);
 const params={...tradeSetupParameters('XAUUSD',rows.at(-1).time),sweepSourceProfile:TRADE_SETUP_OB_SWEEP_PROFILE};
 const shorts=detectTradeSetups(1,levels.highs,[],levels.highs,detectSetupObs(rows,obMinimum('XAUUSD','5m')),params,
  rows.filter(c=>!c.ignored),rows).map(s=>({...s,instrument:'XAUUSD'}));
 return {sessions,window,shorts};
}
async function evaluateLikeChart(fixture,obIso,evaluatedAt){
 const {sessions,window,shorts}=chartCase(fixture,evaluatedAt),setup=shorts.find(s=>s.obStartTime===sec(obIso));
 const context=await loadTradeSetup11Context({symbol:'XAUUSD',evaluatedAt});
 const input={instrument:'XAUUSD',m5Candles:mergeCandles(context.m5??[],window),h1Candles:context.h1,d1Candles:context.d1,
  settings:fixture.settings,sessionConfigs:sessions,evaluatedAt,sweepSourceProfile:TRADE_SETUP_OB_SWEEP_PROFILE};
 return {setup,sessions,input,assessment:filterTradeSetup11Candidates({...input,setups:[setup]}).assessments[0]};
}

it('Pin 509/510: findet den Short OB 12:45 + LS 4179,25, obwohl der D1-Anker vor dem Chart-M5-Fenster liegt',async()=>{
 const at=sec('2026-10-12T11:15:00Z'),{setup,assessment,input}=await evaluateLikeChart(oct12,'2026-10-12T10:45:00Z',at);
 expect([setup.obBottom,setup.obTop]).toEqual([4177.75,4180.14]);
 expect(setup.sweeps.map(s=>s.level.price)).toContain(4179.25);
 // Ursache: Ankerstart 28.09., das 2500er-Chartfenster beginnt erst am 29.09. -> m5AnchorHistoryMissing.
 expect(assessment).toMatchObject({status:'passed',reason:'currentTrendDirection'});
 expect(input.m5Candles[0].time).toBeLessThanOrEqual(assessment.trendEvidence.anchor.structureStartTime);
});

it('DR 139: OB 08:25 ist TS1, TS1.1 bleibt laut Regel unbekannt, weil nur die Wurzelrange abwärts zeigt',async()=>{
 const at=sec('2026-10-22T06:35:00Z'),{setup,assessment,input}=await evaluateLikeChart(oct22,'2026-10-22T06:25:00Z',at);
 expect([setup.obBottom,setup.obTop]).toEqual([4096.77,4102.73]);
 // Philips LS 4100,44 ist ein M1-Pivot; auf M5 gibt es dort kein Fraktal, TS1 nimmt 4092,99.
 expect(setup.sweeps.map(s=>s.level.price)).not.toContain(4100.44);
 const context=prepareTradeSetup11Context({...input});
 expect(context.chain.map(r=>r.trend)).toEqual(['downtrend']);
 expect(context.state.nestedTrend.trend).toBe('unknown');
 expect(assessment).toMatchObject({status:'unknown',reason:'innerTrendUnknown'});
});

it('DR 140: TS1.1 besteht, der Chart verwirft den OB 04:40 aber wegen der verbotenen Asia-Session',async()=>{
 const at=sec('2026-10-22T02:50:00Z'),{setup,assessment,sessions}=await evaluateLikeChart(oct22,'2026-10-22T02:40:00Z',at);
 expect([setup.obBottom,setup.obTop]).toEqual([4117.9,4123.87]);
 expect(setup.sweeps.map(s=>s.level.price)).toContain(4118.36);
 expect(assessment.status).toBe('passed');
 expect(isForbiddenAt(sessions,setup.obStartTime,u=>berlinOffsetMinutes(u*1000))).toBe(true);
});
