import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {describe,expect,it} from 'vitest';
import {createOrderBlockReactionContext,evaluateOrderBlockReaction,internalFvgOpenAt} from '../src/orderBlockReaction.js';
import {detectOrderBlocks,candleTouchesOrderBlock} from '../src/orderBlockDetection.js';
import {orderBlockRecognitionTimes} from '../src/orderBlockRecognitionTime.js';
import {closedChecklistCandles} from '../src/tradeSetupChecklistTimeBasis.js';
import {CHART_DEBUGGER_CASES,expectationOf,productMatches} from '../src/chartDebuggerCases.js';

// Soll aus ff698950: ob-reaction-counter.test.cjs:3–5, ob-reaction-debugger-cases.js:6–8,18
// und ob-reaction-api.js:7–8; öffentlicher state/structuralState/verdict nach Philips Vertrag vom 16.11.2026.
// Die alten Route-Inputs sind Belege dieser zwei Episoden, keine Regel zur Auswahl mehrerer FVGs.
const at=hm=>Date.parse(`2026-10-21T${hm}:00+02:00`)/1000;
const fixture=JSON.parse(readFileSync(new URL('./fixtures/dob-native/2026-10-21.json',import.meta.url),'utf8'));
const episodes={
 502:{startTime:1792552500,reactionAt:at('06:32'),contactAt:at('06:30'),opponentTime:at('06:27'),bottom:4119.06,top:4121.59,filledAt:at('06:33')},
 504:{startTime:1792558800,reactionAt:at('07:47'),contactAt:at('07:44'),opponentTime:at('07:41'),bottom:4119.8,top:4122.04,filledAt:at('07:51')},
};

const reflected=Object.fromEntries(Object.entries(fixture.candles).map(([tf,rows])=>[tf,rows.map(c=>({...c,
 open:10000-c.open,high:10000-c.low,low:10000-c.high,close:10000-c.close}))]));

function evaluate(pin,evaluatedAt,candles=fixture.candles,dir=1){
 const rows=closedChecklistCandles(candles.m1,'1m',evaluatedAt);
 const m5=closedChecklistCandles(candles.m5,'5m',evaluatedAt);
 const startTime=episodes[pin].startTime;
 const zone=detectOrderBlocks(m5,'5m',true,0).find(z=>z.startTime===startTime&&z.dir===dir);
 expect(zone).toBeDefined();
 const ob={...zone,recognizedAt:orderBlockRecognitionTimes(m5,'5m').get(startTime),timeframe:'5M'};
 const context=createOrderBlockReactionContext(rows,evaluatedAt,'XAUUSD');
 return {context,result:evaluateOrderBlockReaction(context,ob)};
}

