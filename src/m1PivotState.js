import { initMarketStructureState,applyMarketStructurePivot,collectNestedChain } from './marketStructureAnalysis';
import { withCandleCloseWindow } from './candleCloseWindow';

// Nur M1 initialisiert per Dochtbruch. Spätere bestätigte P5-Pivots verwenden
// den bestehenden Strukturkern; M5/H1 erhalten dadurch keine neue Bruchregel.
export function buildM1PivotState(pivots,candles,fact,evaluatedAt) {
  const short=fact.direction==='short';
  const origin=pivots.find(p=>p.pivotTime===fact.originTime);
  const level=pivots.find(p=>p.pivotTime===fact.pivotTime);
  const pullback=pivots.find(p=>p.pivotTime===fact.pullbackTime);
  const candle=candles.find(c=>c.time===fact.candleTime);
  const breach={type:short?'low':'high',price:short?candle.low:candle.high,
    pivotTime:candle.time,pivotAt:String(candle.time),recognizedAt:fact.recognizedAt};
  let state={...initMarketStructureState(origin,level),trend:short?'downtrend':'uptrend',
    currRange:short?{high:origin,low:breach}:{low:origin,high:breach},
    structurePivots:[{...pullback,type:short?'protected-high':'protected-low'}],
    appliedPivots:[origin,level,pullback,breach],firstConfirmedAt:breach};
  const events=[{pivot:pullback,at:fact.recognizedAt,trend:state.trend,pre:false,reason:'Pivotbruch',level:fact.price}];
  const phases=[{trend:state.trend,pre:false,from:fact.recognizedAt,to:evaluatedAt}];
  withCandleCloseWindow(candles,()=>{
    for(const pivot of pivots.filter(p=>p.pivotTime>fact.pullbackTime && p.pivotTime!==fact.candleTime)
      .sort((a,b)=>a.recognizedAt-b.recognizedAt)) {
      const at=Math.max(fact.recognizedAt,pivot.recognizedAt);
      state=applyMarketStructurePivot(state,pivot,{candles,direction:state.trend==='downtrend'?'down':'up',asOfTime:at});
      const inner=collectNestedChain(state).at(-1),last=phases.at(-1);
      if(inner.trend==='unknown' || inner.trend===last.trend)continue;
      last.to=at;
      phases.push({trend:inner.trend,pre:false,from:at,to:evaluatedAt});
      events.push({pivot,at,trend:inner.trend,pre:false,reason:'Trendwechsel'});
    }
  });
  return {state,events,phases:phases.filter(p=>p.from<p.to)};
}
