import {expect,it} from 'vitest';
import {filterTradeSetup11Candidates} from '../src/tradeSetup11.js';
import {currentTradeSetup11Range} from '../src/tradeSetup11Ownership.js';
import {findTradeSetup11SourceOwner} from '../src/tradeSetup11Ownership.js';
import {tradeSetupFromRow} from '../src/tradeSetupRow.js';
import {fixture,nativeInput,nativeSetupFor,expectedFor} from './helpers/tradeSetup11NativeFixture.js';

it.each(fixture.references)('does not expose pin $pin before native confirmation or change it after future data arrives',ref=>{
 const setup=nativeSetupFor(ref),at=setup.obStartTime+600;
 expect(filterTradeSetup11Candidates({...nativeInput,setups:[setup],evaluatedAt:at-1}).assessments[0].status).toBe('unknown');
 const full=filterTradeSetup11Candidates({...nativeInput,setups:[setup],evaluatedAt:at});
 const prefix=filterTradeSetup11Candidates({...nativeInput,setups:[setup],evaluatedAt:at,
  m5Candles:nativeInput.m5Candles.filter(c=>c.time+300<=at),h1Candles:nativeInput.h1Candles.filter(c=>c.time+3600<=at),
  d1Candles:nativeInput.d1Candles.filter(c=>c.time+86400<=at)});
 expect(prefix.assessments).toEqual(full.assessments);
 expect(filterTradeSetup11Candidates({...nativeInput,setups:[setup],evaluatedAt:at+2*86400}).assessments).toEqual(full.assessments);
});
it.each([479,483])('does not accept a future or impossible source chronology even when direction would match pin %s',pin=>{
 const setup=nativeSetupFor(fixture.references.find(r=>r.pin===pin)),at=setup.obStartTime+600;
 for(const ls of [{...setup.ls,pivotTime:at+300,touchedTime:at+600},{...setup.ls,touchedTime:at},
  {...setup.ls,pivotTime:at-600,touchedTime:at-300},
  {...setup.ls,dir:-setup.dir},{...setup.ls,fineTouchedTime:'invalid'},
  {...setup.ls,fineTouchedTime:setup.ls.touchedTime-300}]){
  const result=filterTradeSetup11Candidates({...nativeInput,setups:[{...setup,ls}],evaluatedAt:at});
  expect(result.assessments[0].status).toBe('unknown');expect(result.setups).toEqual([]);
 }
});
it.each([479,483])('allows a finer native touch inside the already closed M5 sweep bucket for pin %s',pin=>{
 const ref=fixture.references.find(r=>r.pin===pin),setup=nativeSetupFor(ref),at=setup.obStartTime+600;
 const result=filterTradeSetup11Candidates({...nativeInput,setups:[{...setup,
  ls:{...setup.ls,fineTouchedTime:setup.ls.touchedTime+240}}],evaluatedAt:at});
 // Der feinere Touch darf das Urteil nicht ändern. P483 ist seit Philips Go ✗ (Range nur Close-CHoCH):
 // „der short geht an sich auf, aber den kann man eh nicht traden. von daher halb so wild wenn der wegfällt“.
 expect(result.assessments[0].status).toBe(expectedFor(ref)==='reject'?'unmet':'passed');
});
it.each(['uptrend','downtrend'])('does not use the root or an opposite source owner as %s proof',expectedTrend=>{
 const level={pivotTime:300,price:10,touchedTime:3000};
 const range={low:level,high:{pivotTime:0,price:20}};
 const root={trend:expectedTrend,currRange:range,structurePivots:[level],innerStructurePivots:[]};
 const child={...root,trend:expectedTrend==='uptrend'?'downtrend':'uptrend'};
 const context={candles:Array.from({length:12},(_,i)=>({time:i*300})),pivotsOuter:[],pivotsInner:[],periods:{outer:5,inner:2}};
 const result=findTradeSetup11SourceOwner({setup:{ls:level},context,expectedTrend,
  resolveContext:at=>({status:'ready',chain:[root,child],stateKnownAt:at})});
 expect(result.status).toBe('unmet');
});
it('does not turn the root trend into a direction gate',()=>{
 const root={trend:'uptrend'},inner={trend:'downtrend',currRange:{low:{price:10},high:{price:20}}};
 expect(currentTradeSetup11Range({chain:[root,inner],state:root,stateKnownAt:600}).trend).toBe('downtrend');
 root.trend='downtrend';
 expect(currentTradeSetup11Range({chain:[root,inner],state:root,stateKnownAt:600}).trend).toBe('downtrend');
});
it('keeps manual capture and unavailable context unknown without mutating original source metadata',()=>{
 const ref=fixture.references.find(r=>r.pin===481),source=tradeSetupFromRow(ref.row),before=JSON.stringify(source);
 const result=filterTradeSetup11Candidates({...nativeInput,setups:[source],evaluatedAt:source.obStartTime+600});
 expect(result.assessments[0]).toMatchObject({status:'unknown',reason:'sourceNotKnownYet'});expect(JSON.stringify(source)).toBe(before);
 const live=nativeSetupFor(ref);
 expect(filterTradeSetup11Candidates({...nativeInput,setups:[live],d1Candles:[],evaluatedAt:live.obStartTime+600}).counts.unknown).toBe(1);
});
it('does not let a malformed or foreign source break or bypass the batch',()=>{
 const setup=nativeSetupFor(fixture.references.find(r=>r.pin===479)),at=setup.obStartTime+600;
 for(const source of [null,{...setup,instrument:'EURUSD'},{...setup,obTop:NaN},
  {...setup,obBottom:setup.obTop},{...setup,sweeps:[{timeframe:5,level:setup.ls}]},
  {...setup,sweeps:[{timeframe:'invalid',level:setup.ls}]}]){
  expect(filterTradeSetup11Candidates({...nativeInput,setups:[source],evaluatedAt:at}).counts.unknown).toBe(1);
 }
});
it.each(fixture.references)('mirrors the native direction and source-range policy for pin $pin',ref=>{
 const original=nativeSetupFor(ref),axis=10000;
 const candles=rows=>rows.map(c=>({...c,open:axis-c.open,close:axis-c.close,low:axis-c.high,high:axis-c.low}));
 const level=p=>({...p,dir:-p.dir,price:axis-p.price});
 const setup={...original,dir:-original.dir,ls:level(original.ls),fractal:level(original.fractal),
  sweeps:original.sweeps.map(s=>({...s,level:level(s.level)})),obTop:axis-original.obBottom,obBottom:axis-original.obTop};
 const mirrored={...nativeInput,m5Candles:candles(nativeInput.m5Candles),h1Candles:candles(nativeInput.h1Candles),d1Candles:candles(nativeInput.d1Candles)};
 const result=filterTradeSetup11Candidates({...mirrored,setups:[setup],evaluatedAt:setup.obStartTime+600});
 expect(result.assessments[0].status).toBe(expectedFor(ref)==='reject'?'unmet':'passed');
});
