import {expect,it} from 'vitest';
import {orderBlockSweepSources,evaluateSweepConfirmation,confirmedOrderBlockSweepSource} from '../src/tradeSetupSweepSources.js';
import {filterTradeSetup11Candidates} from '../src/tradeSetup11.js';
import {fixture,nativeInput,nativeSetupFor} from './helpers/tradeSetup11NativeFixture.js';
import {findTradeSetup11SourceOwner} from '../src/tradeSetup11Ownership.js';

const candle=(time,high,low=90)=>({time,open:95,high,low,close:95});
it.each([1,-1])('supersedes only after a distinct confirmed P5 source is swept, mirrored dir %s',dir=>{
 const mirror=p=>dir===1?p:200-p;
 const rows=Array.from({length:16},(_,i)=>candle(i*300,i===7?110:i===14?111:101));
 const level={price:mirror(100),dir,pivotTime:0,touchedTime:1800,touched:true};
 const newer={price:mirror(110),dir,pivotTime:2100,touchedTime:4200,touched:true};
 const candles=dir===1?rows:rows.map(c=>({...c,high:200-c.low,low:200-c.high}));
 expect(evaluateSweepConfirmation(level,candles,4499,'5M',[newer]).status).toBe('valid');
 expect(evaluateSweepConfirmation(level,candles,4500,'5M',[newer])).toMatchObject({status:'superseded',validUntil:4500});
 expect(evaluateSweepConfirmation(level,candles,4500,'5M',[]).status).toBe('valid');
 for(const invalid of [{...newer,pivotTime:1800},{...newer,touchedTime:1800},{...newer,dir:-dir},
  {...newer,sourceKind:'orderBlock'},{...newer,price:level.price},{...newer,pivotTime:9999}])
  expect(evaluateSweepConfirmation(level,candles,4500,'5M',[invalid]).status).toBe('valid');
 expect(evaluateSweepConfirmation({...level,sourceKind:'orderBlock'},candles,4500,'5M',[newer]).status).toBe('valid');
 expect(evaluateSweepConfirmation(level,candles,4500,'1H',[newer]).status).toBe('valid');
});
it('records OB formation age independently from availability, with first closed crossing',()=>{
 const ob={dir:-1,top:100,bottom:98,startTime:300};
 const rows=[candle(300,110),candle(600,110),candle(900,99),candle(1200,101)];
 expect(orderBlockSweepSources([ob],rows,1,1500)).toMatchObject([{price:100,pivotTime:300,
  sourceKind:'orderBlock',sourceKnownAt:900,sourceStartTime:300,touchedTime:1200}]);
 expect(orderBlockSweepSources([ob],rows,1,1499)).toHaveLength(0);
 expect(orderBlockSweepSources([ob],rows,-1,1500)).toHaveLength(0);
 const source=orderBlockSweepSources([ob],rows,1,1500)[0];
 expect(confirmedOrderBlockSweepSource(source,[ob],rows,1500)).toBe(true);
 for(const altered of [{...source,price:101},{...source,sourceKnownAt:600},{...source,sourceDirection:1},
  {...source,touchedTime:900},{...source,sourceTop:101}])
  expect(confirmedOrderBlockSweepSource(altered,[ob],rows,1500)).toBe(false);
});
it('waits for the next actual formation candle close across a gap',()=>{
 const ob={dir:-1,top:100,bottom:98,startTime:300};
 const rows=[candle(300,110),candle(1200,110),candle(1500,101)];
 expect(orderBlockSweepSources([ob],rows,1,1500)).toHaveLength(0);
 expect(orderBlockSweepSources([ob],rows,1,1800)[0]).toMatchObject({sourceKnownAt:1500,touchedTime:1500});
});
it.each(['source','evaluation'])('preserves oldest display source with separate witness and %s profile',profileOrigin=>{
 const setup=nativeSetupFor(fixture.references.find(r=>r.pin===479));
 const oldest={...setup.ls,sourceKind:'orderBlock',price:9999,pivotTime:setup.ls.pivotTime-300};
 const profile='ts11-ob-edge-p5-supersession-v1';
 const candidate={...setup,...(profileOrigin==='source'?{sweepSourceProfile:profile}:{}),ls:oldest,sweeps:[{timeframe:'5M',level:oldest},...setup.sweeps]};
 const result=filterTradeSetup11Candidates({...nativeInput,...(profileOrigin==='evaluation'?{sweepSourceProfile:profile}:{}),setups:[candidate],evaluatedAt:setup.obStartTime+600});
 expect(result.counts.passed).toBe(1);
 expect(result.setups[0].ls).toBe(oldest);
 expect(result.assessments[0].trendEvidence.goWitness.level.price).toBe(setup.ls.price);
 expect(result.setups[0].sweepSourceProfile).toBe(candidate.sweepSourceProfile);
 expect(result.setups[0].trendEvaluationSourceProfile).toBe(profile);
});
it('does not turn an OB formation/age timestamp into a synthetic range pivot',()=>{
 const level={sourceKind:'orderBlock',sourceStartTime:300,sourceKnownAt:900,price:10,pivotTime:300,touchedTime:3000};
 const range={trend:'uptrend',currRange:{low:level,high:{price:20,pivotTime:0}},structurePivots:[level],innerStructurePivots:[]};
 const context={candles:Array.from({length:12},(_,i)=>({time:i*300})),rawCandles:Array.from({length:12},(_,i)=>({time:i*300})),
  sourceLiquidity:{highs:[],lows:[]},pivotsOuter:[],pivotsInner:[],periods:{outer:5,inner:2}};
 expect(findTradeSetup11SourceOwner({setup:{ls:level,dir:-1},context,expectedTrend:'uptrend',
  resolveContext:()=>({status:'ready',chain:[range,range],stateKnownAt:3000})}).status).toBe('unmet');
});
