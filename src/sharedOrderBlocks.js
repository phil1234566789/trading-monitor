import {createIncrementalOrderBlockDetector} from './incrementalOrderBlocks.js';
import {detectOrderBlocks} from './orderBlockDetection.js';
import {isCandleAppend} from './candleAppend.js';

// Lauf-lokal: begrenzte Präfix-Snapshots erlauben interleavte DRs ohne Zeitumordnung.
// Korrekturen verwerfen sie; alte Rücksprünge außerhalb des Caches nutzen den Volllauf.
export function createSharedOrderBlockDetector(timeframe,isForex=true,minGapOverride=null){
  const advance=createIncrementalOrderBlockDetector(timeframe,isForex,minGapOverride),snapshots=new Map();
  let previous=[];
  return function detectSharedOrderBlocks(candles){
    const append=isCandleAppend(previous,candles),earlier=!append&&isCandleAppend(candles,previous);
    if(!append&&!earlier)snapshots.clear();
    let zones=snapshots.get(candles.length);
    if(!zones){
      zones=earlier?detectOrderBlocks(candles,timeframe,isForex,minGapOverride):advance(candles);
      if(!earlier)previous=candles.map(c=>({...c}));
      if(snapshots.size>=8)snapshots.delete(snapshots.keys().next().value);
      snapshots.set(candles.length,zones);
    }
    return zones.map(z=>({...z}));
  };
}
