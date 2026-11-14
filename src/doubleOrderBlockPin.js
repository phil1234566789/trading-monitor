import {DOB_PIN_CONTEXT_VERSION,assertDoubleOrderBlockPin,cloneDoubleOrderBlockContext} from '../supabase/functions/_shared/doubleOrderBlockPin.js';
import {DOUBLE_ORDER_BLOCK_VERSION,doubleOrderBlockDisplay} from './doubleOrderBlocks.js';

export function doubleOrderBlockPinSnapshot(pair,{symbol,currentBar,replayUntil,evaluatedAt,coverage,visibleRange}) {
  return assertDoubleOrderBlockPin({contextVersion:DOB_PIN_CONTEXT_VERSION,engineVersion:DOUBLE_ORDER_BLOCK_VERSION,
    pair:cloneDoubleOrderBlockContext(pair),evaluatedAt,capturedAt:Math.floor(Date.now()/1000),
    view:{symbol,bar:currentBar,replayUntil:replayUntil??null,visibleRange:visibleRange??null},
    coverage:cloneDoubleOrderBlockContext(coverage),display:doubleOrderBlockDisplay(pair,evaluatedAt)});
}

export function doubleOrderBlockPinLabel(snapshot) {
  const p=snapshot.pair;
  return `DOB ${p.direction==='long'?'Long':'Short'} · ${p.instrument}`;
}

export function collectDoubleOrderBlockPins(items,x,y,context,radius=40) {
  const found=new Map();
  for(const item of items) {
    const distance=item.primitive.distanceTo(x,y);
    if(distance>radius)continue;
    for(const pair of item.pairs??[item.pair]) {
      if(found.has(pair.id)&&found.get(pair.id).distance<=distance)continue;
      const saved=context.pinnedSnapshots?.find(p=>p.pair.id===pair.id);
      found.set(pair.id,{kind:'double_order_block',dobContext:saved??doubleOrderBlockPinSnapshot(pair,context),distance});
    }
  }
  return [...found.values()];
}
