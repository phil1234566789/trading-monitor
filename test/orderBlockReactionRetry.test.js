import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {createOrderBlockReactionContext,evaluateOrderBlockReaction,reactionBreaksOrderBlock} from '../src/orderBlockReaction.js';
import {detectOrderBlocks} from '../src/orderBlockDetection.js';
import {orderBlockRecognitionTimes} from '../src/orderBlockRecognitionTime.js';
import {closedChecklistCandles} from '../src/tradeSetupChecklistTimeBasis.js';

// Philips bestätigter Retry-Vertrag vom 16.11.2026: neuer Versuch erst nach Ablehnung bekannt;
// der ursprüngliche M5-Bruch beendet die Suche. Frühere Versuche dürfen dadurch nicht umgeschrieben werden.
const cases={
 P7:{day:'2026-11-03',offset:'+01:00',startTime:1793671200,dir:-1},
 504:{day:'2026-10-21',offset:'+02:00',startTime:1792558800,dir:1},
};
const fixtures=new Map(Object.values(cases).map(c=>[c.day,
 JSON.parse(readFileSync(new URL(`./fixtures/dob-native/${c.day}.json`,import.meta.url),'utf8'))]));
const at=(c,hm)=>Date.parse(`${c.day}T${hm}:00${c.offset}`)/1000;
const fvgAt=(c,center,known)=>({candleTime:at(c,center),recognizedAt:at(c,known)});
const mirror=rows=>rows.map(c=>({...c,open:10000-c.open,high:10000-c.low,low:10000-c.high,close:10000-c.close}));

function evaluate(c,hm,mirrored=false){
 const evaluatedAt=at(c,hm),dir=mirrored?-c.dir:c.dir,source=fixtures.get(c.day).candles;
 const m1=closedChecklistCandles(mirrored?mirror(source.m1):source.m1,'1m',evaluatedAt);
 const m5=closedChecklistCandles(mirrored?mirror(source.m5):source.m5,'5m',evaluatedAt);
 const zone=detectOrderBlocks(m5,'5m',true,0).find(z=>z.startTime===c.startTime&&z.dir===dir);
 expect(zone).toBeDefined();
 const ob={...zone,recognizedAt:orderBlockRecognitionTimes(m5,'5m').get(c.startTime),timeframe:'5M'};
 const context=createOrderBlockReactionContext(m1,evaluatedAt,'XAUUSD');
 return {ob,context,result:evaluateOrderBlockReaction(context,ob)};
}

