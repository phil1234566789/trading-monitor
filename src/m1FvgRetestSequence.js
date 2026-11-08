import { orderBlockMitigationFvg,m1FvgBounds } from './orderBlockMitigation.js';
import { candleTouchesOrderBlock } from './orderBlockDetection.js';
import { closedChecklistCandles } from './tradeSetupChecklistTimeBasis.js';

export const M1_FVG_RETEST_PATTERN_VERSION='m1-structure-fvg-retest-v1';

// Gleicher positiver Gap-Schwellwert wie der bestehende FVG-Auflöser; kein XAU-Sonderfilter.
export function evaluateM1FvgRetestSequence({candles,direction,structureKnownAt,orderBlockRetestKnownAt,evaluatedAt}) {
  const result={status:'unknown',zone:null,retest:null,confirmation:null};
  if(!['short','long'].includes(direction) || !Number.isFinite(structureKnownAt)
    || !Number.isFinite(orderBlockRetestKnownAt) || structureKnownAt<orderBlockRetestKnownAt
    || structureKnownAt>evaluatedAt)return result;
  const rows=closedChecklistCandles(candles,'1m',evaluatedAt);
  if(!rows.some(c=>c.time+60===structureKnownAt))return result;
  result.status='ready';
  for(let i=0;i<rows.length;i++){
    const candle=rows[i];
    if(candle.time+60<structureKnownAt)continue;
    if(i && candle.time!==rows[i-1].time+60){result.status='unknown';return result;}
    const fvg=orderBlockMitigationFvg(rows,direction,i+1);
    if(!result.zone && fvg && fvg.recognizedAt>=structureKnownAt){
      result.zone={...fvg,...m1FvgBounds(direction,fvg.gap,candle)};
    }
    // Die FVG muss vor Kerzenbeginn bekannt sein; Kontakt inkl. Wick-Überlauf zählt.
    if(result.zone && !result.retest && !candle.ignored && candle.time>=result.zone.recognizedAt
      && candleTouchesOrderBlock(candle,result.zone))
      result.retest={candleTime:candle.time,recognizedAt:candle.time+60};
    // Eine schon vor dem Retest bekannte FVG darf keine neue Bestätigung werden.
    if(result.retest && fvg && fvg.recognizedAt>result.retest.recognizedAt){
      result.confirmation=fvg;return result;
    }
  }
  return result;
}
