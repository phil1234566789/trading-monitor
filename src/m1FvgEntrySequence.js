import {candleTouchesOrderBlock,candleInvalidatesOrderBlock} from './orderBlockDetection.js';
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

export function m1FvgEntrySequence(fvg,variant) {
  const state={fvg,variant,next:fvg.recognizedAt,retest:null,result:null};
  if(variant==='immediate')state.result=readyFvgEntry(state,{time:fvg.confirmationCandleTime,close:fvg.confirmationPrice});
  else if(variant!=='retestReaction')state.result={status:'unknown',reason:'Unbekannte Entry-Variante.'};
  return state;
}
function readyFvgEntry(state,candle) {
  return {status:'ready',entryTime:candle.time+60,entryPrice:candle.close,
    confirmationCandleTime:candle.time,fvg:state.fvg,variant:state.variant,
    ...(state.retest?{retestCandleTime:state.retest.time}:{})};
}
export function advanceM1FvgEntrySequence(state,candle) {
  if(state.result || candle.time<state.fvg.recognizedAt)return;
  if(candle.time!==state.next){state.result={status:'unknown',reason:'M1-Historie zwischen FVG und Reaktion ist lückenhaft.'};return;}
  state.next+=60;
  if(candle.ignored)return;
  // Ein gebrochener Ursprungs-OB kann keine spätere Reaktionskerze mehr bestätigen.
  if(state.fvg.orderBlock && candleInvalidatesOrderBlock(candle,state.fvg.orderBlock)){
    state.result={status:'invalid',reason:'Der zugehörige M1-OB wurde vor dem Entry durch einen Docht gebrochen.'};return;
  }
  if(!state.retest){
    const qualified=qualifiedFvgRetest(candle,state.fvg);
    if(qualified===null)state.result={status:'unknown',reason:'Vollständige FVG-Füllung: Der zugehörige M1-OB ist aus dem Vierkerzen-Vorlauf nicht belegt.'};
    else if(qualified)state.retest=candle;
    return;
  }
  if(state.fvg.direction==='short'?candle.close<candle.open:candle.close>candle.open)state.result=readyFvgEntry(state,candle);
}
export function m1FvgSequenceResult(state) {
  return state.result ?? {status:'pending',reason:state.retest?'Zusätzliche Richtungskerze nach dem Retest ist noch nicht geschlossen.'
    :'Die bestätigte FVG wurde am gewählten Stand noch nicht mindestens 50 % retestet (bei vollständiger Füllung ist derselbe Kerzenkontakt mit dem zugehörigen M1-OB erforderlich).'};
}
