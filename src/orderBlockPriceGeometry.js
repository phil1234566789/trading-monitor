export function measureOrderBlockPriceGeometry(first,second,dir) {
 if(![-1,1].includes(dir)||![first?.top,first?.bottom,second?.top,second?.bottom].every(Number.isFinite)
  ||first.top<=first.bottom||second.top<=second.bottom)return null;
 const meanOBWidth=((first.top-first.bottom)+(second.top-second.bottom))/2;
 const signedZoneGap=dir===1?second.bottom-first.top:first.bottom-second.top;
 const positiveZoneGap=Math.max(0,signedZoneGap);
 const midpointDistance=Math.abs((second.top+second.bottom-first.top-first.bottom)/2);
 return {signedZoneGap,positiveZoneGap,
  overlapWidth:Math.max(0,Math.min(first.top,second.top)-Math.max(first.bottom,second.bottom)),
  midpointDistance,directedTopShift:dir*(second.top-first.top),directedBottomShift:dir*(second.bottom-first.bottom),meanOBWidth,
  positiveGapInMeanWidths:positiveZoneGap/meanOBWidth,midpointInMeanWidths:midpointDistance/meanOBWidth};
}
