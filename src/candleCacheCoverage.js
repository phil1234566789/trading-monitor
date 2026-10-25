// Ein späterer Abruf beweist nichts über die Lücke vor seinem ersten Balken.
export function addCandleCoverage(ranges,from,to,barSeconds) {
  if(!Number.isFinite(from)||!Number.isFinite(to)||to<from)return ranges;
  const merged=[];
  for(const range of [...ranges,{from,to}].sort((a,b)=>a.from-b.from)) {
    const last=merged.at(-1);
    if(last&&range.from<=last.to+barSeconds)last.to=Math.max(last.to,range.to);
    else merged.push({...range});
  }
  return merged;
}

export function candleCoverageAt(ranges,at) {
  return ranges.find(range=>range.from<=at&&range.to>=at);
}
