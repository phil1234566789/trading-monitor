import {confirmedM1Fvg,m1FvgBounds} from './m1FairValueGap.js';
import {closedChecklistCandles} from './tradeSetupChecklistTimeBasis.js';
import {detectOrderBlocks,candleTouchesOrderBlock} from './orderBlockDetection.js';
export const M1_FVG_MIN_RETEST_FRACTION=.5;

function qualifiedFvgRetest(candle,fvg) {
  if(!candleTouchesOrderBlock(candle,fvg))return false;
  const height=fvg.top-fvg.bottom;
  const level=fvg.direction==='short'?fvg.bottom+height*M1_FVG_MIN_RETEST_FRACTION
    :fvg.top-height*M1_FVG_MIN_RETEST_FRACTION;
  const tolerance=Number.EPSILON*Math.max(Math.abs(fvg.top),Math.abs(fvg.bottom),1)*8;
  const half=fvg.direction==='short'?candle.high+tolerance>=level:candle.low-tolerance<=level;
  const full=fvg.direction==='short'?candle.high+tolerance>=fvg.top:candle.low-tolerance<=fvg.bottom;
  // Voll gefüllte FVGs brauchen den zugehörigen OB derselben Entstehung, keinen beliebigen Nachbarn.
  if(half && full && !fvg.orderBlock)return null;
  return half && (!full || candleTouchesOrderBlock(candle,fvg.orderBlock));
}

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

export function m1FvgDraftPrefill(result,armed,trade,symbol) {
  const target=result?.target;
  if(result?.status!=='ready'||!armed||!trade||!target
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
  const ready=c=>({status:'ready',entryTime:c.time+60,entryPrice:c.close,
    confirmationCandleTime:c.time,fvg:selected,variant});
  if(variant==='immediate')return ready(rows.find(c=>c.time===selected.confirmationCandleTime));
  if(variant!=='retestReaction')return {status:'unknown',reason:'Unbekannte Entry-Variante.'};
  let retest=null,next=selected.recognizedAt;
  for(const c of rows){
    if(c.time<selected.recognizedAt)continue;
    if(c.time!==next)return {status:'unknown',reason:'M1-Historie zwischen FVG und Reaktion ist lückenhaft.'};
    next+=60;
    if(c.ignored)continue;
    if(!retest){
      const qualified=qualifiedFvgRetest(c,selected);
      if(qualified===null)return {status:'unknown',reason:'Vollständige FVG-Füllung: Der zugehörige M1-OB ist aus dem Vierkerzen-Vorlauf nicht belegt.'};
      if(qualified)retest=c;
      continue;
    }
    if(selected.direction==='short'?c.close<c.open:c.close>c.open)
      return {...ready(c),retestCandleTime:retest.time};
  }
  return {status:'pending',reason:retest?'Zusätzliche Richtungskerze nach dem Retest ist noch nicht geschlossen.'
    :'Die bestätigte FVG wurde am gewählten Stand noch nicht mindestens 50 % retestet (bei vollständiger Füllung ist derselbe Kerzenkontakt mit dem zugehörigen M1-OB erforderlich).'};
}
