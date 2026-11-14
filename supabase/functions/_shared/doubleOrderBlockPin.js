export const DOB_PIN_CONTEXT_VERSION='double-order-block-pin-v1';
const positive=value=>Number.isFinite(value)&&value>0;
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const time=value=>Number.isSafeInteger(value)&&value>0;
export const cloneDoubleOrderBlockContext=value=>JSON.parse(JSON.stringify(value));

/** @param {any} pair */
export function assertDoubleOrderBlockPair(pair) {
  const sign=pair?.direction==='long'?1:pair?.direction==='short'?-1:0;
  const first=pair?.firstOrderBlock,second=pair?.secondOrderBlock;
  if(!sign||!['XAUUSD','GBPUSD','EURUSD'].includes(pair?.instrument)||!first||!second
    ||[first,second].some(ob=>ob.timeframe!=='5M'||ob.dir!==sign||!Number.isSafeInteger(ob.startTime)||ob.startTime<=0||!positive(ob.top)||!positive(ob.bottom)||ob.top<=ob.bottom)
    ||first.startTime>=second.startTime||(second.top-first.top)*sign<=0||(second.bottom-first.bottom)*sign<=0) {
    throw new Error('Ungültiges DOB-Paar: Beide M5-OBs müssen zur Richtung und zum Orderflow passen.');
  }
  return pair;
}

/** @param {any} snapshot @param {boolean} [requireIds] */
export function assertDoubleOrderBlockPin(snapshot,requireIds=false) {
  const pair=assertDoubleOrderBlockPair(snapshot?.pair);
  const serialized=JSON.stringify(snapshot);
  const expected=`dob:${pair.instrument}:${pair.direction==='long'?1:-1}:${pair.firstOrderBlock.startTime}:${pair.secondOrderBlock.startTime}`;
  if(snapshot?.contextVersion!==DOB_PIN_CONTEXT_VERSION||pair.id!==expected
    ||!time(snapshot.evaluatedAt)||!time(pair.recognizedAt)||pair.recognizedAt<=pair.secondOrderBlock.startTime||pair.recognizedAt>snapshot.evaluatedAt
    ||typeof snapshot.engineVersion!=='string'||!snapshot.engineVersion||snapshot.engineVersion.length>128
    ||snapshot.view?.symbol!==pair.instrument||typeof snapshot.view?.bar!=='string'||snapshot.view.bar.length<1||snapshot.view.bar.length>8
    ||!object(snapshot.coverage?.m5)||!object(snapshot.coverage?.m1)||!object(pair.entries)||new TextEncoder().encode(serialized).length>65536||serialized.includes('\\u0000')
    ||[pair.firstOrderBlock,pair.secondOrderBlock].some(ob=>ob.timeframe!=='5M'||(ob.obZoneId!=null&&(!Number.isSafeInteger(ob.obZoneId)||ob.obZoneId<=0)))
    ||[snapshot.coverage.m5,snapshot.coverage.m1].some(c=>!time(c.from)||!time(c.through)||c.through<c.from||c.through>snapshot.evaluatedAt||!Number.isSafeInteger(c.count)||c.count<1)) {
    throw new Error('DOB-Pin-Kontext ist unvollständig oder passt nicht zum sichtbaren Auswertungsstand.');
  }
  if(requireIds&&[pair.firstOrderBlock,pair.secondOrderBlock].some(ob=>!Number.isSafeInteger(ob.obZoneId)||ob.obZoneId<=0)) {
    throw new Error('Beide DOB-Orderblocks müssen vor dem Pinnen aufgelöst sein.');
  }
  return snapshot;
}

