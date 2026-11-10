export function m1FvgBounds(direction,gap,confirmation) {
  const bottom=direction==='short'?confirmation.high:confirmation.low-gap;
  return {bottom,top:bottom+gap};
}

export function confirmedM1Fvg(rows,direction,end=rows.length) {
  if(!['short','long'].includes(direction))return null;
  const window=rows.slice(Math.max(0,end-3),end);
  if(window.length!==3 || window.some((c,i)=>c.ignored || ![c.time,c.high,c.low,c.close].every(Number.isFinite)
    || (i && c.time!==window[i-1].time+60)))return null;
  const [first,impulse,last]=window;
  const gap=direction==='short'?first.low-last.high:last.low-first.high;
  return gap>1e-9 ? {direction,candleTime:impulse.time,recognizedAt:last.time+60,gap} : null;
}
