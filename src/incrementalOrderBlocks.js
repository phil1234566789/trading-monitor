import { orderBlockState,advanceOrderBlocks,orderBlockSnapshot } from "./orderBlockDetection.js";
import { isCandleAppend } from "./candleAppend.js";

// Derselbe Kerzenschritt wie im Volllauf; Korrekturen/Replay-Rücksprünge setzen zurück.
// Retest wird aus dem aktuellen Präfix abgeleitet, nie aus einem späteren Endzustand.
export function createIncrementalOrderBlockDetector(timeframe,isForex=true,minGapOverride=null) {
  let previous=[],state=orderBlockState(timeframe,isForex,minGapOverride);
  return function detectIncrementalOrderBlocks(candles){
    const append=isCandleAppend(previous,candles);
    if(!append)state=orderBlockState(timeframe,isForex,minGapOverride);
    advanceOrderBlocks(candles,state,append?previous.length:3);
    previous=candles.map(c=>({...c}));
    return orderBlockSnapshot(candles,state);
  };
}
