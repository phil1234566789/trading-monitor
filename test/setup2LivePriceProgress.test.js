import {it,expect} from 'vitest';
import {observeDealingRangePrice} from '../src/dealingRangePriceObservation.js';
import {observeCapturedRanges,mergeCapturedRangeState} from '../services/setup2/priceObservations.js';
const candles=[{time:0,open:1,close:1.1,high:1.5,low:.8},{time:300,open:1.1,close:2,high:2.2,low:1.2},{time:600,open:2,close:3,high:3.2,low:1.8}];
const input={candles,validatedAt:0,validationPrice:1,target1:2,target2:3,invalidation:.5,direction:'long'};
it('incremental tail equals the original full observation without rereading the prefix',()=>{
 const first=observeDealingRangePrice({...input,windowEnd:600});
 const incremental=observeDealingRangePrice({...input,candles:candles.slice(2),windowEnd:900,previous:first});
 expect(incremental).toEqual(observeDealingRangePrice({...input,windowEnd:900}));
});
it('freezes capture anchor and price progress across JSON restart while exposing missing earlier coverage',()=>{
 const origin={setupKey:'GBPUSD:setup1:1',originSnapshotId:'first',validatedAt:0,sourceValidatedAt:-120,target1:2,target2:3,invalidation:.5,direction:'long'};
 const args={origins:[origin],previous:{},m5Candles:[{time:-300,open:1,close:1,high:1,low:1},...candles],sessionConfigs:[],instrument:'GBPUSD',toTime:600,configurationId:'config-one'};
 const first=observeCapturedRanges(args);expect(first[origin.setupKey].coverage).toMatchObject({originSnapshotId:'first',validatedAt:0,missingBeforeCapture:true});
 const later=observeCapturedRanges({...args,origins:[{...origin,originSnapshotId:'later',validatedAt:600}],previous:JSON.parse(JSON.stringify(first)),toTime:900});
 expect(later[origin.setupKey].coverage.originSnapshotId).toBe('first');expect(later[origin.setupKey].observation.validatedAt).toBe(0);
 expect(later[origin.setupKey].observation).toEqual(observeDealingRangePrice({...input,windowEnd:900}));
});

it('a missing immediately preceding M5 close stays unknown rather than using an older close',()=>{
 const state=observeCapturedRanges({origins:[{setupKey:'one',originSnapshotId:'first',validatedAt:0,target1:2,target2:3,invalidation:.5,direction:'long'}],
  previous:{},m5Candles:[{time:-600,close:1,high:1,low:1},...candles],sessionConfigs:[],instrument:'GBPUSD',toTime:600});
 expect(state.one.parameters.validationPrice).toBeNull();expect(state.one.observation.stage1).toBe('unknown');
});
it('pending A never overwrites independent DB recovery B and never replaces a newer or different anchor',()=>{
 const value=(id,through,validatedAt=0)=>({coverage:{originSnapshotId:id,evaluatedThrough:through,validatedAt}});
 const fresh={A:value('a',300),B:value('recovered-b',900)},local={A:value('a',600),B:value('old-b',60)};
 expect(mergeCapturedRangeState(fresh,local,['A'])).toEqual({A:local.A,B:fresh.B});
 expect(mergeCapturedRangeState(fresh,{A:value('other',1000)},['A']).A).toEqual(fresh.A);
 expect(mergeCapturedRangeState(fresh,{A:value('a',60)},['A']).A).toEqual(fresh.A);
});
