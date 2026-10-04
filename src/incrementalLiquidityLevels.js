import {detectLiquidityLevels,confirmedLiquidityLevels,advanceLiquidityTouches} from './liquidityDetection.js';

export function createIncrementalLiquidityDetector(period) {
  if(!Number.isInteger(period) || period<1)return rows=>detectLiquidityLevels(rows,period);
  let previous=[],usable=[],levels={highs:[],lows:[]},active=[];
  return function detectIncrementalLiquidityLevels(rows) {
    // Nur diese Felder beeinflussen Fraktale und Berührungen. Wertkopien erkennen
    // auch Korrekturen am selben Array; ein Rücksprung baut den Zustand neu auf.
    const append=previous.length<=rows.length && previous.every((c,i)=>
      Object.is(c.time,rows[i].time) && Object.is(c.high,rows[i].high)
      && Object.is(c.low,rows[i].low) && Object.is(c.ignored,rows[i].ignored));
    if(!append || !previous.length){
      usable=rows.filter(c=>!c.ignored);
      levels=detectLiquidityLevels(usable,period);
      active=[...levels.highs,...levels.lows].filter(l=>!l.touched);
    }else for(let i=previous.length;i<rows.length;i++){
      const candle=rows[i];
      if(candle.ignored)continue;
      advanceLiquidityTouches(active,candle);
      active=active.filter(l=>!l.touched);
      usable.push(candle);
      const confirmed=confirmedLiquidityLevels(usable,usable.length-1-period,period);
      levels.highs.push(...confirmed.highs);levels.lows.push(...confirmed.lows);
      active.push(...confirmed.highs.filter(l=>!l.touched),...confirmed.lows.filter(l=>!l.touched));
    }
    const added=rows.slice(append ? previous.length : 0)
      .map(({time,high,low,ignored})=>({time,high,low,ignored}));
    if(!append || !previous.length)previous=added;
    else if(added.length)previous=previous.concat(added);
    return {highs:levels.highs.map(l=>({...l})),lows:levels.lows.map(l=>({...l}))};
  };
}
