import {expect,it} from 'vitest';
import native from './fixtures/xauM5November6OrderBlock.json';
import {detectOrderBlocks} from '../src/orderBlockDetection.js';
import {detectOrderBlocks as mcp} from '../supabase/functions/trading-monitor-mcp/orderBlockDetection.js';
import {detectOrderBlocks as backend} from '../supabase/functions/_shared/orderBlocks.ts';
import {obMinimum} from '../src/instrumentConfig.js';
import {obMinimum as backendMinimum} from '../supabase/functions/_shared/instrumentConfig.js';
import {calculateSnapshotIndicators} from '../src/snapshotIndicatorCalculation.js';
import {buildTradeSetup2Configuration} from '../src/tradeSetup2Configuration.js';
import {createLiveEvidence} from '../services/setup2/evidence.js';

const candle=(time,low,high)=>({time,low,high,open:low,close:high});
const rows=gap=>[candle(0,4055.06,4058.35),candle(300,4055.70,4058.84),
  candle(600,4057.40,4060.82),candle(900,4058.84+gap,4064.05)];
const mirror=cs=>cs.map(c=>({...c,open:8200-c.open,close:8200-c.close,low:8200-c.high,high:8200-c.low}));
it('accepts every strictly positive Gold M5 gap, including the native 6 November reference',()=>{
  expect(obMinimum('XAUUSD','5m')).toBe(0);
  expect(backendMinimum('XAUUSD','5m')).toBe(0);
  for(const detect of [detectOrderBlocks,mcp,backend])for(const transform of [x=>x,mirror]){
    for(const gap of [0.63,0.01,1e-10])expect(detect(transform(rows(gap)),'5m',true,obMinimum('XAUUSD','5m'))).toHaveLength(1);
    for(const gap of [0,-0.01,-1e-10])expect(detect(transform(rows(gap)),'5m',true,0)).toHaveLength(0);
    expect(detect(transform(rows(.63).map((c,i)=>i===0?{...c,ignored:true}:c)),'5m',true,0)).toHaveLength(0);
    expect(detect(transform(rows(.63).slice(0,3)),'5m',true,0)).toHaveLength(0);
  }
  expect(detectOrderBlocks(rows(.63),'5m',true,0)[0]).toMatchObject({startTime:600,top:4058.84,bottom:4055.06});
});
it('preserves the other instrument/timeframe thresholds',()=>{
  expect(obMinimum('GBPUSD','5m')).toBe(null);
  expect(obMinimum('XAUUSD','1H')).toBe(2.53);
  expect(obMinimum('XAUUSD','4H')).toBe(6.19);
  for(const detect of [detectOrderBlocks,mcp,backend]){
    expect(detect(rows(0),'5m',true)).toHaveLength(0);
    expect(detect(rows(.74),'5m',true,.75)).toHaveLength(0);
    expect(detect(rows(.75),'5m',true,.75)).toHaveLength(1);
  }
});

it('recognizes the native 18:55 OB only after its 19:05 confirmation close',()=>{
  for(const detect of [detectOrderBlocks,mcp,backend]){
    const at=knownAt=>native.filter(c=>c.time+300<=knownAt);
    expect(detect(at(1793988299),'5m',true,obMinimum('XAUUSD','5m'))).toHaveLength(0);
    expect(detect(at(1793988300),'5m',true,obMinimum('XAUUSD','5m'))[0]).toMatchObject({startTime:1793987700,top:4058.84,bottom:4055.06});
  }
});
it('keeps old saved-run OB overlays at their original threshold',()=>{
  const input={frames:{'5m':native},source:{instrument:'XAUUSD'},at:1793988300,
    props:{showObsM5:true,showHistoricalObs:true},config:{sessions:[],setupVersion:'ls-entry-patterns-local-sweep-age-v28'}};
  expect(calculateSnapshotIndicators(input).zones).toHaveLength(0);
  const config=buildTradeSetup2Configuration({instrument:'XAUUSD'});
  expect(config.m5OrderBlockMinGap).toBe(0);
  expect(createLiveEvidence({instrument:'XAUUSD',sessions:[]},{fromTime:0,toTime:1200,startedAt:0,mode:'live'}).complete().configuration.configuration.m5OrderBlockMinGap).toBe(0);
  expect(calculateSnapshotIndicators({...input,config}).zones).toHaveLength(1);
});