describe('Historischer OB-Reaktionsvertrag: native Quellen statt Produkt-Goldens',()=>{
 it('bewahrt das gespeicherte Nutzer-Soll 504: öffentlich false und beide Routen rejected',()=>{
  const c=CHART_DEBUGGER_CASES.find(c=>c.id==='504');
  expect(expectationOf(c)).toMatchObject({verdict:'negative',reaction:'false',routes:{a:'rejected',b:'rejected'}});
 });

 it('productMatches lehnt einen negativen Fall mit Route-a-Entry auch bei passendem öffentlichem false ab',()=>{
  const c=CHART_DEBUGGER_CASES.find(c=>c.id==='504');
  const reaction={state:'false',verdict:{state:'false'},routes:{a:{status:'rejected'},b:{status:'rejected'}}};
  const output=r=>({orderBlocks:[{reaction:r}],pair:null});
  expect(productMatches(c,output(reaction))).toBe(true);
  expect(productMatches(c,output({...reaction,routes:{...reaction.routes,a:{status:'entry',entryPrice:4121.07}}}))).toBe(false);
 });

 it('bewahrt die ursprünglichen nativen M1/M5-Kerzen unabhängig von geänderten Erwartungen',()=>{
  const hashes={m1:'c907827feb851c1f2abb0f9b6f9cd916adb9c10a02df6d351546814ba650c27e',m5:'4ba0738ae820e1696d16a17fc53ca1c8128423e636d2c915aeeb6689441978b0'};
  for(const [tf,hash] of Object.entries(hashes))
   expect(createHash('sha256').update(JSON.stringify(fixture.candles[tf])).digest('hex')).toBe(hash);
 });

 for(const pin of [502,504]){
  it(`Pin ${pin}: genau eine aktive Gegen-FVG im belegten Reaktionspfad; Füllung erst bei Kerzenschluss`,()=>{
   const e=episodes[pin],{context}=evaluate(pin,e.reactionAt);
   const pathRows=context.rows.filter(c=>c.time>=e.contactAt-60);
   const path={low:Math.min(...pathRows.map(c=>c.low)),high:Math.max(...pathRows.map(c=>c.high))};
   // Alte reaction-window-Zuordnung; die Anzahl ist nur eine Vorbedingung dieser nativen Fälle.
   const active=context.byDirection.short.filter(f=>f.recognizedAt<=e.reactionAt&&candleTouchesOrderBlock(path,f)&&internalFvgOpenAt(context,f,e.reactionAt)===true);
   expect(active).toHaveLength(1);
   expect(active[0]).toMatchObject({direction:'short',candleTime:e.opponentTime,bottom:e.bottom,top:e.top});
   for(const time of [e.filledAt-1,e.filledAt]){
    const later=evaluate(pin,time).context;
    const same=later.byDirection.short.find(f=>f.candleTime===e.opponentTime);
    expect(internalFvgOpenAt(later,same,time)).toBe(time<e.filledAt);
   }
  });

  it(`Pin ${pin}: neue FVG vor Schluss noch unbekannt; Struktur wird nicht mit öffentlichem Entry verwechselt`,()=>{
   const e=episodes[pin];
   expect.soft(evaluate(pin,e.reactionAt-1).result.structuralState).toBe('unknown');
   const r=evaluate(pin,e.reactionAt).result;
   expect.soft(r).toMatchObject({structuralState:'true',knownAt:e.reactionAt,state:'unknown',verdict:{state:'pending'}});
   expect.soft(r.routes.a).toMatchObject({status:'rejected',knownAt:e.reactionAt});
   expect.soft(r.routes.b.status).toBe('pending');
  });
 }

 it.each(['06:33','06:37','06:39'])('502: A-Ablehnung von 06:32 bleibt um %s trotz späterer Gegen-FVG-Füllung bestehen',hm=>{
  const r=evaluate(502,at(hm)).result;
  expect(r.routes.a).toMatchObject({status:'rejected',knownAt:1792557120});
  expect(r.routes.a).not.toHaveProperty('entryPrice');
  expect(r.routes.a).not.toHaveProperty('stopLoss');
 });

 it('502: bis 06:38 pending, erst Entry b 06:39 macht das öffentliche Ergebnis true, SL 4112.95',()=>{
  const before=evaluate(502,at('06:38')).result;
  expect.soft(before).toMatchObject({structuralState:'true',knownAt:1792557120,state:'unknown',verdict:{state:'pending'}});
  expect.soft(before.routes.b.status).toBe('pending');
  const r=evaluate(502,at('06:39')).result;
  expect.soft(r).toMatchObject({structuralState:'true',knownAt:1792557120,state:'true',verdict:{state:'true',knownAt:at('06:39')}});
  expect.soft(r.routes.a).toMatchObject({status:'rejected',knownAt:1792557120});
  expect(r.routes.b).toMatchObject({status:'entry',entryTime:at('06:39'),entryPrice:4117.62,stopLoss:4112.95});
 });

 it('504: bis 07:53 pending, ab 07:54 beide Routen abgelehnt und öffentlich false trotz struktureller Reaktion',()=>{
  const before=evaluate(504,at('07:53')).result;
  expect.soft(before).toMatchObject({structuralState:'true',knownAt:at('07:47'),state:'unknown',verdict:{state:'pending'}});
  expect.soft(before.routes.a).toMatchObject({status:'rejected',knownAt:at('07:47')});
  expect.soft(before.routes.b.status).toBe('pending');
  for(const time of ['07:54','08:13']){
   const r=evaluate(504,at(time)).result;
   expect.soft(r,time).toMatchObject({structuralState:'true',knownAt:at('07:47'),state:'false',verdict:{state:'false',knownAt:at('07:54')}});
   expect.soft(r.routes.a,time).toMatchObject({status:'rejected',knownAt:at('07:47')});
   expect.soft(r.routes.b,time).toMatchObject({status:'rejected',reason:'entryBOrderBlockTooDeep',knownAt:at('07:54')});
   expect.soft(Object.values(r.routes).some(route=>route.status==='entry'),time).toBe(false);
  }
 });

 for(const pin of [502,504]){
  it(`Pin ${pin} gespiegelt: Short erkennt dieselbe Episode, sperrt A kausal und bewahrt B samt reflektiertem SL`,()=>{
   const e=episodes[pin],run=time=>evaluate(pin,time,reflected,-1);
   expect(run(e.reactionAt-1).result.structuralState).toBe('unknown');
   const {context,result:r}=run(e.reactionAt);
   expect(r).toMatchObject({structuralState:'true',knownAt:e.reactionAt,state:'unknown',
    verdict:{state:'pending'},routes:{a:{status:'rejected',knownAt:e.reactionAt},b:{status:'pending'}}});
   expect(r.contact).toEqual(evaluate(pin,e.reactionAt).result.contact);
   const opponent=context.byDirection.long.find(f=>f.candleTime===e.opponentTime);
   expect(opponent).toBeDefined();
   expect(opponent.bottom).toBeCloseTo(10000-e.top,8);
   expect(opponent.top).toBeCloseTo(10000-e.bottom,8);
   expect(internalFvgOpenAt(context,opponent,e.reactionAt)).toBe(true);
   for(const time of [e.filledAt-1,e.filledAt]){
    const later=run(time),same=later.context.byDirection.long.find(f=>f.candleTime===e.opponentTime);
    expect(internalFvgOpenAt(later.context,same,time)).toBe(time<e.filledAt);
    expect(later.result.routes.a).toMatchObject({status:'rejected',knownAt:e.reactionAt});
   }
   const finalAt=at(pin===502?'06:39':'07:54'),final=run(finalAt).result;
   expect(final).toMatchObject({structuralState:'true',knownAt:e.reactionAt,
    state:pin===502?'true':'false',verdict:{state:pin===502?'true':'false',knownAt:finalAt},
    routes:{a:{status:'rejected',knownAt:e.reactionAt}}});
   if(pin===502){
    expect(run(finalAt-1).result.verdict.state).toBe('pending');
    expect(final.routes.b).toMatchObject({status:'entry',entryTime:finalAt});
    expect(final.routes.b.entryPrice).toBeCloseTo(10000-4117.62,8);
    expect(final.routes.b.stopLoss).toBeCloseTo(10000-4112.95,8);
   }else{
    expect(final.routes.b).toMatchObject({status:'rejected',reason:'entryBOrderBlockTooDeep',knownAt:finalAt});
    expect(Object.values(final.routes).some(route=>route.status==='entry')).toBe(false);
   }
  });
 }

 it.each([1,-1])('502 Richtung %s: vor dem A-Kandidaten gefüllte Gegen-FVG gibt denselben A-Kandidaten frei',dir=>{
  const source=dir===1?fixture.candles:reflected,e=episodes[502];
  // Nur die Kerze 06:30 erreicht die ferne Gegen-FVG-Kante früher; keine Änderung an Quelle oder Erwartungslabels.
  const candles={...source,m1:source.m1.map(c=>c.time!==at('06:30')?c:dir===1?{...c,high:4121.60}:{...c,low:10000-4121.60})};
  const baseline=evaluate(502,e.reactionAt,source,dir),changed=evaluate(502,e.reactionAt,candles,dir);
  const direction=dir===1?'short':'long';
  const original=baseline.context.byDirection[direction].find(f=>f.candleTime===e.opponentTime);
  const opponent=changed.context.byDirection[direction].find(f=>f.candleTime===e.opponentTime);
  expect(opponent).toMatchObject({candleTime:original.candleTime,recognizedAt:original.recognizedAt,bottom:original.bottom,top:original.top});
  expect(internalFvgOpenAt(baseline.context,original,e.reactionAt)).toBe(true);
  const before=evaluate(502,at('06:31')-1,candles,dir).context;
  expect(internalFvgOpenAt(before,before.byDirection[direction].find(f=>f.candleTime===e.opponentTime),at('06:31')-1)).toBe(true);
  expect(internalFvgOpenAt(changed.context,opponent,at('06:31'))).toBe(false);
  expect(changed.result.contact).toEqual(baseline.result.contact);
  expect(changed.result.fvg).toMatchObject({candleTime:baseline.result.fvg.candleTime,recognizedAt:e.reactionAt});
  expect(baseline.result.routes.a).toMatchObject({status:'rejected',knownAt:e.reactionAt});
  expect(changed.result).toMatchObject({state:'true',structuralState:'true',knownAt:e.reactionAt,
   verdict:{state:'true',knownAt:e.reactionAt},routes:{a:{status:'entry',entryTime:e.reactionAt},b:{status:'pending'}}});
  expect(changed.result.routes.a.entryPrice).toBeCloseTo(dir===1?4120.27:10000-4120.27,8);
  expect(changed.result.routes.a.stopLoss).toBeCloseTo(dir===1?4112.95:10000-4112.95,8);
 });
});
