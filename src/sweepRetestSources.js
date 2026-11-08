import { detectLiquidityLevels,LIQUIDITY_FRACTAL_PERIOD } from './liquidityDetection.js';
import { detectOrderBlocks,candleTouchesOrderBlock,candleInvalidatesOrderBlock } from './orderBlockDetection.js';
import { orderBlockRecognitionTimes } from './orderBlockRecognitionTime.js';
import { closedChecklistCandles } from './tradeSetupChecklistTimeBasis.js';
import { instrumentConfig } from './instrumentConfig.js';
import { M1_FVG_RETEST_PATTERN_VERSION } from './m1FvgRetestSequence.js';
import { m5EntryHistoryKnown } from './m5EntryHistory.js';
import {refineChecklistH1Sweeps} from './tradeSetupChecklistH1Sweeps.js';
import {strongestSetupSweeps} from './tradeSetup.js';

export const SWEEP_RETEST_SOURCE_KIND='liquidity-sweep-existing-m5-ob-retest-v1';

// Der zusätzliche Startpfad nutzt dieselben nativen Fraktale und OB-Zonen, kein Setup-1.0-Ersatz.
export function detectSweepRetestSources({instrument,m5Candles=[],h1Candles=[],evaluatedAt,sessionConfigs=[]}) {
  const m5=closedChecklistCandles(m5Candles,'5m',evaluatedAt);
  const recognition=orderBlockRecognitionTimes(m5,'5m');
  const zones=detectOrderBlocks(m5,'5m',true,instrumentConfig(instrument).minFvg['5m'] ?? null);
  const sweeps=[];
  for(const [rows,timeframe,duration] of [[m5,'5M',300],[closedChecklistCandles(h1Candles,'1h',evaluatedAt),'1H',3600]]){
    const usable=rows.filter(c=>!c.ignored),levels=detectLiquidityLevels(usable,LIQUIDITY_FRACTAL_PERIOD);
    for(const level of [...levels.highs,...levels.lows]){
      const index=usable.findIndex(c=>c.time===level.pivotTime);
      const knownAt=usable[index+LIQUIDITY_FRACTAL_PERIOD]?.time+duration;
      if(duration===3600){
        const refined=refineChecklistH1Sweeps([level],rows,m5.filter(c=>!c.ignored))[0];
        if(refined&&knownAt<=refined.recognizedAt)sweeps.push({level:{...refined,recognizedAt:knownAt},
          timeframe,sweepAt:refined.fineTouchedTime ?? refined.recognizedAt,sweepKnownAt:refined.recognizedAt});
      }else if(level.touched && knownAt<=level.touchedTime+duration)
        sweeps.push({level:{...level,recognizedAt:knownAt},timeframe,sweepAt:level.touchedTime,sweepKnownAt:level.touchedTime+duration});
    }
  }
  const histories=zones.map(zone=>{
    const knownAt=recognition.get(zone.startTime),contacts=[];
    let invalidationKnownAt=Infinity;
    for(const candle of m5){
      if(candle.time<knownAt||candle.ignored)continue;
      if(candleInvalidatesOrderBlock(candle,zone)){invalidationKnownAt=candle.time+300;break;}
      if(candleTouchesOrderBlock(candle,zone))contacts.push(candle);
    }
    return {zone,knownAt,contacts,invalidationKnownAt,coverage:new Map()};
  });
  const sources=[];
  for(const {level,timeframe,sweepAt,sweepKnownAt} of sweeps)for(const {zone,knownAt,contacts,invalidationKnownAt,coverage} of histories){
    const obDir=-level.dir;
    if(zone.dir!==obDir || !(knownAt<=(level.fineTouchedTime ?? level.touchedTime)))continue;
    // Spätere Invalidierungen dürfen die damals gültige Quelle nicht rückwirkend entfernen.
    const retest=contacts.find(candle=>candle.time>=sweepAt);
    if(!retest)continue;
    const recognizedAt=Math.max(sweepKnownAt,retest.time+300);
    if(recognizedAt>evaluatedAt||invalidationKnownAt<=recognizedAt)continue;
    if(!coverage.has(retest.time))coverage.set(retest.time,m5EntryHistoryKnown(m5,knownAt,retest.time+300,sessionConfigs,instrument));
    if(!coverage.get(retest.time))continue;
    const key=[level.dir,zone.startTime,retest.time].join(':');
    sources.push({instrument,sourceKey:key,sourceKind:SWEEP_RETEST_SOURCE_KIND,
      entryPattern:M1_FVG_RETEST_PATTERN_VERSION,createdAt:recognizedAt,recognizedAt,dir:level.dir,
      obTop:zone.top,obBottom:zone.bottom,obStartTime:zone.startTime,obFvg:zone.fvg,
      orderBlockKnownAt:knownAt,sourceRetest:{candleTime:retest.time,recognizedAt:retest.time+300},
      ls:level,sweeps:[{timeframe,level}],invalidation:obDir===-1?zone.top:zone.bottom});
  }
  const grouped=new Map();
  for(const source of sources){
    const previous=grouped.get(source.sourceKey);
    if(!previous){grouped.set(source.sourceKey,source);continue;}
    const selected=strongestSetupSweeps([...previous.sweeps,...source.sweeps]);
    grouped.set(source.sourceKey,{...previous,sweeps:selected,ls:selected[0].level});
  }
  return [...grouped.values()].sort((a,b)=>a.createdAt-b.createdAt || a.sourceKey.localeCompare(b.sourceKey));
}
