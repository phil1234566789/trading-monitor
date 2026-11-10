import {confirmedM1Fvg,m1FvgBounds} from './m1FairValueGap.js';
import {closedChecklistCandles} from './tradeSetupChecklistTimeBasis.js';
import {detectOrderBlocks} from './orderBlockDetection.js';
export {M1_FVG_MIN_RETEST_FRACTION} from './m1FvgEntrySequence.js';
import {m1FvgEntrySequence,advanceM1FvgEntrySequence,m1FvgSequenceResult} from './m1FvgEntrySequence.js';

export function m1FvgEntryCandidates(candles,evaluatedAt,direction) {
  const rows=closedChecklistCandles(candles,'1m',evaluatedAt),result=[];
  const directions=direction?[direction]:['long','short'];
  for(let end=3;end<=rows.length;end++)for(const side of directions){
    const fvg=confirmedM1Fvg(rows,side,end);
    const formation=rows.slice(end-4,end);
    const contiguous=formation.length===4 && formation.every((c,i)=>!c.ignored && (!i||c.time===formation[i-1].time+60));
    const orderBlock=fvg && contiguous ? detectOrderBlocks(formation,'1m',true)
      .find(z=>z.startTime===fvg.candleTime && z.dir===(side==='long'?1:-1)) ?? null : null;
    if(fvg)result.push({...fvg,...m1FvgBounds(side,fvg.gap,rows[end-1]),
      confirmationCandleTime:rows[end-1].time,confirmationPrice:rows[end-1].close,
      orderBlock:orderBlock?{...orderBlock,recognizedAt:fvg.recognizedAt,timeframe:'1M'}:null});
  }
  return result;
}

export function matchM1FvgEntryCandidate(candidates,candles,time,price) {
  const candle=candles.find(c=>c.time===time);
  if(!candle || !Number.isFinite(price) || price<candle.low || price>candle.high)return null;
  return candidates.find(fvg=>fvg.candleTime===time) ?? null;
}

export function m1FvgCardPrefill(result,armed,trade,symbol) {
  const target=result?.target;
  if(result?.status!=='ready'||!armed||!trade||!target
    ||typeof target.cardKey!=='string'||target.cardKey!==armed.cardKey||target.cardKey!==trade.cardKey
    ||target.draftToken!==armed.draftToken||target.id!==trade.id
    ||target.dealingRangeId!==trade.dealingRangeId||target.instrument!==trade.instrument
    ||target.direction!==trade.direction||symbol!==trade.instrument
    ||![result.entryTime,result.entryPrice].every(Number.isFinite)||result.entryPrice<=0)return null;
  return {entryTime:result.entryTime,entryPrice:result.entryPrice};
}

// Nur ein Formularvorschlag: keine Strategie-Gates, Stop-/Exit-Werte oder Journal-Schreibzugriffe.
export function m1FvgEntryPrefill({candles,fvg,evaluatedAt,variant='immediate'}) {
  const rows=closedChecklistCandles(candles,'1m',evaluatedAt);
  const selected=m1FvgEntryCandidates(rows,evaluatedAt,fvg?.direction)
    .find(item=>item.candleTime===fvg?.candleTime && item.recognizedAt===fvg?.recognizedAt);
  if(!selected)return {status:'unknown',reason:'FVG ist am gewählten Stand nicht bestätigt.'};
  const sequence=m1FvgEntrySequence(selected,variant);
  for(const candle of rows){advanceM1FvgEntrySequence(sequence,candle);if(sequence.result)break;}
  return m1FvgSequenceResult(sequence);
}