for(const mirrored of [false,true])describe(`Route-b-Retry: ${mirrored?'gespiegelte':'native'} OHLC`,()=>{
 it('P7: erster Versuch false 03:26, neuer Versuch pending 03:32, Entry 03:35 mit eigener FVG',()=>{
  const c=cases.P7,firstFvg=fvgAt(c,'03:15','03:17'),secondFvg=fvgAt(c,'03:30','03:32');
  const first=evaluate(c,'03:26',mirrored).result;
  expect.soft(first).toMatchObject({state:'false',structuralState:'true',knownAt:at(c,'03:17'),verdict:{state:'false',knownAt:at(c,'03:26')}});
  expect.soft(first.routes.a.status).toBe('rejected');
  expect(first.routes.b).toMatchObject({status:'rejected',reason:'entryBOrderBlockTooDeep',knownAt:at(c,'03:26'),
   attempts:[{fvg:firstFvg,status:'rejected',reason:'entryBOrderBlockTooDeep',knownAt:at(c,'03:26')}]});
  expect(first.routes.b.attempts).toHaveLength(1);
  expect(evaluate(c,'03:31',mirrored).result.routes.b.attempts).toHaveLength(1);

  const pending=evaluate(c,'03:32',mirrored).result;
  expect.soft(pending).toMatchObject({state:'unknown',structuralState:'true',knownAt:at(c,'03:17'),verdict:{state:'pending'},fvg:firstFvg});
  expect(pending.routes.b.status).toBe('pending');
  expect(pending.routes.b.attempts).toHaveLength(2);
  expect(pending.routes.b.attempts[0]).toEqual(first.routes.b.attempts[0]);
  expect(pending.routes.b.attempts[1]).toMatchObject({status:'pending',fvg:secondFvg});

  const ready=evaluate(c,'03:35',mirrored).result;
  expect.soft(ready).toMatchObject({state:'true',structuralState:'true',knownAt:at(c,'03:17'),
   verdict:{state:'true',knownAt:at(c,'03:35')},fvg:firstFvg});
  expect(ready.routes.b).toMatchObject({status:'entry',entryTime:at(c,'03:35'),entryFvg:secondFvg});
  expect(ready.routes.b.entryPrice).toBeCloseTo(mirrored?10000-3943.16:3943.16,8);
  expect(ready.routes.b.attempts).toHaveLength(2);
  expect(ready.routes.b.attempts[0]).toEqual(first.routes.b.attempts[0]);
  expect(ready.routes.b.attempts[1]).toMatchObject({status:'entry',entryTime:at(c,'03:35'),fvg:secondFvg});
 });

 it('P7: längere Zukunft und Rückspulen erhalten die erste Ablehnung und die Entry-Zuordnung',()=>{
  const c=cases.P7,first=evaluate(c,'03:26',mirrored).result.routes.b;
  expect(first.attempts).toHaveLength(1);
  const frozen=structuredClone(first.attempts[0]);
  for(const hm of ['03:32','03:35','04:00','14:31']){
   const r=evaluate(c,hm,mirrored).result;
   expect(r.routes.b.attempts[0],hm).toEqual(frozen);
   expect(r.fvg).toMatchObject(fvgAt(c,'03:15','03:17'));
   if(hm!=='03:32'){
    expect(r.routes.b).toMatchObject({status:'entry',entryTime:at(c,'03:35'),entryFvg:fvgAt(c,'03:30','03:32')});
    expect(r.routes.b.attempts).toHaveLength(2);
   }
  }
  expect(evaluate(c,'03:26',mirrored).result.routes.b).toEqual(first);
 });

 it('P7: fehlende Minute 03:28 macht nur die Retry-Suche unknown und bewahrt die Ablehnung',()=>{
  const c=cases.P7,{ob,context,result:complete}=evaluate(c,'03:35',mirrored);
  const rejected=structuredClone(evaluate(c,'03:26',mirrored).result.routes.b.attempts[0]);
  expect(complete.routes.b).toMatchObject({status:'entry',entryTime:at(c,'03:35')});
  const rows=context.rows.filter(row=>row.time!==at(c,'03:28'));
  for(const hm of ['03:28','03:29','03:35']){
   const evaluatedAt=at(c,hm),prefix=closedChecklistCandles(rows,'1m',evaluatedAt);
   const r=evaluateOrderBlockReaction(createOrderBlockReactionContext(prefix,evaluatedAt,'XAUUSD'),ob);
   if(hm==='03:28'){
    expect(r.routes.b).toMatchObject({status:'rejected',knownAt:at(c,'03:26')});
   }else{
    expect(r).toMatchObject({state:'unknown',structuralState:'true',
     verdict:{state:'unknown',reason:'missingHistory',knownAt:at(c,'03:28')}});
    expect(r.routes.b).toMatchObject({status:'unknown',reason:'missingHistory',knownAt:at(c,'03:28')});
    expect(r.routes.b).not.toHaveProperty('entryTime');
   }
   expect(r.routes.b.attempts).toEqual([rejected]);
  }
 });

 it('504: 07:48 ist kein Nachfolger der Ablehnung 07:54; M5-Bruch 08:11 sperrt die neue FVG 08:15',()=>{
  const c=cases[504],first=evaluate(c,'07:54',mirrored).result;
  expect(first).toMatchObject({state:'false',structuralState:'true',verdict:{state:'false',knownAt:at(c,'07:54')}});
  expect(first.routes.b).toMatchObject({status:'rejected',reason:'entryBOrderBlockTooDeep',knownAt:at(c,'07:54'),
   attempts:[{status:'rejected',reason:'entryBOrderBlockTooDeep',knownAt:at(c,'07:54'),fvg:fvgAt(c,'07:45','07:47')}]});
  expect(first.routes.b.attempts).toHaveLength(1);
  const frozen=structuredClone(first.routes.b.attempts[0]);
  const through=evaluate(c,'08:19',mirrored),side=mirrored?'short':'long';
  expect(through.context.byDirection[side]).toEqual(expect.arrayContaining([
   expect.objectContaining(fvgAt(c,'07:46','07:48')),expect.objectContaining(fvgAt(c,'08:13','08:15')),
  ]));
  // Der M5-Bruch muss auch zwischen zwei FVG-Kandidaten sichtbar bleiben, nicht erst beim nächsten Versuch.
  const broken=through.context.rows.find(row=>row.time>=at(c,'07:47')&&reactionBreaksOrderBlock(row,through.ob));
  expect(broken.time+60).toBe(at(c,'08:11'));
  for(const hm of ['08:10','08:11','08:15','08:19']){
   const r=evaluate(c,hm,mirrored).result;
   expect(r.state,hm).toBe('false');
   expect(r.verdict.state,hm).toBe('false');
   expect(r.routes.b.status,hm).toBe('rejected');
   expect(r.routes.b.attempts,hm).toHaveLength(1);
   expect(r.routes.b.attempts[0],hm).toEqual(frozen);
   expect(Object.values(r.routes).some(route=>route.status==='entry'),hm).toBe(false);
  }
 });
});
