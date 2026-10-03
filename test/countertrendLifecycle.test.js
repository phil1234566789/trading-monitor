import { describe,it,expect,vi } from 'vitest';
import { setup1RecognitionTime } from '../src/setup1RecognitionTime.js';
import { evaluateCountertrendLifecycle, countertrendLifecycleEnd } from '../src/countertrendLifecycle.js';
import { createSetup2Entry } from '../src/tradeSetup2EntryGate.js';
import fixture from './fixtures/gbpusd-m5-cd-97-105.json';

const selection={status:'passed',direction:'short',selectedAt:600,target1:{price:1.2},target2:{price:1.1}};
const candle=(time,low,high=1.25)=>({time,low,high});
const run=(candles,entries=[],target2=selection.target2,evaluatedAt=candles.at(-1)?.time+300 ?? 600)=>
 evaluateCountertrendLifecycle({selection:{...selection,target2},invalidation:1.4,candles,entries,evaluatedAt});
describe('Countertrend-Lebenszyklus',()=>{
 it('verschiebt 97 auf FVG-Schluss, lässt 105 unverändert',()=>{
  expect(setup1RecognitionTime(fixture.setups[0])).toBe(fixture.setups[0].obStartTime+600);
  expect(setup1RecognitionTime(fixture.setups[1])).toBe(fixture.setups[1].createdAt);
 });
 it.each([{tradeSetupId:7,createdAt:null,obStartTime:300},{tradeSetupId:8,createdAt:300,obStartTime:600}])
 ('meldet unbrauchbare Quellen statt stiller Filterung',s=>expect(()=>setup1RecognitionTime(s)).toThrow(/Erkennungszeit nicht ableitbar/));
 it('endet am Invalidierungslevel',()=>expect(run([candle(600,1.25,1.41)]).main.reason).toBe('invalidation'));
 it('T1 ohne Entry beendet die DR und speichert das Ereignis',()=>{
  const result=run([candle(600,1.19)]);
  expect(result.main).toMatchObject({state:'ended',reason:'target1',recognizedAt:900});
  expect(result.events).toEqual([{type:'target1',time:600,recognizedAt:900}]);
  expect(result.entrySearchAllowed).toBe(false);
 });
 it('T1 mit offenem Entry läuft weiter bis BE',()=>{
  const rows=[candle(600,1.19),candle(900,1.21)];
  const open={entryTime:600,status:'open'};
  expect(run(rows,[open]).main.state).toBe('active');
  expect(run(rows,[open]).entrySearchAllowed).toBe(false);
  expect(run(rows,[{...open,status:'closed',exitTime:960,exitRecognizedAt:1020}],selection.target2,1020).main)
   .toMatchObject({state:'ended',reason:'entriesClosed',recognizedAt:1020});
 });
 it('wartet bei mehreren Entries auf alle Ausgänge',()=>{
  const closed={entryTime:600,status:'closed',exitTime:900,exitRecognizedAt:960};
  expect(run([candle(600,1.19),candle(900,1.21)],[closed,{entryTime:600,status:'open'}]).main.state).toBe('active');
  expect(countertrendLifecycleEnd({target1:true,hasTarget2:true,entries:[closed,closed]})).toBe('entriesClosed');
 });
 it('endet ohne T2 bei T1 auch mit offenem Entry',()=>expect(run([candle(600,1.19)],[{entryTime:600,status:'open'}],null).main.reason).toBe('target1'));
 it('endet bei T2 mit offenen Restpositionen',()=>expect(run([candle(600,1.09)],[{entryTime:600,status:'open'}]).main.reason).toBe('target2'));
 it('verwendet M1-T1 zwischen M5-Schlüssen',()=>{
  const result=run([], [{entryTime:600,status:'open',t1Time:600,t1RecognizedAt:660}],selection.target2,660);
  expect(result.target1.recognizedAt).toBe(660);expect(result.entrySearchAllowed).toBe(false);
 });
 it('ein M1-T1 sperrt auch ohne bisherigen Entry vor dem nächsten M5-Schluss',()=>{
  const result=evaluateCountertrendLifecycle({selection,invalidation:1.4,candles:[],evaluatedAt:660,
   m1Candles:[candle(600,1.19)]});
  expect(result.main).toMatchObject({state:'ended',reason:'target1',recognizedAt:660});
  expect(result.entrySearchAllowed).toBe(false);
 });
 it('spätere Entry-Ausgänge ändern keine früheren Stände',()=>{
  expect(run([candle(600,1.19)],[{entryTime:600,status:'closed',exitRecognizedAt:1200}],selection.target2,900).main.state).toBe('active');
 });
 it('beweist bei zwei Entry-Modellen genau einen zentralen Stundencheck je Anlageversuch',()=>{
  const hours=vi.fn(()=>({status:'blocked'})),models=[vi.fn(()=>1),vi.fn(()=>2)];
  for(const model of models) expect(createSetup2Entry({},model,hours)).toBeNull();
  expect(hours).toHaveBeenCalledTimes(2);models.forEach(model=>expect(model).not.toHaveBeenCalled());
  hours.mockReturnValue({status:'passed'});
  expect(createSetup2Entry({},models[0],hours)).toBe(1);
 });
 it('fehlende Historie bleibt unbekannt; Invalidierung/Target derselben Kerze beendet mit offener Reihenfolge',()=>{
  expect(run([candle(900,1.19)]).main).toMatchObject({state:'unknown',reason:'missingHistory'});
  expect(run([candle(600,1.19,1.41)]).main).toMatchObject({state:'ended',reason:'both',ambiguous:true});
 });
});
